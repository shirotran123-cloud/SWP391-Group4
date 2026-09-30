import { KeyPoolItem } from "../types/provider.types";

export class KeyRotatorService {
  private pools: Map<"openai" | "gemini", KeyPoolItem[]> = new Map();
  private cursor: Map<"openai" | "gemini", number> = new Map();

  constructor(openaiKeys: string[] = [], geminiKeys: string[] = []) {
    this.initPool("openai", openaiKeys);
    this.initPool("gemini", geminiKeys);
  }

  private initPool(provider: "openai" | "gemini", keys: string[]): void {
    const items: KeyPoolItem[] = keys.map((key) => ({
      key,
      provider,
      errorCount: 0,
      lastUsedAt: 0,
      isCoolingDown: false,
      cooldownUntil: 0,
    }));
    this.pools.set(provider, items);
    this.cursor.set(provider, 0);
  }

  /**
   * Acquires the next available healthy key via round-robin.
   */
  public getNextKey(provider: "openai" | "gemini"): string | null {
    const pool = this.pools.get(provider);
    if (!pool || pool.length === 0) return null;

    const now = Date.now();
    const len = pool.length;
    let idx = this.cursor.get(provider) || 0;

    for (let i = 0; i < len; i++) {
      const candidateIndex = (idx + i) % len;
      const item = pool[candidateIndex];

      // Check if cooldown has expired
      if (item.isCoolingDown && now >= item.cooldownUntil) {
        item.isCoolingDown = false;
        item.cooldownUntil = 0;
      }

      if (!item.isCoolingDown) {
        item.lastUsedAt = now;
        this.cursor.set(provider, (candidateIndex + 1) % len);
        return item.key;
      }
    }

    // All keys in cooldown, return least recently used
    pool.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    return pool[0].key;
  }

  /**
   * Flags a key that hit 429 rate limit or 5xx server error, setting cooldown.
   */
  public reportError(provider: "openai" | "gemini", key: string, statusCode: number): void {
    const pool = this.pools.get(provider);
    if (!pool) return;

    const item = pool.find((k) => k.key === key);
    if (!item) return;

    item.errorCount++;

    if (statusCode === 429) {
      // Rate limited: cooldown for 60 seconds
      item.isCoolingDown = true;
      item.cooldownUntil = Date.now() + 60000;
    } else if (statusCode >= 500) {
      // Server error: cooldown for 15 seconds
      item.isCoolingDown = true;
      item.cooldownUntil = Date.now() + 15000;
    }
  }

  /**
   * Reports successful execution with key, resetting error count.
   */
  public reportSuccess(provider: "openai" | "gemini", key: string): void {
    const pool = this.pools.get(provider);
    if (!pool) return;
    const item = pool.find((k) => k.key === key);
    if (item) {
      item.errorCount = 0;
      item.isCoolingDown = false;
    }
  }

  /**
   * Returns current health statistics of all key pools.
   */
  public getPoolStats(provider: "openai" | "gemini"): {
    total: number;
    healthy: number;
    coolingDown: number;
  } {
    const pool = this.pools.get(provider) || [];
    const now = Date.now();
    const cooling = pool.filter((k) => k.isCoolingDown && now < k.cooldownUntil).length;
    return {
      total: pool.length,
      healthy: pool.length - cooling,
      coolingDown: cooling,
    };
  }
}
