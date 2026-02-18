import { useState, useCallback, useMemo, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ScrollText, Filter, Download, BarChart3, AlertCircle, Info, AlertTriangle, Bug, HelpCircle } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { downloadFile } from '../../utils';
import type { LogEntry, LogStats, LogLevel } from '../../types';

const levelColors: Record<LogLevel, string> = {
  trace: '#94a3b8',
  debug: '#60a5fa',
  info: '#34d399',
  warn: '#fbbf24',
  error: '#f87171',
  unknown: '#6b7280',
};

const levelIcons: Record<LogLevel, typeof Info> = {
  trace: HelpCircle,
  debug: Bug,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  unknown: HelpCircle,
};

export function LogView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [analysisTime, setAnalysisTime] = useState(0);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [textFilter, setTextFilter] = useState('');
  const [showStats, setShowStats] = useState(true);

  const analyze = useCallback(() => {
    if (!jsonInput.trim()) return;
    worker.analyzeLogs(jsonInput, (response) => {
      if (response.type === 'analyzeLogsResult') {
        setEntries(response.payload.entries);
        setStats(response.payload.stats);
        setAnalysisTime(response.payload.time);
      } else if (response.type === 'error') {
        showToast(response.payload.message, 'error');
      }
    });
  }, [jsonInput, worker, showToast]);

  useEffect(() => {
    if (jsonInput.trim()) {
      const timer = setTimeout(analyze, 500);
      return () => clearTimeout(timer);
    }
  }, [jsonInput, analyze]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (levelFilter !== 'all') {
      result = result.filter(e => e.level === levelFilter);
    }
    if (textFilter.trim()) {
      const q = textFilter.toLowerCase();
      result = result.filter(e =>
        (e.message?.toLowerCase().includes(q)) ||
        JSON.stringify(e.raw).toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, levelFilter, textFilter]);

  const exportFiltered = useCallback(() => {
    const json = JSON.stringify(filteredEntries.map(e => e.raw), null, 2);
    downloadFile(json, 'filtered-logs.json');
    showToast(`Exported ${filteredEntries.length} entries`);
  }, [filteredEntries, showToast]);

  const maxCount = useMemo(() => {
    if (!stats) return 1;
    return Math.max(...Object.values(stats.byLevel), 1);
  }, [stats]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={35} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              JSON Logs Input
            </div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={65} minSize={30}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Toolbar */}
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setLevelFilter('all')}
                  style={{ padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: levelFilter === 'all' ? 'var(--accent)' : 'var(--bg-primary)', color: levelFilter === 'all' ? '#fff' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                  All
                </button>
                {(Object.keys(levelColors) as LogLevel[]).map(level => {
                  const count = stats?.byLevel[level] || 0;
                  if (count === 0 && level !== levelFilter) return null;
                  const Icon = levelIcons[level];
                  return (
                    <button key={level} onClick={() => setLevelFilter(level)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '4px', border: `1px solid ${levelFilter === level ? levelColors[level] : 'var(--border-color)'}`, background: levelFilter === level ? levelColors[level] + '22' : 'var(--bg-primary)', color: levelFilter === level ? levelColors[level] : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                      <Icon size={12} /> {level} ({count})
                    </button>
                  );
                })}
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowStats(!showStats)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: showStats ? 'var(--accent)' : 'var(--bg-primary)', color: showStats ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>
                  <BarChart3 size={12} /> Stats
                </button>
                <button onClick={exportFiltered} disabled={filteredEntries.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', opacity: filteredEntries.length ? 1 : 0.5 }}>
                  <Download size={12} /> Export
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Filter size={14} color="var(--text-muted)" />
                <input type="text" value={textFilter} onChange={e => setTextFilter(e.target.value)}
                  placeholder="Filter by message or field..."
                  style={{ flex: 1, padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {filteredEntries.length}/{entries.length} entries · {analysisTime.toFixed(1)}ms
                </span>
              </div>
            </div>

            {/* Stats Panel */}
            {showStats && stats && (
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Level Distribution</span>
                  {(Object.entries(stats.byLevel) as [LogLevel, number][]).filter(([, c]) => c > 0).map(([level, count]) => (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                      <span style={{ width: '50px', color: levelColors[level], fontWeight: 500 }}>{level}</span>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', borderRadius: '3px', background: levelColors[level] }} />
                      </div>
                      <span style={{ color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
                {stats.timeRange && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Time Range</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From: {stats.timeRange.start}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>To: {stats.timeRange.end}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Top Fields</span>
                  {stats.topFields.slice(0, 5).map(({ field, count }) => (
                    <span key={field} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{field}: {count}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Log Entries */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
              {filteredEntries.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem', flexDirection: 'column', gap: '8px' }}>
                  <ScrollText size={32} opacity={0.3} />
                  <span>{entries.length === 0 ? 'Paste JSON log data in the left panel' : 'No matches with current filters'}</span>
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const Icon = levelIcons[entry.level];
                  return (
                    <div key={entry.index} style={{
                      padding: '6px 10px', margin: '2px', borderRadius: '4px',
                      background: 'var(--bg-secondary)', borderLeft: `3px solid ${levelColors[entry.level]}`,
                      fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon size={12} color={levelColors[entry.level]} />
                        <span style={{ fontWeight: 600, color: levelColors[entry.level], fontSize: '0.6875rem', textTransform: 'uppercase', minWidth: '40px' }}>{entry.level}</span>
                        {entry.timestamp && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{entry.timestamp}</span>}
                      </div>
                      {entry.message && (
                        <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>{entry.message}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
