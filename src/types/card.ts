export interface CustomLink {
  id: string;
  label: string;
  url: string;
}

export interface BusinessCard {
  cardId: string;
  creatorUid: string;
  ownerUid: string | null;
  isPublished: boolean;
  qrVersion: number;
  businessName: string;
  ownerName: string;
  logoUrl: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  googleReviewUrl: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  website: string;
  customLinks: CustomLink[];
  wifiSsid: string;
  wifiPassword: string;
  wifiIsOpen: boolean;
  accentColor: string;
  hasOwnerPin: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CardPrivateAuth {
  cardId: string;
  creatorUid: string;
  ownerUid: string | null;
  setupPinHash: string;
  ownerPinHash: string;
  submittedPinHash: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const CARD_LIMITS = {
  cardIdPattern: /^[a-zA-Z0-9_-]+$/,
  cardIdMin: 3,
  cardIdMax: 64,
  businessNameMax: 100,
  ownerNameMax: 80,
  logoUrlMax: 300000,
  descriptionMax: 500,
  addressMax: 240,
  phoneMax: 40,
  emailMax: 120,
  googleReviewUrlMax: 500,
  whatsappMax: 120,
  instagramMax: 160,
  facebookMax: 200,
  websiteMax: 300,
  customLinkLabelMax: 60,
  customLinkUrlMax: 500,
  maxPublicButtons: 7,
  wifiSsidMax: 64,
  wifiPasswordMax: 128,
} as const;

export const ACCENT_PRESETS = [
  { name: 'Deep Teal', hex: '#0F766E' },
  { name: 'Obsidian', hex: '#0F172A' },
  { name: 'Cobalt', hex: '#1D4ED8' },
  { name: 'Amber Bronze', hex: '#B45309' },
  { name: 'Burgundy', hex: '#9F1239' },
] as const;
