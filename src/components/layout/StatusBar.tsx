/* ===================================================================
 * StatusBar shows metadata about the current JSON:
 * file size, parse time, line count, and validity status.
 * =================================================================== */

import { useAppState } from '../../stores/AppStore';
import { formatBytes, formatTime, countLines } from '../../utils';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export function StatusBar() {
  const { jsonInput, parseResult, isProcessing } = useAppState();
  const lines = countLines(jsonInput);
  const size = new Blob([jsonInput]).size;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.375rem 1rem',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      {isProcessing ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Loader size={12} className="animate-spin" /> Processing...
        </span>
      ) : parseResult ? (
        parseResult.success ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
            <CheckCircle size={12} /> Valid JSON
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--error)' }}>
            <XCircle size={12} /> Invalid JSON
          </span>
        )
      ) : (
        <span>Ready</span>
      )}

      <span style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '0.75rem' }}>
        Lines: {lines.toLocaleString()}
      </span>
      <span>Size: {formatBytes(size)}</span>
      {parseResult?.parseTime !== undefined && (
        <span>Parse: {formatTime(parseResult.parseTime)}</span>
      )}
      <span style={{ marginLeft: 'auto', fontSize: '0.6875rem' }}>
        ⌘+Enter Format · ⌘+M Minify · ⌘+F Search
      </span>
    </div>
  );
}
