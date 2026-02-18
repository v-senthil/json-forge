import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Play, Copy, Download, Settings } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { copyToClipboard, downloadFile } from '../../utils';
import type { CodeGenLanguage, CodeGenOptions } from '../../types';

const languageOptions: { value: CodeGenLanguage; label: string; ext: string; monacoLang: string }[] = [
  { value: 'typescript', label: 'TypeScript', ext: 'ts', monacoLang: 'typescript' },
  { value: 'java', label: 'Java', ext: 'java', monacoLang: 'java' },
  { value: 'go', label: 'Go', ext: 'go', monacoLang: 'go' },
  { value: 'python', label: 'Python', ext: 'py', monacoLang: 'python' },
  { value: 'csharp', label: 'C#', ext: 'cs', monacoLang: 'csharp' },
];

export function CodeGenView() {
  const { jsonInput } = useAppState();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [language, setLanguage] = useState<CodeGenLanguage>('typescript');
  const [rootName, setRootName] = useState('Root');
  const [optionalFields, setOptionalFields] = useState(false);
  const [strictTyping, setStrictTyping] = useState(true);
  const [enumDetection, setEnumDetection] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [genTime, setGenTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const generate = useCallback(async () => {
    if (!jsonInput.trim()) { showToast('Paste JSON first', 'error'); return; }
    const options: CodeGenOptions = { language, rootName, optionalFields, strictTyping, enumDetection };
    try {
      const result = await worker.generateCode(jsonInput, options);
      setGeneratedCode(result.code);
      setGenTime(result.time);
    } catch (err) {
      showToast(String(err), 'error');
    }
  }, [jsonInput, language, rootName, optionalFields, strictTyping, enumDetection, worker, showToast]);

  const langConf = languageOptions.find(l => l.value === language)!;

  const handleCopy = useCallback(async () => {
    if (!generatedCode) return;
    const ok = await copyToClipboard(generatedCode);
    if (ok) showToast('Code copied');
  }, [generatedCode, showToast]);

  const handleDownload = useCallback(() => {
    if (!generatedCode) return;
    downloadFile(generatedCode, `${rootName}.${langConf.ext}`, 'text/plain');
    showToast('File downloaded');
  }, [generatedCode, rootName, langConf.ext, showToast]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={40} minSize={25}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              JSON Input
            </div>
            <div style={{ flex: 1 }}><JsonEditor /></div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={60} minSize={30}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {languageOptions.map(l => (
                  <button key={l.value} onClick={() => { setLanguage(l.value); setGeneratedCode(''); }}
                    style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: language === l.value ? 'var(--accent)' : 'var(--bg-primary)', color: language === l.value ? '#fff' : 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                    {l.label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowSettings(!showSettings)} title="Settings"
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: showSettings ? 'var(--accent)' : 'var(--bg-primary)', color: showSettings ? '#fff' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Settings size={14} />
                </button>
                <button onClick={handleCopy} disabled={!generatedCode}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem', opacity: generatedCode ? 1 : 0.5 }}>
                  <Copy size={12} /> Copy
                </button>
                <button onClick={handleDownload} disabled={!generatedCode}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem', opacity: generatedCode ? 1 : 0.5 }}>
                  <Download size={12} /> Download
                </button>
                <button onClick={generate}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '4px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <Play size={12} /> Generate
                </button>
              </div>

              {showSettings && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    Root name:
                    <input value={rootName} onChange={e => setRootName(e.target.value)}
                      style={{ width: '100px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={optionalFields} onChange={e => setOptionalFields(e.target.checked)} /> Optional fields
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={strictTyping} onChange={e => setStrictTyping(e.target.checked)} /> Strict typing
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enumDetection} onChange={e => setEnumDetection(e.target.checked)} /> Enum detection
                  </label>
                </div>
              )}

              {genTime > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Generated in {genTime.toFixed(1)}ms
                </div>
              )}
            </div>

            {/* Generated Code */}
            <div style={{ flex: 1 }}>
              <JsonEditor value={generatedCode || `// Select a language and click Generate\n// Supported: TypeScript, Java, Go, Python, C#`} readOnly language={langConf.monacoLang} />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
