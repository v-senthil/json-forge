/* ===================================================================
 * FormatterView - Main formatter module.
 * Split-pane layout: Editor (left) + Formatted output (right).
 * =================================================================== */

import { useEffect, useRef, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { JsonEditor } from '../common/JsonEditor';
import { FormatterToolbar } from './FormatterToolbar';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useDebouncedPersist } from '../../hooks/useDebouncedPersist';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useToast } from '../common/Toast';

export function FormatterView() {
  const { jsonInput } = useAppState();
  const dispatch = useAppDispatch();
  const worker = useJsonWorker();
  const { showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist input to localStorage with debounce
  useDebouncedPersist('jf-json-input', jsonInput);

  // Auto-parse on input change (debounced 300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!jsonInput.trim()) {
      dispatch({ type: 'SET_PARSE_RESULT', payload: null });
      return;
    }

    debounceRef.current = setTimeout(() => {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      worker.parse(jsonInput, (response) => {
        if (response.type === 'parseResult') {
          dispatch({ type: 'SET_PARSE_RESULT', payload: response.payload });
        }
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [jsonInput, worker, dispatch]);

  // Keyboard shortcuts
  const handleFormat = useCallback(() => {
    if (!jsonInput.trim()) return;
    dispatch({ type: 'SET_PROCESSING', payload: true });
    worker.format(jsonInput, 2, (response) => {
      if (response.type === 'formatResult') {
        dispatch({ type: 'SET_JSON_INPUT', payload: response.payload.formatted });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        showToast(`Formatted in ${Math.round(response.payload.time)}ms`);
      }
    });
  }, [jsonInput, worker, dispatch, showToast]);

  const handleMinify = useCallback(() => {
    if (!jsonInput.trim()) return;
    dispatch({ type: 'SET_PROCESSING', payload: true });
    worker.minify(jsonInput, (response) => {
      if (response.type === 'minifyResult') {
        dispatch({ type: 'SET_JSON_INPUT', payload: response.payload.minified });
        dispatch({ type: 'SET_PROCESSING', payload: false });
        showToast(`Minified in ${Math.round(response.payload.time)}ms`);
      }
    });
  }, [jsonInput, worker, dispatch, showToast]);

  useKeyboardShortcuts({
    'mod+enter': handleFormat,
    'mod+m': handleMinify,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FormatterToolbar />
      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={100} minSize={30}>
          <JsonEditor />
        </Panel>
        <Separator
          style={{
            width: '4px',
            background: 'var(--border-color)',
            cursor: 'col-resize',
            transition: 'background 0.15s',
          }}
        />
        <Panel defaultSize={0} minSize={0}>
          <FormattedOutput />
        </Panel>
      </Group>
    </div>
  );
}

/** Formatted output panel (read-only Monaco) */
function FormattedOutput() {
  const { parseResult } = useAppState();

  if (!parseResult) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        Paste or upload JSON to get started.
        <br />
        Use ⌘+Enter to format.
      </div>
    );
  }

  if (!parseResult.success) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--error)',
          fontSize: '0.875rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        {parseResult.error?.message || 'Invalid JSON'}
      </div>
    );
  }

  return <JsonEditor value={parseResult.formatted || ''} readOnly />;
}
