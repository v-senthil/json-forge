import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { GitCompare, Play, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { SchemaDrift } from '../../types';

export function SchemaDriftView() {
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [schemaA, setSchemaA] = useState('');
  const [schemaB, setSchemaB] = useState('');
  const [drifts, setDrifts] = useState<SchemaDrift[]>([]);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);

  const handleAnalyze = useCallback(async () => {
    if (!schemaA.trim() || !schemaB.trim()) { showToast('Both schemas required', 'error'); return; }
    setLoading(true);
    try {
      const start = performance.now();
      const r = await worker.analyzeSchemaDrift(schemaA, schemaB);
      setTime(performance.now() - start);
      setDrifts(r);
      showToast(`Found ${r.length} drift(s)`, r.length > 0 ? 'error' : 'success');
    } catch (err) {
      showToast(`Failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [schemaA, schemaB, worker, showToast]);

  const breakingCount = drifts.filter(d => d.severity === 'breaking').length;
  const nonBreakingCount = drifts.filter(d => d.severity === 'non-breaking').length;
  const infoCount = drifts.filter(d => d.severity === 'info').length;

  const severityIcon = (s: string) => {
    if (s === 'breaking') return <AlertTriangle size={13} color="#ef4444" />;
    if (s === 'non-breaking') return <Info size={13} color="#f59e0b" />;
    return <CheckCircle size={13} color="#6366f1" />;
  };

  const changeColor = (c: string): string => {
    const map: Record<string, string> = { added: '#10b981', removed: '#ef4444', 'type-changed': '#f59e0b', 'required-changed': '#ec4899', 'constraint-changed': '#6366f1' };
    return map[c] || '#6b7280';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <GitCompare size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Schema Drift Analyzer</span>
        <button onClick={handleAnalyze} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Analyze Drift
        </button>
        {drifts.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.6875rem' }}>
            <span style={{ color: '#ef4444' }}>{breakingCount} breaking</span>
            <span style={{ color: '#f59e0b' }}>{nonBreakingCount} non-breaking</span>
            <span style={{ color: '#6366f1' }}>{infoCount} info</span>
            <span style={{ color: 'var(--text-muted)' }}>{time.toFixed(0)}ms</span>
          </div>
        )}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schema A (Before)</div>
            <div style={{ flex: 1 }}><JsonEditor value={schemaA} onChange={setSchemaA} language="json" /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schema B (After)</div>
            <div style={{ flex: 1 }}><JsonEditor value={schemaB} onChange={setSchemaB} language="json" /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={40} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drift Report</div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {drifts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  {schemaA && schemaB ? 'No drifts detected — schemas are compatible' : 'Paste two JSON schemas and click Analyze Drift'}
                </div>
              )}
              {drifts.map((d, i) => (
                <div key={i} style={{ marginBottom: '6px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    {severityIcon(d.severity)}
                    <code style={{ fontSize: '0.75rem', color: 'var(--accent)', flex: 1 }}>{d.path}</code>
                    <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', color: changeColor(d.change), background: `${changeColor(d.change)}15`, fontWeight: 600 }}>{d.change}</span>
                    <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', color: d.severity === 'breaking' ? '#ef4444' : d.severity === 'non-breaking' ? '#f59e0b' : '#6366f1', background: d.severity === 'breaking' ? '#ef444415' : d.severity === 'non-breaking' ? '#f59e0b15' : '#6366f115' }}>{d.severity}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.6875rem' }}>
                    {d.before && <span style={{ color: '#ef4444' }}>Before: <code>{d.before}</code></span>}
                    {d.after && <span style={{ color: '#10b981' }}>After: <code>{d.after}</code></span>}
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
