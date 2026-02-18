import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { FileJson2, Play, Copy, Download } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';

export function OpenApiView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('My API');
  const [basePath, setBasePath] = useState('/api/resource');
  const [outputFormat, setOutputFormat] = useState<'json' | 'yaml'>('json');

  const handleGenerate = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('No JSON input', 'error'); return; }
    setLoading(true);
    try {
      const spec = await worker.generateOpenApi(jsonInput, title, basePath);
      if (outputFormat === 'yaml') {
        // Simple JSON-to-YAML conversion
        const obj = JSON.parse(spec);
        setResult(jsonToYaml(obj, 0));
      } else {
        setResult(spec);
      }
    } catch (err) {
      showToast(`Failed: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [jsonInput, title, basePath, outputFormat, worker, showToast]);

  const handleCopy = useCallback(() => {
    if (result) { navigator.clipboard.writeText(result); showToast('Copied!', 'success'); }
  }, [result, showToast]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const ext = outputFormat === 'yaml' ? 'yaml' : 'json';
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openapi.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, outputFormat]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <FileJson2 size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>OpenAPI Generator</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Title:</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Path:</label>
          <input value={basePath} onChange={e => setBasePath(e.target.value)} style={{ width: '120px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['json', 'yaml'] as const).map(f => (
            <button key={f} onClick={() => setOutputFormat(f)} style={{
              padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)',
              background: outputFormat === f ? 'var(--accent)' : 'transparent',
              color: outputFormat === f ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.6875rem', cursor: 'pointer', textTransform: 'uppercase',
            }}>{f}</button>
          ))}
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{
          padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
        }}>
          <Play size={12} /> Generate
        </button>
        {result && (
          <>
            <button onClick={handleCopy} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Copy size={12} /> Copy</button>
            <button onClick={handleDownload} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Download size={12} /> Export</button>
          </>
        )}
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={35} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JSON Sample</div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={65} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              OpenAPI Spec ({outputFormat.toUpperCase()})
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={result || '// Generate OpenAPI spec from your JSON sample'} readOnly language={outputFormat === 'yaml' ? 'yaml' : 'json'} />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

function jsonToYaml(obj: unknown, indent: number): string {
  const spaces = '  '.repeat(indent);
  if (obj === null) return 'null';
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.startsWith('{') || obj.startsWith('[')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const val = jsonToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const lines = val.split('\n');
        return `${spaces}- ${lines[0]}\n${lines.slice(1).map(l => `${spaces}  ${l}`).join('\n')}`;
      }
      return `${spaces}- ${val}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries.map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `${spaces}${k}:\n${jsonToYaml(v, indent + 1)}`;
      }
      return `${spaces}${k}: ${jsonToYaml(v, indent + 1)}`;
    }).join('\n');
  }
  return String(obj);
}
