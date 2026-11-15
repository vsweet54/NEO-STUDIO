export interface CloudflarePair {
  apiKey: string;
  accountId: string;
}

export class KeyPool {
  private static providerIndices: Record<string, number> = {};
  private static rateLimitedKeys: Map<string, number> = new Map(); // key -> cooldown until timestamp

  /**
   * Parses comma-separated API keys from client input or server environment variables.
   * Format: "key1, key2, key3" or "key1,key2,key3"
   */
  static getKeys(rawClientKeys?: string, envVarNames: string[] = []): string[] {
    const collected: string[] = [];

    // 1. Parse client-provided keys
    if (rawClientKeys && typeof rawClientKeys === 'string') {
      const parts = rawClientKeys
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      collected.push(...parts);
    }

    // 2. Fallback to server Environment Variables if no client key provided
    if (collected.length === 0) {
      for (const envName of envVarNames) {
        const envVal = process.env[envName];
        if (envVal && typeof envVal === 'string') {
          const parts = envVal
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0);
          collected.push(...parts);
        }
      }
    }

    return Array.from(new Set(collected)); // unique keys
  }

  /**
   * Pairs Cloudflare API Keys with Account IDs 1:1 in matching order:
   * (key1, idakun1), (key2, idakun2), (key3, idakun3)...
   */
  static getCloudflarePairs(rawKeys?: string, rawAccountIds?: string): CloudflarePair[] {
    const keys = this.getKeys(rawKeys, [
      'CLOUDFLARE_API_KEY',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_API_KEYS',
    ]);
    const accountIds = this.getKeys(rawAccountIds, [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_ACCOUNT_IDS',
    ]);

    if (keys.length === 0 || accountIds.length === 0) {
      return [];
    }

    const maxCount = Math.max(keys.length, accountIds.length);
    const pairs: CloudflarePair[] = [];

    for (let i = 0; i < maxCount; i++) {
      const apiKey = keys[i % keys.length];
      const accountId = accountIds[i % accountIds.length];
      pairs.push({ apiKey, accountId });
    }

    return pairs;
  }

  /**
   * Executes Cloudflare operation with rotation across (API Key, Account ID) pairs.
   */
  static async executeCloudflareWithRotation<T>(
    pairs: CloudflarePair[],
    operation: (apiKey: string, accountId: string, pairIndex: number, totalPairs: number) => Promise<T>
  ): Promise<T> {
    if (pairs.length === 0) {
      throw new Error(
        'Cloudflare API Key dan Account ID wajib diisi. Masukkan key1, key2... dan idakun1, idakun2... di settings atau Vercel Environment Variables.'
      );
    }

    const now = Date.now();
    const availablePairs = pairs.filter((p) => {
      const keyCooldown = this.rateLimitedKeys.get(p.apiKey);
      const acctCooldown = this.rateLimitedKeys.get(p.accountId);
      return (!keyCooldown || keyCooldown < now) && (!acctCooldown || acctCooldown < now);
    });

    const activePool = availablePairs.length > 0 ? availablePairs : pairs;
    let currentIndex = (this.providerIndices['cloudflare'] || 0) % activePool.length;
    let lastError: any = null;

    for (let attempt = 0; attempt < activePool.length; attempt++) {
      const pairIndex = (currentIndex + attempt) % activePool.length;
      const current = activePool[pairIndex];

      try {
        const result = await operation(
          current.apiKey,
          current.accountId,
          pairIndex + 1,
          activePool.length
        );

        if (result && typeof result === 'object' && 'success' in result && !(result as any).success) {
          const resErr = String((result as any).error || '');
          const isLimit =
            resErr.includes('429') ||
            resErr.includes('rate limit') ||
            resErr.includes('quota') ||
            resErr.includes('Too Many Requests');
          const isAuth =
            resErr.includes('401') ||
            resErr.includes('Unauthorized') ||
            resErr.includes('Invalid token') ||
            resErr.includes('invalid') ||
            resErr.includes('API key not valid');

          if (isLimit || isAuth) {
            console.warn(
              `[KeyPool Cloudflare] Pair #${pairIndex + 1}/${activePool.length} error: ${resErr}. Rotating to next pair...`
            );
            if (isLimit) {
              this.rateLimitedKeys.set(current.apiKey, Date.now() + 60000);
              this.rateLimitedKeys.set(current.accountId, Date.now() + 60000);
            }
            lastError = new Error(resErr);
            continue;
          }
        }

        this.providerIndices['cloudflare'] = (pairIndex + 1) % activePool.length;
        return result;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || err);
        const isLimit =
          errMsg.includes('429') ||
          errMsg.includes('rate limit') ||
          errMsg.includes('quota') ||
          errMsg.includes('Too Many Requests');

        if (isLimit) {
          console.warn(
            `[KeyPool Cloudflare] Pair #${pairIndex + 1}/${activePool.length} (Account ${current.accountId}) rate limited. Rotating to next pair...`
          );
          this.rateLimitedKeys.set(current.apiKey, Date.now() + 60000);
          this.rateLimitedKeys.set(current.accountId, Date.now() + 60000);
          continue;
        }

        if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('Invalid token')) {
          console.warn(`[KeyPool Cloudflare] Pair #${pairIndex + 1} unauthorized. Rotating...`);
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error(`Semua ${pairs.length} pasangan Cloudflare (Key & Account ID) gagal.`);
  }

  /**
   * Executes an operation with automatic multi-key rotation and rate-limit (429) fallback.
   */
  static async executeWithRotation<T>(
    providerId: string,
    keys: string[],
    operation: (apiKey: string, keyIndex: number, totalKeys: number) => Promise<T>
  ): Promise<T> {
    if (keys.length === 0) {
      throw new Error(
        `API Key untuk ${providerId} tidak ditemukan. Harap masukkan API Key (bisa multi key dipisah koma) di menu Provider Settings atau atur Environment Variable di Vercel.`
      );
    }

    const now = Date.now();
    const availableKeys = keys.filter((k) => {
      const cooldownUntil = this.rateLimitedKeys.get(k);
      return !cooldownUntil || cooldownUntil < now;
    });

    const activePool = availableKeys.length > 0 ? availableKeys : keys;
    let currentIndex = (this.providerIndices[providerId] || 0) % activePool.length;
    let lastError: any = null;

    for (let attempt = 0; attempt < activePool.length; attempt++) {
      const keyIndex = (currentIndex + attempt) % activePool.length;
      const apiKey = activePool[keyIndex];

      try {
        const result = await operation(apiKey, keyIndex + 1, activePool.length);

        if (result && typeof result === 'object' && 'success' in result && !(result as any).success) {
          const resErr = String((result as any).error || '');
          const isRateLimit =
            resErr.includes('429') ||
            resErr.includes('RESOURCE_EXHAUSTED') ||
            resErr.includes('rate limit') ||
            resErr.includes('quota') ||
            resErr.includes('Too Many Requests');
          const isAuth =
            resErr.includes('API_KEY_INVALID') ||
            resErr.includes('API key not valid') ||
            resErr.includes('Unauthorized') ||
            resErr.includes('401') ||
            resErr.includes('not valid');

          if (isRateLimit || isAuth) {
            console.warn(
              `[KeyPool ${providerId}] Key #${keyIndex + 1}/${activePool.length} returned error: ${resErr}. Rotating to next key...`
            );
            if (isRateLimit) {
              this.rateLimitedKeys.set(apiKey, Date.now() + 60000);
            }
            lastError = new Error(resErr);
            continue;
          }
        }

        this.providerIndices[providerId] = (keyIndex + 1) % activePool.length;
        return result;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || err);

        const isRateLimit =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('rate limit') ||
          errMsg.includes('quota') ||
          errMsg.includes('Too Many Requests');

        if (isRateLimit) {
          console.warn(
            `[KeyPool ${providerId}] Key #${keyIndex + 1}/${activePool.length} rate limited. Cool down 60s. Rotating to next key...`
          );
          this.rateLimitedKeys.set(apiKey, Date.now() + 60000);
          continue;
        }

        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('Unauthorized') || errMsg.includes('401')) {
          console.warn(`[KeyPool ${providerId}] Key #${keyIndex + 1} invalid. Trying next key if available...`);
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error(`Semua ${keys.length} API Key untuk ${providerId} gagal dieksekusi.`);
  }
}
