import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Key, Copy, Shield, Clock, AlertTriangle, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '../common/Toast';
import { copyToClipboard } from '../../utils';

export function JwtView() {
  const { showToast } = useToast();
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      const parts = token.trim().split('.');
      if (parts.length !== 3) return null;
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const signature = parts[2];
      const algorithm = header.alg || 'unknown';
      let isExpired = false;
      let expiresAt: Date | undefined;
      let issuedAt: Date | undefined;
      if (payload.exp) {
        expiresAt = new Date(payload.exp * 1000);
        isExpired = expiresAt.getTime() < now;
      }
      if (payload.iat) {
        issuedAt = new Date(payload.iat * 1000);
      }
      return { header, payload, signature, isExpired, expiresAt, issuedAt, algorithm };
    } catch {
      return null;
    }
  }, [token, now]);

  const timeUntilExpiry = useMemo(() => {
    if (!decoded?.expiresAt) return null;
    const diff = decoded.expiresAt.getTime() - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [decoded, now]);

  const handleVerify = useCallback(async () => {
    if (!token.trim() || !secret.trim()) { showToast('Enter token and secret', 'error'); return; }
    try {
      const parts = token.trim().split('.');
      if (parts.length !== 3) { setVerifyResult('invalid'); return; }
      // Client-side HMAC verification using Web Crypto API
      const encoder = new TextEncoder();
      const algo = decoded?.algorithm?.toUpperCase() || 'HS256';
      let hashAlgo: string;
      if (algo === 'HS256') hashAlgo = 'SHA-256';
      else if (algo === 'HS384') hashAlgo = 'SHA-384';
      else if (algo === 'HS512') hashAlgo = 'SHA-512';
      else { showToast(`Verification not supported for ${algo}`, 'error'); return; }
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: hashAlgo }, false, ['sign']);
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${parts[0]}.${parts[1]}`));
      const computedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      setVerifyResult(computedSig === parts[2] ? 'valid' : 'invalid');
    } catch (err) {
      showToast(`Verify error: ${err}`, 'error');
      setVerifyResult('invalid');
    }
  }, [token, secret, decoded, showToast]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    const ok = await copyToClipboard(typeof text === 'object' ? JSON.stringify(text, null, 2) : text);
    if (ok) showToast(`${label} copied`);
  }, [showToast]);

  const sectionStyle = {
    padding: '16px', borderRadius: '8px', background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, gap: '8px',
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Token Input */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Key size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>JWT Token</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fully client-side - no data sent externally</span>
        </div>
        <textarea value={token} onChange={e => { setToken(e.target.value); setVerifyResult(null); }}
          placeholder="Paste your JWT token here..."
          style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-editor)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8125rem', resize: 'vertical', outline: 'none' }} />
      </div>

      {!decoded && token.trim() && (
        <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> Invalid JWT token format. Expected 3 base64-encoded parts separated by dots.
        </div>
      )}

      {decoded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Header */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Header</span>
              <button onClick={() => handleCopy(JSON.stringify(decoded.header, null, 2), 'Header')}
                style={{ padding: '2px 6px', borderRadius: '3px', background: 'transparent', border: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Copy size={12} />
              </button>
            </div>
            <pre style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(decoded.header, null, 2)}
            </pre>
          </div>

          {/* Payload */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payload</span>
              <button onClick={() => handleCopy(JSON.stringify(decoded.payload, null, 2), 'Payload')}
                style={{ padding: '2px 6px', borderRadius: '3px', background: 'transparent', border: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Copy size={12} />
              </button>
            </div>
            <pre style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(decoded.payload, null, 2)}
            </pre>
          </div>

          {/* Signature */}
          <div style={sectionStyle}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signature</span>
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {decoded.signature}
            </div>
          </div>

          {/* Info */}
          <div style={sectionStyle}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Info</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} color="var(--accent)" />
                <span style={{ color: 'var(--text-secondary)' }}>Algorithm:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{decoded.algorithm}</span>
              </div>
              {decoded.issuedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-secondary)' }}>Issued:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{decoded.issuedAt.toLocaleString()}</span>
                </div>
              )}
              {decoded.expiresAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color={decoded.isExpired ? 'var(--error)' : 'var(--success)'} />
                  <span style={{ color: 'var(--text-secondary)' }}>Expires:</span>
                  <span style={{ color: decoded.isExpired ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>
                    {decoded.expiresAt.toLocaleString()}
                    {timeUntilExpiry && <span style={{ marginLeft: '8px', fontSize: '0.75rem' }}>({timeUntilExpiry})</span>}
                  </span>
                </div>
              )}
              {decoded.isExpired && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)' }}>
                  <AlertTriangle size={14} /> Token is expired
                </div>
              )}
              {!decoded.isExpired && decoded.expiresAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
                  <CheckCircle size={14} /> Token is valid (not expired)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify */}
      {decoded && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Lock size={16} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Verify Signature</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type={showSecret ? 'text' : 'password'} value={secret} onChange={e => setSecret(e.target.value)}
                placeholder="Enter secret key..."
                style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-editor)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8125rem' }} />
              <button onClick={() => setShowSecret(!showSecret)}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button onClick={handleVerify}
              style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              Verify
            </button>
          </div>
          {verifyResult === 'valid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.875rem', fontWeight: 600 }}>
              <CheckCircle size={16} /> Signature is valid
            </div>
          )}
          {verifyResult === 'invalid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--error)', fontSize: '0.875rem', fontWeight: 600 }}>
              <AlertTriangle size={16} /> Signature verification failed
            </div>
          )}
        </div>
      )}

      {!token.trim() && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)' }}>
          <Key size={48} opacity={0.3} />
          <p style={{ fontSize: '0.875rem' }}>Paste a JWT token above to decode it</p>
          <p style={{ fontSize: '0.75rem' }}>All processing is done locally — nothing is sent to external services</p>
        </div>
      )}
    </div>
  );
}
