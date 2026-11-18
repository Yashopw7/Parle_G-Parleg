import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  Nfc,
  Printer,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { BusinessCard } from '../types/card';
import { getPermanentCardUrl, getQrDestinationUrl } from '../lib/cardUtils';
import { regenerateQrVersion } from '../services/cardService';

interface QrCodeModalProps {
  card: BusinessCard;
  isOwner: boolean;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ card, isOwner, onClose }) => {
  const permanentNfcUrl = getPermanentCardUrl(card.cardId);
  const qrUrl = getQrDestinationUrl(card.cardId, card.qrVersion);

  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'success' | 'unsupported' | 'error'>('idle');
  const [nfcMessage, setNfcMessage] = useState('');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrUrl, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((dataUrl) => {
        if (active) setQrPreviewUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrPreviewUrl('');
      });

    return () => {
      active = false;
    };
  }, [qrUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(permanentNfcUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Fallback
    }
  };

  const handleDownloadHighResPng = async () => {
    const hiResUrl = await QRCode.toDataURL(qrUrl, {
      width: 1200,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });
    const link = document.createElement('a');
    link.href = hiResUrl;
    link.download = `${card.cardId}-qr-1200px.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPrintStandee = async () => {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 900,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 4;
      ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 54px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const title = (card.businessName || 'Digital Business Card').slice(0, 32);
      ctx.fillText(title, canvas.width / 2, 165);

      ctx.fillStyle = '#475569';
      ctx.font = '500 28px "DM Sans", sans-serif';
      ctx.fillText('Tap NFC card or scan QR to connect', canvas.width / 2, 220);

      ctx.drawImage(img, 150, 280, 900, 900);

      ctx.fillStyle = '#64748B';
      ctx.font = '500 24px "JetBrains Mono", monospace';
      ctx.fillText(`/c/${card.cardId}`, canvas.width / 2, 1275);

      ctx.fillStyle = card.accentColor || '#0F766E';
      ctx.fillRect(460, 1330, 280, 10);

      const finalUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = finalUrl;
      link.download = `${card.cardId}-print-stand.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = qrDataUrl;
  };

  const handleWriteNfcTag = async () => {
    const NdefConstructor = (window as unknown as {
      NDEFReader?: new () => {
        write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void>;
      };
    }).NDEFReader;

    if (!NdefConstructor) {
      setNfcStatus('unsupported');
      setNfcMessage(
        'Web NFC writing is supported on Chrome for Android. On iPhone or desktop, copy the permanent URL above and write it to your NFC tag with NFC Tools.'
      );
      return;
    }

    try {
      setNfcStatus('writing');
      setNfcMessage('Hold your blank NFC card against the back of your phone...');
      const ndef = new NdefConstructor();
      await ndef.write({
        records: [{ recordType: 'url', data: permanentNfcUrl }],
      });
      setNfcStatus('success');
      setNfcMessage('NFC card programmed with your permanent profile URL.');
    } catch (err) {
      setNfcStatus('error');
      setNfcMessage(
        err instanceof Error ? err.message : 'Unable to write to NFC tag. Try again.'
      );
    }
  };

  const handleRegenerateQr = async () => {
    setRegenerating(true);
    try {
      await regenerateQrVersion(card.cardId, card.qrVersion || 1);
      setShowRegenConfirm(false);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="qr-modal-title" className="text-xl font-bold text-slate-900">
              Dynamic QR &amp; NFC Destination
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {card.businessName || card.cardId} · Revision {card.qrVersion}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close QR dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
          {qrPreviewUrl ? (
            <img
              src={qrPreviewUrl}
              alt={`QR code for ${card.businessName || card.cardId}`}
              className="w-56 h-56 rounded-xl bg-white p-2 border border-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-56 h-56 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-400">
              Generating QR...
            </div>
          )}

          <div className="w-full space-y-2">
            <p className="text-xs font-medium text-slate-500">
              Permanent Profile &amp; NFC URL (never changes on edits)
            </p>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <code className="text-xs font-mono text-slate-800 truncate flex-1 text-left">
                {permanentNfcUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleDownloadHighResPng}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            High-Res QR (1200px)
          </button>
          <button
            type="button"
            onClick={handleDownloadPrintStandee}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Counter Card
          </button>
        </div>

        <div className="border-t border-slate-200 pt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">NFC Card Programming</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Encode the permanent URL above onto any NTAG213/215/216 NFC card.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWriteNfcTag}
              disabled={nfcStatus === 'writing'}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Nfc className="w-4 h-4" />
              {nfcStatus === 'writing' ? 'Hold NFC Tag...' : 'Write NFC Tag'}
            </button>
          </div>
          {nfcMessage && (
            <p
              className={`text-xs rounded-xl px-3 py-2 border ${
                nfcStatus === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : nfcStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {nfcMessage}
            </p>
          )}
        </div>

        {isOwner && (
          <div className="border-t border-slate-200 pt-4">
            {!showRegenConfirm ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Editing your profile keeps this exact QR code working.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRegenConfirm(true)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Regenerate QR
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5 text-amber-900">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    Only regenerate the QR code if you explicitly want a new QR revision. Your permanent NFC URL{' '}
                    <span className="font-mono">/c/{card.cardId}</span> remains active.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegenConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateQr}
                    disabled={regenerating}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                    Confirm Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
