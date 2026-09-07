import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../notifications/email.service';
import { OrdersService } from '../../orders/orders.service';
import { SessionService } from '../session.service';
import { TokenService } from '../token.service';
import { ConfigService } from '@nestjs/config';
import type { RegisterDto } from '../dto/register.dto';
import type { LoginDto } from '../dto/login.dto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    emailVerificationToken: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let sessionService: {
    createSession: jest.Mock;
    rotate: jest.Mock;
    revoke: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let tokenService: {
    signAccessToken: jest.Mock;
    signRefreshToken: jest.Mock;
    verifyRefreshToken: jest.Mock;
  };
  let emailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let configService: { getOrThrow: jest.Mock };
  let ordersService: { linkGuestOrders: jest.Mock };

  const baseUser = {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: null,
    passwordHash: 'hashed-password',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    emailVerifiedAt: null,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      emailVerificationToken: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    sessionService = {
      createSession: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    tokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    emailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://app.local'),
    };
    ordersService = {
      linkGuestOrders: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      sessionService as unknown as SessionService,
      tokenService as unknown as TokenService,
      emailService as unknown as EmailService,
      configService as unknown as ConfigService,
      ordersService as unknown as OrdersService,
    );
  });

  describe('register', () => {
    const dto: RegisterDto = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'super-secret',
    };

    it('rejects when the email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password, creates the user, and issues a verification email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(baseUser);
      prisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('super-secret', 12);
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        baseUser.email,
        baseUser.firstName,
        expect.stringContaining('verify-email?token='),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    const dto: LoginDto = { email: 'ada@example.com', password: 'secret' };

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto, 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a soft-deleted account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });

      await expect(service.login(dto, 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a non-active account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        status: 'DEACTIVATED',
      });

      await expect(service.login(dto, 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto, 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('creates a session and returns tokens on success', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      sessionService.createSession.mockResolvedValue({
        sessionId: 'session-1',
        jti: 'jti-1',
      });
      tokenService.signAccessToken.mockReturnValue('access-token');
      tokenService.signRefreshToken.mockReturnValue('refresh-token');

      const result = await service.login(dto, 'jest-agent');

      expect(sessionService.createSession).toHaveBeenCalledWith(
        'user-1',
        'jest-agent',
      );
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('refresh', () => {
    it('rejects a token that fails verification', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(service.refresh('bad', 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the session reports reuse', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        sessionId: 'session-1',
        jti: 'jti-1',
      });
      sessionService.rotate.mockResolvedValue({
        status: 'reused',
        userId: 'user-1',
      });

      await expect(service.refresh('token', 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the session is invalid', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        sessionId: 'session-1',
        jti: 'jti-1',
      });
      sessionService.rotate.mockResolvedValue({ status: 'invalid' });

      await expect(service.refresh('token', 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('revokes the session and rejects when the user is no longer active', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        sessionId: 'session-1',
        jti: 'jti-1',
      });
      sessionService.rotate.mockResolvedValue({
        status: 'rotated',
        userId: 'user-1',
        newJti: 'jti-2',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token', 'jest')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(sessionService.revoke).toHaveBeenCalledWith('session-1', 'user-1');
    });

    it('issues a fresh token pair on a valid rotation', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        sessionId: 'session-1',
        jti: 'jti-1',
      });
      sessionService.rotate.mockResolvedValue({
        status: 'rotated',
        userId: 'user-1',
        newJti: 'jti-2',
      });
      prisma.user.findUnique.mockResolvedValue(baseUser);
      tokenService.signAccessToken.mockReturnValue('new-access');
      tokenService.signRefreshToken.mockReturnValue('new-refresh');

      const result = await service.refresh('token', 'jest');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
      expect(tokenService.signRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ jti: 'jti-2' }),
      );
    });
  });

  describe('logout / logoutAll', () => {
    it('revokes a single session', async () => {
      await service.logout('session-1', 'user-1');
      expect(sessionService.revoke).toHaveBeenCalledWith('session-1', 'user-1');
    });

    it('revokes every session for the user', async () => {
      await service.logoutAll('user-1');
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('me', () => {
    it('rejects when the account no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.me('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns the user without the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      const result = await service.me('user-1');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('verifyEmail', () => {
    it('rejects a missing token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail('token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an already-used token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.verifyEmail('token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an expired token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.verifyEmail('token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marks the token used and the user verified in one transaction', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      });
      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.verifyEmail('token');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('resendVerification', () => {
    it('does nothing when the email is unknown, already verified, or deleted', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.resendVerification('nobody@example.com');
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();

      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        emailVerifiedAt: new Date(),
      });
      await service.resendVerification(baseUser.email);
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('issues a new verification token for an unverified account', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
      prisma.emailVerificationToken.create.mockResolvedValue({});

      await service.resendVerification(baseUser.email);

      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('silently skips within the cooldown of the last sent token', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.emailVerificationToken.findFirst.mockResolvedValue({
        createdAt: new Date(),
      });

      await service.resendVerification(baseUser.email);

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('stays silent for an unknown email (no user enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.forgotPassword('nobody@example.com');
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('creates a reset token and sends the email for a known account', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.forgotPassword(baseUser.email);

      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        baseUser.email,
        baseUser.firstName,
        expect.stringContaining('reset-password?token='),
      );
    });
  });

  describe('resetPassword', () => {
    it('rejects a missing, used, or expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword('token', 'new-pass'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the password and revokes every session on success', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.resetPassword('token', 'new-pass');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('rejects when the account no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('user-1', 'old', 'new'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an incorrect current password', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrong', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the password hash and revokes every session', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      await service.changePassword('user-1', 'old', 'new');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hash' },
      });
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteAccount', () => {
    it('deactivates the account and revokes every session', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.deleteAccount('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'DEACTIVATED', deletedAt: expect.any(Date) },
      });
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
