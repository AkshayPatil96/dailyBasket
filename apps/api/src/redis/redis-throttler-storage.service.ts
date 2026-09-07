import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

// Not exported from the package root despite being the return type of
// ThrottlerStorage.increment() — re-declared here to match.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Atomic in Redis via a single EVAL — the default in-memory ThrottlerStorageService
// (per-process Map + setTimeout) can't be: on multiple API instances, each would
// keep its own hit count, so a client could get `limit` requests through PER
// INSTANCE instead of in total, and nothing survives a restart. This mirrors the
// default implementation's semantics (block-on-exceed, block expires independently
// of the hit-count window) but backed by shared state.
//
// KEYS[1] = hits key, KEYS[2] = blocked key
// ARGV[1] = ttl (ms), ARGV[2] = limit, ARGV[3] = blockDuration (ms)
// returns [totalHits, timeToExpireMs, isBlocked (0/1), timeToBlockExpireMs]
const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockedKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockedTtl = redis.call('PTTL', blockedKey)
if blockedTtl > 0 then
  local hits = tonumber(redis.call('GET', hitsKey) or '0')
  return {hits, redis.call('PTTL', hitsKey), 1, blockedTtl}
end

local hits = redis.call('INCR', hitsKey)
local timeToExpire
if hits == 1 then
  redis.call('PEXPIRE', hitsKey, ttl)
  timeToExpire = ttl
else
  timeToExpire = redis.call('PTTL', hitsKey)
  if timeToExpire < 0 then
    redis.call('PEXPIRE', hitsKey, ttl)
    timeToExpire = ttl
  end
end

local isBlocked = 0
local timeToBlockExpire = 0
if hits > limit then
  isBlocked = 1
  if blockDuration > 0 then
    redis.call('SET', blockedKey, '1', 'PX', blockDuration)
    timeToBlockExpire = blockDuration
  end
end

return {hits, timeToExpire, isBlocked, timeToBlockExpire}
`;

@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:hits:${throttlerName}:${key}`;
    const blockedKey = `throttle:blocked:${throttlerName}:${key}`;

    const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] =
      (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        hitsKey,
        blockedKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpireMs / 1000),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
    };
  }
}
