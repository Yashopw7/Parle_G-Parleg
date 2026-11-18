import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateCardId, generateSetupPin, hashOwnerPin, hashSetupPin } from '../lib/crypto';
import { ACCENT_PRESETS, BusinessCard, CARD_LIMITS, CustomLink } from '../types/card';

function clampString(val: unknown, max: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, max);
}

function sanitizeCustomLinks(links: CustomLink[]): CustomLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter((item) => item && item.label.trim() && item.url.trim())
    .slice(0, CARD_LIMITS.maxPublicButtons)
    .map((item, idx) => ({
      id: clampString(item.id || `link-${idx + 1}`, 64) || `link-${idx + 1}`,
      label: clampString(item.label, CARD_LIMITS.customLinkLabelMax),
      url: clampString(item.url, CARD_LIMITS.customLinkUrlMax),
    }));
}

export function sanitizeCardUpdates(input: Partial<BusinessCard>) {
  const googleReviewUrl = clampString(input.googleReviewUrl, CARD_LIMITS.googleReviewUrlMax);
  const whatsapp = clampString(input.whatsapp, CARD_LIMITS.whatsappMax);
  const instagram = clampString(input.instagram, CARD_LIMITS.instagramMax);
  const facebook = clampString(input.facebook, CARD_LIMITS.facebookMax);
  const website = clampString(input.website, CARD_LIMITS.websiteMax);

  const standardCount =
    (googleReviewUrl ? 1 : 0) +
    (whatsapp ? 1 : 0) +
    (instagram ? 1 : 0) +
    (facebook ? 1 : 0) +
    (website ? 1 : 0);

  const remainingSlots = Math.max(0, CARD_LIMITS.maxPublicButtons - standardCount);
  const customLinks = sanitizeCustomLinks(input.customLinks || []).slice(0, remainingSlots);

  const wifiIsOpen = Boolean(input.wifiIsOpen);

  return {
    isPublished: Boolean(input.isPublished),
    businessName: clampString(input.businessName, CARD_LIMITS.businessNameMax),
    ownerName: clampString(input.ownerName, CARD_LIMITS.ownerNameMax),
    logoUrl: clampString(input.logoUrl, CARD_LIMITS.logoUrlMax),
    description: clampString(input.description, CARD_LIMITS.descriptionMax),
    address: clampString(input.address, CARD_LIMITS.addressMax),
    phone: clampString(input.phone, CARD_LIMITS.phoneMax),
    email: clampString(input.email, CARD_LIMITS.emailMax),
    googleReviewUrl,
    whatsapp,
    instagram,
    facebook,
    website,
    customLinks,
    wifiSsid: clampString(input.wifiSsid, CARD_LIMITS.wifiSsidMax),
    wifiPassword: wifiIsOpen ? '' : clampString(input.wifiPassword, CARD_LIMITS.wifiPasswordMax),
    wifiIsOpen,
    accentColor: clampString(input.accentColor || ACCENT_PRESETS[0].hex, 20) || ACCENT_PRESETS[0].hex,
    hasOwnerPin: Boolean(input.hasOwnerPin),
  };
}

