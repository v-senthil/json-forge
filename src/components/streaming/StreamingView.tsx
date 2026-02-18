import { useState, useCallback, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Zap, Play, ChevronLeft, ChevronRight, Search, FileJson } from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useToast } from '../common/Toast';

const CHUNK_SIZE = 50; // items per chunk for arrays

export function StreamingView() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [fileSize, setFileSize] = useState('');
  const [parseTime, setParseTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [fileName, setFileName] = useState('');

  const handleFileLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setFileSize(`${sizeMB} MB`);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setRawText(text);
      processChunks(text);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const processChunks = useCallback((text: string) => {
    const start = performance.now();
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        setTotalItems(data.length);
        const ch: string[] = [];
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          ch.push(JSON.stringify(data.slice(i, i + CHUNK_SIZE), null, 2));
        }
        setChunks(ch);
        setCurrentChunk(0);
      } else {
        setTotalItems(1);
        setChunks([JSON.stringify(data, null, 2)]);
        setCurrentChunk(0);
      }
      setParseTime(performance.now() - start);
    } catch (err) {
      showToast(`Parse error: ${err}`, 'error');
    }
  }, [showToast]);

  const handlePasteProcess = useCallback(() => {
    if (!rawText.trim()) { showToast('No text to process', 'error'); return; }
    processChunks(rawText);
  }, [rawText, processChunks, showToast]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || chunks.length === 0) return;
    const matches: number[] = [];
    const q = searchQuery.toLowerCase();
    chunks.forEach((c, i) => { if (c.toLowerCase().includes(q)) matches.push(i); });
    setSearchResults(matches);
    if (matches.length > 0) { setCurrentChunk(matches[0]); showToast(`Found in ${matches.length} chunk(s)`, 'success'); }
    else showToast('Not found in any chunk', 'error');
  }, [searchQuery, chunks, showToast]);

  const chunkStart = currentChunk * CHUNK_SIZE;
  const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalItems);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <Zap size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Streaming & Chunk Viewer</span>
        <input ref={fileRef} type="file" accept=".json,.jsonl" onChange={handleFileLoad} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileJson size={12} /> Load File
        </button>
        <button onClick={handlePasteProcess} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Play size={12} /> Process Input
        </button>
        {fileSize && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{fileName} ({fileSize})</span>}
        {parseTime > 0 && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Parsed in {parseTime.toFixed(0)}ms</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Search in chunks..." style={{ width: '160px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
          <button onClick={handleSearch} style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}><Search size={14} /></button>
        </div>
      </div>

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={40} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Raw Input (Paste or Load)
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={rawText} onChange={setRawText} language="json" />
            </div>
          </div>
        </Panel>
        <Separator />
        <Panel defaultSize={60} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chunk View</span>
              {chunks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <button onClick={() => setCurrentChunk(Math.max(0, currentChunk - 1))} disabled={currentChunk === 0} style={{ padding: '2px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}><ChevronLeft size={14} /></button>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-primary)', minWidth: '100px', textAlign: 'center' }}>
                    Items {chunkStart + 1}–{chunkEnd} of {totalItems}
                  </span>
                  <button onClick={() => setCurrentChunk(Math.min(chunks.length - 1, currentChunk + 1))} disabled={currentChunk >= chunks.length - 1} style={{ padding: '2px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}><ChevronRight size={14} /></button>
                  {searchResults.length > 0 && <span style={{ fontSize: '0.625rem', color: '#f59e0b' }}>{searchResults.length} matches</span>}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={chunks[currentChunk] ?? '// Load a large JSON file or paste data and click "Process Input"'} readOnly language="json" />
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
