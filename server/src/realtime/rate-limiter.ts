/**
 * Rate Limiter for Socket.io
 * 
 * In-memory rate limiting per socket/user.
 * Simple sliding window implementation for MVP.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Check if user has exceeded rate limit.
 * Returns true if within limit, false if exceeded.
 * 
 * @param userId - User UID to rate limit
 * @param maxMessages - Max messages allowed
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  userId: string,
  maxMessages: number = 10,
  windowMs: number = 10000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  // Check if over limit
  if (entry.timestamps.length >= maxMessages) {
    return false;
  }

  // Add current timestamp and update entry
  entry.timestamps.push(now);
  rateLimitMap.set(userId, entry);

  return true;
}

/**
 * Get remaining messages for user in current window.
 */
export function getRemainingMessages(
  userId: string,
  maxMessages: number = 10,
  windowMs: number = 10000
): number {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry) {
    return maxMessages;
  }

  // Count timestamps still in window
  const validCount = entry.timestamps.filter((ts) => now - ts < windowMs).length;
  return Math.max(0, maxMessages - validCount);
}

/**
 * Reset rate limit for user (admin action, future).
 */
export function resetRateLimit(userId: string): void {
  rateLimitMap.delete(userId);
}

/**
 * Cleanup old entries (call periodically).
 */
export function cleanupRateLimitMap(): void {
  const now = Date.now();
  const windowMs = 60000; // 1 minute max retention

  const userIds = Array.from(rateLimitMap.keys());
  for (const userId of userIds) {
    const entry = rateLimitMap.get(userId);
    if (entry) {
      const validTimestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
      if (validTimestamps.length === 0) {
        rateLimitMap.delete(userId);
      } else {
        entry.timestamps = validTimestamps;
      }
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitMap, 5 * 60 * 1000);
