/* ===================================================================
 * SchemaView - JSON Schema generator and validator.
 * Features:
 *  - Generate Draft 2020-12 compatible schema from JSON
 *  - Edit schema manually
 *  - Validate JSON against schema
 *  - Show validation errors inline
 *  - Download schema
 * =================================================================== */

import { useState, useCallback, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { JsonEditor } from '../common/JsonEditor';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useJsonWorker } from '../../hooks/useJsonWorker';
import { useToast } from '../common/Toast';
import { copyToClipboard, downloadFile } from '../../utils';
import type { SchemaValidationError } from '../../types';
import {
  Wand2,
  ShieldCheck,
  Copy,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export function SchemaView() {
  const { jsonInput, parseResult, schemaText } = useAppState();
  const dispatch = useAppDispatch();
  const worker = useJsonWorker();
  const { showToast } = useToast();

  const [validationErrors, setValidationErrors] = useState<SchemaValidationError[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Auto-generate schema when JSON changes and we don't have one yet
  useEffect(() => {
    if (parseResult?.success && !schemaText) {
      handleGenerate();
    }
    // Only run on initial valid parse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parseResult?.success]);

  const handleGenerate = useCallback(() => {
    if (!jsonInput.trim()) {
      showToast('No JSON to generate schema from', 'info');
      return;
    }
    if (!parseResult?.success) {
      showToast('Fix JSON errors first', 'error');
      return;
    }

    setIsGenerating(true);
    worker.generateSchema(jsonInput, (response) => {
      if (response.type === 'schemaResult') {
        const schemaStr = JSON.stringify(response.payload.schema, null, 2);
        dispatch({ type: 'SET_SCHEMA_TEXT', payload: schemaStr });
        setIsGenerating(false);
        setIsValid(null);
        setValidationErrors([]);
        showToast(`Schema generated in ${Math.round(response.payload.time)}ms`);
      }
    });
  }, [jsonInput, parseResult, worker, dispatch, showToast]);

  const handleValidate = useCallback(() => {
    if (!jsonInput.trim()) {
      showToast('No JSON to validate', 'info');
      return;
    }
    if (!schemaText.trim()) {
      showToast('No schema to validate against', 'info');
      return;
    }

    setIsValidating(true);
    worker.validate(jsonInput, schemaText, (response) => {
      if (response.type === 'validateResult') {
        setIsValid(response.payload.valid);
        setValidationErrors(response.payload.errors);
        setIsValidating(false);
        showToast(
          response.payload.valid
            ? `Valid! (${Math.round(response.payload.time)}ms)`
            : `${response.payload.errors.length} error(s) found`,
          response.payload.valid ? 'success' : 'error'
        );
      }
    });
  }, [jsonInput, schemaText, worker, showToast]);

  const handleCopySchema = useCallback(async () => {
    if (!schemaText.trim()) return;
    await copyToClipboard(schemaText);
    showToast('Schema copied');
  }, [schemaText, showToast]);

  const handleDownloadSchema = useCallback(() => {
    if (!schemaText.trim()) return;
    downloadFile(schemaText, 'schema.json');
    showToast('Downloaded schema.json');
  }, [schemaText, showToast]);

  if (!jsonInput.trim()) {
    return (
      <div style={emptyStyle}>
        Enter JSON in the Formatter tab to generate a schema.
      </div>
    );
  }

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
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            ...primaryBtnStyle,
            opacity: isGenerating ? 0.7 : 1,
          }}
        >
          <Wand2 size={14} />
          {isGenerating ? 'Generating...' : 'Generate Schema'}
        </button>

        <button
          onClick={handleValidate}
          disabled={isValidating || !schemaText.trim()}
          style={{
            ...btnStyle,
            opacity: isValidating || !schemaText.trim() ? 0.5 : 1,
          }}
        >
          <ShieldCheck size={14} />
          {isValidating ? 'Validating...' : 'Validate'}
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        <button onClick={handleCopySchema} style={btnStyle} disabled={!schemaText.trim()}>
          <Copy size={14} /> Copy
        </button>
        <button onClick={handleDownloadSchema} style={btnStyle} disabled={!schemaText.trim()}>
          <Download size={14} /> Download
        </button>

        {/* Validation status */}
        {isValid !== null && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.3125rem 0.625rem',
              background: isValid ? 'var(--success-bg)' : 'var(--error-bg)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: isValid ? 'var(--success)' : 'var(--error)',
            }}
          >
            {isValid ? (
              <>
                <CheckCircle size={14} /> Valid
              </>
            ) : (
              <>
                <XCircle size={14} /> {validationErrors.length} error(s)
              </>
            )}
          </div>
        )}
      </div>

      {/* Split pane: JSON input (left) + Schema output (right) */}
      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={50} minSize={25}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '0.375rem 0.75rem',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-tertiary)',
              }}
            >
              JSON Input
            </div>
            <div style={{ flex: 1 }}>
              <JsonEditor />
            </div>
          </div>
        </Panel>

        <Separator
          style={{
            width: '4px',
            background: 'var(--border-color)',
            cursor: 'col-resize',
          }}
        />

        <Panel defaultSize={50} minSize={25}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '0.375rem 0.75rem',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-tertiary)',
              }}
            >
              Schema
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Schema editor */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <JsonEditor
                  value={schemaText}
                  onChange={(val) => {
                    dispatch({ type: 'SET_SCHEMA_TEXT', payload: val });
                    setIsValid(null);
                    setValidationErrors([]);
                  }}
                />
              </div>

              {/* Validation errors (shown inline below schema when present) */}
              {(isValid !== null || validationErrors.length > 0) && (
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    maxHeight: '40%',
                    overflow: 'auto',
                    padding: '0.5rem',
                    flexShrink: 0,
                  }}
                >
                  {isValid === true && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.625rem',
                        color: 'var(--success)',
                        background: 'var(--success-bg)',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle size={16} />
                      JSON is valid — all properties match the schema.
                    </div>
                  )}
                  {validationErrors.map((err, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.625rem',
                        marginBottom: '0.375rem',
                        background: 'var(--error-bg)',
                        borderRadius: '6px',
                        border: '1px solid var(--error)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <AlertTriangle size={14} color="var(--error)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '2px' }}>
                          {err.path}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          [{err.keyword}] {err.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
  padding: '2rem',
  textAlign: 'center',
};

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
