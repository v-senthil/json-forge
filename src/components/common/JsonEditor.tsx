/* ===================================================================
 * JsonEditor - Monaco Editor wrapper for JSON input.
 * Features: syntax highlighting, error markers, line numbers,
 * auto-complete, and large file handling.
 * =================================================================== */

import { useCallback, useRef, useEffect } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useAppState, useAppDispatch } from '../../stores/AppStore';

interface Props {
  /** Override input value (for diff panel) */
  value?: string;
  /** Override onChange (for diff panel) */
  onChange?: (value: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Language override */
  language?: string;
  /** Height override */
  height?: string;
}

export function JsonEditor({ value, onChange, readOnly = false, language = 'json', height }: Props) {
  const { theme, jsonInput, parseResult } = useAppState();
  const dispatch = useAppDispatch();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const currentValue = value ?? jsonInput;

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Configure editor for large files
    editor.updateOptions({
      // Disable minimap for large files
      minimap: { enabled: currentValue.length < 500000 },
      // Folding for collapse
      folding: true,
      // Word wrap
      wordWrap: 'on',
      // Smooth scrolling
      smoothScrolling: true,
      // Bracket colorization
      bracketPairColorization: { enabled: true },
    });
  }, [currentValue.length]);

  const handleChange: OnChange = useCallback(
    (val) => {
      const newValue = val || '';
      if (onChange) {
        onChange(newValue);
      } else if (value === undefined) {
        // Only dispatch to global store when no explicit value prop is provided.
        // This prevents read-only result editors from polluting the JSON input.
        dispatch({ type: 'SET_JSON_INPUT', payload: newValue });
      }
    },
    [onChange, value, dispatch]
  );

  // Update error markers when parseResult changes
  useEffect(() => {
    if (!editorRef.current || value !== undefined) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const monaco = (window as unknown as { monaco: typeof import('monaco-editor') }).monaco;
    if (!monaco) return;

    if (parseResult && !parseResult.success && parseResult.error) {
      const { line, column, message } = parseResult.error;
      if (line && column) {
        monaco.editor.setModelMarkers(model, 'json-parser', [
          {
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + 1,
            message,
            severity: monaco.MarkerSeverity.Error,
          },
        ]);
      }
    } else {
      monaco.editor.setModelMarkers(model, 'json-parser', []);
    }
  }, [parseResult, value]);

  return (
    <div style={{ height: height || '100%', width: '100%' }}>
      <Editor
        height="100%"
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        value={currentValue}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          readOnly,
          fontSize: 13,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          minimap: { enabled: false },
          folding: true,
          wordWrap: 'on',
          bracketPairColorization: { enabled: true },
          padding: { top: 8 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
        loading={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}
          >
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
