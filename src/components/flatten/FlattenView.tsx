import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Layers, ArrowRightLeft, Play, Settings } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';

export function FlattenView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'flatten' | 'unflatten'>('flatten');
  const [delimiter, setDelimiter] = useState('.');
  const [safe, setSafe] = useState(false);
  const [maxDepth, setMaxDepth] = useState('');

  const handleRun = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      if (mode === 'flatten') {
        const r = await worker.flatten(jsonInput, {
          delimiter,
          safe,
          maxDepth: maxDepth ? Number(maxDepth) : undefined,
        });
        setResult(r);
      } else {
        const r = await worker.unflatten(jsonInput, delimiter);
        setResult(r);
      }
    } catch (err) {
      showToast(`${mode} failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, mode, delimiter, safe, maxDepth, worker, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Layers size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Flatten / Unflatten</span>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
          {(['flatten', 'unflatten'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.75rem', cursor: 'pointer', textTransform: 'capitalize',
            }}>{m}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
          <Settings size={12} color="var(--text-muted)" />
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Delimiter:</label>
          <input value={delimiter} onChange={e => setDelimiter(e.target.value)} style={{ width: '40px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', textAlign: 'center' }} />
        </div>
        {mode === 'flatten' && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={safe} onChange={e => setSafe(e.target.checked)} /> Safe arrays
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Max depth:</label>
              <input value={maxDepth} onChange={e => setMaxDepth(e.target.value)} placeholder="∞" style={{ width: '40px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', textAlign: 'center' }} />
            </div>
          </>
        )}
        <button onClick={handleRun} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          {loading ? <ArrowRightLeft size={12} className="animate-spin" /> : <Play size={12} />}
          {mode === 'flatten' ? 'Flatten' : 'Unflatten'}
        </button>
        {result && <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}>Copy</button>}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JSON Input</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={50} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {mode === 'flatten' ? 'Flattened Output' : 'Unflattened Output'}
            </div>
            <div style={{ flex: 1 }}><JsonEditor value={result} readOnly language="json" /></div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
