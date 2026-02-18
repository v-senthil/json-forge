import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Database, Play, Copy } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { DbSchemaDialect, DbSchemaResult } from '../../types';

export function DbSchemaView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState<DbSchemaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialect, setDialect] = useState<DbSchemaDialect>('postgresql');
  const [tableName, setTableName] = useState('my_table');

  const handleGenerate = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      const r = await worker.generateDbSchema(jsonInput, dialect, tableName);
      setResult(r);
    } catch (err) {
      showToast(`Failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, dialect, tableName, worker, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result.sql); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  const dialects: DbSchemaDialect[] = ['postgresql', 'mysql', 'sqlite', 'mongodb'];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Database size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>DB Schema Generator</span>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
          {dialects.map(d => (
            <button key={d} onClick={() => setDialect(d)} style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: dialect === d ? 'var(--accent)' : 'transparent',
              color: dialect === d ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.75rem', cursor: 'pointer', textTransform: 'capitalize',
            }}>{d}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Table:</label>
          <input value={tableName} onChange={e => setTableName(e.target.value)} style={{ width: '120px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
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
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {dialect === 'mongodb' ? 'MongoDB Schema' : 'SQL Output'}
              {result && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 400 }}>({result.tables} table{result.tables !== 1 ? 's' : ''} • {result.time.toFixed(1)}ms)</span>}
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={result?.sql ?? ''} readOnly language={dialect === 'mongodb' ? 'javascript' : 'sql'} />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
