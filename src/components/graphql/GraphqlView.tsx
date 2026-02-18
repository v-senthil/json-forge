import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Braces, Play, Copy } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { GraphqlOutputMode } from '../../types';

export function GraphqlView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<GraphqlOutputMode>('schema');
  const [rootName, setRootName] = useState('Root');

  const handleGenerate = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      const output = await worker.generateGraphql(jsonInput, mode, rootName);
      setResult(output);
    } catch (err) {
      showToast(`Failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, mode, rootName, worker, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Braces size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>GraphQL Converter</span>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
          {(['schema', 'query'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.75rem', cursor: 'pointer', textTransform: 'capitalize',
            }}>{m === 'schema' ? 'Schema' : 'Query'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Root Type:</label>
          <input value={rootName} onChange={e => setRootName(e.target.value)} style={{ width: '80px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Generate
        </button>
        {result && <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12} /> Copy</button>}
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
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              GraphQL {mode === 'schema' ? 'Schema' : 'Query'}
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={result || `// Generate GraphQL ${mode} from your JSON`} readOnly language="graphql" />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
