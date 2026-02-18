import { useState, useCallback, useEffect, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Search, Filter, Copy, Hash, Type, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { copyToClipboard } from '../../utils';
import type { SearchMatch, SearchMode, JsonValueType } from '../../types';

const searchModes: { value: SearchMode; label: string; icon: typeof Search }[] = [
  { value: 'key', label: 'Key', icon: Hash },
  { value: 'value', label: 'Value', icon: Type },
  { value: 'regex', label: 'Regex', icon: Filter },
  { value: 'type', label: 'Type', icon: FileText },
  { value: 'path', label: 'Path', icon: Search },
];

const typeOptions: JsonValueType[] = ['object', 'array', 'string', 'number', 'boolean', 'null'];

const typeColors: Record<JsonValueType, string> = {
  object: '#60a5fa',
  array: '#a78bfa',
  string: '#34d399',
  number: '#fbbf24',
  boolean: '#f97316',
  null: '#94a3b8',
};

export function SearchView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [queryText, setQueryText] = useState('');
  const [mode, setMode] = useState<SearchMode>('key');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [fuzzy, setFuzzy] = useState(true);
  const [typeFilter, setTypeFilter] = useState<JsonValueType>('string');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [searchTime, setSearchTime] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const doSearch = useCallback(() => {
    if (!jsonInput.trim() || !queryText.trim()) {
      setMatches([]);
      return;
    }
    setIsSearching(true);
    worker.search(jsonInput, {
      mode: mode === 'type' ? 'type' : mode,
      query: mode === 'type' ? typeFilter : queryText,
      caseSensitive,
      fuzzy,
    }, (response) => {
      setIsSearching(false);
      if (response.type === 'searchResult') {
        setMatches(response.payload.matches);
        setSearchTime(response.payload.time);
      }
    });
  }, [jsonInput, queryText, mode, caseSensitive, fuzzy, typeFilter, worker]);

  // Debounced search
  useEffect(() => {
    if (!queryText.trim() && mode !== 'type') { setMatches([]); return; }
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [queryText, mode, caseSensitive, fuzzy, typeFilter, doSearch]);

  const handleCopyPath = useCallback(async (path: string) => {
    const ok = await copyToClipboard(path);
    if (ok) showToast('Path copied');
  }, [showToast]);

  const truncatedValue = useCallback((val: unknown): string => {
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    return s.length > 80 ? s.substring(0, 80) + '...' : s;
  }, []);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    matches.forEach(m => { byType[m.type] = (byType[m.type] || 0) + 1; });
    return byType;
  }, [matches]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={40} minSize={25}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              JSON Input
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor />
            </div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={60} minSize={30}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Search Controls */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {searchModes.map(m => (
                  <button key={m.value} onClick={() => setMode(m.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: mode === m.value ? 'var(--accent)' : 'var(--bg-primary)', color: mode === m.value ? '#fff' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                    <m.icon size={12} /> {m.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {mode === 'type' ? (
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as JsonValueType)}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <input type="text" value={queryText} onChange={e => setQueryText(e.target.value)}
                    placeholder={mode === 'regex' ? 'Enter regex pattern...' : mode === 'path' ? 'Enter JSON path (e.g. $.users)...' : `Search by ${mode}...`}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none' }} />
                )}
                <button onClick={() => setCaseSensitive(!caseSensitive)} title="Case sensitive"
                  style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: caseSensitive ? 'var(--accent)' : 'var(--bg-primary)', color: caseSensitive ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}>
                  {caseSensitive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} Aa
                </button>
                <button onClick={() => setFuzzy(!fuzzy)} title="Fuzzy match"
                  style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: fuzzy ? 'var(--accent)' : 'var(--bg-primary)', color: fuzzy ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}>
                  ~Fuzzy
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{isSearching ? 'Searching...' : `${matches.length} match${matches.length !== 1 ? 'es' : ''}`}</span>
                {searchTime > 0 && <span>{searchTime.toFixed(1)}ms</span>}
                {Object.entries(stats).map(([type, count]) => (
                  <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[type as JsonValueType] }}></span>
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
              {matches.length === 0 && !isSearching && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <Search size={18} style={{ marginRight: 8, opacity: 0.5 }} />
                  {jsonInput.trim() ? 'Enter a search query to find matches' : 'Paste JSON in the left panel to search'}
                </div>
              )}
              {matches.map((match, i) => (
                <div key={i} className="animate-fade-in" style={{
                  padding: '8px 12px', margin: '2px 4px', borderRadius: '6px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer',
                }} onClick={() => handleCopyPath(match.path)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent)', wordBreak: 'break-all' }}>{match.path}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ padding: '1px 6px', borderRadius: '3px', background: typeColors[match.type], color: '#fff', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' }}>{match.type}</span>
                      <Copy size={12} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{match.key}: </span>
                    {truncatedValue(match.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
