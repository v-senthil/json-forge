import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Wand2, Play, Copy, RefreshCw } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';

export function MockDataView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('Provide a JSON template/sample', 'error'); return; }
    setLoading(true);
    try {
      const r = await worker.generateMock(jsonInput, {
        count,
        locale: 'en',
        seed: seed ? Number(seed) : undefined,
      });
      setResult(r);
    } catch (err) {
      showToast(`Failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, count, seed, worker, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  const handleRegenerate = useCallback(() => {
    setSeed(String(Date.now()));
    handleGenerate();
  }, [handleGenerate]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Wand2 size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Mock Data Generator</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Count:</label>
          <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={10000} style={{ width: '60px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', textAlign: 'center' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Seed:</label>
          <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="random" style={{ width: '70px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', textAlign: 'center' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Generate
        </button>
        {result && (
          <>
            <button onClick={handleRegenerate} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={12} /> Shuffle</button>
            <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12} /> Copy</button>
          </>
        )}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={40} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template / Sample JSON</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={60} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Generated Mock Data {result && `(${count} items)`}
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={result || '// Provide a JSON template and click Generate\n// Field names like "email", "name", "date", "id", etc.\n// will produce contextually appropriate values'} readOnly language="json" />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
