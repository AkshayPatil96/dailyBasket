const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses a "15m" / "30d" style duration (as used for JWT expiresIn) into seconds. */
export function parseDurationSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${input}" — expected formats like "15m", "30d"`,
    );
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit];
}
