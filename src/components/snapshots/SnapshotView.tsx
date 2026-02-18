import { useState, useCallback, useMemo } from 'react';
import { Camera, Clock, Download, Upload, Trash2, GitCompare, Tag, RotateCcw } from 'lucide-react';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { formatBytes, downloadFile } from '../../utils';
import type { Snapshot } from '../../types';

const STORAGE_KEY = 'jf-snapshots';

function loadSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveSnapshots(snapshots: Snapshot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch { /* storage full */ }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function SnapshotView() {
  const { jsonInput } = useAppState();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadSnapshots);
  const [tag, setTag] = useState('');
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [diffText, setDiffText] = useState('');

  const createSnapshot = useCallback(() => {
    if (!jsonInput.trim()) { showToast('No JSON to snapshot', 'error'); return; }
    const snap: Snapshot = {
      id: generateId(),
      tag: tag.trim() || `Snapshot ${snapshots.length + 1}`,
      timestamp: Date.now(),
      json: jsonInput,
      size: new Blob([jsonInput]).size,
    };
    const updated = [snap, ...snapshots];
    setSnapshots(updated);
    saveSnapshots(updated);
    setTag('');
    showToast('Snapshot saved');
  }, [jsonInput, tag, snapshots, showToast]);

  const deleteSnapshot = useCallback((id: string) => {
    const updated = snapshots.filter(s => s.id !== id);
    setSnapshots(updated);
    saveSnapshots(updated);
    showToast('Snapshot deleted');
  }, [snapshots, showToast]);

  const restoreSnapshot = useCallback((snap: Snapshot) => {
    dispatch({ type: 'SET_JSON_INPUT', payload: snap.json });
    showToast(`Restored: ${snap.tag}`);
  }, [dispatch, showToast]);

  const exportHistory = useCallback(() => {
    downloadFile(JSON.stringify(snapshots, null, 2), 'snapshot-history.json');
    showToast('History exported');
  }, [snapshots, showToast]);

  const importHistory = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as Snapshot[];
        const merged = [...imported, ...snapshots];
        const unique = merged.filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
        setSnapshots(unique);
        saveSnapshots(unique);
        showToast(`Imported ${imported.length} snapshots`);
      } catch { showToast('Invalid snapshot file', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [snapshots, showToast]);

  const compareSnapshots = useCallback(() => {
    if (!compareA || !compareB) { showToast('Select two snapshots to compare', 'error'); return; }
    const a = snapshots.find(s => s.id === compareA);
    const b = snapshots.find(s => s.id === compareB);
    if (!a || !b) return;
    try {
      const objA = JSON.parse(a.json);
      const objB = JSON.parse(b.json);
      const diff = simpleDiff(objA, objB, '');
      setDiffText(diff.length > 0 ? diff.join('\n') : 'No differences found');
    } catch (err) {
      setDiffText(`Error comparing: ${err}`);
    }
  }, [compareA, compareB, snapshots, showToast]);

  const clearAll = useCallback(() => {
    setSnapshots([]);
    saveSnapshots([]);
    showToast('All snapshots cleared');
  }, [showToast]);

  const formatDate = useMemo(() => {
    return (ts: number) => new Date(ts).toLocaleString();
  }, []);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Create Snapshot */}
      <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Save Snapshot</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Tag name (optional)"
            style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-editor)', color: 'var(--text-primary)', fontSize: '0.8125rem' }}
            onKeyDown={e => { if (e.key === 'Enter') createSnapshot(); }} />
          <button onClick={createSnapshot}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 16px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
            <Camera size={14} /> Save
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
          <button onClick={exportHistory} disabled={snapshots.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', opacity: snapshots.length ? 1 : 0.5 }}>
            <Download size={12} /> Export History
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Upload size={12} /> Import
            <input type="file" accept=".json" onChange={importHistory} style={{ display: 'none' }} />
          </label>
          <div style={{ flex: 1 }} />
          <button onClick={clearAll} disabled={snapshots.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--error)', color: 'var(--error)', background: 'transparent', cursor: 'pointer', opacity: snapshots.length ? 1 : 0.5 }}>
            <Trash2 size={12} /> Clear All
          </button>
        </div>
      </div>

      {/* Compare */}
      {snapshots.length >= 2 && (
        <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCompare size={14} color="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Compare Snapshots</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={compareA || ''} onChange={e => setCompareA(e.target.value || null)}
              style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
              <option value="">Select A...</option>
              {snapshots.map(s => <option key={s.id} value={s.id}>{s.tag} ({formatDate(s.timestamp)})</option>)}
            </select>
            <span style={{ color: 'var(--text-muted)' }}>vs</span>
            <select value={compareB || ''} onChange={e => setCompareB(e.target.value || null)}
              style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
              <option value="">Select B...</option>
              {snapshots.map(s => <option key={s.id} value={s.id}>{s.tag} ({formatDate(s.timestamp)})</option>)}
            </select>
            <button onClick={compareSnapshots}
              style={{ padding: '4px 12px', borderRadius: '4px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}>
              Compare
            </button>
          </div>
          {diffText && (
            <pre style={{ padding: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto', margin: 0 }}>
              {diffText}
            </pre>
          )}
        </div>
      )}

      {/* Snapshot List */}
      <div style={{ flex: 1 }}>
        {snapshots.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
            <Camera size={32} opacity={0.3} />
            <span style={{ fontSize: '0.875rem' }}>No snapshots yet. Save your current JSON as a snapshot.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {snapshots.map(snap => (
              <div key={snap.id} style={{
                padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <Tag size={16} color="var(--accent)" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{snap.tag}</span>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {formatDate(snap.timestamp)}</span>
                    <span>{formatBytes(snap.size)}</span>
                  </div>
                </div>
                <button onClick={() => restoreSnapshot(snap)} title="Restore"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>
                  <RotateCcw size={12} /> Restore
                </button>
                <button onClick={() => deleteSnapshot(snap.id)} title="Delete"
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--error)', color: 'var(--error)', background: 'transparent', cursor: 'pointer' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple diff helper for comparing two objects
function simpleDiff(a: unknown, b: unknown, path: string): string[] {
  const results: string[] = [];
  if (a === b) return results;
  if (a === undefined) { results.push(`+ ${path || '/'}: ${JSON.stringify(b)}`); return results; }
  if (b === undefined) { results.push(`- ${path || '/'}: ${JSON.stringify(a)}`); return results; }
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    results.push(`~ ${path || '/'}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    return results;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      results.push(...simpleDiff(a[i], b[i], `${path}[${i}]`));
    }
    return results;
  }
  if (typeof a === 'object' && a !== null && b !== null) {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const key of allKeys) {
      results.push(...simpleDiff(ao[key], bo[key], `${path}.${key}`));
    }
    return results;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    results.push(`~ ${path || '/'}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  }
  return results;
}
