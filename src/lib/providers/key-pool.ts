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
    // Filter out keys currently on cooldown, unless all are cooled down
    const availableKeys = keys.filter((k) => {
      const cooldownUntil = this.rateLimitedKeys.get(k);
      return !cooldownUntil || cooldownUntil < now;
    });

    const activePool = availableKeys.length > 0 ? availableKeys : keys;

    // Get current round-robin index
    let currentIndex = (this.providerIndices[providerId] || 0) % activePool.length;
    let lastError: any = null;

    // Try keys in order starting from currentIndex
    for (let attempt = 0; attempt < activePool.length; attempt++) {
      const keyIndex = (currentIndex + attempt) % activePool.length;
      const apiKey = activePool[keyIndex];

      try {
        const result = await operation(apiKey, keyIndex + 1, activePool.length);

        // Update index for next request (round-robin)
        this.providerIndices[providerId] = (keyIndex + 1) % activePool.length;
        return result;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || err);

        // Check if error is rate limit (429) or quota exceeded
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
          // Put this key on cooldown for 60 seconds
          this.rateLimitedKeys.set(apiKey, Date.now() + 60000);
          continue; // Try next key in the pool!
        }

        // For other fatal errors (e.g. invalid syntax), rethrow immediately unless there are alternate keys
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
