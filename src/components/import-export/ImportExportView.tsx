import { useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Upload, Download, Link, FileSpreadsheet, FileCode, FileText, Table, Database, ArrowRight } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { copyToClipboard, downloadFile, readFileAsText } from '../../utils';
import Papa from 'papaparse';
import yaml from 'js-yaml';

type ImportTab = 'csv' | 'yaml' | 'xml' | 'url' | 'file';
type ExportTab = 'csv' | 'yaml' | 'sql' | 'markdown' | 'excel';

export function ImportExportView() {
  const { jsonInput } = useAppState();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  const [activeMode, setActiveMode] = useState<'import' | 'export'>('import');
  const [importTab, setImportTab] = useState<ImportTab>('csv');
  const [exportTab, setExportTab] = useState<ExportTab>('csv');
  const [importText, setImportText] = useState('');
  const [exportResult, setExportResult] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [sqlTable, setSqlTable] = useState('my_table');
  const [isFetching, setIsFetching] = useState(false);

  // ─── IMPORT ────────────────────────
  const handleCsvImport = useCallback(() => {
    if (!importText.trim()) return;
    const result = Papa.parse(importText, { header: true, dynamicTyping: true, skipEmptyLines: true });
    const json = JSON.stringify(result.data, null, 2);
    dispatch({ type: 'SET_JSON_INPUT', payload: json });
    showToast(`Imported ${result.data.length} rows from CSV`);
  }, [importText, dispatch, showToast]);

  const handleYamlImport = useCallback(() => {
    if (!importText.trim()) return;
    try {
      const data = yaml.load(importText);
      const json = JSON.stringify(data, null, 2);
      dispatch({ type: 'SET_JSON_INPUT', payload: json });
      showToast('YAML imported successfully');
    } catch (err) {
      showToast(`YAML parse error: ${err}`, 'error');
    }
  }, [importText, dispatch, showToast]);

  const handleXmlImport = useCallback(() => {
    if (!importText.trim()) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(importText, 'text/xml');
      const errorNode = doc.querySelector('parsererror');
      if (errorNode) { showToast('XML parse error', 'error'); return; }
      const data = xmlToJson(doc.documentElement);
      const json = JSON.stringify(data, null, 2);
      dispatch({ type: 'SET_JSON_INPUT', payload: json });
      showToast('XML imported successfully');
    } catch (err) {
      showToast(`XML error: ${err}`, 'error');
    }
  }, [importText, dispatch, showToast]);

  const handleUrlFetch = useCallback(async () => {
    if (!apiUrl.trim()) return;
    setIsFetching(true);
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const text = await res.text();
      dispatch({ type: 'SET_JSON_INPUT', payload: text });
      showToast('Fetched from URL successfully');
    } catch (err) {
      showToast(`Fetch error: ${err}`, 'error');
    } finally {
      setIsFetching(false);
    }
  }, [apiUrl, dispatch, showToast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileAsText(file);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      setImportTab('csv');
      setImportText(text);
    } else if (ext === 'yaml' || ext === 'yml') {
      setImportTab('yaml');
      setImportText(text);
    } else if (ext === 'xml') {
      setImportTab('xml');
      setImportText(text);
    } else {
      dispatch({ type: 'SET_JSON_INPUT', payload: text });
      showToast('File loaded');
    }
    e.target.value = '';
  }, [dispatch, showToast]);

  const doImport = useCallback(() => {
    switch (importTab) {
      case 'csv': handleCsvImport(); break;
      case 'yaml': handleYamlImport(); break;
      case 'xml': handleXmlImport(); break;
      case 'url': handleUrlFetch(); break;
    }
  }, [importTab, handleCsvImport, handleYamlImport, handleXmlImport, handleUrlFetch]);

  // ─── EXPORT ────────────────────────
  const doExport = useCallback(() => {
    if (!jsonInput.trim()) { showToast('No JSON to export', 'error'); return; }
    try {
      const data = JSON.parse(jsonInput);
      let output = '';
      switch (exportTab) {
        case 'csv': {
          const arr = Array.isArray(data) ? data : [data];
          output = Papa.unparse(arr);
          break;
        }
        case 'yaml': {
          output = yaml.dump(data, { indent: 2, lineWidth: 120, noRefs: true });
          break;
        }
        case 'sql': {
          const arr = Array.isArray(data) ? data : [data];
          if (arr.length === 0) { output = '-- Empty dataset'; break; }
          const keys = Object.keys(arr[0]);
          output = arr.map(row => {
            const vals = keys.map(k => {
              const v = (row as Record<string, unknown>)[k];
              if (v === null) return 'NULL';
              if (typeof v === 'number') return String(v);
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              return `'${String(v).replace(/'/g, "''")}'`;
            });
            return `INSERT INTO ${sqlTable} (${keys.join(', ')}) VALUES (${vals.join(', ')});`;
          }).join('\n');
          break;
        }
        case 'markdown': {
          const arr = Array.isArray(data) ? data : [data];
          if (arr.length === 0) { output = '| (empty) |'; break; }
          const keys = Object.keys(arr[0]);
          const header = `| ${keys.join(' | ')} |`;
          const sep = `| ${keys.map(() => '---').join(' | ')} |`;
          const rows = arr.map(row => `| ${keys.map(k => String((row as Record<string, unknown>)[k] ?? '')).join(' | ')} |`);
          output = [header, sep, ...rows].join('\n');
          break;
        }
        case 'excel': {
          // Export as TSV (tab-separated) which Excel can open
          const arr = Array.isArray(data) ? data : [data];
          if (arr.length === 0) { output = ''; break; }
          const keys = Object.keys(arr[0]);
          const header = keys.join('\t');
          const rows = arr.map(row => keys.map(k => String((row as Record<string, unknown>)[k] ?? '')).join('\t'));
          output = [header, ...rows].join('\n');
          break;
        }
      }
      setExportResult(output);
    } catch (err) {
      showToast(`Export error: ${err}`, 'error');
    }
  }, [jsonInput, exportTab, sqlTable, showToast]);

  const handleDownloadExport = useCallback(() => {
    if (!exportResult) return;
    const exts: Record<ExportTab, string> = { csv: 'csv', yaml: 'yaml', sql: 'sql', markdown: 'md', excel: 'tsv' };
    const mimes: Record<ExportTab, string> = { csv: 'text/csv', yaml: 'text/yaml', sql: 'text/sql', markdown: 'text/markdown', excel: 'text/tab-separated-values' };
    downloadFile(exportResult, `export.${exts[exportTab]}`, mimes[exportTab]);
    showToast('Exported');
  }, [exportResult, exportTab, showToast]);

  const importTabs: { value: ImportTab; label: string; icon: typeof Upload }[] = [
    { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
    { value: 'yaml', label: 'YAML', icon: FileCode },
    { value: 'xml', label: 'XML', icon: FileText },
    { value: 'url', label: 'URL', icon: Link },
    { value: 'file', label: 'File', icon: Upload },
  ];

  const exportTabs: { value: ExportTab; label: string; icon: typeof Download }[] = [
    { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
    { value: 'yaml', label: 'YAML', icon: FileCode },
    { value: 'sql', label: 'SQL', icon: Database },
    { value: 'markdown', label: 'Markdown', icon: Table },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  ];

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
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Mode Switch */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <button onClick={() => setActiveMode('import')}
                style={{ flex: 1, padding: '10px', background: activeMode === 'import' ? 'var(--accent)' : 'var(--bg-secondary)', color: activeMode === 'import' ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Upload size={14} /> Import to JSON
              </button>
              <button onClick={() => setActiveMode('export')}
                style={{ flex: 1, padding: '10px', background: activeMode === 'export' ? 'var(--accent)' : 'var(--bg-secondary)', color: activeMode === 'export' ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Download size={14} /> Export from JSON
              </button>
            </div>

            {activeMode === 'import' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Import Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  {importTabs.map(t => (
                    <button key={t.value} onClick={() => setImportTab(t.value)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: importTab === t.value ? 'var(--accent)' : 'var(--bg-primary)', color: importTab === t.value ? '#fff' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                      <t.icon size={12} /> {t.label}
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  {importTab !== 'file' && importTab !== 'url' && (
                    <button onClick={doImport}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '4px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                      <ArrowRight size={12} /> Convert
                    </button>
                  )}
                </div>

                {importTab === 'url' ? (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>API URL:</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                        placeholder="https://api.example.com/data.json"
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-editor)', color: 'var(--text-primary)', fontSize: '0.875rem' }} />
                      <button onClick={handleUrlFetch} disabled={isFetching}
                        style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, opacity: isFetching ? 0.6 : 1 }}>
                        {isFetching ? 'Fetching...' : 'Fetch'}
                      </button>
                    </div>
                  </div>
                ) : importTab === 'file' ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                    <Upload size={40} color="var(--text-muted)" />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Upload a file (JSON, CSV, YAML, XML)</p>
                    <input type="file" accept=".json,.csv,.yaml,.yml,.xml,.txt" onChange={handleFileUpload}
                      style={{ fontSize: '0.8125rem' }} />
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <JsonEditor value={importText} onChange={setImportText} language={importTab === 'xml' ? 'xml' : importTab === 'yaml' ? 'yaml' : 'plaintext'} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Export Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                  {exportTabs.map(t => (
                    <button key={t.value} onClick={() => setExportTab(t.value)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: exportTab === t.value ? 'var(--accent)' : 'var(--bg-primary)', color: exportTab === t.value ? '#fff' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>
                      <t.icon size={12} /> {t.label}
                    </button>
                  ))}
                  {exportTab === 'sql' && (
                    <input value={sqlTable} onChange={e => setSqlTable(e.target.value)} placeholder="table_name"
                      style={{ width: '120px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
                  )}
                  <div style={{ flex: 1 }} />
                  <button onClick={async () => { await copyToClipboard(exportResult); showToast('Copied'); }} disabled={!exportResult}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', opacity: exportResult ? 1 : 0.5 }}>
                    <Upload size={12} /> Copy
                  </button>
                  <button onClick={handleDownloadExport} disabled={!exportResult}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', opacity: exportResult ? 1 : 0.5 }}>
                    <Download size={12} /> Save
                  </button>
                  <button onClick={doExport}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '4px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <ArrowRight size={12} /> Export
                  </button>
                </div>

                {/* Export Result */}
                <div style={{ flex: 1 }}>
                  <JsonEditor value={exportResult || '// Click Export to convert JSON'} readOnly
                    language={exportTab === 'sql' ? 'sql' : exportTab === 'yaml' ? 'yaml' : exportTab === 'markdown' ? 'markdown' : 'plaintext'} />
                </div>
              </div>
            )}
          </div>
        </Panel>
      </Group>
    </div>
  );
}

// XML to JSON helper
function xmlToJson(node: Element): unknown {
  const obj: Record<string, unknown> = {};
  if (node.attributes.length > 0) {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      attrs[`@${attr.name}`] = attr.value;
    }
    Object.assign(obj, attrs);
  }
  const children = Array.from(node.children);
  if (children.length === 0) {
    const text = node.textContent?.trim();
    if (Object.keys(obj).length === 0) return text || '';
    if (text) obj['#text'] = text;
    return obj;
  }
  const childMap = new Map<string, unknown[]>();
  for (const child of children) {
    const name = child.nodeName;
    if (!childMap.has(name)) childMap.set(name, []);
    childMap.get(name)!.push(xmlToJson(child));
  }
  for (const [name, values] of childMap) {
    obj[name] = values.length === 1 ? values[0] : values;
  }
  return obj;
}
