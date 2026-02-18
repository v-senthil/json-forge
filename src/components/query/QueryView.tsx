import { useState, useCallback, useEffect, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Play, Copy, AlertCircle, Clock } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { copyToClipboard } from '../../utils';
import type { QueryLanguage } from '../../types';

const languages: { value: QueryLanguage; label: string; placeholder: string; examples: string[] }[] = [
  {
    value: 'jq', label: 'jq',
    placeholder: '.users[0].name',
    examples: ['.', '.field', '.field.sub', '.[0]', '.[] | select(.age > 30)', '[.[] | .name]', 'keys', 'length', 'values', 'type', 'unique', 'sort', 'reverse', 'flatten'],
  },
  {
    value: 'jsonata', label: 'JSONata',
    placeholder: 'users.name',
    examples: ['fieldName', 'field.subfield', '*.fieldName', '$count(array)', '$sum(array)', '$distinct(array)', 'array[field=value]'],
  },
  {
    value: 'mongodb', label: 'MongoDB',
    placeholder: '{"status": "active"}',
    examples: ['{"field": "value"}', '{"age": {"$gt": 30}}', '{"$or": [{"a": 1}, {"b": 2}]}', '{"name": {"$regex": "john"}}', '{"tags": {"$in": ["a","b"]}}'],
  },
];

export function QueryView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [language, setLanguage] = useState<QueryLanguage>('jq');
  const [queryText, setQueryText] = useState('.');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [queryTime, setQueryTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const runQuery = useCallback(async () => {
    if (!jsonInput.trim() || !queryText.trim()) return;
    setIsRunning(true);
    setError('');
    try {
      const response = await worker.query(jsonInput, queryText, language);
      setIsRunning(false);
      if (response.error) {
        setError(response.error);
        setResult('');
      } else {
        setResult(response.result);
        setError('');
      }
      setQueryTime(response.time);
    } catch (err) {
      setIsRunning(false);
      setError(String(err));
      setResult('');
    }
  }, [jsonInput, queryText, language, worker]);

  // Debounced auto-run
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runQuery, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [runQuery]);

  const activeLang = languages.find(l => l.value === language)!;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* Left: JSON Input */}
        <Panel defaultSize={40} minSize={25}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              JSON Input
            </div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        {/* Right: Query + Results */}
        <Panel defaultSize={60} minSize={30}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Query Input */}
            <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {languages.map(l => (
                  <button key={l.value} onClick={() => { setLanguage(l.value); setQueryText(l.value === 'jq' ? '.' : l.value === 'mongodb' ? '{}' : ''); }}
                    style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: language === l.value ? 'var(--accent)' : 'var(--bg-primary)', color: language === l.value ? '#fff' : 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    {l.label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} /> {queryTime.toFixed(1)}ms
                </span>
                <button onClick={runQuery} disabled={isRunning}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '4px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <Play size={12} /> Run
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <textarea value={queryText} onChange={e => setQueryText(e.target.value)}
                  placeholder={activeLang.placeholder}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-editor)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.875rem', resize: 'none', minHeight: '40px', maxHeight: '80px', outline: 'none' }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runQuery(); } }} />
              </div>
              {/* Quick examples */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {activeLang.examples.slice(0, 8).map(ex => (
                  <button key={ex} onClick={() => setQueryText(ex)}
                    style={{ padding: '2px 8px', borderRadius: '3px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '8px 12px', background: 'var(--error-bg)', borderBottom: '1px solid var(--error)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--error)' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Result */}
            <div style={{ flex: 1, position: 'relative' }}>
              {result && (
                <button onClick={async () => { await copyToClipboard(result); showToast('Result copied'); }}
                  style={{ position: 'absolute', top: 8, right: 16, zIndex: 10, padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Copy size={12} /> Copy
                </button>
              )}
              <JsonEditor value={result || '// Query results will appear here'} readOnly language="json" />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
