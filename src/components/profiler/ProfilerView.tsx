import { useState, useCallback, useRef, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Activity, Clock, Database, Layers, Zap, BarChart3, Play, RefreshCw } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { ProfileMetrics } from '../../types';

const LEVEL_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308'];

export function ProfilerView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [metrics, setMetrics] = useState<ProfileMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseTime, setParseTime] = useState(0);
  const startTime = useRef(0);

  const runProfile = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON to profile', 'error'); return; }
    setLoading(true);
    startTime.current = performance.now();
    try {
      const result = await worker.profile(jsonInput);
      setParseTime(performance.now() - startTime.current);
      setMetrics(result);
    } catch (err) {
      showToast(`Profile failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, worker, showToast]);

  // Auto-run on first load if JSON present
  useEffect(() => {
    if (jsonInput.trim() && !metrics) runProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalNodes = metrics?.totalNodes ?? 0;
  const typeEntries = metrics ? Object.entries(metrics.typeDistribution).sort((a, b) => b[1] - a[1]) : [];
  const depthEntries = metrics ? Object.entries(metrics.depthDistribution).sort((a, b) => Number(a[0]) - Number(b[0])) : [];

  const maxTypeCount = typeEntries.length > 0 ? Math.max(...typeEntries.map(e => e[1])) : 1;
  const maxDepthCount = depthEntries.length > 0 ? Math.max(...depthEntries.map(e => e[1])) : 1;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* Left: JSON Input */}
        <Panel defaultSize={35} minSize={20}>
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
        {/* Right: Profiler Results */}
        <Panel defaultSize={65} minSize={30}>
          <div style={{ height: '100%', overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={runProfile} disabled={loading || !jsonInput.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '6px',
            background: loading ? 'var(--bg-tertiary)' : 'var(--accent)', color: '#fff', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem',
          }}>
          {loading ? <><RefreshCw size={14} className="spin" /> Profiling...</> : <><Play size={14} /> Run Profiler</>}
        </button>
        {metrics && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Analysis took {parseTime.toFixed(0)}ms
          </span>
        )}
      </div>

      {!metrics && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
          <Activity size={32} opacity={0.3} />
          <span style={{ fontSize: '0.875rem' }}>Click "Run Profiler" to analyze your JSON structure</span>
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <MetricCard icon={<Layers size={18} />} label="Total Nodes" value={totalNodes.toLocaleString()} color="#6366f1" />
            <MetricCard icon={<Database size={18} />} label="Max Depth" value={String(metrics.maxDepth)} color="#8b5cf6" />
            <MetricCard icon={<BarChart3 size={18} />} label="Max Breadth" value={String(metrics.maxBreadth)} color="#a855f7" />
            <MetricCard icon={<Zap size={18} />} label="Estimated Size" value={formatBytes(metrics.estimatedMemory)} color="#f59e0b" />
            <MetricCard icon={<Clock size={18} />} label="Parse Time" value={`${metrics.parseTime.toFixed(1)}ms`} color="#10b981" />
            <MetricCard icon={<Activity size={18} />} label="Unique Keys" value={String(metrics.uniqueKeys)} color="#ec4899" />
          </div>

          {/* Type Distribution */}
          <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '12px' }}>Type Distribution</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {typeEntries.map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 500 }}>{type}</span>
                  <div style={{ flex: 1, height: '20px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / maxTypeCount) * 100}%`, height: '100%',
                      background: typeColor(type), borderRadius: '4px',
                      transition: 'width 0.3s ease', minWidth: '2px',
                    }} />
                  </div>
                  <span style={{ width: '60px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {count.toLocaleString()} ({((count / totalNodes) * 100).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Depth Distribution */}
          {depthEntries.length > 0 && (
            <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '12px' }}>Depth Distribution</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '0 4px' }}>
                {depthEntries.map(([depth, count], idx) => (
                  <div key={depth} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{count}</span>
                    <div style={{
                      width: '100%', maxWidth: '40px',
                      height: `${Math.max((count / maxDepthCount) * 100, 4)}%`,
                      background: LEVEL_COLORS[idx % LEVEL_COLORS.length],
                      borderRadius: '3px 3px 0 0', transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{depth}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '4px' }}>Depth Level</div>
            </div>
          )}

          {/* Warnings / Recommendations */}
          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Analysis & Recommendations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {totalNodes > 100000 && <RecommendationItem type="warn" text={`Large document with ${totalNodes.toLocaleString()} nodes. Consider pagination or lazy loading.`} />}
              {metrics.maxDepth > 15 && <RecommendationItem type="warn" text={`Deep nesting (${metrics.maxDepth} levels). May cause rendering performance issues.`} />}
              {metrics.maxBreadth > 1000 && <RecommendationItem type="warn" text={`Wide arrays detected (${metrics.maxBreadth} elements). Consider virtualized rendering.`} />}
              {metrics.estimatedMemory > 10 * 1024 * 1024 && <RecommendationItem type="warn" text={`Estimated memory ${formatBytes(metrics.estimatedMemory)}. May impact browser performance.`} />}
              {totalNodes <= 100000 && metrics.maxDepth <= 15 && <RecommendationItem type="ok" text="Document size and structure are within optimal parameters." />}
              {metrics.parseTime < 100 && <RecommendationItem type="ok" text={`Fast parse time (${metrics.parseTime.toFixed(1)}ms). No performance concerns.`} />}
              {metrics.parseTime >= 100 && metrics.parseTime < 1000 && <RecommendationItem type="info" text={`Moderate parse time (${metrics.parseTime.toFixed(1)}ms). Acceptable for most use cases.`} />}
              {metrics.parseTime >= 1000 && <RecommendationItem type="warn" text={`Slow parse time (${metrics.parseTime.toFixed(1)}ms). Consider splitting the document.`} />}
            </div>
          </div>
        </>
      )}
          </div>
        </Panel>
      </Group>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '8px', background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function RecommendationItem({ type, text }: { type: 'ok' | 'warn' | 'info'; text: string }) {
  const icons = { ok: '✅', warn: '⚠️', info: 'ℹ️' };
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
      <span>{icons[type]}</span>
      <span>{text}</span>
    </div>
  );
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    string: '#10b981', number: '#6366f1', boolean: '#f59e0b',
    null: '#94a3b8', object: '#8b5cf6', array: '#ec4899',
  };
  return map[type] || '#6b7280';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
