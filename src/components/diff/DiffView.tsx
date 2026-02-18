/* ===================================================================
 * DiffView - Side-by-side JSON comparison.
 * Features:
 *  - Two editor panels for left/right JSON
 *  - Compute structural diffs
 *  - Highlight added/removed/changed fields
 *  - Show diff summary
 * =================================================================== */

import { useState, useCallback, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import { Virtuoso } from 'react-virtuoso';
import { downloadFile } from '../../utils';
import type { DiffResult, DiffPatchOp } from '../../types';
import {
  ArrowRightLeft,
  Plus,
  Minus,
  RefreshCw,
  ArrowLeftRight,
  Download,
  Copy,
} from 'lucide-react';

export function DiffView() {
  const { jsonInput, diffInput } = useAppState();
  const dispatch = useAppDispatch();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [diffs, setDiffs] = useState<DiffResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [patchOps, setPatchOps] = useState<DiffPatchOp[]>([]);

  const handleCompare = useCallback(() => {
    if (!jsonInput.trim() || !diffInput.trim()) {
      showToast('Both JSON inputs are required', 'info');
      return;
    }

    setIsComparing(true);
    worker.diff(jsonInput, diffInput, (response) => {
      if (response.type === 'diffResult') {
        setDiffs(response.payload.diffs);
        setIsComparing(false);
        setHasCompared(true);
        showToast(`Compared in ${Math.round(response.payload.time)}ms`);
      } else if (response.type === 'error') {
        setIsComparing(false);
        showToast(response.payload.message, 'error');
      }
    });

    // Also generate RFC 6902 patch
    worker.diffPatch(jsonInput, diffInput, (response) => {
      if (response.type === 'diffPatchResult') {
        setPatchOps(response.payload.patch);
      }
    });
  }, [jsonInput, diffInput, worker, showToast]);

  const handleSwap = useCallback(() => {
    const temp = jsonInput;
    dispatch({ type: 'SET_JSON_INPUT', payload: diffInput });
    dispatch({ type: 'SET_DIFF_INPUT', payload: temp });
    setDiffs([]);
    setHasCompared(false);
    setPatchOps([]);
  }, [jsonInput, diffInput, dispatch]);

  // Diff statistics
  const stats = useMemo(() => {
    const added = diffs.filter((d) => d.type === 'added').length;
    const removed = diffs.filter((d) => d.type === 'removed').length;
    const changed = diffs.filter((d) => d.type === 'changed').length;
    const unchanged = diffs.filter((d) => d.type === 'unchanged').length;
    return { added, removed, changed, unchanged, total: diffs.length };
  }, [diffs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
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
        <button
          onClick={handleCompare}
          disabled={isComparing}
          style={{
            ...primaryBtnStyle,
            opacity: isComparing ? 0.7 : 1,
          }}
        >
          <ArrowRightLeft size={14} />
          {isComparing ? 'Comparing...' : 'Compare'}
        </button>

        <button onClick={handleSwap} style={btnStyle}>
          <ArrowLeftRight size={14} /> Swap
        </button>

        {hasCompared && patchOps.length > 0 && (
          <>
            <button
              onClick={() => {
                const patchJson = JSON.stringify(patchOps, null, 2);
                navigator.clipboard.writeText(patchJson);
                showToast('RFC 6902 patch copied');
              }}
              style={btnStyle}
              title="Copy RFC 6902 JSON Patch to clipboard"
            >
              <Copy size={14} /> Patch
            </button>
            <button
              onClick={() => {
                const patchJson = JSON.stringify(patchOps, null, 2);
                downloadFile(patchJson, 'patch.json');
                showToast('Patch exported');
              }}
              style={btnStyle}
              title="Download RFC 6902 JSON Patch"
            >
              <Download size={14} /> Export Patch
            </button>
          </>
        )}

        {hasCompared && (
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginLeft: 'auto',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Plus size={12} /> {stats.added} added
            </span>
            <span style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Minus size={12} /> {stats.removed} removed
            </span>
            <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <RefreshCw size={12} /> {stats.changed} changed
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {stats.unchanged} unchanged
            </span>
          </div>
        )}
      </div>

      {/* Split editors + diff results */}
      <Group orientation="horizontal" style={{ flex: 1 }}>
        {/* Left JSON */}
        <Panel defaultSize={35} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={panelLabelStyle}>
              Left (Original)
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor value={jsonInput} onChange={(v) => dispatch({ type: 'SET_JSON_INPUT', payload: v })} />
            </div>
          </div>
        </Panel>

        <Separator style={resizeHandleStyle} />

        {/* Right JSON */}
        <Panel defaultSize={35} minSize={20}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={panelLabelStyle}>
              Right (Modified)
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor
                value={diffInput}
                onChange={(v) => dispatch({ type: 'SET_DIFF_INPUT', payload: v })}
              />
            </div>
          </div>
        </Panel>

        <Separator style={resizeHandleStyle} />

        {/* Diff Results */}
        <Panel defaultSize={30} minSize={15}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={panelLabelStyle}>
              Differences
            </div>
            <div style={{ flex: 1 }}>
              {!hasCompared ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    fontSize: '0.8125rem',
                    padding: '1rem',
                    textAlign: 'center',
                  }}
                >
                  Paste JSON in both panels and click "Compare".
                </div>
              ) : diffs.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    fontSize: '0.8125rem',
                  }}
                >
                  No differences found.
                </div>
              ) : (
                <Virtuoso
                  totalCount={diffs.filter((d) => d.type !== 'unchanged').length}
                  itemContent={(index) => {
                    const changedDiffs = diffs.filter((d) => d.type !== 'unchanged');
                    const diff = changedDiffs[index];
                    if (!diff) return null;
                    return <DiffRow key={diff.path} diff={diff} />;
                  }}
                  style={{ height: '100%' }}
                  overscan={20}
                />
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

/* ─── DiffRow Component ────────────────────────────────────────────── */

function DiffRow({ diff }: { diff: DiffResult }) {
  const colors = {
    added: { bg: 'var(--success-bg)', border: 'var(--success)', icon: <Plus size={12} />, label: 'Added' },
    removed: { bg: 'var(--error-bg)', border: 'var(--error)', icon: <Minus size={12} />, label: 'Removed' },
    changed: { bg: 'var(--warning-bg)', border: 'var(--warning)', icon: <RefreshCw size={12} />, label: 'Changed' },
    unchanged: { bg: 'transparent', border: 'var(--border-color)', icon: null, label: 'Same' },
  };

  const c = colors[diff.type];

  return (
    <div
      style={{
        padding: '0.5rem 0.625rem',
        borderBottom: '1px solid var(--border-color)',
        background: c.bg,
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
        <span style={{ color: c.border, display: 'flex', alignItems: 'center' }}>{c.icon}</span>
        <span
          style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: '3px',
            background: c.border,
            color: '#fff',
            textTransform: 'uppercase',
          }}
        >
          {c.label}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          {diff.path}
        </span>
      </div>

      {diff.type === 'changed' && (
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: 'var(--error)', fontWeight: 600 }}>- </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
              {JSON.stringify(diff.oldValue)}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>+ </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
              {JSON.stringify(diff.newValue)}
            </span>
          </div>
        </div>
      )}

      {diff.type === 'added' && (
        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {JSON.stringify(diff.newValue)}
        </div>
      )}

      {diff.type === 'removed' && (
        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {JSON.stringify(diff.oldValue)}
        </div>
      )}
    </div>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const btnStyle: React.CSSProperties = {
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
  whiteSpace: 'nowrap' as const,
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--accent)',
  color: '#fff',
  border: '1px solid var(--accent)',
};

const panelLabelStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  borderBottom: '1px solid var(--border-color)',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  background: 'var(--bg-tertiary)',
};

const resizeHandleStyle: React.CSSProperties = {
  width: '4px',
  background: 'var(--border-color)',
  cursor: 'col-resize',
};
