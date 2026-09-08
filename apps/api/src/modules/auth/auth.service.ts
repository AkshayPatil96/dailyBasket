import { randomBytes, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { OrdersService } from '../orders/orders.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_VERIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between sends per user
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const generateToken = () => randomBytes(32).toString('hex');

const toSafeUser = <T extends { passwordHash: string }>(user: T) => {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
};

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  // Best-effort — a guest order never creating a durable account link is a
  // gap, not a correctness issue, so a failure here must never block
  // register/login itself.
  private async linkGuestOrders(userId: string, email: string): Promise<void> {
    try {
      await this.ordersService.linkGuestOrders(userId, email);
    } catch (error) {
      this.logger.warn(`Failed linking guest orders for ${userId}: ${error}`);
    }
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    await this.issueEmailVerificationToken(user.id, user.email, user.firstName);
    // Guest orders are NOT linked here — the email isn't proven to belong to
    // this caller yet. Linking now would let anyone claim a stranger's guest
    // order history (address, phone, order contents) just by registering
    // with their email. Linked instead once ownership is proven: on
    // verifyEmail() for a brand-new account, or on login() for an
    // already-verified one (see linkGuestOrders callers).

    return toSafeUser(user);
  }

  async login(
    dto: LoginDto,
    userAgent: string,
  ): Promise<{ user: Omit<User, 'passwordHash'>; tokens: SessionTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('This account is not active');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Gated on emailVerifiedAt, not just a successful password check —
    // login isn't itself gated on verification in this app, so right after
    // register() an attacker could otherwise log into an account created
    // with a stranger's (unverified) email and immediately inherit their
    // guest order history. A verified email is what actually proves this
    // account owns that inbox.
    if (user.emailVerifiedAt) {
      await this.linkGuestOrders(user.id, user.email);
    }

    const { sessionId, jti } = await this.sessionService.createSession(
      user.id,
      userAgent,
    );
    const tokens: SessionTokens = {
      accessToken: this.tokenService.signAccessToken({
        sub: user.id,
        role: user.role,
        sessionId,
      }),
      refreshToken: this.tokenService.signRefreshToken({
        sub: user.id,
        sessionId,
        jti,
      }),
    };

    return { user: toSafeUser(user), tokens };
  }

  async refresh(
    refreshToken: string,
    userAgent: string,
  ): Promise<SessionTokens> {
    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const result = await this.sessionService.rotate(
      payload.sessionId,
      payload.jti,
    );
    if (result.status === 'reused') {
      throw new UnauthorizedException('Session revoked — please log in again');
    }
    if (result.status === 'invalid') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: result.userId },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.sessionService.revoke(payload.sessionId, result.userId);
      throw new UnauthorizedException('Account is no longer active');
    }

    void userAgent;

    return {
      accessToken: this.tokenService.signAccessToken({
        sub: user.id,
        role: user.role,
        sessionId: payload.sessionId,
      }),
      refreshToken: this.tokenService.signRefreshToken({
        sub: user.id,
        sessionId: payload.sessionId,
        jti: result.newJti,
      }),
    };
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.sessionService.revoke(sessionId, userId);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.revokeAllForUser(userId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return toSafeUser(user);
  }

  async updateProfile(
    userId: string,
    dto: { firstName?: string; lastName?: string; phone?: string },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      },
    });
    return toSafeUser(user);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'This verification link is invalid or has expired',
      );
    }

    const [, user] = await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    // Email ownership is proven now — safe to link any guest orders placed
    // under this address (see the register()/login() comments on why this
    // can't happen any earlier).
    await this.linkGuestOrders(user.id, user.email);
  }

  async resendVerification(email: string): Promise<string | void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt && !user.deletedAt) {
      const lastToken = await this.prisma.emailVerificationToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      const cooledDown =
        !lastToken ||
        Date.now() - lastToken.createdAt.getTime() >=
          RESEND_VERIFICATION_COOLDOWN_MS;
      // Silently skips instead of throwing — the response must stay identical
      // to the "not found"/"already verified" cases below, or a rapid
      // double-click would leak "this email exists" via a different error.
      if (cooledDown) {
        return await this.issueEmailVerificationToken(
          user.id,
          user.email,
          user.firstName,
        );
      }
    }
    // Always resolves the same way regardless of match, to avoid leaking which emails are registered.
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const rawToken = generateToken();
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      const resetUrl = `${this.configService.getOrThrow<string>('app.appUrl')}/reset-password?token=${rawToken}`;
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetUrl,
      );
    }
    // Always resolves the same way regardless of match, to avoid leaking which emails are registered.
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    ]);

    // Password change invalidates every existing session (doc: high-risk event -> revoke everywhere).
    await this.sessionService.revokeAllForUser(record.userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.sessionService.revokeAllForUser(userId);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DEACTIVATED', deletedAt: new Date() },
    });
    await this.sessionService.revokeAllForUser(userId);
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
    firstName: string,
  ): Promise<string | void> {
    const rawToken = generateToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });
    const verifyUrl = `${this.configService.getOrThrow<string>('app.appUrl')}/verify-email?token=${rawToken}`;
    await this.emailService.sendVerificationEmail(email, firstName, verifyUrl);

    const env = this.configService.getOrThrow<string>('app.nodeEnv');
    if (env === 'development' || env === 'test') {
      return verifyUrl;
    }
  }
}
