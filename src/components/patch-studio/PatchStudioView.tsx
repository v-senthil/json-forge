import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Wrench, Play, Plus, Trash2, Copy, ArrowDown } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { PatchOperation } from '../../types';

const OP_TYPES: PatchOperation['op'][] = ['add', 'remove', 'replace', 'move', 'copy', 'test'];

export function PatchStudioView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState<PatchOperation[]>([
    { op: 'add', path: '/newField', value: 'hello' },
  ]);
  const [patchJson, setPatchJson] = useState('');

  const addOp = useCallback(() => {
    setOperations(prev => [...prev, { op: 'add', path: '/', value: '' }]);
  }, []);

  const removeOp = useCallback((idx: number) => {
    setOperations(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateOp = useCallback((idx: number, updates: Partial<PatchOperation>) => {
    setOperations(prev => prev.map((op, i) => i === idx ? { ...op, ...updates } : op));
  }, []);

  const handleApply = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      // Parse values from string
      const ops = operations.map(op => ({
        ...op,
        value: op.value !== undefined ? tryParseValue(String(op.value)) : undefined,
      }));
      const r = await worker.applyPatch(jsonInput, ops);
      setResult(r);
      setPatchJson(JSON.stringify(operations, null, 2));
    } catch (err) {
      showToast(`Patch failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, operations, worker, showToast]);

  const handleImportPatch = useCallback(() => {
    try {
      const ops = JSON.parse(patchJson) as PatchOperation[];
      if (!Array.isArray(ops)) throw new Error('Must be array');
      setOperations(ops);
      showToast('Patch imported', 'success');
    } catch (err) {
      showToast(`Invalid patch: ${err}`, 'error');
    }
  }, [patchJson, showToast]);

  const handleCopyPatch = useCallback(() => {
    const json = JSON.stringify(operations, null, 2);
    navigator.clipboard.writeText(json);
    showToast('Patch copied!', 'success');
  }, [operations, showToast]);

  const handleCopyResult = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  const needsFrom = (op: string) => op === 'move' || op === 'copy';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Wrench size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>JSON Patch Studio (RFC 6902)</span>
        <button onClick={addOp} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.6875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}><Plus size={12} /> Add Op</button>
        <button onClick={handleCopyPatch} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.6875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}><Copy size={12} /> Copy Patch</button>
        <button onClick={handleApply} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Apply Patch
        </button>
        {result && <button onClick={handleCopyResult} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}>Copy Result</button>}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* JSON Input */}
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original JSON</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        {/* Patch Operations */}
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Patch Ops ({operations.length})</span>
            </div>
            {operations.map((op, idx) => (
              <div key={idx} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', width: '16px' }}>{idx + 1}</span>
                  <select value={op.op} onChange={e => updateOp(idx, { op: e.target.value as PatchOperation['op'] })} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.6875rem', fontWeight: 600 }}>
                    {OP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={() => removeOp(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: 'auto', padding: 0 }}><Trash2 size={13} /></button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input value={op.path} onChange={e => updateOp(idx, { path: e.target.value })} placeholder="/path" style={{ flex: 1, padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.6875rem', fontFamily: 'monospace' }} />
                  {needsFrom(op.op) && <input value={op.from || ''} onChange={e => updateOp(idx, { from: e.target.value })} placeholder="/from" style={{ flex: 1, padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.6875rem', fontFamily: 'monospace' }} />}
                </div>
                {op.op !== 'remove' && !needsFrom(op.op) && (
                  <input value={op.value !== undefined ? String(op.value) : ''} onChange={e => updateOp(idx, { value: e.target.value })} placeholder="value (JSON or string)" style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.6875rem', fontFamily: 'monospace' }} />
                )}
              </div>
            ))}
            {/* Import patch JSON */}
            <div style={{ padding: '8px 12px', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowDown size={11} /> Import Patch JSON</div>
              <textarea value={patchJson} onChange={e => setPatchJson(e.target.value)} placeholder='[{"op":"add","path":"/key","value":"val"}]' rows={4} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.6875rem', fontFamily: 'monospace', resize: 'vertical' }} />
              <button onClick={handleImportPatch} style={{ marginTop: '4px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.6875rem', cursor: 'pointer' }}>Import</button>
            </div>
          </div>
        </Panel>
        <Separator />
        {/* Result */}
        <Panel defaultSize={40} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patched Result</div>
            <div style={{ flex: 1 }}><JsonEditor value={result || '// Apply patch to see result'} readOnly language="json" /></div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

function tryParseValue(str: string): unknown {
  try { return JSON.parse(str); } catch { return str; }
}
