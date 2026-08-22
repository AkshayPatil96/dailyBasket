import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { parseDurationSeconds } from '../../common/utils/duration';

interface SessionRecord {
  userId: string;
  currentJti: string;
  previousJti: string | null;
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
}

type RotateResult =
  | { status: 'rotated'; userId: string; newJti: string }
  | { status: 'reused'; userId: string }
  | { status: 'invalid' };

const sessionKey = (sessionId: string) => `refresh_session:${sessionId}`;
const userSessionsKey = (userId: string) => `user_sessions:${userId}`;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ttlSeconds = parseDurationSeconds(process.env.JWT_REFRESH_EXPIRES_IN ?? '30d');

  constructor(private readonly redis: RedisService) {}

  async createSession(userId: string, userAgent: string): Promise<{ sessionId: string; jti: string }> {
    const sessionId = randomUUID();
    const jti = randomUUID();
    const now = new Date().toISOString();
    const record: SessionRecord = { userId, currentJti: jti, previousJti: null, userAgent, createdAt: now, lastUsedAt: now };

    await this.redis.set(sessionKey(sessionId), JSON.stringify(record), 'EX', this.ttlSeconds);
    await this.redis.sadd(userSessionsKey(userId), sessionId);
    await this.redis.expire(userSessionsKey(userId), this.ttlSeconds);

    return { sessionId, jti };
  }

  async rotate(sessionId: string, presentedJti: string): Promise<RotateResult> {
    const raw = await this.redis.get(sessionKey(sessionId));
    if (!raw) {
      return { status: 'invalid' };
    }

    const record: SessionRecord = JSON.parse(raw);

    if (record.currentJti === presentedJti) {
      const newJti = randomUUID();
      const updated: SessionRecord = { ...record, previousJti: record.currentJti, currentJti: newJti, lastUsedAt: new Date().toISOString() };
      await this.redis.set(sessionKey(sessionId), JSON.stringify(updated), 'EX', this.ttlSeconds);
      return { status: 'rotated', userId: record.userId, newJti };
    }

    if (record.previousJti === presentedJti) {
      this.logger.warn(`Refresh token reuse detected for session ${sessionId} (user ${record.userId}) — revoking session`);
      await this.revoke(sessionId, record.userId);
      return { status: 'reused', userId: record.userId };
    }

    return { status: 'invalid' };
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await this.redis.del(sessionKey(sessionId));
    await this.redis.srem(userSessionsKey(userId), sessionId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sessionIds = await this.redis.smembers(userSessionsKey(userId));
    if (sessionIds.length > 0) {
      await this.redis.del(...sessionIds.map(sessionKey));
    }
    await this.redis.del(userSessionsKey(userId));
  }
}
