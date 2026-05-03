// ── Storage keys ──────────────────────────────────────────────────────────────

export const PIN_KEYS = {
  ENABLED:       'viniverse_pin_enabled',
  HASH:          'viniverse_pin_hash',
  SALT:          'viniverse_pin_salt',
  TIMEOUT:       'viniverse_lock_timeout_minutes',
  LAST_UNLOCKED: 'viniverse_last_unlocked_at',
  VERSION:       'viniverse_privacy_lock_version',
} as const;

const CURRENT_VERSION = '1';

// ── Crypto helpers ─────────────────────────────────────────────────────────────

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const message = `${salt}:${pin}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: djb2-inspired hash (not cryptographic, but avoids plain-text storage)
  let h = 5381;
  for (let i = 0; i < message.length; i++) {
    h = (h * 33) ^ message.charCodeAt(i);
    h = h & h;
  }
  const base = (h >>> 0).toString(16).padStart(8, '0');
  const saltSlice = parseInt(salt.slice(0, 8), 16);
  return (((h >>> 0) + (saltSlice || 0)) >>> 0).toString(16).padStart(8, '0') + base;
}

// ── Settings read/write ────────────────────────────────────────────────────────

export function isPinEnabled(): boolean {
  return localStorage.getItem(PIN_KEYS.ENABLED) === 'true';
}

export function getStoredHash(): string | null {
  return localStorage.getItem(PIN_KEYS.HASH);
}

export function getStoredSalt(): string | null {
  return localStorage.getItem(PIN_KEYS.SALT);
}

export function getTimeoutMinutes(): number {
  const val = localStorage.getItem(PIN_KEYS.TIMEOUT);
  return val !== null ? parseInt(val, 10) : 5;
}

export function setTimeoutMinutes(minutes: number): void {
  localStorage.setItem(PIN_KEYS.TIMEOUT, String(minutes));
}

export function getLastUnlockedAt(): string | null {
  return localStorage.getItem(PIN_KEYS.LAST_UNLOCKED);
}

export function setLastUnlocked(): void {
  localStorage.setItem(PIN_KEYS.LAST_UNLOCKED, new Date().toISOString());
}

export function enablePin(hash: string, salt: string): void {
  localStorage.setItem(PIN_KEYS.ENABLED, 'true');
  localStorage.setItem(PIN_KEYS.HASH, hash);
  localStorage.setItem(PIN_KEYS.SALT, salt);
  localStorage.setItem(PIN_KEYS.VERSION, CURRENT_VERSION);
  setLastUnlocked();
}

export function disablePin(): void {
  localStorage.removeItem(PIN_KEYS.ENABLED);
  localStorage.removeItem(PIN_KEYS.HASH);
  localStorage.removeItem(PIN_KEYS.SALT);
  localStorage.removeItem(PIN_KEYS.LAST_UNLOCKED);
}

export function clearPinForReset(): void {
  disablePin();
  localStorage.removeItem(PIN_KEYS.VERSION);
}

// ── Lock state helpers ─────────────────────────────────────────────────────────

export function isTimeoutExpired(): boolean {
  if (!isPinEnabled()) return false;
  const timeout = getTimeoutMinutes();
  const lastUnlocked = getLastUnlockedAt();
  if (!lastUnlocked) return true;
  if (timeout === 0) return true; // Immediately
  const elapsedMs = Date.now() - new Date(lastUnlocked).getTime();
  return elapsedMs > timeout * 60 * 1000;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = getStoredHash();
  const storedSalt = getStoredSalt();
  if (!storedHash || !storedSalt) return false;
  const hash = await hashPin(pin, storedSalt);
  return hash === storedHash;
}

// ── App-level lock event ───────────────────────────────────────────────────────

export function dispatchLockEvent(): void {
  window.dispatchEvent(new CustomEvent('viniverse:lock'));
}
