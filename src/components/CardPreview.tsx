import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Star,
  UserPlus,
  Wifi,
} from 'lucide-react';
import { BusinessCard } from '../types/card';
import {
  buildWifiQrString,
  downloadVcf,
  normalizeFacebookUrl,
  normalizeGoogleReviewUrl,
  normalizeInstagramUrl,
  normalizeWebsiteUrl,
  normalizeWhatsAppUrl,
} from '../lib/cardUtils';

interface CardPreviewProps {
  card: BusinessCard;
  isPreviewMode?: boolean;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ card, isPreviewMode = false }) => {
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [showWifiQr, setShowWifiQr] = useState(false);
  const [wifiQrDataUrl, setWifiQrDataUrl] = useState('');
  const [contactSavedFeedback, setContactSavedFeedback] = useState(false);

  const accent = card.accentColor || '#0F766E';
  const initials = (card.businessName || card.ownerName || 'B')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const googleReviewHref = normalizeGoogleReviewUrl(card.googleReviewUrl);
  const whatsappHref = normalizeWhatsAppUrl(card.whatsapp);
  const instagramHref = normalizeInstagramUrl(card.instagram);
  const facebookHref = normalizeFacebookUrl(card.facebook);
  const websiteHref = normalizeWebsiteUrl(card.website);

  // Build up to 7 configured public buttons in deterministic order
  const publicButtons: {
    key: string;
    label: string;
    subtitle?: string;
    href: string;
    icon: React.ReactNode;
    isHighlight?: boolean;
  }[] = [];

  if (googleReviewHref) {
    publicButtons.push({
      key: 'google-review',
      label: 'Leave a Google Review',
      subtitle: 'Share your experience',
      href: googleReviewHref,
      icon: <Star className="w-5 h-5" />,
      isHighlight: true,
    });
  }
  if (whatsappHref) {
    publicButtons.push({
      key: 'whatsapp',
      label: 'Chat on WhatsApp',
      href: whatsappHref,
      icon: <MessageCircle className="w-5 h-5" />,
    });
  }
  if (instagramHref) {
    publicButtons.push({
      key: 'instagram',
      label: 'Instagram',
      href: instagramHref,
      icon: <Instagram className="w-5 h-5" />,
    });
  }
  if (facebookHref) {
    publicButtons.push({
      key: 'facebook',
      label: 'Facebook',
      href: facebookHref,
      icon: <Facebook className="w-5 h-5" />,
    });
  }
  if (websiteHref) {
    publicButtons.push({
      key: 'website',
      label: 'Visit Website',
      href: websiteHref,
      icon: <Globe className="w-5 h-5" />,
    });
  }

  for (const custom of card.customLinks || []) {
    if (publicButtons.length >= 7) break;
    const href = normalizeWebsiteUrl(custom.url);
    if (custom.label.trim() && href) {
      publicButtons.push({
        key: `custom-${custom.id}`,
        label: custom.label.trim(),
        href,
        icon: <ExternalLink className="w-5 h-5" />,
      });
    }
  }

  const hasWifi = Boolean(card.wifiSsid.trim());
  const hasContactDetails = Boolean(
    card.address.trim() || card.phone.trim() || card.email.trim()
  );

  useEffect(() => {
    if (!showWifiQr || !hasWifi) return;
    let active = true;
    const wifiStr = buildWifiQrString(card.wifiSsid, card.wifiPassword, card.wifiIsOpen);
    QRCode.toDataURL(wifiStr, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (active) setWifiQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [showWifiQr, hasWifi, card.wifiSsid, card.wifiPassword, card.wifiIsOpen]);

  const handleSaveContact = () => {
    downloadVcf(card);
    setContactSavedFeedback(true);
    setTimeout(() => setContactSavedFeedback(false), 2200);
  };

  const handleCopyWifiPassword = async () => {
    if (!card.wifiPassword) return;
    try {
      await navigator.clipboard.writeText(card.wifiPassword);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 1800);
    } catch {
      // Ignore clipboard fallback
    }
  };

  return (
    <article className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      {/* Subtle top accent bar */}
      <div className="h-24 w-full relative" style={{ backgroundColor: accent }}>
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.45), transparent 55%)',
          }}
        />
      </div>

      <div className="px-6 pb-7 -mt-11 relative space-y-6">
        {/* Identity Header */}
        <div className="space-y-3">
          <div className="w-22 h-22 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center">
            {card.logoUrl ? (
              <img
                src={card.logoUrl}
                alt={`${card.businessName || 'Business'} logo`}
                className="w-full h-full object-contain p-1.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                className="text-2xl font-bold font-display tracking-tight"
                style={{ color: accent }}
              >
                {initials || 'B'}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">
              {card.businessName || (isPreviewMode ? 'Your Business Name' : 'Business Profile')}
            </h1>
            {card.ownerName && (
              <p className="text-sm font-medium text-slate-600">{card.ownerName}</p>
            )}
          </div>

          {card.description && (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {card.description}
            </p>
          )}
        </div>

        {/* Save Contact Primary CTA */}
        <button
          type="button"
          onClick={handleSaveContact}
          className="w-full min-h-[48px] px-5 py-3 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-opacity hover:opacity-95 active:scale-[0.99] cursor-pointer"
          style={{ backgroundColor: accent }}
        >
          {contactSavedFeedback ? (
            <>
              <Check className="w-4 h-4" />
              Contact File Downloaded (.vcf)
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Save Contact
            </>
          )}
        </button>

        {/* Contact Details & Address */}
        {hasContactDetails && (
          <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
            {card.phone.trim() && (
              <a
                href={`tel:${card.phone.trim().replace(/\s+/g, '')}`}
                className="min-h-[48px] py-3 flex items-center gap-3 text-sm text-slate-700 hover:text-slate-900 transition-colors"
              >
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate tabular-nums">{card.phone.trim()}</span>
              </a>
            )}
            {card.email.trim() && (
              <a
                href={`mailto:${card.email.trim()}`}
                className="min-h-[48px] py-3 flex items-center gap-3 text-sm text-slate-700 hover:text-slate-900 transition-colors"
              >
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{card.email.trim()}</span>
              </a>
            )}
            {card.address.trim() && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(card.address.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] py-3 flex items-start gap-3 text-sm text-slate-700 hover:text-slate-900 transition-colors"
              >
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{card.address.trim()}</span>
              </a>
            )}
          </div>
        )}

        {/* Action Buttons (Only configured buttons, max 7) */}
        {publicButtons.length > 0 && (
          <div className="space-y-2.5">
            {publicButtons.map((btn) => (
              <a
                key={btn.key}
                href={btn.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`min-h-[52px] w-full px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                  btn.isHighlight
                    ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      btn.isHighlight ? 'bg-white/15 text-amber-300' : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {btn.icon}
                  </span>
                  <span className="text-left min-w-0">
                    <span className="block text-sm font-semibold truncate">{btn.label}</span>
                    {btn.subtitle && (
                      <span className="block text-xs text-slate-300 truncate">{btn.subtitle}</span>
                    )}
                  </span>
                </span>
                <ExternalLink
                  className={`w-4 h-4 shrink-0 ${
                    btn.isHighlight ? 'text-slate-300' : 'text-slate-400'
                  }`}
                />
              </a>
            ))}
          </div>
        )}

        {/* Guest Wi-Fi Section */}
        {hasWifi && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                  <Wifi className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">Guest Wi-Fi</p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {card.wifiSsid.trim()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWifiQr((v) => !v)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                {showWifiQr ? 'Hide QR' : 'Scan Wi-Fi'}
              </button>
            </div>

            {card.wifiIsOpen ? (
              <p className="text-xs text-slate-600">Open Network · No password required</p>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-500 shrink-0">Password</span>
                <span className="text-sm font-mono text-slate-900 flex-1 truncate">
                  {showWifiPassword ? card.wifiPassword : '••••••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowWifiPassword((v) => !v)}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                  aria-label={showWifiPassword ? 'Hide Wi-Fi password' : 'Show Wi-Fi password'}
                >
                  {showWifiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyWifiPassword}
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1 hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedWifi ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedWifi ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}

            {showWifiQr && wifiQrDataUrl && (
              <div className="pt-2 flex flex-col items-center space-y-1.5">
                <img
                  src={wifiQrDataUrl}
                  alt={`Wi-Fi QR code for ${card.wifiSsid}`}
                  className="w-40 h-40 rounded-xl bg-white p-2 border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <p className="text-xs text-slate-500">
                  Point your phone camera to join {card.wifiSsid.trim()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
