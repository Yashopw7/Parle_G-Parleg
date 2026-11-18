import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { ArrowRight, Lock, Nfc, QrCode, Settings } from 'lucide-react';
import { BusinessCard } from '../types/card';
import { subscribePublicCard } from '../services/cardService';
import { CardPreview } from './CardPreview';
import { QrCodeModal } from './QrCodeModal';

interface PublicCardPageProps {
  cardId: string;
  user: User | null;
  onNavigate: (path: string) => void;
}

export const PublicCardPage: React.FC<PublicCardPageProps> = ({
  cardId,
  user,
  onNavigate,
}) => {
  const [card, setCard] = useState<BusinessCard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    setCard(undefined);
    setError(null);
    const unsub = subscribePublicCard(
      cardId,
      (loaded) => setCard(loaded),
      (err) => setError(err.message)
    );
    return () => unsub();
  }, [cardId]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Unable to load card</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium cursor-pointer"
          >
            Go to Tapfolio Home
          </button>
        </div>
      </div>
    );
  }

  if (card === undefined) {
    return (
      <div className="min-h-screen bg-slate-100 py-8 px-4 flex justify-center">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl overflow-hidden animate-pulse">
          <div className="h-24 bg-slate-200" />
          <div className="p-6 space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-200 -mt-12 border-4 border-white" />
            <div className="h-7 bg-slate-200 rounded-lg w-2/3" />
            <div className="h-4 bg-slate-200 rounded-lg w-1/2" />
            <div className="h-12 bg-slate-200 rounded-2xl w-full" />
            <div className="h-12 bg-slate-100 rounded-2xl w-full" />
            <div className="h-12 bg-slate-100 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (card === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
            <Nfc className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Card Not Found</h1>
          <p className="text-sm text-slate-600">
            No digital business card exists at <span className="font-mono">/c/{cardId}</span>.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Back to Platform
          </button>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(user && card.ownerUid && user.uid === card.ownerUid);
  const isCreator = Boolean(user && user.uid === card.creatorUid);

  // Unclaimed NFC card: guide shop owner directly to Self-Setup
  if (!card.ownerUid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Nfc className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-mono text-slate-500">Card ID · {card.cardId}</p>
            <h1 className="text-2xl font-bold text-slate-900 text-balance">
              Activate Your NFC Business Card
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              This physical NFC card and QR code are ready to be linked to your business. Enter your
              6-digit Setup PIN to configure your logo, links, Wi-Fi, and publish live.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`/setup/${card.cardId}`)}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-teal-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-teal-800 transition-colors cursor-pointer"
          >
            Claim &amp; Set Up Card
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Claimed but not yet published
  if (!card.isPublished) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-7 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">Profile Setup in Progress</h1>
            <p className="text-sm text-slate-600">
              {isOwner || isCreator
                ? 'Your card is saved as a draft. Open Setup to review your preview and click Save and Go Live.'
                : 'The business owner is still setting up this digital card. Check back soon.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(`/setup/${card.cardId}`)}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Owner Setup &amp; Publish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-4">
      <div className="max-w-md mx-auto space-y-5">
        <CardPreview card={card} />

        <footer className="flex items-center justify-between gap-4 px-2 py-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="hover:text-slate-900 transition-colors font-medium cursor-pointer"
          >
            Tapfolio
          </button>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              Share QR
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/setup/${card.cardId}`)}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Owner Edit
            </button>
          </div>
        </footer>
      </div>

      {showQrModal && (
        <QrCodeModal
          card={card}
          isOwner={isOwner}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
