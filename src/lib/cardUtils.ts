import { BusinessCard, CARD_LIMITS } from '../types/card';

function getOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function getPermanentCardUrl(cardId: string): string {
  return `${getOrigin()}/c/${cardId}`;
}

export function getQrDestinationUrl(cardId: string, qrVersion = 1): string {
  const base = getPermanentCardUrl(cardId);
  return qrVersion > 1 ? `${base}?qr=${qrVersion}` : base;
}

export function getSetupCardUrl(cardId: string): string {
  return `${getOrigin()}/setup/${cardId}`;
}

export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeGoogleReviewUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeWhatsAppUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(wa\.me|api\.whatsapp\.com)\//i.test(trimmed)) return `https://${trimmed}`;
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

export function normalizeInstagramUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)?instagram\.com\//i.test(trimmed)) return `https://${trimmed}`;
  const handle = trimmed.replace(/^@+/, '');
  return handle ? `https://instagram.com/${handle}` : '';
}

export function normalizeFacebookUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)?(facebook|fb)\.com\//i.test(trimmed)) return `https://${trimmed}`;
  const handle = trimmed.replace(/^@+/, '');
  return handle ? `https://facebook.com/${handle}` : '';
}

export function countPublicButtons(card: Pick<
  BusinessCard,
  'googleReviewUrl' | 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'customLinks'
>): number {
  let count = 0;
  if (card.googleReviewUrl.trim()) count += 1;
  if (card.whatsapp.trim()) count += 1;
  if (card.instagram.trim()) count += 1;
  if (card.facebook.trim()) count += 1;
  if (card.website.trim()) count += 1;
  count += card.customLinks.length;
  return count;
}

function escapeVCardValue(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function buildVcfContent(card: BusinessCard): string {
  const fullName = (card.ownerName || card.businessName || 'Business Contact').trim();
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || fullName;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardValue(fullName)}`,
    `N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`,
  ];

  if (card.businessName.trim()) {
    lines.push(`ORG:${escapeVCardValue(card.businessName.trim())}`);
  }
  if (card.phone.trim()) {
    lines.push(`TEL;TYPE=WORK,VOICE:${card.phone.trim()}`);
  }
  if (card.email.trim()) {
    lines.push(`EMAIL;TYPE=WORK,INTERNET:${card.email.trim()}`);
  }
  if (card.address.trim()) {
    lines.push(`ADR;TYPE=WORK:;;${escapeVCardValue(card.address.trim())};;;;`);
  }
  const website = normalizeWebsiteUrl(card.website);
  if (website) {
    lines.push(`URL:${website}`);
  }
  lines.push(`URL;TYPE=Profile:${getPermanentCardUrl(card.cardId)}`);
  if (card.description.trim()) {
    lines.push(`NOTE:${escapeVCardValue(card.description.trim())}`);
  }

  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

export function downloadVcf(card: BusinessCard): void {
  const content = buildVcfContent(card);
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const slug = (card.businessName || card.ownerName || card.cardId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug || card.cardId}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeWifiField(val: string): string {
  return val.replace(/([\\;,:"])/g, '\\$1');
}

export function buildWifiQrString(ssid: string, password: string, isOpen: boolean): string {
  const s = escapeWifiField(ssid.trim());
  if (isOpen || !password.trim()) {
    return `WIFI:T:nopass;S:${s};;`;
  }
  const p = escapeWifiField(password);
  return `WIFI:T:WPA;S:${s};P:${p};;`;
}

export function compressLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (PNG, JPG, WebP, or SVG).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const maxDim = 420;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || maxDim) * scale));
        const height = Math.max(1, Math.round((img.height || maxDim) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer crisp WebP/PNG while keeping strictly below Firestore limit
        let dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 220000) {
          dataUrl = canvas.toDataURL('image/webp', 0.86);
        }
        if (dataUrl.length > 220000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        }
        if (dataUrl.length > CARD_LIMITS.logoUrlMax) {
          reject(new Error('Image is still too large after compression. Please choose a smaller logo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function sanitizeCardIdInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CARD_LIMITS.cardIdMax);
}
