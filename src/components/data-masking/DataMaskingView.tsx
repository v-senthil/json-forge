import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { EyeOff, Play, Copy, Plus, Trash2 } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { MaskingRule } from '../../types';

const RULES: { id: MaskingRule; label: string; desc: string }[] = [
  { id: 'redact', label: 'Redact', desc: 'Replace with ***REDACTED***' },
  { id: 'hash', label: 'Hash', desc: 'One-way hash of value' },
  { id: 'partial', label: 'Partial', desc: 'Show first/last 2 chars' },
  { id: 'randomize', label: 'Randomize', desc: 'Replace with random data' },
  { id: 'nullify', label: 'Nullify', desc: 'Replace with null' },
];

const COMMON_FIELDS = ['password', 'email', 'ssn', 'phone', 'token', 'secret', 'apiKey', 'creditCard', 'address'];

export function DataMaskingView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<string[]>(['password', 'email', 'ssn']);
  const [rule, setRule] = useState<MaskingRule>('redact');
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [newField, setNewField] = useState('');

  const handleMask = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    if (fields.length === 0) { showToast('Add fields to mask', 'error'); return; }
    setLoading(true);
    try {
      const r = await worker.maskData(jsonInput, { fields, rule, preserveStructure });
      setResult(r);
    } catch (err) {
      showToast(`Masking failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, fields, rule, preserveStructure, worker, showToast]);

  const addField = useCallback(() => {
    if (newField.trim() && !fields.includes(newField.trim())) {
      setFields(prev => [...prev, newField.trim()]);
      setNewField('');
    }
  }, [newField, fields]);

  const removeField = useCallback((f: string) => {
    setFields(prev => prev.filter(x => x !== f));
  }, []);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <EyeOff size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Data Masking</span>
        <select value={rule} onChange={e => setRule(e.target.value as MaskingRule)} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}>
          {RULES.map(r => <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={preserveStructure} onChange={e => setPreserveStructure(e.target.checked)} /> Preserve structure
        </label>
        <button onClick={handleMask} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Mask Data
        </button>
        {result && <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12} /> Copy</button>}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={35} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JSON Input</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={25} minSize={15}>
          <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Fields to Mask ({fields.length})
            </div>
            <div style={{ padding: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                <input value={newField} onChange={e => setNewField(e.target.value)} onKeyDown={e => e.key === 'Enter' && addField()} placeholder="Field name..." style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
                <button onClick={addField} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}><Plus size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                {fields.map(f => (
                  <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '0.6875rem', color: 'var(--text-primary)' }}>
                    {f}
                    <button onClick={() => removeField(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', display: 'flex' }}><Trash2 size={11} /></button>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Quick add:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {COMMON_FIELDS.filter(f => !fields.includes(f)).map(f => (
                  <button key={f} onClick={() => setFields(prev => [...prev, f])} style={{ padding: '2px 6px', borderRadius: '3px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.625rem', cursor: 'pointer' }}>
                    + {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={40} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Masked Output</div>
            <div style={{ flex: 1 }}><JsonEditor value={result || '// Masked data will appear here'} readOnly language="json" /></div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
