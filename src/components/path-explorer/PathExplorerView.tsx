import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Compass, Search, Copy } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { PathResult } from '../../types';

const EXAMPLES = [
  { label: '$.store.book[*].author', desc: 'All authors' },
  { label: '$.store.book[0]', desc: 'First book' },
  { label: '$.*', desc: 'Root members' },
  { label: 'name', desc: 'Find "name" keys' },
  { label: '.data.items', desc: 'Dot-path access' },
];

export function PathExplorerView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [expression, setExpression] = useState('$.*');
  const [results, setResults] = useState<PathResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);

  const handleExplore = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    if (!expression.trim()) { showToast('Enter a path expression', 'error'); return; }
    setLoading(true);
    try {
      const start = performance.now();
      const r = await worker.explorePaths(jsonInput, expression);
      setTime(performance.now() - start);
      setResults(r);
    } catch (err) {
      showToast(`Explore failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, expression, worker, showToast]);

  const handleCopyResults = useCallback(() => {
    const text = JSON.stringify(results.map(r => ({ path: r.path, value: r.value })), null, 2);
    navigator.clipboard.writeText(text);
    showToast('Copied!', 'success');
  }, [results, showToast]);

  const formatValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  const typeColor = (type: string): string => {
    const map: Record<string, string> = { string: '#10b981', number: '#6366f1', boolean: '#f59e0b', null: '#94a3b8', object: '#8b5cf6', array: '#ec4899' };
    return map[type] || '#6b7280';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Compass size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>JSON Path Explorer</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '200px' }}>
          <input value={expression} onChange={e => setExpression(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleExplore()} placeholder="$.path.to.value or key name..." style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'monospace' }} />
          <button onClick={handleExplore} disabled={loading} style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Search size={12} /> Explore
          </button>
        </div>
        {results.length > 0 && (
          <>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{results.length} result{results.length !== 1 ? 's' : ''} ({time.toFixed(0)}ms)</span>
            <button onClick={handleCopyResults} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.6875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}><Copy size={11} /> Copy</button>
          </>
        )}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={40} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JSON Input</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={60} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Results</div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {results.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '16px' }}>Enter a JSONPath expression to explore</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {EXAMPLES.map(ex => (
                      <button key={ex.label} onClick={() => { setExpression(ex.label); }} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                        <code style={{ color: 'var(--accent)' }}>{ex.label}</code>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>{ex.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {results.map((r, i) => (
                <div key={i} style={{ marginBottom: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 10px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
                    <code style={{ fontSize: '0.75rem', color: 'var(--accent)', flex: 1 }}>{r.path}</code>
                    <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', color: typeColor(r.type), background: `${typeColor(r.type)}15`, fontWeight: 600 }}>{r.type}</span>
                  </div>
                  <pre style={{ padding: '8px 10px', margin: 0, fontSize: '0.6875rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflow: 'auto', background: 'var(--bg-primary)' }}>
                    {formatValue(r.value)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
