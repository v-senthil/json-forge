import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ShieldCheck, Play, Copy, CheckCircle, XCircle } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { ContractTestFramework, ContractTestResult } from '../../types';

export function ContractView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState<ContractTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [framework, setFramework] = useState<ContractTestFramework>('jest');
  const [activeView, setActiveView] = useState<'code' | 'assertions'>('code');

  const handleGenerate = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      const r = await worker.generateContract(jsonInput, undefined, framework);
      setResult(r);
    } catch (err) {
      showToast(`Failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, framework, worker, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result.code); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  const frameworks: ContractTestFramework[] = ['jest', 'mocha', 'junit'];
  const langMap: Record<ContractTestFramework, string> = { jest: 'javascript', mocha: 'javascript', junit: 'java' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <ShieldCheck size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Contract Testing</span>
        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
          {frameworks.map(f => (
            <button key={f} onClick={() => setFramework(f)} style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: framework === f ? 'var(--accent)' : 'transparent',
              color: framework === f ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.75rem', cursor: 'pointer', textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Generate Tests
        </button>
        {result && <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12} /> Copy</button>}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={35} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JSON Input (Sample Response)</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={65} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {(['code', 'assertions'] as const).map(v => (
                <button key={v} onClick={() => setActiveView(v)} style={{
                  padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)',
                  background: activeView === v ? 'var(--bg-tertiary)' : 'transparent',
                  color: activeView === v ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.6875rem', cursor: 'pointer', textTransform: 'capitalize',
                }}>{v}</button>
              ))}
              {result && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{result.assertions.length} assertions • {result.time.toFixed(1)}ms</span>}
            </div>
            <div style={{ flex: 1 }}>
              {activeView === 'code' ? (
                <JsonEditor value={result?.code ?? '// Generate contract tests from your JSON sample'} readOnly language={langMap[framework]} />
              ) : (
                <div style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
                  {result?.assertions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', marginBottom: '4px', background: 'var(--bg-secondary)', fontSize: '0.75rem' }}>
                      {a.required ? <CheckCircle size={14} color="#10b981" /> : <XCircle size={14} color="#94a3b8" />}
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{a.path || '(root)'}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{a.type}</span>
                      {a.required && <span style={{ fontSize: '0.625rem', padding: '1px 4px', borderRadius: '3px', background: '#10b98120', color: '#10b981' }}>required</span>}
                    </div>
                  )) || <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', marginTop: '24px' }}>Generate tests to see assertions</div>}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
