export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hashSetupPin(cardId: string, pin: string): Promise<string> {
  return sha256Hex(`${cardId}:setup:${pin.trim()}`);
}

export function hashOwnerPin(cardId: string, pin: string): Promise<string> {
  return sha256Hex(`${cardId}:owner:${pin.trim()}`);
}

export function generateCardId(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `card-${suffix}`;
}

export function generateSetupPin(): string {
  const bytes = new Uint32Array(1);
  window.crypto.getRandomValues(bytes);
  const num = 100000 + (bytes[0] % 900000);
  return String(num);
}
