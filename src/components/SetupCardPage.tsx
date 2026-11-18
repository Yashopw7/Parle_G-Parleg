import React, { useEffect, useState } from 'react';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  KeyRound,
  Lock,
  Plus,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  ACCENT_PRESETS,
  BusinessCard,
  CARD_LIMITS,
  CustomLink,
} from '../types/card';
import {
  claimCardWithPin,
  setOwnerEditPin,
  subscribePublicCard,
  updateBusinessCard,
  verifyOwnerEditPin,
} from '../services/cardService';
import {
  compressLogoFile,
  countPublicButtons,
  getPermanentCardUrl,
} from '../lib/cardUtils';
import { CardPreview } from './CardPreview';
import { QrCodeModal } from './QrCodeModal';

interface SetupCardPageProps {
  cardId: string;
  user: User | null;
  authReady: boolean;
  onNavigate: (path: string) => void;
}

export const SetupCardPage: React.FC<SetupCardPageProps> = ({
  cardId,
  user,
  authReady,
  onNavigate,
}) => {
  const [card, setCard] = useState<BusinessCard | null | undefined>(undefined);
  const [form, setForm] = useState<BusinessCard | null>(null);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');

  // Auth & PIN states
  const [claimPin, setClaimPin] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState('');

  const [ownerPinEntry, setOwnerPinEntry] = useState('');
  const [ownerPinUnlocked, setOwnerPinUnlocked] = useState(false);
  const [ownerPinError, setOwnerPinError] = useState('');
  const [verifyingOwnerPin, setVerifyingOwnerPin] = useState(false);

  // Optional Owner Edit PIN configuration
  const [newOwnerPin, setNewOwnerPin] = useState('');
  const [pinSaveMsg, setPinSaveMsg] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // Save states
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    setCard(undefined);
    setForm(null);
    setOwnerPinUnlocked(false);
    const unsub = subscribePublicCard(cardId, (loaded) => {
      setCard(loaded);
      setForm((prev) => {
        if (!loaded) return null;
        if (prev && prev.cardId === loaded.cardId) {
          return {
            ...prev,
            qrVersion: loaded.qrVersion,
            hasOwnerPin: loaded.hasOwnerPin,
            isPublished: loaded.isPublished,
          };
        }
        return loaded;
      });
    });
    return () => unsub();
  }, [cardId]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setClaimError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Sign-in was cancelled.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleClaimCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setClaimBusy(true);
    setClaimError('');
    try {
      await claimCardWithPin(cardId, user.uid, claimPin);
      setClaimPin('');
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Failed to claim card.');
    } finally {
      setClaimBusy(false);
    }
  };

  const handleVerifyOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingOwnerPin(true);
    setOwnerPinError('');
    try {
      const ok = await verifyOwnerEditPin(cardId, ownerPinEntry);
      if (ok) {
        setOwnerPinUnlocked(true);
        setOwnerPinEntry('');
      } else {
        setOwnerPinError('Incorrect Edit PIN.');
      }
    } catch {
      setOwnerPinError('Unable to verify PIN.');
    } finally {
      setVerifyingOwnerPin(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setLogoUploading(true);
    setSaveErrorMsg('');
    try {
      const compressed = await compressLogoFile(file);
      setForm({ ...form, logoUrl: compressed });
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Failed to upload logo.');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleAddCustomLink = () => {
    if (!form) return;
    const total = countPublicButtons(form);
    if (total >= CARD_LIMITS.maxPublicButtons) return;
    const next: CustomLink = {
      id: `cl-${Date.now().toString(36)}`,
      label: '',
      url: '',
    };
    setForm({ ...form, customLinks: [...form.customLinks, next] });
  };

  const handleUpdateCustomLink = (idx: number, field: 'label' | 'url', value: string) => {
    if (!form) return;
    const updated = form.customLinks.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    setForm({ ...form, customLinks: updated });
  };

  const handleRemoveCustomLink = (idx: number) => {
    if (!form) return;
    setForm({
      ...form,
      customLinks: form.customLinks.filter((_, i) => i !== idx),
    });
  };

  const handleSave = async (publish: boolean) => {
    if (!form) return;
    if (!form.businessName.trim()) {
      setSaveErrorMsg('Please enter your Business Name before saving.');
      return;
    }
    const totalButtons = countPublicButtons(form);
    if (totalButtons > CARD_LIMITS.maxPublicButtons) {
      setSaveErrorMsg(`Maximum ${CARD_LIMITS.maxPublicButtons} public buttons allowed.`);
      return;
    }

    setSaving(true);
    setSaveErrorMsg('');
    setSaveSuccessMsg('');
    try {
      await updateBusinessCard(cardId, {
        ...form,
        isPublished: publish,
      });
      setForm({ ...form, isPublished: publish });
      setSaveSuccessMsg(
        publish
          ? 'Saved and published live! Your permanent NFC and QR code now display your updated profile.'
          : 'Draft saved.'
      );
    } catch (err) {
      setSaveErrorMsg(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOwnerPin = async (pinValue: string) => {
    if (!form) return;
    setSavingPin(true);
    setPinSaveMsg('');
    try {
      await setOwnerEditPin(cardId, pinValue);
      setForm({ ...form, hasOwnerPin: Boolean(pinValue.trim()) });
      setNewOwnerPin('');
      setPinSaveMsg(
        pinValue.trim()
          ? 'Owner Edit PIN enabled.'
          : 'Owner Edit PIN removed.'
      );
    } catch (err) {
      setPinSaveMsg(err instanceof Error ? err.message : 'Unable to update PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  if (!authReady || card === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">Loading card setup...</p>
      </div>
    );
  }

  if (card === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Card Not Found</h1>
          <p className="text-sm text-slate-600">
            Card ID <span className="font-mono">{cardId}</span> does not exist.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Gate 1: Unclaimed card -> Shop Owner Claim Flow (Google Auth + Setup PIN)
  if (!card.ownerUid) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Tapfolio
            </button>
            <span className="text-xs font-mono text-slate-500">{card.cardId}</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Claim &amp; Set Up Card</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Authenticate your shop owner account and enter the 6-digit Setup PIN provided with
              your NFC card.
            </p>
          </div>

          {!user ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed">
                Step 1 of 2: Sign in with your Google account so only you can edit this business
                card in the future.
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                {signingIn ? 'Signing in...' : 'Continue with Google'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleClaimCard} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 truncate">
                  Signed in as <strong className="text-slate-900">{user.email}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="text-slate-500 hover:text-slate-900 underline shrink-0 cursor-pointer"
                >
                  Switch
                </button>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="setup-pin" className="block text-sm font-medium text-slate-800">
                  6-Digit Setup PIN
                </label>
                <input
                  id="setup-pin"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={claimPin}
                  onChange={(e) => setClaimPin(e.target.value)}
                  placeholder="Enter setup PIN"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-700"
                  required
                />
              </div>

              {claimError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {claimError}
                </p>
              )}

              <button
                type="submit"
                disabled={claimBusy}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                {claimBusy ? 'Verifying PIN...' : 'Verify PIN & Unlock Setup'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Gate 2: Already claimed -> Require owner sign-in
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Owner Sign-In Required</h1>
            <p className="text-sm text-slate-600">
              Sign in with the authorized Google account for{' '}
              <strong>{card.businessName || card.cardId}</strong> to edit this card.
            </p>
          </div>
          {claimError && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {claimError}
            </p>
          )}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {signingIn ? 'Signing in...' : 'Sign In with Google'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/c/${card.cardId}`)}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              View Public Card
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 3: Signed in as someone else -> Block unauthorized edit
  if (card.ownerUid !== user.uid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">Access Restricted</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              You are signed in as <strong className="text-slate-900">{user.email}</strong>, which
              does not have edit permission for this business card.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Switch Account
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/c/${card.cardId}`)}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Public Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 4: Optional extra Owner Edit PIN lock
  if (card.hasOwnerPin && !ownerPinUnlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900">Enter Owner Edit PIN</h1>
            <p className="text-sm text-slate-600">
              This card has an additional Edit PIN enabled for{' '}
              <strong>{card.businessName || card.cardId}</strong>.
            </p>
          </div>
          <form onSubmit={handleVerifyOwnerPin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              value={ownerPinEntry}
              onChange={(e) => setOwnerPinEntry(e.target.value)}
              placeholder="Enter your Edit PIN"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-700"
              required
            />
            {ownerPinError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {ownerPinError}
              </p>
            )}
            <button
              type="submit"
              disabled={verifyingOwnerPin}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {verifyingOwnerPin ? 'Checking PIN...' : 'Unlock Editor'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const activeButtonCount = countPublicButtons(form);
  const remainingButtonSlots = Math.max(0, CARD_LIMITS.maxPublicButtons - activeButtonCount);
  const permanentUrl = getPermanentCardUrl(card.cardId);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              My Cards
            </button>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <span className="text-sm font-semibold text-slate-900 truncate hidden sm:inline">
              {form.businessName || card.cardId}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              QR &amp; NFC
            </button>
            {card.isPublished && (
              <button
                type="button"
                onClick={() => onNavigate(`/c/${card.cardId}`)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Live Card
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Permanent Destination Summary */}
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-900">
              {card.isPublished ? 'Live' : 'Draft'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Permanent QR &amp; NFC URL:</span>
            <code className="font-mono text-slate-900 break-all">{permanentUrl}</code>
          </div>
          <span className="text-slate-500 tabular-nums shrink-0">
            {activeButtonCount} / {CARD_LIMITS.maxPublicButtons} public buttons
          </span>
        </div>

        {/* Mobile Edit / Preview Switcher */}
        <div className="lg:hidden flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => setMobileView('edit')}
            className={`flex-1 min-h-[40px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              mobileView === 'edit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => setMobileView('preview')}
            className={`flex-1 min-h-[40px] rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileView === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview Card
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Setup Form */}
          <div
            className={`lg:col-span-7 space-y-6 ${
              mobileView === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Section 1: Business Information */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Business Information</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shown at the top of your digital card and included in Save Contact (.vcf).
                </p>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800">Business Logo</label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Business logo preview"
                        className="w-full h-full object-contain p-1.5"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No Logo</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {logoUploading ? 'Processing...' : 'Upload Logo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="sr-only"
                      />
                    </label>
                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, logoUrl: '' })}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="businessName" className="block text-sm font-medium text-slate-800">
                    Business Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    maxLength={CARD_LIMITS.businessNameMax}
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="e.g., Harbor Coffee Roasters"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ownerName" className="block text-sm font-medium text-slate-800">
                    Owner / Contact Name
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    maxLength={CARD_LIMITS.ownerNameMax}
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    placeholder="e.g., Maya Patel"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className="block text-sm font-medium text-slate-800">
                  Profile Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  maxLength={CARD_LIMITS.descriptionMax}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Specialty espresso bar, fresh pastries, and neighborhood workspace."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-800">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    maxLength={CARD_LIMITS.phoneMax}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 415 555 0198"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    maxLength={CARD_LIMITS.emailMax}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="hello@harborcoffee.com"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="address" className="block text-sm font-medium text-slate-800">
                  Business Address
                </label>
                <input
                  id="address"
                  type="text"
                  maxLength={CARD_LIMITS.addressMax}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="240 Market Street, Suite 4, San Francisco, CA"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Card Accent Color</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {ACCENT_PRESETS.map((preset) => {
                    const selected = form.accentColor === preset.hex;
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setForm({ ...form, accentColor: preset.hex })}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer ${
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/40"
                          style={{ backgroundColor: preset.hex }}
                        />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Section 2: Public Buttons (Max 7) */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Action Buttons &amp; Links</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Only filled-in links appear on your card. Maximum 7 public buttons.
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums shrink-0 ${
                    activeButtonCount >= CARD_LIMITS.maxPublicButtons
                      ? 'text-amber-700'
                      : 'text-slate-700'
                  }`}
                >
                  {activeButtonCount} / {CARD_LIMITS.maxPublicButtons} used
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="googleReviewUrl" className="block text-sm font-medium text-slate-800">
                    Google Review URL
                  </label>
                  <input
                    id="googleReviewUrl"
                    type="url"
                    maxLength={CARD_LIMITS.googleReviewUrlMax}
                    value={form.googleReviewUrl}
                    disabled={!form.googleReviewUrl && remainingButtonSlots === 0}
                    onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
                    placeholder="https://g.page/r/your-business/review"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="whatsapp" className="block text-sm font-medium text-slate-800">
                      WhatsApp Number or Link
                    </label>
                    <input
                      id="whatsapp"
                      type="text"
                      maxLength={CARD_LIMITS.whatsappMax}
                      value={form.whatsapp}
                      disabled={!form.whatsapp && remainingButtonSlots === 0}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                      placeholder="+1 415 555 0198"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="instagram" className="block text-sm font-medium text-slate-800">
                      Instagram Handle or URL
                    </label>
                    <input
                      id="instagram"
                      type="text"
                      maxLength={CARD_LIMITS.instagramMax}
                      value={form.instagram}
                      disabled={!form.instagram && remainingButtonSlots === 0}
                      onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                      placeholder="@harborcoffee"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="facebook" className="block text-sm font-medium text-slate-800">
                      Facebook Page or URL
                    </label>
                    <input
                      id="facebook"
                      type="text"
                      maxLength={CARD_LIMITS.facebookMax}
                      value={form.facebook}
                      disabled={!form.facebook && remainingButtonSlots === 0}
                      onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                      placeholder="https://facebook.com/harborcoffee"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="website" className="block text-sm font-medium text-slate-800">
                      Website URL
                    </label>
                    <input
                      id="website"
                      type="url"
                      maxLength={CARD_LIMITS.websiteMax}
                      value={form.website}
                      disabled={!form.website && remainingButtonSlots === 0}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://harborcoffee.com"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Links */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Custom Links</h3>
                  <button
                    type="button"
                    onClick={handleAddCustomLink}
                    disabled={remainingButtonSlots === 0}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Link
                  </button>
                </div>

                {remainingButtonSlots === 0 && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Maximum of 7 public buttons reached. Clear a link above to add another.
                  </p>
                )}

                {form.customLinks.map((cl, idx) => (
                  <div
                    key={cl.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-slate-50 border border-slate-200 rounded-2xl p-3"
                  >
                    <input
                      type="text"
                      maxLength={CARD_LIMITS.customLinkLabelMax}
                      value={cl.label}
                      onChange={(e) => handleUpdateCustomLink(idx, 'label', e.target.value)}
                      placeholder="Button label (e.g. Menu)"
                      className="sm:col-span-5 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                    <input
                      type="url"
                      maxLength={CARD_LIMITS.customLinkUrlMax}
                      value={cl.url}
                      onChange={(e) => handleUpdateCustomLink(idx, 'url', e.target.value)}
                      placeholder="https://..."
                      className="sm:col-span-6 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomLink(idx)}
                      className="sm:col-span-1 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      aria-label="Remove custom link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: Guest Wi-Fi */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Guest Wi-Fi</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional. Displayed on your public card with 1-tap password copy and Wi-Fi QR scan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="wifiSsid" className="block text-sm font-medium text-slate-800">
                    Wi-Fi Network Name (SSID)
                  </label>
                  <input
                    id="wifiSsid"
                    type="text"
                    maxLength={CARD_LIMITS.wifiSsidMax}
                    value={form.wifiSsid}
                    onChange={(e) => setForm({ ...form, wifiSsid: e.target.value })}
                    placeholder="Harbor_Guest"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="wifiPassword" className="block text-sm font-medium text-slate-800">
                    Wi-Fi Password
                  </label>
                  <input
                    id="wifiPassword"
                    type="text"
                    maxLength={CARD_LIMITS.wifiPasswordMax}
                    disabled={form.wifiIsOpen}
                    value={form.wifiIsOpen ? '' : form.wifiPassword}
                    onChange={(e) => setForm({ ...form, wifiPassword: e.target.value })}
                    placeholder={form.wifiIsOpen ? 'Open network (no password)' : 'Enter Wi-Fi password'}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.wifiIsOpen}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      wifiIsOpen: e.target.checked,
                      wifiPassword: e.target.checked ? '' : form.wifiPassword,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                />
                Open network (no password required)
              </label>
            </section>

            {/* Section 4: Extra Owner Edit PIN Lock */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    Card Edit Security
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Protected by your Google account ({user.email}). Optionally add a secondary
                    Edit PIN lock.
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-600 shrink-0">
                  {form.hasOwnerPin ? 'Edit PIN active' : 'Google Auth only'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={12}
                  value={newOwnerPin}
                  onChange={(e) => setNewOwnerPin(e.target.value)}
                  placeholder={form.hasOwnerPin ? 'Set new Edit PIN' : 'Optional 4–6 digit PIN'}
                  className="flex-1 min-w-[180px] min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
                <button
                  type="button"
                  disabled={savingPin || !newOwnerPin.trim()}
                  onClick={() => handleSaveOwnerPin(newOwnerPin)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {form.hasOwnerPin ? 'Update PIN' : 'Enable PIN'}
                </button>
                {form.hasOwnerPin && (
                  <button
                    type="button"
                    disabled={savingPin}
                    onClick={() => handleSaveOwnerPin('')}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Remove PIN
                  </button>
                )}
              </div>
              {pinSaveMsg && <p className="text-xs text-teal-800">{pinSaveMsg}</p>}
            </section>
          </div>

          {/* Right Column: Live Card Preview */}
          <aside
            className={`lg:col-span-5 lg:sticky lg:top-24 space-y-3 ${
              mobileView === 'edit' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-slate-800">Live Mobile Card Preview</h2>
              <span className="text-xs font-mono text-slate-500">/c/{card.cardId}</span>
            </div>
            <div className="max-w-md mx-auto">
              <CardPreview card={form} isPreviewMode />
            </div>
          </aside>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            {saveErrorMsg && (
              <p className="text-xs font-medium text-rose-700 truncate">{saveErrorMsg}</p>
            )}
            {saveSuccessMsg && (
              <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{saveSuccessMsg}</span>
              </p>
            )}
            {!saveErrorMsg && !saveSuccessMsg && (
              <p className="text-xs text-slate-500 hidden sm:block">
                Saving updates your existing permanent QR code and NFC destination immediately.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-none min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save and Go Live'}
            </button>
          </div>
        </div>
      </div>

      {showQrModal && (
        <QrCodeModal
          card={form}
          isOwner={true}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
