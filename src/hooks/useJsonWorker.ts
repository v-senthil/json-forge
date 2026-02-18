/* ===================================================================
 * Hook to interact with the JSON Web Worker.
 * Provides a clean API for all worker operations with
 * automatic cleanup on unmount.
 * =================================================================== */

import { useCallback, useEffect, useRef } from 'react';
import type { WorkerRequest, WorkerResponse, SearchOptions, CodeGenOptions, QueryLanguage, ProfileMetrics, CodeGenResult, QueryResult, FlattenOptions, DbSchemaDialect, DbSchemaResult, ContractTestFramework, ContractTestResult, GraphqlOutputMode, WorkflowStep, WorkflowResult, MockOptions, MaskingConfig, PatchOperation, PathResult, SchemaDrift } from '../types';

type MessageHandler = (response: WorkerResponse) => void;

export function useJsonWorker() {
  const workerRef = useRef<Worker | null>(null);
  const handlersRef = useRef<Map<string, MessageHandler>>(new Map());

  useEffect(() => {
    // Create worker using Vite's worker import syntax
    const worker = new Worker(
      new URL('../workers/json.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const response = e.data;
      const handler = handlersRef.current.get(response.type);
      if (handler) {
        handler(response);
        // Clean up one-shot handlers
        handlersRef.current.delete(response.type);
      }
    };

    worker.onerror = (e) => {
      console.error('Worker error:', e);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(
    (request: WorkerRequest, responseType: string, handler: MessageHandler) => {
      if (!workerRef.current) return;
      handlersRef.current.set(responseType, handler);
      workerRef.current.postMessage(request);
    },
    []
  );

  const parse = useCallback(
    (input: string, onResult: MessageHandler) => {
      sendMessage({ type: 'parse', payload: input }, 'parseResult', onResult);
    },
    [sendMessage]
  );

  const format = useCallback(
    (input: string, indent: number, onResult: MessageHandler) => {
      sendMessage(
        { type: 'format', payload: { data: input, indent } },
        'formatResult',
        onResult
      );
    },
    [sendMessage]
  );

  const minify = useCallback(
    (input: string, onResult: MessageHandler) => {
      sendMessage({ type: 'minify', payload: input }, 'minifyResult', onResult);
    },
    [sendMessage]
  );

  const generateSchema = useCallback(
    (input: string, onResult: MessageHandler) => {
      sendMessage({ type: 'generateSchema', payload: input }, 'schemaResult', onResult);
    },
    [sendMessage]
  );

  const validate = useCallback(
    (json: string, schema: string, onResult: MessageHandler) => {
      sendMessage(
        { type: 'validate', payload: { json, schema } },
        'validateResult',
        onResult
      );
    },
    [sendMessage]
  );

  const diff = useCallback(
    (left: string, right: string, onResult: MessageHandler) => {
      sendMessage(
        { type: 'diff', payload: { left, right } },
        'diffResult',
        onResult
      );
    },
    [sendMessage]
  );

  const buildTree = useCallback(
    (input: string, onResult: MessageHandler) => {
      sendMessage({ type: 'buildTree', payload: input }, 'treeResult', onResult);
    },
    [sendMessage]
  );

  const search = useCallback(
    (json: string, options: SearchOptions, onResult: MessageHandler) => {
      sendMessage({ type: 'search', payload: { json, options } }, 'searchResult', onResult);
    },
    [sendMessage]
  );

  const profile = useCallback(
    (input: string): Promise<ProfileMetrics> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'profile', payload: input }, 'profileResult', (response) => {
          if (response.type === 'profileResult') resolve(response.payload);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const generateCode = useCallback(
    (json: string, options: CodeGenOptions): Promise<CodeGenResult> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'generateCode', payload: { json, options } }, 'codegenResult', (response) => {
          if (response.type === 'codegenResult') resolve(response.payload);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const query = useCallback(
    (json: string, queryStr: string, language: QueryLanguage): Promise<QueryResult> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'query', payload: { json, query: queryStr, language } }, 'queryResult', (response) => {
          if (response.type === 'queryResult') resolve(response.payload);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const diffPatch = useCallback(
    (left: string, right: string, onResult: MessageHandler) => {
      sendMessage({ type: 'diffPatch', payload: { left, right } }, 'diffPatchResult', onResult);
    },
    [sendMessage]
  );

  const analyzeLogs = useCallback(
    (input: string, onResult: MessageHandler) => {
      sendMessage({ type: 'analyzeLogs', payload: input }, 'analyzeLogsResult', onResult);
    },
    [sendMessage]
  );

  const flatten = useCallback(
    (json: string, options: FlattenOptions): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'flatten', payload: { json, options } }, 'flattenResult', (response) => {
          if (response.type === 'flattenResult') resolve(response.payload.result);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const unflatten = useCallback(
    (json: string, delimiter: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'unflatten', payload: { json, delimiter } }, 'unflattenResult', (response) => {
          if (response.type === 'unflattenResult') resolve(response.payload.result);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const generateDbSchema = useCallback(
    (json: string, dialect: DbSchemaDialect, tableName: string): Promise<DbSchemaResult> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'generateDbSchema', payload: { json, dialect, tableName } }, 'dbSchemaResult', (response) => {
          if (response.type === 'dbSchemaResult') resolve(response.payload);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const generateContract = useCallback(
    (json: string, schema: string | undefined, framework: ContractTestFramework): Promise<ContractTestResult> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'generateContract', payload: { json, schema, framework } }, 'contractResult', (response) => {
          if (response.type === 'contractResult') resolve(response.payload);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const generateOpenApi = useCallback(
    (json: string, title: string, basePath: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'generateOpenApi', payload: { json, title, basePath } }, 'openApiResult', (response) => {
          if (response.type === 'openApiResult') resolve(response.payload.spec);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const generateGraphql = useCallback(
    (json: string, mode: GraphqlOutputMode, rootName: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'generateGraphql', payload: { json, mode, rootName } }, 'graphqlResult', (response) => {
          if (response.type === 'graphqlResult') resolve(response.payload.output);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const runWorkflow = useCallback(
    (json: string, steps: WorkflowStep[]): Promise<WorkflowResult> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'runWorkflow', payload: { json, steps } }, 'workflowResult', (response) => {
          if (response.type === 'workflowResult') resolve(response.payload);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const applyPatch = useCallback(
    (json: string, patch: PatchOperation[]): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'applyPatch', payload: { json, patch } }, 'patchResult', (response) => {
          if (response.type === 'patchResult') resolve(response.payload.result);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const explorePaths = useCallback(
    (json: string, expression: string): Promise<PathResult[]> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'explorePaths', payload: { json, expression } }, 'pathExplorerResult', (response) => {
          if (response.type === 'pathExplorerResult') resolve(response.payload.results);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const generateMock = useCallback(
    (json: string, options: MockOptions): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'generateMock', payload: { json, options } }, 'mockDataResult', (response) => {
          if (response.type === 'mockDataResult') resolve(response.payload.result);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const maskData = useCallback(
    (json: string, config: MaskingConfig): Promise<string> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'maskData', payload: { json, config } }, 'maskDataResult', (response) => {
          if (response.type === 'maskDataResult') resolve(response.payload.result);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  const analyzeSchemaDrift = useCallback(
    (schemaA: string, schemaB: string): Promise<SchemaDrift[]> => {
      return new Promise((resolve, reject) => {
        sendMessage({ type: 'analyzeSchemaDrift', payload: { schemaA, schemaB } }, 'schemaDriftResult', (response) => {
          if (response.type === 'schemaDriftResult') resolve(response.payload.drifts);
          else if (response.type === 'error') reject(new Error(response.payload.message));
        });
      });
    },
    [sendMessage]
  );

  return {
    parse, format, minify, generateSchema, validate, diff, buildTree, search,
    profile, generateCode, query, diffPatch, analyzeLogs,
    flatten, unflatten, generateDbSchema, generateContract,
    generateOpenApi, generateGraphql, runWorkflow, applyPatch,
    explorePaths, generateMock, maskData, analyzeSchemaDrift,
  };
}
