/* ===================================================================
 * Formatter Toolbar - actions for format, minify, copy, download.
 * Sits between the editor and output for quick operations.
 * =================================================================== */

import { useCallback, useState } from 'react';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import { copyToClipboard, downloadFile } from '../../utils';
import {
  Wand2,
  Minimize2,
  Copy,
  Download,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react';

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.4375rem 0.75rem',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  background: 'var(--bg-primary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 500,
  transition: 'all 0.15s',
  whiteSpace: 'nowrap' as const,
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
};

export function FormatterToolbar() {
  const { jsonInput, parseResult } = useAppState();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const worker = useJsonWorker();
  const [indent, setIndent] = useState(2);

  const handleFormat = useCallback(() => {
    if (!jsonInput.trim()) {
      showToast('No JSON to format', 'info');
      return;
    }
    dispatch({ type: 'SET_PROCESSING', payload: true });
    worker.format(jsonInput, indent, (response) => {
      if (response.type === 'formatResult') {
        dispatch({ type: 'SET_JSON_INPUT', payload: response.payload.formatted });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        showToast(`Formatted in ${Math.round(response.payload.time)}ms`);
      }
    });
  }, [jsonInput, indent, worker, dispatch, showToast]);

  const handleMinify = useCallback(() => {
    if (!jsonInput.trim()) {
      showToast('No JSON to minify', 'info');
      return;
    }
    dispatch({ type: 'SET_PROCESSING', payload: true });
    worker.minify(jsonInput, (response) => {
      if (response.type === 'minifyResult') {
        dispatch({ type: 'SET_JSON_INPUT', payload: response.payload.minified });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        showToast(`Minified in ${Math.round(response.payload.time)}ms`);
      }
    });
  }, [jsonInput, worker, dispatch, showToast]);

  const handleCopy = useCallback(async () => {
    const text = parseResult?.formatted || jsonInput;
    if (!text.trim()) {
      showToast('Nothing to copy', 'info');
      return;
    }
    const ok = await copyToClipboard(text);
    showToast(ok ? 'Copied to clipboard' : 'Failed to copy', ok ? 'success' : 'error');
  }, [jsonInput, parseResult, showToast]);

  const handleDownload = useCallback(() => {
    const text = parseResult?.formatted || jsonInput;
    if (!text.trim()) {
      showToast('Nothing to download', 'info');
      return;
    }
    downloadFile(text, 'formatted.json');
    showToast('Downloaded formatted.json');
  }, [jsonInput, parseResult, showToast]);

  const handleClear = useCallback(() => {
    dispatch({ type: 'SET_JSON_INPUT', payload: '' });
    dispatch({ type: 'SET_PARSE_RESULT', payload: null });
    showToast('Cleared', 'info');
  }, [dispatch, showToast]);

  const handleSample = useCallback(() => {
    const sample = JSON.stringify(
      {
        name: 'JSONForge',
        version: '1.0.0',
        features: ['format', 'tree', 'diagram', 'schema', 'diff'],
        config: {
          theme: 'dark',
          indent: 2,
          maxSize: '20MB',
        },
        users: [
          { id: 1, name: 'Alice', email: 'alice@example.com', active: true },
          { id: 2, name: 'Bob', email: 'bob@example.com', active: false },
        ],
        metadata: {
          created: '2026-01-15T10:30:00Z',
          updated: null,
          tags: ['developer-tools', 'json', 'formatter'],
        },
      },
      null,
      2
    );
    dispatch({ type: 'SET_JSON_INPUT', payload: sample });
    showToast('Sample JSON loaded', 'info');
  }, [dispatch, showToast]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexWrap: 'wrap',
      }}
    >
      <button onClick={handleFormat} style={primaryButtonStyle} title="Format JSON (⌘+Enter)">
        <Wand2 size={14} /> Format
      </button>

      <button onClick={handleMinify} style={buttonStyle} title="Minify JSON (⌘+M)">
        <Minimize2 size={14} /> Minify
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Indent:</label>
        <select
          value={indent}
          onChange={(e) => setIndent(Number(e.target.value))}
          style={{
            padding: '0.25rem 0.375rem',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.75rem',
          }}
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={8}>8</option>
          <option value={1}>Tab</option>
        </select>
      </div>

      <div
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--border-color)',
          margin: '0 0.25rem',
        }}
      />

      <button onClick={handleCopy} style={buttonStyle} title="Copy to clipboard">
        <Copy size={14} /> Copy
      </button>
      <button onClick={handleDownload} style={buttonStyle} title="Download as .json">
        <Download size={14} /> Download
      </button>

      <div
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--border-color)',
          margin: '0 0.25rem',
        }}
      />

      <button onClick={handleSample} style={buttonStyle} title="Load sample JSON">
        <ArrowRightLeft size={14} /> Sample
      </button>
      <button onClick={handleClear} style={{ ...buttonStyle, color: 'var(--error)' }} title="Clear editor">
        <Trash2 size={14} /> Clear
      </button>

      {/* Error display */}
      {parseResult && !parseResult.success && parseResult.error && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.3125rem 0.625rem',
            background: 'var(--error-bg)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--error)',
            maxWidth: '400px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={parseResult.error.message}
        >
          {parseResult.error.line
            ? `Error at line ${parseResult.error.line}, col ${parseResult.error.column}: `
            : 'Error: '}
          {parseResult.error.message}
        </div>
      )}
    </div>
  );
}
