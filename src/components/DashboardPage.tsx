import React, { useEffect, useState } from 'react';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  ArrowRight,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  KeyRound,
  LogOut,
  Nfc,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { BusinessCard } from '../types/card';
import {
  createBusinessCard,
  deleteBusinessCard,
  subscribeMyCards,
} from '../services/cardService';
import {
  countPublicButtons,
  getPermanentCardUrl,
  getSetupCardUrl,
  sanitizeCardIdInput,
} from '../lib/cardUtils';
import { QrCodeModal } from './QrCodeModal';

interface DashboardPageProps {
  user: User | null;
  authReady: boolean;
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  authReady,
  onNavigate,
}) => {
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpCardId, setJumpCardId] = useState('');

  // Create Card Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'self' | 'provision'>('self');
  const [customSlug, setCustomSlug] = useState('');
  const [initialName, setInitialName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Handoff screen after provisioning a blank card for a shop owner
  const [provisionResult, setProvisionResult] = useState<{
    cardId: string;
    setupPin: string;
  } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedSetupUrl, setCopiedSetupUrl] = useState(false);

  // Active QR modal & delete confirm
  const [qrModalCard, setQrModalCard] = useState<BusinessCard | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!user) {
      setCards([]);
      return;
    }
    setLoadingCards(true);
    const unsub = subscribeMyCards(user.uid, (list) => {
      setCards(list);
      setLoadingCards(false);
    });
    return () => unsub();
  }, [user]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      setSigningIn(false);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    setCreateError('');
    try {
      const cleanedSlug = customSlug.trim() ? sanitizeCardIdInput(customSlug) : undefined;
      const result = await createBusinessCard({
        creatorUid: user.uid,
        mode: createMode,
        customCardId: cleanedSlug,
        initialBusinessName: initialName,
      });

      if (createMode === 'self') {
        setShowCreateModal(false);
        setCustomSlug('');
        setInitialName('');
        onNavigate(`/setup/${result.cardId}`);
      } else {
        setProvisionResult(result);
        setCustomSlug('');
        setInitialName('');
      }
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Unable to create card.';
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed.error) msg = parsed.error;
      } catch {
        // Not JSON
      }
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    setDeletingId(cardId);
    try {
      await deleteBusinessCard(cardId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleJumpToCard = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeCardIdInput(jumpCardId);
    if (!cleaned) return;
    onNavigate(`/setup/${cleaned}`);
  };

  const filteredCards = cards.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.businessName.toLowerCase().includes(q) ||
      c.ownerName.toLowerCase().includes(q) ||
      c.cardId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xl font-bold font-display tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tapfolio
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {user ? (
              <>
                <a href="#cards" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  My Cards
                </a>
                <button
                  type="button"
                  onClick={() => document.getElementById('claim-card-input')?.focus()}
                  className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Claim Card
                </button>
              </>
            ) : (
              <>
                <a href="#claim" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  Claim NFC Card
                </a>
                <a href="#workflow" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
                  How It Works
                </a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setProvisionResult(null);
                  setCreateError('');
                  setShowCreateModal(true);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Card
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn || !authReady}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {signingIn ? 'Signing In...' : 'Sign In'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {!user ? (
          <>
            {/* Editorial Hero */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-medium text-teal-800">
                    Dynamic NFC &amp; QR Business Card Platform
                  </p>
                  <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.1] text-balance">
                    One permanent NFC card. Editable forever.
                  </h1>
                  <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                    Issue smart NFC cards and printed QR stands to any shop owner. They tap their
                    card, enter their Setup PIN, and manage their Google Reviews, WhatsApp, Guest
                    Wi-Fi, and contact details without ever reprinting a card.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={signingIn || !authReady}
                    className="min-h-[48px] px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {signingIn ? 'Signing in...' : 'Sign In with Google to Start'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="h-full min-h-[280px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-200">
                  <img
                    src="/src/assets/images/nfc_card_counter_1795020872773.jpg"
                    alt="Physical NFC business card and brushed metal QR stand on a retail counter"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </section>

            {/* Quick Claim Bar */}
            <section
              id="claim"
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">Already have an NFC card?</h2>
                <p className="text-sm text-slate-600">
                  Enter the Card ID printed on your package or tap your NFC card to open setup.
                </p>
              </div>
              <form onSubmit={handleJumpToCard} className="flex items-center gap-2.5 w-full md:w-auto">
                <input
                  type="text"
                  value={jumpCardId}
                  onChange={(e) => setJumpCardId(e.target.value)}
                  placeholder="e.g. card-8f3a9k2m"
                  className="flex-1 md:w-60 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Setup
                </button>
              </form>
            </section>

            {/* 3-Step Workflow */}
            <section id="workflow" className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-2.5">
                <p className="text-xs font-mono text-slate-500">01</p>
                <h3 className="text-base font-bold text-slate-900">Permanent Identity</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every business gets a permanent URL (/c/card-id) shared by both the NFC chip and
                  high-res QR code.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-2.5">
                <p className="text-xs font-mono text-slate-500">02</p>
                <h3 className="text-base font-bold text-slate-900">Shop Owner Self-Setup</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Shop owners tap their card, authenticate with their Setup PIN, add logo, Google
                  Review link, social links, and Guest Wi-Fi.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-2.5">
                <p className="text-xs font-mono text-slate-500">03</p>
                <h3 className="text-base font-bold text-slate-900">Update Anytime</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Changing WhatsApp, reviews, or logos updates the live public card instantly while
                  existing QR codes and NFC cards keep working.
                </p>
              </div>
            </section>
          </>
        ) : (
          /* Signed-In Multi-Business Workspace */
          <section id="cards" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Business Cards
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Signed in as {user.email} · {cards.length}{' '}
                  {cards.length === 1 ? 'card' : 'cards'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setProvisionResult(null);
                    setCreateError('');
                    setShowCreateModal(true);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Business Card
                </button>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Search & Claim Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by business name, owner, or card ID..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <form onSubmit={handleJumpToCard} className="lg:col-span-5 flex items-center gap-2">
                <input
                  id="claim-card-input"
                  type="text"
                  value={jumpCardId}
                  onChange={(e) => setJumpCardId(e.target.value)}
                  placeholder="Claim / open card ID..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Claim Card
                </button>
              </form>
            </div>

            {/* Card List */}
            {loadingCards ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-48 rounded-3xl bg-white border border-slate-200 p-6 animate-pulse space-y-4"
                  >
                    <div className="h-6 bg-slate-200 rounded w-1/2" />
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-10 bg-slate-100 rounded-xl w-full mt-4" />
                  </div>
                ))}
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
                  <Nfc className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900">
                    {cards.length === 0 ? 'No business cards yet' : 'No matching cards'}
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    {cards.length === 0
                      ? 'Create your own business card or provision a blank NFC card with a Setup PIN for a shop owner.'
                      : 'Try clearing your search filter.'}
                  </p>
                </div>
                {cards.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-teal-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Card
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCards.map((c) => {
                  const isOwnedByMe = c.ownerUid === user.uid;
                  const isUnclaimed = !c.ownerUid;
                  const statusLabel = isUnclaimed
                    ? 'Awaiting Owner Claim'
                    : c.isPublished
                    ? 'Live'
                    : 'Draft';
                  const buttonCount = countPublicButtons(c);

                  return (
                    <article
                      key={c.cardId}
                      className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between gap-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                              {c.logoUrl ? (
                                <img
                                  src={c.logoUrl}
                                  alt={c.businessName || c.cardId}
                                  className="w-full h-full object-contain p-1"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span
                                  className="text-sm font-bold font-display"
                                  style={{ color: c.accentColor || '#0F766E' }}
                                >
                                  {(c.businessName || c.cardId).slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-slate-900 truncate">
                                {c.businessName || (isUnclaimed ? 'Unclaimed NFC Card' : 'Untitled Card')}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">
                                {c.ownerName || (isUnclaimed ? 'Ready for shop owner' : 'No owner name')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Unboxed metadata row */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span
                            className={`font-semibold ${
                              c.isPublished
                                ? 'text-emerald-700'
                                : isUnclaimed
                                ? 'text-amber-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {statusLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{buttonCount} / 7 buttons</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono truncate">/c/{c.cardId}</span>
                        </div>
                      </div>

                      {confirmDeleteId === c.cardId ? (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 space-y-2">
                          <p className="text-xs text-rose-900 font-medium">
                            Permanently delete {c.businessName || c.cardId}?
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-rose-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === c.cardId}
                              onClick={() => handleDeleteCard(c.cardId)}
                              className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 cursor-pointer disabled:opacity-60"
                            >
                              {deletingId === c.cardId ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => onNavigate(`/c/${c.cardId}`)}
                            className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Public Card
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {(isOwnedByMe || isUnclaimed) && (
                            <button
                              type="button"
                              onClick={() => onNavigate(`/setup/${c.cardId}`)}
                              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {isUnclaimed ? 'Setup' : 'Edit'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setQrModalCard(c)}
                            className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center cursor-pointer"
                            aria-label="Open QR and NFC settings"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {(isOwnedByMe || isUnclaimed) && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.cardId)}
                              className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-rose-700 hover:border-rose-200 transition-colors flex items-center justify-center cursor-pointer"
                              aria-label="Delete card"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Create Business Card Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-card-title"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-card-title" className="text-xl font-bold text-slate-900">
                  {provisionResult ? 'NFC Card Provisioned' : 'New Business Card'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {provisionResult
                    ? 'Save this Setup PIN now. It is never displayed on the public profile.'
                    : 'Every business receives an isolated card and permanent URL.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setProvisionResult(null);
                }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {provisionResult ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-emerald-900">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    <strong>Card created and saved.</strong> Share the Card ID, permanent URL, and
                    6-digit Setup PIN with the shop owner.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Unique Card ID</p>
                    <p className="text-sm font-mono font-semibold text-slate-900">
                      {provisionResult.cardId}
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">Permanent NFC &amp; QR URL</p>
                    <code className="text-xs font-mono text-slate-900 break-all">
                      {getPermanentCardUrl(provisionResult.cardId)}
                    </code>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" />
                        Shop Owner Setup PIN
                      </p>
                      <p className="text-2xl font-bold font-mono tracking-widest text-slate-900 mt-0.5">
                        {provisionResult.setupPin}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(provisionResult.setupPin);
                        setCopiedPin(true);
                        setTimeout(() => setCopiedPin(false), 1800);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedPin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPin ? 'Copied' : 'Copy PIN'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        getSetupCardUrl(provisionResult.cardId)
                      );
                      setCopiedSetupUrl(true);
                      setTimeout(() => setCopiedSetupUrl(false), 1800);
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    {copiedSetupUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSetupUrl ? 'Copied Link' : 'Copy Setup URL'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      onNavigate(`/c/${provisionResult.cardId}`);
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-teal-800 cursor-pointer"
                  >
                    Open Permanent URL
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateCard} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCreateMode('self')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      createMode === 'self'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Set Up Myself
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('provision')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      createMode === 'provision'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    For a Shop Owner
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {createMode === 'self'
                    ? 'Creates a new business card owned by your account and opens the setup studio immediately.'
                    : 'Generates an unclaimed NFC card with a 6-digit Setup PIN so an independent shop owner can claim and edit it on their own phone.'}
                </p>

                {createMode === 'self' && (
                  <div className="space-y-1.5">
                    <label htmlFor="init-name" className="block text-sm font-medium text-slate-800">
                      Business Name
                    </label>
                    <input
                      id="init-name"
                      type="text"
                      value={initialName}
                      onChange={(e) => setInitialName(e.target.value)}
                      placeholder="e.g., Oak &amp; Grain Bakery"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="custom-slug" className="block text-sm font-medium text-slate-800">
                    Permanent Card ID <span className="text-xs text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="custom-slug"
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="Auto-generated (e.g. oak-bakery)"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                {createError && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {createError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {creating
                    ? 'Creating Card...'
                    : createMode === 'self'
                    ? 'Create & Configure Card'
                    : 'Generate Card & Setup PIN'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {qrModalCard && (
        <QrCodeModal
          card={qrModalCard}
          isOwner={Boolean(user && qrModalCard.ownerUid === user.uid)}
          onClose={() => setQrModalCard(null)}
        />
      )}
    </div>
  );
};
