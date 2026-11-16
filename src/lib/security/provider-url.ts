import { isIP } from 'node:net';

const PROVIDER_HOSTS: Record<string, string[]> = {
  groq: ['api.groq.com'],
  nvidia: ['integrate.api.nvidia.com'],
  openrouter: ['openrouter.ai'],
};

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

/** Validate provider endpoints before sending credentials or server-side requests. */
export function validateProviderBaseUrl(providerId: string, rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Base URL tidak valid.'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Base URL tidak boleh berisi kredensial, query, atau fragment.');
  }
  const host = parsed.hostname.toLowerCase();
  const localOllamaDev = providerId === 'ollama' && process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1') && parsed.protocol === 'http:';
  if (parsed.protocol !== 'https:' && !localOllamaDev) throw new Error('Base URL provider harus menggunakan HTTPS (kecuali Ollama localhost saat development).');
  if (!localOllamaDev && (isIP(host) || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isPrivateIpv4(host))) {
    throw new Error('Base URL ke alamat IP/local/private tidak diizinkan.');
  }
  const allowed = PROVIDER_HOSTS[providerId];
  if (allowed && !allowed.includes(host)) {
    throw new Error(`Host Base URL tidak sesuai dengan provider ${providerId}.`);
  }
  if (!allowed && providerId !== 'ollama') {
    throw new Error('Provider ini tidak mendukung Base URL kustom.');
  }
  return parsed.toString().replace(/\/$/, '');
}
