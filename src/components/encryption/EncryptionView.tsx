import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Lock, Unlock, Play, Copy, Hash, ShieldCheck } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import type { EncryptionMode, HashAlgorithm } from '../../types';

export function EncryptionView() {
  const { jsonInput } = useAppState();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<EncryptionMode>('base64-encode');
  const [secret, setSecret] = useState('');
  const [hashAlgo, setHashAlgo] = useState<HashAlgorithm>('SHA-256');

  const handleRun = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      let output = '';
      switch (mode) {
        case 'base64-encode':
          output = btoa(unescape(encodeURIComponent(jsonInput)));
          break;
        case 'base64-decode':
          output = decodeURIComponent(escape(atob(jsonInput.trim())));
          try { output = JSON.stringify(JSON.parse(output), null, 2); } catch { /* not JSON, leave as is */ }
          break;
        case 'aes-encrypt': {
          if (!secret) { showToast('Secret key required', 'error'); setLoading(false); return; }
          const enc = new TextEncoder();
          const keyData = await crypto.subtle.importKey('raw', enc.encode(secret.padEnd(32, '0').slice(0, 32)), 'AES-GCM', false, ['encrypt']);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyData, enc.encode(jsonInput));
          const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
          combined.set(iv);
          combined.set(new Uint8Array(encrypted), iv.length);
          output = btoa(String.fromCharCode(...combined));
          break;
        }
        case 'aes-decrypt': {
          if (!secret) { showToast('Secret key required', 'error'); setLoading(false); return; }
          const enc2 = new TextEncoder();
          const dec = new TextDecoder();
          const raw = Uint8Array.from(atob(jsonInput.trim()), c => c.charCodeAt(0));
          const iv2 = raw.slice(0, 12);
          const ciphertext = raw.slice(12);
          const keyData2 = await crypto.subtle.importKey('raw', enc2.encode(secret.padEnd(32, '0').slice(0, 32)), 'AES-GCM', false, ['decrypt']);
          const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv2 }, keyData2, ciphertext);
          output = dec.decode(decrypted);
          try { output = JSON.stringify(JSON.parse(output), null, 2); } catch { /* not JSON */ }
          break;
        }
        case 'hmac': {
          if (!secret) { showToast('Secret key required', 'error'); setLoading(false); return; }
          const enc3 = new TextEncoder();
          const key3 = await crypto.subtle.importKey('raw', enc3.encode(secret), { name: 'HMAC', hash: hashAlgo }, false, ['sign']);
          const sig = await crypto.subtle.sign('HMAC', key3, enc3.encode(jsonInput));
          output = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
          break;
        }
        case 'hash': {
          const enc4 = new TextEncoder();
          const digest = await crypto.subtle.digest(hashAlgo, enc4.encode(jsonInput));
          output = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
          break;
        }
      }
      setResult(output);
    } catch (err) {
      showToast(`Operation failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, mode, secret, hashAlgo, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  const modes: { id: EncryptionMode; label: string; icon: React.ReactNode }[] = [
    { id: 'base64-encode', label: 'B64 Encode', icon: <Lock size={11} /> },
    { id: 'base64-decode', label: 'B64 Decode', icon: <Unlock size={11} /> },
    { id: 'aes-encrypt', label: 'AES Encrypt', icon: <Lock size={11} /> },
    { id: 'aes-decrypt', label: 'AES Decrypt', icon: <Unlock size={11} /> },
    { id: 'hmac', label: 'HMAC', icon: <ShieldCheck size={11} /> },
    { id: 'hash', label: 'Hash', icon: <Hash size={11} /> },
  ];

  const needsSecret = ['aes-encrypt', 'aes-decrypt', 'hmac'].includes(mode);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <Lock size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Encryption</span>
        <div style={{ display: 'flex', gap: '3px', marginLeft: '8px', flexWrap: 'wrap' }}>
          {modes.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: mode === m.id ? 'var(--accent)' : 'transparent',
              color: mode === m.id ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.6875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
            }}>{m.icon} {m.label}</button>
          ))}
        </div>
        {needsSecret && (
          <input value={secret} onChange={e => setSecret(e.target.value)} placeholder="Secret key..." type="password" style={{ width: '140px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
        )}
        {(mode === 'hmac' || mode === 'hash') && (
          <select value={hashAlgo} onChange={e => setHashAlgo(e.target.value as HashAlgorithm)} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}>
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-384">SHA-384</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        )}
        <button onClick={handleRun} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Run
        </button>
        {result && <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12} /> Copy</button>}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Output</div>
            <div style={{ flex: 1 }}><JsonEditor value={result} readOnly language="plaintext" /></div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
