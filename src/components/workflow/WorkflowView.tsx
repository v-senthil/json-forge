import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Workflow, Play, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import type { WorkflowStep, WorkflowResult } from '../../types';

let stepCounter = 0;

function newStep(type: WorkflowStep['type'] = 'pick', config = ''): WorkflowStep {
  return { id: `step-${++stepCounter}`, name: `Step ${stepCounter}`, type, config, enabled: true };
}

const STEP_TYPES: WorkflowStep['type'][] = ['pick', 'omit', 'filter', 'map', 'sort', 'rename', 'jq', 'custom'];

export function WorkflowView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [steps, setSteps] = useState<WorkflowStep[]>([newStep('pick', 'name, email')]);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const addStep = useCallback(() => {
    setSteps(prev => [...prev, newStep()]);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const toggleStep = useCallback((id: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const handleRun = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    if (steps.length === 0) { showToast('Add at least one step', 'error'); return; }
    setLoading(true);
    try {
      const r = await worker.runWorkflow(jsonInput, steps);
      setResult(r);
      const hasError = r.stepResults.some(s => s.error);
      showToast(hasError ? 'Workflow completed with errors' : `Workflow completed in ${r.totalTime.toFixed(0)}ms`, hasError ? 'error' : 'success');
    } catch (err) {
      showToast(`Workflow failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, steps, worker, showToast]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Workflow size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Workflow Simulator</span>
        <button onClick={addStep} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.6875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Plus size={12} /> Add Step
        </button>
        <button onClick={handleRun} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Run Workflow
        </button>
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* JSON Input */}
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JSON Input</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        {/* Steps */}
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pipeline Steps ({steps.length})
            </div>
            {steps.map((step, idx) => {
              const stepResult = result?.stepResults.find(r => r.stepId === step.id);
              const isExpanded = expandedStep === step.id;
              return (
                <div key={step.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                    <GripVertical size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', width: '16px' }}>{idx + 1}</span>
                    {isExpanded ? <ChevronDown size={12} color="var(--text-muted)" /> : <ChevronRight size={12} color="var(--text-muted)" />}
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: step.enabled ? 'var(--text-primary)' : 'var(--text-muted)', textDecoration: step.enabled ? 'none' : 'line-through', flex: 1 }}>{step.name}</span>
                    <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', background: 'var(--accent)', color: '#fff' }}>{step.type}</span>
                    {stepResult?.error && <span style={{ fontSize: '0.625rem', color: '#ef4444' }}>error</span>}
                    {stepResult && !stepResult.error && <span style={{ fontSize: '0.625rem', color: '#10b981' }}>{stepResult.time.toFixed(0)}ms</span>}
                    <button onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: step.enabled ? '#10b981' : 'var(--text-muted)' }}>
                      {step.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeStep(step.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input value={step.name} onChange={e => updateStep(step.id, { name: e.target.value })} placeholder="Step name" style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
                      <select value={step.type} onChange={e => updateStep(step.id, { type: e.target.value as WorkflowStep['type'] })} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                        {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <textarea value={step.config} onChange={e => updateStep(step.id, { config: e.target.value })} placeholder={getPlaceholder(step.type)} rows={3} style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'monospace', resize: 'vertical' }} />
                    </div>
                  )}
                </div>
              );
            })}
            {steps.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Add steps to build your transformation pipeline
              </div>
            )}
          </div>
        </Panel>
        <Separator />
        {/* Output */}
        <Panel defaultSize={40} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Output
              {result && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({result.totalTime.toFixed(0)}ms)</span>}
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={result?.finalOutput ?? '// Run workflow to see output'} readOnly language="json" />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

function getPlaceholder(type: WorkflowStep['type']): string {
  switch (type) {
    case 'pick': return 'field1, field2, field3';
    case 'omit': return 'password, secret, token';
    case 'filter': return 'age > 18';
    case 'map': return '{ name, email: contact.email }';
    case 'sort': return 'name asc';
    case 'rename': return 'old_name:new_name, field:renamed';
    case 'jq': return '.data.items';
    case 'custom': return '(data) => data.map(x => x)';
    default: return '';
  }
}
