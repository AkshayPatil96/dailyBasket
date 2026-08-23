import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  TokenService,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from '../token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  const accessPayload: AccessTokenPayload = {
    sub: 'user-1',
    role: 'CUSTOMER',
    sessionId: 'session-1',
  };
  const refreshPayload: RefreshTokenPayload = {
    sub: 'user-1',
    sessionId: 'session-1',
    jti: 'jti-1',
  };

  beforeEach(async () => {
    jwtService = { sign: jest.fn(), verify: jest.fn() };
    configService = { get: jest.fn(), getOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  describe('signAccessToken', () => {
    it('signs with jwt.secret and configured expiry', () => {
      configService.getOrThrow.mockReturnValue('access-secret');
      configService.get.mockReturnValue('20m');
      jwtService.sign.mockReturnValue('signed-access');

      const result = service.signAccessToken(accessPayload);

      expect(result).toBe('signed-access');
      expect(jwtService.sign).toHaveBeenCalledWith(accessPayload, {
        secret: 'access-secret',
        expiresIn: '20m',
      });
      expect(configService.getOrThrow).toHaveBeenCalledWith('jwt.secret');
      expect(configService.get).toHaveBeenCalledWith('jwt.accessExpiresIn');
    });

    it('falls back to 15m when accessExpiresIn is unset', () => {
      configService.getOrThrow.mockReturnValue('access-secret');
      configService.get.mockReturnValue(undefined);
      jwtService.sign.mockReturnValue('signed-access');

      service.signAccessToken(accessPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        accessPayload,
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });
  });

  describe('signRefreshToken', () => {
    it('signs with jwt.refreshSecret and configured expiry', () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');
      configService.get.mockReturnValue('45d');
      jwtService.sign.mockReturnValue('signed-refresh');

      const result = service.signRefreshToken(refreshPayload);

      expect(result).toBe('signed-refresh');
      expect(jwtService.sign).toHaveBeenCalledWith(refreshPayload, {
        secret: 'refresh-secret',
        expiresIn: '45d',
      });
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'jwt.refreshSecret',
      );
    });

    it('falls back to 30d when refreshExpiresIn is unset', () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');
      configService.get.mockReturnValue(undefined);
      jwtService.sign.mockReturnValue('signed-refresh');

      service.signRefreshToken(refreshPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        refreshPayload,
        expect.objectContaining({ expiresIn: '30d' }),
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies with jwt.refreshSecret and returns the payload', () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');
      jwtService.verify.mockReturnValue(refreshPayload);

      const result = service.verifyRefreshToken('raw-token');

      expect(result).toEqual(refreshPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('raw-token', {
        secret: 'refresh-secret',
      });
    });

    it('propagates verification errors (expired/invalid/wrong secret)', () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => service.verifyRefreshToken('bad-token')).toThrow(
        'jwt expired',
      );
    });
  });
});
