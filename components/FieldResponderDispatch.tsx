'use client';

import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  X, 
  Copy, 
  Check, 
  MessageSquare, 
  ExternalLink, 
  QrCode, 
  MapPin, 
  Navigation,
  Waves,
  Timer,
  Send
} from 'lucide-react';
import { GPSCoordinate } from '@/lib/kalman';

interface FieldResponderDispatchProps {
  isOpen: boolean;
  onClose: () => void;
  puckId: string | null;
  targetLocation: GPSCoordinate | null;
  waterSpeed?: number;
  driftHeading?: number;
  buoyEtaSec?: number | null;
}

export const FieldResponderDispatch: React.FC<FieldResponderDispatchProps> = ({
  isOpen,
  onClose,
  puckId,
  targetLocation,
  waterSpeed = 1.8,
  driftHeading = 140,
  buoyEtaSec = 31,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [QRCodeComponent, setQRCodeComponent] = useState<any>(null);

  const activePuck = puckId || 'PUCK-ALPHA-04';
  const lat = targetLocation?.lat != null ? targetLocation.lat.toFixed(6) : '17.385044';
  const lng = targetLocation?.lng != null ? targetLocation.lng.toFixed(6) : '78.486671';
  const trackUrl = `https://aquarescue.app/track?id=${activePuck}`;

  useEffect(() => {
    setMounted(true);
    // Dynamic import to prevent SSR hydration mismatch
    import('qrcode.react').then((mod) => {
      setQRCodeComponent(() => mod.QRCodeSVG || (mod as any).default || mod.QRCodeCanvas);
    }).catch(err => console.error('Failed to load qrcode.react:', err));
  }, []);

  if (!isOpen) return null;

  const copyTrackUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const whatsappMessage = `🚨 AQUARESCUE EMERGENCY DISPATCH 🚨\nTarget: ${activePuck}\nGPS Target: ${lat}, ${lng}\nDrift Vector: ${waterSpeed}m/s @ ${driftHeading}°\nBuoy ETA: ${buoyEtaSec ?? 31}s\nTrack Live: ${trackUrl}`;

  const openWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  const openSMS = () => {
    const url = `sms:?body=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono text-gray-200 select-none animate-fade-in">
      <div className="bg-[#111827] border border-[#06B6D4]/40 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#090D16] px-4 py-3 border-b border-[#1F293D] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[#06B6D4]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                RESPONDER MOBILE GPS LINK
              </h2>
              <p className="text-[10px] text-gray-400">INSTANT QR CODE & FIELD PAYLOAD DISPATCH</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target Coords & Details Card */}
          <div className="bg-[#090D16] p-3.5 rounded-lg border border-[#1F293D] space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-[#1F293D] pb-1.5">
              <span className="text-gray-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#EF4444]" />
                TARGET PUCK ID:
              </span>
              <span className="font-extrabold text-white">{activePuck}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 block">LAT / LNG COORDS:</span>
                <span className="font-bold text-[#06B6D4]">{lat}, {lng}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">DRIFT VECTOR:</span>
                <span className="font-bold text-[#F59E0B]">{waterSpeed}m/s @ {driftHeading}°</span>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="bg-[#090D16] p-4 rounded-lg border border-[#06B6D4]/30 flex flex-col items-center justify-center space-y-3">
            <div className="text-xs font-bold text-[#06B6D4] flex items-center gap-1.5 uppercase tracking-wider">
              <QrCode className="w-4 h-4" />
              <span>FIELD RESPONDER LIVE TRACK QR</span>
            </div>

            <div className="p-3 bg-white rounded-xl shadow-xl flex items-center justify-center border-4 border-[#06B6D4]">
              {mounted && QRCodeComponent ? (
                <QRCodeComponent
                  value={trackUrl}
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              ) : (
                <div className="w-[160px] h-[160px] bg-gray-900 flex items-center justify-center text-xs text-gray-400">
                  GENERATING QR...
                </div>
              )}
            </div>

            <p className="text-[10px] text-gray-400 text-center max-w-xs">
              Scan with responder smartphone camera to initiate live HUD tracking mesh without login.
            </p>
          </div>

          {/* Short URL & Copy Action */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">SECURE LIVE TRACKING URL:</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={trackUrl}
                className="flex-1 bg-[#090D16] border border-[#1F293D] rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#06B6D4]"
              />
              <button
                onClick={copyTrackUrl}
                className="px-3.5 py-2 rounded bg-[#06B6D4]/20 border border-[#06B6D4]/60 text-[#06B6D4] hover:bg-[#06B6D4]/40 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'COPIED!' : 'COPY'}</span>
              </button>
            </div>
          </div>

          {/* Quick SMS & WhatsApp 1-Click Payload Dispatch */}
          <div className="space-y-2 pt-2 border-t border-[#1F293D]">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">1-CLICK FIELD TEAM DISPATCH PAYLOAD:</label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={openWhatsApp}
                className="py-2.5 px-3 rounded-lg bg-[#25D366]/15 border border-[#25D366]/50 text-[#25D366] hover:bg-[#25D366]/30 font-bold text-xs uppercase flex items-center justify-center space-x-2 transition-all shadow-lg"
              >
                <MessageSquare className="w-4 h-4" />
                <span>DISPATCH WHATSAPP</span>
              </button>

              <button
                onClick={openSMS}
                className="py-2.5 px-3 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/50 text-[#3B82F6] hover:bg-[#3B82F6]/30 font-bold text-xs uppercase flex items-center justify-center space-x-2 transition-all shadow-lg"
              >
                <Send className="w-4 h-4" />
                <span>DISPATCH SMS</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldResponderDispatch;
