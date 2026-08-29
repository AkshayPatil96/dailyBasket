import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session.service';
import { RedisService } from '../../../redis/redis.service';

describe('SessionService', () => {
  let service: SessionService;
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    sadd: jest.Mock;
    srem: jest.Mock;
    smembers: jest.Mock;
    expire: jest.Mock;
  };

  const record = (overrides: Partial<Record<string, unknown>> = {}) => ({
    userId: 'user-1',
    currentJti: 'jti-current',
    previousJti: null,
    userAgent: 'jest',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastUsedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(async () => {
    redis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: redis },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('30d') },
        },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  describe('createSession', () => {
    it('stores a session record and adds it to the user set', async () => {
      const { sessionId, jti } = await service.createSession('user-1', 'jest');

      expect(sessionId).toEqual(expect.any(String));
      expect(jti).toEqual(expect.any(String));
      expect(redis.set).toHaveBeenCalledWith(
        `refresh_session:${sessionId}`,
        expect.stringContaining('"userId":"user-1"'),
        'EX',
        2592000,
      );
      expect(redis.sadd).toHaveBeenCalledWith(
        'user_sessions:user-1',
        sessionId,
      );
      expect(redis.expire).toHaveBeenCalledWith(
        'user_sessions:user-1',
        2592000,
      );
    });
  });

  describe('rotate', () => {
    it('returns invalid when no session record exists', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.rotate('missing-session', 'any-jti');

      expect(result).toEqual({ status: 'invalid' });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('rotates and stores a new jti when the current jti matches', async () => {
      redis.get.mockResolvedValue(JSON.stringify(record()));

      const result = await service.rotate('session-1', 'jti-current');

      expect(result.status).toBe('rotated');
      if (result.status === 'rotated') {
        expect(result.userId).toBe('user-1');
        expect(result.newJti).toEqual(expect.any(String));
        expect(result.newJti).not.toBe('jti-current');
      }
      expect(redis.set).toHaveBeenCalledWith(
        'refresh_session:session-1',
        expect.stringContaining('"previousJti":"jti-current"'),
        'EX',
        2592000,
      );
    });

    it('revokes the session and reports reuse when the previous jti is presented', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify(record({ currentJti: 'jti-2', previousJti: 'jti-1' })),
      );

      const result = await service.rotate('session-1', 'jti-1');

      expect(result).toEqual({ status: 'reused', userId: 'user-1' });
      expect(redis.del).toHaveBeenCalledWith('refresh_session:session-1');
      expect(redis.srem).toHaveBeenCalledWith(
        'user_sessions:user-1',
        'session-1',
      );
    });

    it('returns invalid for an unrecognized jti', async () => {
      redis.get.mockResolvedValue(JSON.stringify(record()));

      const result = await service.rotate('session-1', 'never-issued');

      expect(result).toEqual({ status: 'invalid' });
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('deletes the session and removes it from the user set', async () => {
      await service.revoke('session-1', 'user-1');

      expect(redis.del).toHaveBeenCalledWith('refresh_session:session-1');
      expect(redis.srem).toHaveBeenCalledWith(
        'user_sessions:user-1',
        'session-1',
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('deletes every tracked session plus the user set', async () => {
      redis.smembers.mockResolvedValue(['session-1', 'session-2']);

      await service.revokeAllForUser('user-1');

      expect(redis.del).toHaveBeenCalledWith(
        'refresh_session:session-1',
        'refresh_session:session-2',
      );
      expect(redis.del).toHaveBeenCalledWith('user_sessions:user-1');
    });

    it('skips the session-key delete when the user has no sessions', async () => {
      redis.smembers.mockResolvedValue([]);

      await service.revokeAllForUser('user-1');

      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledWith('user_sessions:user-1');
    });
  });
});
