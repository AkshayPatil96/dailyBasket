import { randomBytes, createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
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
        passwordHash
      }
    });

    await this.issueEmailVerificationToken(user.id, user.email, user.firstName);

    return toSafeUser(user);
  }

  async login(dto: LoginDto, userAgent: string): Promise<{ user: ReturnType<typeof toSafeUser>; tokens: SessionTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
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

    const { sessionId, jti } = await this.sessionService.createSession(user.id, userAgent);
    const tokens: SessionTokens = {
      accessToken: this.tokenService.signAccessToken({ sub: user.id, role: user.role, sessionId }),
      refreshToken: this.tokenService.signRefreshToken({ sub: user.id, sessionId, jti })
    };

    return { user: toSafeUser(user), tokens };
  }

  async refresh(refreshToken: string, userAgent: string): Promise<SessionTokens> {
    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const result = await this.sessionService.rotate(payload.sessionId, payload.jti);
    if (result.status === 'reused') {
      throw new UnauthorizedException('Session revoked — please log in again');
    }
    if (result.status === 'invalid') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      await this.sessionService.revoke(payload.sessionId, result.userId);
      throw new UnauthorizedException('Account is no longer active');
    }

    void userAgent;

    return {
      accessToken: this.tokenService.signAccessToken({ sub: user.id, role: user.role, sessionId: payload.sessionId }),
      refreshToken: this.tokenService.signRefreshToken({ sub: user.id, sessionId: payload.sessionId, jti: result.newJti })
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

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } })
    ]);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt && !user.deletedAt) {
      await this.issueEmailVerificationToken(user.id, user.email, user.firstName);
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
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS)
        }
      });
      const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;
      await this.emailService.sendPasswordResetEmail(user.email, user.firstName, resetUrl);
    }
    // Always resolves the same way regardless of match, to avoid leaking which emails are registered.
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } })
    ]);

    // Password change invalidates every existing session (doc: high-risk event -> revoke everywhere).
    await this.sessionService.revokeAllForUser(record.userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.sessionService.revokeAllForUser(userId);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED', deletedAt: new Date() } });
    await this.sessionService.revokeAllForUser(userId);
  }

  private async issueEmailVerificationToken(userId: string, email: string, firstName: string): Promise<void> {
    const rawToken = generateToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)
      }
    });
    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${rawToken}`;
    await this.emailService.sendVerificationEmail(email, firstName, verifyUrl);
  }
}
