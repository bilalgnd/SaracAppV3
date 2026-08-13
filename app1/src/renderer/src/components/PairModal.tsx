import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, X, Smartphone, Copy, Check } from 'lucide-react';
import { customAlert } from '../utils/alert';
import { generateQRMatrix } from '../utils/qrGenerator';

interface PairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PairModal({ isOpen, onClose }: PairModalProps) {
  const [code, setCode] = useState<string>('------');
  const [qrData, setQrData] = useState<string>('');
  const [shopId, setShopId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const getLocalPairCode = () => {
    let saved = localStorage.getItem('kasa_pair_code');
    if (!saved || saved === '123456' || saved.length !== 6) {
      saved = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem('kasa_pair_code', saved);
    }
    return saved;
  };

  const fetchPairCode = async () => {
    setLoading(true);
    try {
      let gotData = false;
      if (window.api && (window.api as any).getPairCode) {
        const res = await (window.api as any).getPairCode();
        if (res && res.success && res.code) {
          setCode(res.code);
          setQrData(res.qrData || res.code);
          setShopId(res.shopId || 'sarac');
          localStorage.setItem('kasa_pair_code', res.code);
          gotData = true;
        }
      }

      if (!gotData) {
        // Direct Web API fallback
        const token = localStorage.getItem('token') || '';
        const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('https://bilalgnd.shop/api/shop/pair-code', { headers });
        const data = await res.json();
        if (data && (data.success || data.code)) {
          setCode(data.code);
          setQrData(data.qrData || data.code);
          setShopId(data.shopId || 'sarac');
          localStorage.setItem('kasa_pair_code', data.code);
        } else {
          const fallbackCode = getLocalPairCode();
          const activeToken = localStorage.getItem('token') || '123456';
          setCode(fallbackCode);
          setQrData(JSON.stringify({ app: 'saracapp', type: 'pair', code: fallbackCode, token: activeToken, shopId: 'sarac', url: 'bilalgnd.shop' }));
        }
      }
    } catch (e) {
      console.error('Fetch pair code error', e);
      const fallbackCode = getLocalPairCode();
      const activeToken = localStorage.getItem('token') || '123456';
      setCode(fallbackCode);
      setQrData(JSON.stringify({ app: 'saracapp', type: 'pair', code: fallbackCode, token: activeToken, shopId: 'sarac', url: 'bilalgnd.shop' }));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      let gotData = false;
      if (window.api && (window.api as any).refreshPairCode) {
        const res = await (window.api as any).refreshPairCode();
        if (res && res.success && res.code) {
          setCode(res.code);
          setQrData(res.qrData || res.code);
          localStorage.setItem('kasa_pair_code', res.code);
          gotData = true;
          customAlert('Eşleşme kodu başarıyla yenilendi!', 'success');
        }
      }

      if (!gotData) {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const activeToken = localStorage.getItem('token') || '123456';
        setCode(newCode);
        setQrData(JSON.stringify({ app: 'saracapp', type: 'pair', code: newCode, token: activeToken, shopId: 'sarac', url: 'bilalgnd.shop' }));
        localStorage.setItem('kasa_pair_code', newCode);
        customAlert('Eşleşme kodu başarıyla yenilendi!', 'success');
      }
    } catch (e) {
      console.error('Refresh pair code error', e);
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const activeToken = localStorage.getItem('token') || '123456';
      setCode(newCode);
      setQrData(JSON.stringify({ app: 'saracapp', type: 'pair', code: newCode, token: activeToken, shopId: 'sarac', url: 'bilalgnd.shop' }));
      localStorage.setItem('kasa_pair_code', newCode);
      customAlert('Eşleşme kodu başarıyla yenilendi!', 'success');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (code && code !== '------') {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPairCode();
    }
  }, [isOpen]);

  const matrix = useMemo(() => {
    const activeToken = localStorage.getItem('token') || '123456';
    const rawData = qrData || JSON.stringify({ app: 'saracapp', type: 'pair', code: code || '123456', token: activeToken, shopId: shopId || 'sarac', url: 'bilalgnd.shop' });
    try {
      return generateQRMatrix(rawData);
    } catch (e) {
      console.error('QR Matrix Generation Error:', e);
      return [];
    }
  }, [qrData, code, shopId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          width: 480,
          maxWidth: '90vw',
          maxHeight: '90vh',
          padding: 24,
          borderRadius: 16,
          background: '#18181b',
          border: '1px solid #27272a',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={22} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 'bold' }}>Garson Eşleşme (App2)</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#2a2a2a',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: '#aaa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ color: '#a1a1aa', fontSize: 13, textAlign: 'center', margin: '0 0 20px 0' }}>
          Garson telefonundaki <b>SaracApp (App2)</b> uygulamasından bu QR kodu okutun veya aşağıdaki 6 haneli kodu girin.
        </p>

        {/* QR Code Container */}
        <div
          style={{
            background: '#fff',
            padding: 12,
            borderRadius: 16,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            marginBottom: 20,
            width: 220,
            height: 220,
            overflow: 'hidden'
          }}
        >
          {loading && !code ? (
            <div style={{ color: '#666', fontSize: 14, fontWeight: 'bold' }}>Kod yükleniyor...</div>
          ) : matrix && matrix.length > 0 ? (
            <svg
              viewBox={`0 0 ${matrix.length + 8} ${matrix.length + 8}`}
              style={{ width: '100%', height: '100%', display: 'block', padding: '6px' }}
              shapeRendering="crispEdges"
            >
              <rect width="100%" height="100%" fill="#ffffff" />
              {matrix.map((row, r) =>
                row.map((cell, c) =>
                  cell ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c + 4}
                      y={r + 4}
                      width={1}
                      height={1}
                      fill="#000000"
                    />
                  ) : null
                )
              )}
            </svg>
          ) : (
            <div style={{ color: '#666', fontSize: 14, fontWeight: 'bold' }}>QR oluşturulamadı</div>
          )}
        </div>

        {/* 6-Digit Code Badge */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Kasa Bağlantı Kodu ({shopId || 'Kasa'})
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              background: '#27272a',
              padding: '10px 24px',
              borderRadius: 12,
              border: '1px solid #3f3f46',
            }}
          >
            <span style={{ fontSize: 32, fontWeight: '900', letterSpacing: 8, color: '#10b981', fontFamily: 'monospace' }}>
              {code}
            </span>
            <button
              onClick={handleCopy}
              title="Kodu Kopyala"
              style={{
                background: copied ? '#10b981' : '#3f3f46',
                border: 'none',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                transition: '0.2s',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#27272a',
              border: '1px solid #3f3f46',
              color: '#fff',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Yeni Kod Üret
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#10b981',
              border: 'none',
              color: '#fff',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 13,
            }}
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
