import { redisConnection } from "../queue/connection";

const TYPING_TTL_SEC = 4;
const KEY_PREFIX = "typing:";

function typingKey(roomId: string, userId: string): string {
  return `${KEY_PREFIX}${roomId}:${userId}`;
}

export interface TypingUser {
  userId: string;
  name: string;
}

export async function setTypingIndicator(
  roomId: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    await redisConnection.set(
      typingKey(roomId, userId),
      JSON.stringify({ userId, name: userName }),
      "EX",
      TYPING_TTL_SEC
    );
  } catch {
    // Redis unavailable — typing is best-effort only.
  }
}

export async function clearTypingIndicator(roomId: string, userId: string): Promise<void> {
  try {
    await redisConnection.del(typingKey(roomId, userId));
  } catch {
    // ignore
  }
}

export async function getTypingUsers(roomId: string, excludeUserId: string): Promise<TypingUser[]> {
  try {
    const keys = await redisConnection.keys(`${KEY_PREFIX}${roomId}:*`);
    if (keys.length === 0) return [];

    const values = await redisConnection.mget(...keys);
    const typers: TypingUser[] = [];
    const seen = new Set<string>();

    for (const raw of values) {
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { userId?: string; name?: string };
      if (!parsed.userId || parsed.userId === excludeUserId || !parsed.name) continue;
      if (seen.has(parsed.userId)) continue;
      seen.add(parsed.userId);
      typers.push({ userId: parsed.userId, name: parsed.name });
    }

    return typers;
  } catch {
    return [];
  }
}