export function subscribePublicCard(
  cardId: string,
  onData: (card: BusinessCard | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `cards/${cardId}`;
  return onSnapshot(
    doc(db, 'cards', cardId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(snap.data() as BusinessCard);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export function subscribeMyCards(
  uid: string,
  onData: (cards: BusinessCard[]) => void
): Unsubscribe {
  let ownedMap = new Map<string, BusinessCard>();
  let createdMap = new Map<string, BusinessCard>();

  const emitMerged = () => {
    const combined = new Map<string, BusinessCard>();
    createdMap.forEach((v, k) => combined.set(k, v));
    ownedMap.forEach((v, k) => combined.set(k, v));
    const list = Array.from(combined.values()).sort((a, b) => {
      const aSec = (a.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0;
      const bSec = (b.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0;
      return bSec - aSec;
    });
    onData(list);
  };

  const qOwned = query(collection(db, 'cards'), where('ownerUid', '==', uid));
  const qCreated = query(collection(db, 'cards'), where('creatorUid', '==', uid));

  const unsubOwned = onSnapshot(
    qOwned,
    (snap) => {
      ownedMap = new Map();
      snap.forEach((d) => ownedMap.set(d.id, d.data() as BusinessCard));
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cards');
    }
  );

  const unsubCreated = onSnapshot(
    qCreated,
    (snap) => {
      createdMap = new Map();
      snap.forEach((d) => createdMap.set(d.id, d.data() as BusinessCard));
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cards');
    }
  );

  return () => {
    unsubOwned();
    unsubCreated();
  };
}

export async function createBusinessCard(params: {
  creatorUid: string;
  mode: 'self' | 'provision';
  customCardId?: string;
  initialBusinessName?: string;
}): Promise<{ cardId: string; setupPin: string }> {
  const cardId = params.customCardId?.trim() || generateCardId();
  if (
    cardId.length < CARD_LIMITS.cardIdMin ||
    cardId.length > CARD_LIMITS.cardIdMax ||
    !CARD_LIMITS.cardIdPattern.test(cardId)
  ) {
    throw new Error('Card ID must be 3–64 characters using only letters, numbers, hyphens, or underscores.');
  }

  const cardRef = doc(db, 'cards', cardId);
  let existingSnap;
  try {
    existingSnap = await getDoc(cardRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `cards/${cardId}`);
  }
  if (existingSnap.exists()) {
    throw new Error(`Card ID "${cardId}" is already in use. Please choose another ID.`);
  }

  const setupPin = generateSetupPin();
  const setupPinHash = await hashSetupPin(cardId, setupPin);
  const ownerUid = params.mode === 'self' ? params.creatorUid : null;

  const batch = writeBatch(db);
  const cardData: BusinessCard = {
    cardId,
    creatorUid: params.creatorUid,
    ownerUid,
    isPublished: false,
    qrVersion: 1,
    businessName: clampString(params.initialBusinessName || '', CARD_LIMITS.businessNameMax),
    ownerName: '',
    logoUrl: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    googleReviewUrl: '',
    whatsapp: '',
    instagram: '',
    facebook: '',
    website: '',
    customLinks: [],
    wifiSsid: '',
    wifiPassword: '',
    wifiIsOpen: false,
    accentColor: ACCENT_PRESETS[0].hex,
    hasOwnerPin: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(cardRef, cardData);
  batch.set(doc(db, 'cardPrivate', cardId), {
    cardId,
    creatorUid: params.creatorUid,
    ownerUid,
    setupPinHash,
    ownerPinHash: '',
    submittedPinHash: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return { cardId, setupPin };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `cards/${cardId}`);
  }
}

export async function claimCardWithPin(
  cardId: string,
  ownerUid: string,
  pin: string
): Promise<void> {
  const cleanedPin = pin.trim();
  if (!cleanedPin) {
    throw new Error('Please enter the 6-digit Setup PIN.');
  }
  const submittedPinHash = await hashSetupPin(cardId, cleanedPin);
  const batch = writeBatch(db);

  batch.update(doc(db, 'cardPrivate', cardId), {
    ownerUid,
    submittedPinHash,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'cards', cardId), {
    ownerUid,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('insufficient')) {
      throw new Error('Incorrect Setup PIN or this card has already been claimed.');
    }
    handleFirestoreError(error, OperationType.UPDATE, `cards/${cardId}`);
  }
}

export async function updateBusinessCard(
  cardId: string,
  updates: Partial<BusinessCard>
): Promise<void> {
  const sanitized = sanitizeCardUpdates(updates);
  const path = `cards/${cardId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'cards', cardId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setOwnerEditPin(
  cardId: string,
  pinOrEmpty: string
): Promise<void> {
  const trimmed = pinOrEmpty.trim();
  const ownerPinHash = trimmed ? await hashOwnerPin(cardId, trimmed) : '';
  const hasOwnerPin = Boolean(trimmed);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'cardPrivate', cardId), {
      ownerPinHash,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'cards', cardId), {
      hasOwnerPin,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cardPrivate/${cardId}`);
  }
}

export async function verifyOwnerEditPin(cardId: string, pin: string): Promise<boolean> {
  const path = `cardPrivate/${cardId}`;
  try {
    const snap = await getDoc(doc(db, 'cardPrivate', cardId));
    if (!snap.exists()) return false;
    const data = snap.data() as { ownerPinHash?: string };
    if (!data.ownerPinHash) return true;
    const candidate = await hashOwnerPin(cardId, pin);
    return candidate === data.ownerPinHash;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function regenerateQrVersion(
  cardId: string,
  currentVersion: number
): Promise<void> {
  const path = `cards/${cardId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'cards', cardId), {
      qrVersion: currentVersion + 1,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBusinessCard(cardId: string): Promise<void> {
  const path = `cards/${cardId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'cards', cardId));
    batch.delete(doc(db, 'cardPrivate', cardId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
