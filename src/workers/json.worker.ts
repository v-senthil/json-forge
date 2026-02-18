/* ===================================================================
 * JSON Processing Web Worker
 * 
 * Runs heavy JSON operations off the main thread to prevent UI freezing.
 * Handles: parsing, formatting, minifying, schema generation,
 * validation, diff computation, and tree building.
 * =================================================================== */

import type {
  WorkerRequest,
  WorkerResponse,
  ParseResult,
  ParseError,
  TreeNode,
  JsonValueType,
  JsonSchema,
  SchemaValidationError,
  DiffResult,
  SearchMatch,
  SearchOptions,
  ProfileMetrics,
  CodeGenOptions,
  CodeGenResult,
  QueryLanguage,
  LogEntry,
  LogLevel,
  LogStats,
  DiffPatchOp,
  FlattenOptions,
  DbSchemaDialect,
  ContractTestFramework,
  ContractAssertion,
  GraphqlOutputMode,
  WorkflowStep,
  WorkflowResult,
  PatchOperation,
  PathResult,
  MockOptions,
  MaskingConfig,
  SchemaDrift,
} from '../types';

// Listen for messages from the main thread
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'parse':
        handleParse(payload);
        break;
      case 'format':
        handleFormat(payload.data, payload.indent);
        break;
      case 'minify':
        handleMinify(payload);
        break;
      case 'generateSchema':
        handleGenerateSchema(payload);
        break;
      case 'validate':
        handleValidate(payload.json, payload.schema);
        break;
      case 'diff':
        handleDiff(payload.left, payload.right);
        break;
      case 'buildTree':
        handleBuildTree(payload);
        break;
      case 'search':
        handleSearch(payload.json, payload.options);
        break;
      case 'profile':
        handleProfile(payload);
        break;
      case 'generateCode':
        handleGenerateCode(payload.json, payload.options);
        break;
      case 'query':
        handleQuery(payload.json, payload.query, payload.language);
        break;
      case 'diffPatch':
        handleDiffPatch(payload.left, payload.right);
        break;
      case 'analyzeLogs':
        handleAnalyzeLogs(payload);
        break;
      case 'flatten':
        handleFlatten(payload.json, payload.options);
        break;
      case 'unflatten':
        handleUnflatten(payload.json, payload.delimiter);
        break;
      case 'generateDbSchema':
        handleGenerateDbSchema(payload.json, payload.dialect, payload.tableName);
        break;
      case 'generateContract':
        handleGenerateContract(payload.json, payload.schema, payload.framework);
        break;
      case 'generateOpenApi':
        handleGenerateOpenApi(payload.json, payload.title, payload.basePath);
        break;
      case 'generateGraphql':
        handleGenerateGraphql(payload.json, payload.mode, payload.rootName);
        break;
      case 'runWorkflow':
        handleRunWorkflow(payload.json, payload.steps);
        break;
      case 'applyPatch':
        handleApplyPatch(payload.json, payload.patch);
        break;
      case 'explorePaths':
        handleExplorePaths(payload.json, payload.expression);
        break;
      case 'generateMock':
        handleGenerateMock(payload.json, payload.options);
        break;
      case 'maskData':
        handleMaskData(payload.json, payload.config);
        break;
      case 'analyzeSchemaDrift':
        handleAnalyzeSchemaDrift(payload.schemaA, payload.schemaB);
        break;
    }
  } catch (err) {
    respond({ type: 'error', payload: { message: String(err) } });
  }
};

function respond(msg: WorkerResponse) {
  self.postMessage(msg);
}

// ─── Parse ────────────────────────────────────────────────────────────
function handleParse(input: string) {
  const start = performance.now();
  const size = new Blob([input]).size;

  try {
    const data = JSON.parse(input);
    const formatted = JSON.stringify(data, null, 2);
    const minified = JSON.stringify(data);
    const parseTime = performance.now() - start;

    const result: ParseResult = {
      success: true,
      data,
      formatted,
      minified,
      size,
      parseTime,
    };
    respond({ type: 'parseResult', payload: result });
  } catch (err) {
    const parseTime = performance.now() - start;
    const error = extractParseError(err, input);
    const result: ParseResult = {
      success: false,
      error,
      size,
      parseTime,
    };
    respond({ type: 'parseResult', payload: result });
  }
}

/** Extract line/column from JSON parse errors */
function extractParseError(err: unknown, input: string): ParseError {
  const message = err instanceof Error ? err.message : String(err);
  // Try to extract position from the error message
  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch) {
    const position = parseInt(posMatch[1], 10);
    const lines = input.substring(0, position).split('\n');
    return {
      message,
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
      position,
    };
  }
  return { message };
}

// ─── Format ───────────────────────────────────────────────────────────
function handleFormat(input: string, indent: number) {
  const start = performance.now();
  const data = JSON.parse(input);
  const formatted = JSON.stringify(data, null, indent);
  respond({ type: 'formatResult', payload: { formatted, time: performance.now() - start } });
}

// ─── Minify ───────────────────────────────────────────────────────────
function handleMinify(input: string) {
  const start = performance.now();
  const data = JSON.parse(input);
  const minified = JSON.stringify(data);
  respond({ type: 'minifyResult', payload: { minified, time: performance.now() - start } });
}

// ─── Schema Generation (Draft 2020-12 compatible) ─────────────────────
function handleGenerateSchema(input: string) {
  const start = performance.now();
  const data = JSON.parse(input);
  const schema = generateSchema(data);
  schema.$schema = 'https://json-schema.org/draft/2020-12/schema';
  respond({ type: 'schemaResult', payload: { schema, time: performance.now() - start } });
}

function generateSchema(value: unknown, depth = 0): JsonSchema {
  if (value === null) return { type: 'null' };

  if (Array.isArray(value)) {
    const schema: JsonSchema = { type: 'array' };
    if (value.length > 0) {
      // Detect if all items have the same structure
      const itemSchemas = value.slice(0, 10).map((item) => generateSchema(item, depth + 1));
      if (itemSchemas.length === 1) {
        schema.items = itemSchemas[0];
      } else {
        // Merge schemas if all same type
        const types = new Set(itemSchemas.map((s) => s.type));
        if (types.size === 1 && itemSchemas[0].type === 'object') {
          schema.items = mergeObjectSchemas(itemSchemas);
        } else if (types.size === 1) {
          schema.items = itemSchemas[0];
        } else {
          schema.items = { anyOf: deduplicateSchemas(itemSchemas) };
        }
      }
    }
    return schema;
  }

  switch (typeof value) {
    case 'string': {
      const schema: JsonSchema = { type: 'string' };
      // Detect common formats
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) schema.format = 'date-time';
      else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) schema.format = 'date';
      else if (/^[\w.-]+@[\w.-]+\.\w+$/.test(value)) schema.format = 'email';
      else if (/^https?:\/\//.test(value)) schema.format = 'uri';
      return schema;
    }
    case 'number':
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object': {
      const obj = value as Record<string, unknown>;
      const schema: JsonSchema = {
        type: 'object',
        properties: {},
        required: Object.keys(obj),
      };
      for (const [k, v] of Object.entries(obj)) {
        schema.properties![k] = generateSchema(v, depth + 1);
      }
      return schema;
    }
    default:
      return {};
  }
}

function mergeObjectSchemas(schemas: JsonSchema[]): JsonSchema {
  const merged: JsonSchema = { type: 'object', properties: {} };
  const requiredSets: Set<string>[] = schemas.map((s) => new Set(s.required || []));
  const allKeys = new Set(schemas.flatMap((s) => Object.keys(s.properties || {})));

  for (const key of allKeys) {
    const propSchemas = schemas
      .filter((s) => s.properties?.[key])
      .map((s) => s.properties![key]);
    merged.properties![key] = propSchemas.length > 0 ? propSchemas[0] : {};
  }

  // Required = keys present in ALL schemas
  merged.required = [...allKeys].filter((k) => requiredSets.every((s) => s.has(k)));
  if (merged.required.length === 0) delete merged.required;

  return merged;
}

function deduplicateSchemas(schemas: JsonSchema[]): JsonSchema[] {
  const seen = new Set<string>();
  return schemas.filter((s) => {
    const key = JSON.stringify(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Validation ───────────────────────────────────────────────────────
function handleValidate(jsonStr: string, schemaStr: string) {
  const start = performance.now();
  try {
    const data = JSON.parse(jsonStr);
    const schema = JSON.parse(schemaStr);
    const errors = simpleValidate(data, schema, '$');
    respond({
      type: 'validateResult',
      payload: { valid: errors.length === 0, errors, time: performance.now() - start },
    });
  } catch (err) {
    respond({
      type: 'validateResult',
      payload: {
        valid: false,
        errors: [{ path: '$', message: String(err), keyword: 'parse' }],
        time: performance.now() - start,
      },
    });
  }
}

/** Simple recursive JSON Schema validator (covers common keywords) */
function simpleValidate(data: unknown, schema: JsonSchema, path: string): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = getJsonType(data);
    if (!types.includes(actualType) && !(actualType === 'integer' && types.includes('number'))) {
      errors.push({ path, message: `Expected type ${types.join('|')}, got ${actualType}`, keyword: 'type' });
      return errors;
    }
  }

  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) {
    errors.push({ path, message: `Value must be one of: ${JSON.stringify(schema.enum)}`, keyword: 'enum' });
  }

  if (schema.const !== undefined && JSON.stringify(data) !== JSON.stringify(schema.const)) {
    errors.push({ path, message: `Value must be ${JSON.stringify(schema.const)}`, keyword: 'const' });
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({ path: `${path}.${key}`, message: `Missing required property "${key}"`, keyword: 'required' });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          errors.push(...simpleValidate(obj[key], propSchema as JsonSchema, `${path}.${key}`));
        }
      }
    }
  }

  if (Array.isArray(data) && schema.items) {
    const itemSchema = schema.items as JsonSchema;
    data.forEach((item, i) => {
      errors.push(...simpleValidate(item, itemSchema, `${path}[${i}]`));
    });
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `Value ${data} is less than minimum ${schema.minimum}`, keyword: 'minimum' });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `Value ${data} is greater than maximum ${schema.maximum}`, keyword: 'maximum' });
    }
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path, message: `String length ${data.length} is less than minLength ${schema.minLength}`, keyword: 'minLength' });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path, message: `String length ${data.length} is greater than maxLength ${schema.maxLength}`, keyword: 'maxLength' });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push({ path, message: `String does not match pattern "${schema.pattern}"`, keyword: 'pattern' });
    }
  }

  return errors;
}

function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

// ─── Diff ─────────────────────────────────────────────────────────────
function handleDiff(leftStr: string, rightStr: string) {
  const start = performance.now();
  try {
    const left = JSON.parse(leftStr);
    const right = JSON.parse(rightStr);
    const diffs = computeDiff(left, right, '$');
    respond({ type: 'diffResult', payload: { diffs, time: performance.now() - start } });
  } catch (err) {
    respond({ type: 'error', payload: { message: `Diff error: ${err}` } });
  }
}

function computeDiff(left: unknown, right: unknown, path: string): DiffResult[] {
  if (left === right) {
    return [{ type: 'unchanged', path, key: path.split('.').pop() || '$', oldValue: left, newValue: right }];
  }

  if (left === undefined) {
    return [{ type: 'added', path, key: path.split('.').pop() || '$', newValue: right }];
  }

  if (right === undefined) {
    return [{ type: 'removed', path, key: path.split('.').pop() || '$', oldValue: left }];
  }

  const leftType = typeof left;
  const rightType = typeof right;

  if (leftType !== rightType || Array.isArray(left) !== Array.isArray(right)) {
    return [{ type: 'changed', path, key: path.split('.').pop() || '$', oldValue: left, newValue: right }];
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const results: DiffResult[] = [];
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      results.push(...computeDiff(left[i], right[i], `${path}[${i}]`));
    }
    return results;
  }

  if (leftType === 'object' && left !== null && right !== null) {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);
    const results: DiffResult[] = [];
    for (const key of allKeys) {
      results.push(...computeDiff(leftObj[key], rightObj[key], `${path}.${key}`));
    }
    return results;
  }

  if (JSON.stringify(left) !== JSON.stringify(right)) {
    return [{ type: 'changed', path, key: path.split('.').pop() || '$', oldValue: left, newValue: right }];
  }

  return [{ type: 'unchanged', path, key: path.split('.').pop() || '$', oldValue: left, newValue: right }];
}

// ─── Tree Building ────────────────────────────────────────────────────
function handleBuildTree(input: string) {
  const start = performance.now();
  try {
    const data = JSON.parse(input);
    const nodes = buildTreeNodes(data, '$', '', 0);
    respond({ type: 'treeResult', payload: { nodes, time: performance.now() - start } });
  } catch (err) {
    respond({ type: 'error', payload: { message: `Tree build error: ${err}` } });
  }
}

let nodeIdCounter = 0;

function buildTreeNodes(
  value: unknown,
  path: string,
  key: string,
  depth: number,
): TreeNode[] {
  const id = `node-${nodeIdCounter++}`;
  const type = getValueType(value);
  const preview = getPreview(value, type);

  const node: TreeNode = { id, key, value, type, path, depth, preview };

  if (type === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    node.childCount = entries.length;
    node.children = entries.flatMap(([k, v]) =>
      buildTreeNodes(v, `${path}.${k}`, k, depth + 1)
    );
  } else if (type === 'array') {
    const arr = value as unknown[];
    node.childCount = arr.length;
    node.children = arr.flatMap((item, i) =>
      buildTreeNodes(item, `${path}[${i}]`, String(i), depth + 1)
    );
  }

  return [node];
}

function getValueType(value: unknown): JsonValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonValueType;
}

function getPreview(value: unknown, type: JsonValueType): string {
  switch (type) {
    case 'object': {
      const keys = Object.keys(value as object);
      if (keys.length === 0) return '{}';
      const preview = keys.slice(0, 3).join(', ');
      return `{ ${preview}${keys.length > 3 ? ', ...' : ''} }`;
    }
    case 'array': {
      const arr = value as unknown[];
      if (arr.length === 0) return '[]';
      return `[${arr.length} items]`;
    }
    case 'string': {
      const str = value as string;
      return str.length > 50 ? `"${str.substring(0, 50)}..."` : `"${str}"`;
    }
    case 'null':
      return 'null';
    default:
      return String(value);
  }
}

// ─── Search & Filter ──────────────────────────────────────────────────
function handleSearch(jsonStr: string, options: SearchOptions) {
  const start = performance.now();
  try {
    const data = JSON.parse(jsonStr);
    const matches: SearchMatch[] = [];
    searchRecursive(data, '$', options, matches, 10000);
    respond({ type: 'searchResult', payload: { matches, time: performance.now() - start } });
  } catch (err) {
    respond({ type: 'error', payload: { message: `Search error: ${err}` } });
  }
}

function searchRecursive(
  value: unknown,
  path: string,
  options: SearchOptions,
  matches: SearchMatch[],
  limit: number
): void {
  if (matches.length >= limit) return;
  const { mode, query, caseSensitive } = options;
  const q = caseSensitive ? query : query.toLowerCase();

  const type = getValueType(value);

  if (type === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (matches.length >= limit) return;
      const childPath = `${path}.${k}`;
      const kCmp = caseSensitive ? k : k.toLowerCase();
      const vType = getValueType(v);

      let matched = false;
      switch (mode) {
        case 'key':
          matched = kCmp.includes(q);
          break;
        case 'value':
          matched = String(v).toLowerCase().includes(q.toLowerCase());
          break;
        case 'regex':
          try { matched = new RegExp(query, caseSensitive ? '' : 'i').test(k) || new RegExp(query, caseSensitive ? '' : 'i').test(String(v)); } catch { /* invalid regex */ }
          break;
        case 'type':
          matched = vType === q;
          break;
        case 'path':
          matched = caseSensitive ? childPath.includes(query) : childPath.toLowerCase().includes(q);
          break;
      }
      if (matched) {
        matches.push({ path: childPath, key: k, value: v, type: vType });
      }
      searchRecursive(v, childPath, options, matches, limit);
    }
  } else if (type === 'array') {
    const arr = value as unknown[];
    for (let i = 0; i < arr.length; i++) {
      if (matches.length >= limit) return;
      const childPath = `${path}[${i}]`;
      const item = arr[i];
      const vType = getValueType(item);

      let matched = false;
      switch (mode) {
        case 'value':
          matched = String(item).toLowerCase().includes(q.toLowerCase());
          break;
        case 'regex':
          try { matched = new RegExp(query, caseSensitive ? '' : 'i').test(String(item)); } catch { /* invalid regex */ }
          break;
        case 'type':
          matched = vType === q;
          break;
        case 'path':
          matched = caseSensitive ? childPath.includes(query) : childPath.toLowerCase().includes(q);
          break;
      }
      if (matched && (vType !== 'object' && vType !== 'array')) {
        matches.push({ path: childPath, key: String(i), value: item, type: vType });
      }
      searchRecursive(item, childPath, options, matches, limit);
    }
  }
}

// ─── Profile ──────────────────────────────────────────────────────────
function handleProfile(jsonStr: string) {
  const start = performance.now();
  try {
    const data = JSON.parse(jsonStr);
    const parseTime = performance.now() - start;
    const metrics: ProfileMetrics = {
      totalNodes: 0,
      maxDepth: 0,
      maxBreadth: 0,
      estimatedMemory: new Blob([jsonStr]).size,
      parseTime,
      uniqueKeys: 0,
      typeDistribution: {},
      depthDistribution: {},
    };
    const keySet = new Set<string>();
    profileRecursive(data, 0, metrics, keySet);
    metrics.uniqueKeys = keySet.size;
    respond({ type: 'profileResult', payload: metrics });
  } catch (err) {
    respond({ type: 'error', payload: { message: `Profile error: ${err}` } });
  }
}

function profileRecursive(value: unknown, depth: number, metrics: ProfileMetrics, keySet: Set<string>): void {
  metrics.totalNodes++;
  if (depth > metrics.maxDepth) metrics.maxDepth = depth;

  const depthKey = String(depth);
  metrics.depthDistribution[depthKey] = (metrics.depthDistribution[depthKey] || 0) + 1;

  const type = getValueType(value);
  metrics.typeDistribution[type] = (metrics.typeDistribution[type] || 0) + 1;

  if (type === 'object' && value !== null) {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > metrics.maxBreadth) metrics.maxBreadth = keys.length;
    for (const k of keys) {
      keySet.add(k);
      profileRecursive((value as Record<string, unknown>)[k], depth + 1, metrics, keySet);
    }
  } else if (type === 'array') {
    const arr = value as unknown[];
    if (arr.length > metrics.maxBreadth) metrics.maxBreadth = arr.length;
    for (const item of arr) {
      profileRecursive(item, depth + 1, metrics, keySet);
    }
  }
}

// ─── Code Generation ──────────────────────────────────────────────────
function handleGenerateCode(jsonStr: string, options: CodeGenOptions) {
  const start = performance.now();
  try {
    const data = JSON.parse(jsonStr);
    let code = '';
    switch (options.language) {
      case 'typescript': code = genTypeScript(data, options.rootName); break;
      case 'java': code = genJava(data, options.rootName); break;
      case 'go': code = genGo(data, options.rootName); break;
      case 'python': code = genPython(data, options.rootName); break;
      case 'csharp': code = genCSharp(data, options.rootName); break;
    }
    const result: CodeGenResult = { code, language: options.language, time: performance.now() - start };
    respond({ type: 'codegenResult', payload: result });
  } catch (err) {
    respond({ type: 'error', payload: { message: `CodeGen error: ${err}` } });
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferTsType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    return `${inferTsType(value[0])}[]`;
  }
  if (typeof value === 'object') return 'Record<string, unknown>';
  return typeof value;
}

function genTypeScript(data: unknown, rootName: string): string {
  const interfaces: string[] = [];
  function gen(obj: unknown, name: string): string {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return inferTsType(obj);
    const lines: string[] = [`export interface ${capitalize(name)} {`];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        const childName = capitalize(k);
        gen(v, childName);
        lines.push(`  ${k}: ${childName};`);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        const childName = capitalize(k) + 'Item';
        gen(v[0], childName);
        lines.push(`  ${k}: ${childName}[];`);
      } else {
        lines.push(`  ${k}: ${inferTsType(v)};`);
      }
    }
    lines.push('}');
    interfaces.push(lines.join('\n'));
    return capitalize(name);
  }
  gen(data, rootName);
  return interfaces.join('\n\n');
}

function genJava(data: unknown, rootName: string): string {
  const classes: string[] = [];
  function javaType(v: unknown): string {
    if (v === null) return 'Object';
    if (typeof v === 'string') return 'String';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'double';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) return `List<${v.length > 0 ? javaType(v[0]) : 'Object'}>`;
    return 'Object';
  }
  function gen(obj: unknown, name: string) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    const lines: string[] = [`public class ${capitalize(name)} {`];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        gen(v, capitalize(k));
        lines.push(`    private ${capitalize(k)} ${k};`);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        gen(v[0], capitalize(k) + 'Item');
        lines.push(`    private List<${capitalize(k)}Item> ${k};`);
      } else {
        lines.push(`    private ${javaType(v)} ${k};`);
      }
    }
    lines.push('}');
    classes.push(lines.join('\n'));
  }
  gen(data, rootName);
  return `import java.util.List;\n\n${classes.join('\n\n')}`;
}

function genGo(data: unknown, rootName: string): string {
  const structs: string[] = [];
  function goType(v: unknown): string {
    if (v === null) return 'interface{}';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float64';
    if (typeof v === 'boolean') return 'bool';
    if (Array.isArray(v)) return `[]${v.length > 0 ? goType(v[0]) : 'interface{}'}`;
    return 'interface{}';
  }
  function gen(obj: unknown, name: string) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    const lines: string[] = [`type ${capitalize(name)} struct {`];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const goName = capitalize(k);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        gen(v, capitalize(k));
        lines.push(`\t${goName} ${capitalize(k)} \`json:"${k}"\``);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        gen(v[0], capitalize(k) + 'Item');
        lines.push(`\t${goName} []${capitalize(k)}Item \`json:"${k}"\``);
      } else {
        lines.push(`\t${goName} ${goType(v)} \`json:"${k}"\``);
      }
    }
    lines.push('}');
    structs.push(lines.join('\n'));
  }
  gen(data, rootName);
  return `package main\n\n${structs.join('\n\n')}`;
}

function genPython(data: unknown, rootName: string): string {
  const classes: string[] = [];
  function pyType(v: unknown): string {
    if (v === null) return 'None';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (typeof v === 'boolean') return 'bool';
    if (Array.isArray(v)) return `list[${v.length > 0 ? pyType(v[0]) : 'Any'}]`;
    return 'Any';
  }
  function gen(obj: unknown, name: string) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    const lines: string[] = ['@dataclass', `class ${capitalize(name)}:`];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        gen(v, capitalize(k));
        lines.push(`    ${k}: ${capitalize(k)}`);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        gen(v[0], capitalize(k) + 'Item');
        lines.push(`    ${k}: list[${capitalize(k)}Item]`);
      } else {
        lines.push(`    ${k}: ${pyType(v)}`);
      }
    }
    classes.push(lines.join('\n'));
  }
  gen(data, rootName);
  return `from dataclasses import dataclass\nfrom typing import Any\n\n${classes.join('\n\n')}`;
}

function genCSharp(data: unknown, rootName: string): string {
  const classes: string[] = [];
  function csType(v: unknown): string {
    if (v === null) return 'object';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'double';
    if (typeof v === 'boolean') return 'bool';
    if (Array.isArray(v)) return `List<${v.length > 0 ? csType(v[0]) : 'object'}>`;
    return 'object';
  }
  function gen(obj: unknown, name: string) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
    const lines: string[] = [`public class ${capitalize(name)}`, '{'];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        gen(v, capitalize(k));
        lines.push(`    public ${capitalize(k)} ${capitalize(k)} { get; set; }`);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        gen(v[0], capitalize(k) + 'Item');
        lines.push(`    public List<${capitalize(k)}Item> ${capitalize(k)} { get; set; }`);
      } else {
        lines.push(`    public ${csType(v)} ${capitalize(k)} { get; set; }`);
      }
    }
    lines.push('}');
    classes.push(lines.join('\n'));
  }
  gen(data, rootName);
  return `using System.Collections.Generic;\n\n${classes.join('\n\n')}`;
}

// ─── Query ────────────────────────────────────────────────────────────
function handleQuery(jsonStr: string, query: string, language: QueryLanguage) {
  const start = performance.now();
  try {
    const data = JSON.parse(jsonStr);
    let result: unknown;
    switch (language) {
      case 'jq': result = executeJq(data, query); break;
      case 'jsonata': result = executeJsonata(data, query); break;
      case 'mongodb': result = executeMongodb(data, query); break;
    }
    respond({
      type: 'queryResult',
      payload: { result: JSON.stringify(result, null, 2), time: performance.now() - start },
    });
  } catch (err) {
    respond({
      type: 'queryResult',
      payload: { result: '', time: performance.now() - start, error: String(err) },
    });
  }
}

function executeJq(data: unknown, query: string): unknown {
  // Simple jq-like implementation
  const parts = query.split('|').map(p => p.trim());
  let current: unknown = data;
  for (const part of parts) {
    if (part === '.') continue;
    if (part === 'keys' || part === 'keys[]') {
      if (typeof current === 'object' && current !== null) current = Object.keys(current as object);
    } else if (part === 'values' || part === 'values[]') {
      if (typeof current === 'object' && current !== null) current = Object.values(current as object);
    } else if (part === 'length') {
      if (Array.isArray(current)) current = current.length;
      else if (typeof current === 'object' && current !== null) current = Object.keys(current as object).length;
      else if (typeof current === 'string') current = current.length;
    } else if (part === 'flatten') {
      if (Array.isArray(current)) current = current.flat();
    } else if (part === 'sort') {
      if (Array.isArray(current)) current = [...current].sort();
    } else if (part === 'unique') {
      if (Array.isArray(current)) current = [...new Set(current.map(x => JSON.stringify(x)))].map(x => JSON.parse(x));
    } else if (part === 'reverse') {
      if (Array.isArray(current)) current = [...current].reverse();
    } else if (part === 'type') {
      current = Array.isArray(current) ? 'array' : current === null ? 'null' : typeof current;
    } else if (part.startsWith('.')) {
      const key = part.slice(1).replace(/\[\]$/, '');
      if (Array.isArray(current)) {
        current = current.map(item => typeof item === 'object' && item !== null ? (item as Record<string, unknown>)[key] : undefined).filter(v => v !== undefined);
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      }
    } else if (part.startsWith('map(') && part.endsWith(')')) {
      const innerExpr = part.slice(4, -1).trim();
      if (Array.isArray(current)) {
        current = current.map(item => executeJq(item, innerExpr));
      }
    } else if (part.startsWith('select(') && part.endsWith(')')) {
      const cond = part.slice(7, -1).trim();
      if (Array.isArray(current)) {
        current = current.filter(item => evalJqCondition(item, cond));
      }
    } else if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1).trim();
      if (/^\d+$/.test(inner) && Array.isArray(current)) {
        current = current[parseInt(inner)];
      } else if (inner.includes(':') && Array.isArray(current)) {
        const [s, e] = inner.split(':').map(n => n.trim() ? parseInt(n.trim()) : undefined);
        current = current.slice(s ?? 0, e);
      }
    } else if (part === 'first') {
      if (Array.isArray(current)) current = current[0];
    } else if (part === 'last') {
      if (Array.isArray(current)) current = current[current.length - 1];
    } else if (part === 'not') {
      current = !current;
    } else if (part === 'to_entries') {
      if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
        current = Object.entries(current as Record<string, unknown>).map(([key, value]) => ({ key, value }));
      }
    } else if (part === 'from_entries') {
      if (Array.isArray(current)) {
        const result: Record<string, unknown> = {};
        for (const item of current) {
          if (typeof item === 'object' && item !== null && 'key' in item && 'value' in item) {
            result[String((item as Record<string, unknown>).key)] = (item as Record<string, unknown>).value;
          }
        }
        current = result;
      }
    }
  }
  return current;
}

function evalJqCondition(item: unknown, cond: string): boolean {
  // Simple condition evaluation for jq select
  const match = cond.match(/^\.(\w+)\s*(==|!=|>|>=|<|<=)\s*(.+)$/);
  if (match && typeof item === 'object' && item !== null) {
    const [, key, op, rawVal] = match;
    const fieldVal = (item as Record<string, unknown>)[key];
    let cmpVal: unknown = rawVal.trim();
    if (cmpVal === 'null') cmpVal = null;
    else if (cmpVal === 'true') cmpVal = true;
    else if (cmpVal === 'false') cmpVal = false;
    else if (/^".*"$/.test(String(cmpVal))) cmpVal = String(cmpVal).slice(1, -1);
    else if (!isNaN(Number(cmpVal))) cmpVal = Number(cmpVal);
    switch (op) {
      case '==': return fieldVal === cmpVal || JSON.stringify(fieldVal) === JSON.stringify(cmpVal);
      case '!=': return fieldVal !== cmpVal;
      case '>': return Number(fieldVal) > Number(cmpVal);
      case '>=': return Number(fieldVal) >= Number(cmpVal);
      case '<': return Number(fieldVal) < Number(cmpVal);
      case '<=': return Number(fieldVal) <= Number(cmpVal);
    }
  }
  // Simple truthy check for `.fieldName`
  if (cond.startsWith('.') && typeof item === 'object' && item !== null) {
    const key = cond.slice(1);
    return !!(item as Record<string, unknown>)[key];
  }
  return true;
}

function executeJsonata(data: unknown, query: string): unknown {
  // Simplified JSONata-like implementation
  const trimmed = query.trim();
  
  // Handle $count
  if (trimmed === '$count($)' || trimmed === 'count($)') {
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object' && data !== null) return Object.keys(data).length;
    return 1;
  }
  // Handle $sum
  const sumMatch = trimmed.match(/^\$sum\((\S+)\)$/);
  if (sumMatch) {
    const path = sumMatch[1];
    const values = resolveJsonataPath(data, path);
    if (Array.isArray(values)) return values.reduce((s: number, v: unknown) => s + Number(v), 0);
    return Number(values);
  }
  // Handle $distinct
  const distinctMatch = trimmed.match(/^\$distinct\((\S+)\)$/);
  if (distinctMatch) {
    const values = resolveJsonataPath(data, distinctMatch[1]);
    if (Array.isArray(values)) return [...new Set(values.map(v => JSON.stringify(v)))].map(v => JSON.parse(v));
    return values;
  }
  // Handle simple path navigation
  return resolveJsonataPath(data, trimmed);
}

function resolveJsonataPath(data: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    // Handle array wildcard
    if (part === '*') {
      if (Array.isArray(current)) return current;
      if (typeof current === 'object' && current !== null) return Object.values(current as object);
      return current;
    }
    // Handle filter [condition]
    const filterMatch = part.match(/^(\w+)\[(.+)\]$/);
    if (filterMatch) {
      const [, key, filter] = filterMatch;
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      }
      if (Array.isArray(current)) {
        const condMatch = filter.match(/^(\w+)\s*(=|!=|>|<)\s*(.+)$/);
        if (condMatch) {
          const [, fKey, fOp, fVal] = condMatch;
          let compareVal: unknown = fVal.trim();
          if (/^['"].*['"]$/.test(String(compareVal))) compareVal = String(compareVal).slice(1, -1);
          else if (!isNaN(Number(compareVal))) compareVal = Number(compareVal);
          current = current.filter((item: unknown) => {
            if (typeof item !== 'object' || item === null) return false;
            const v = (item as Record<string, unknown>)[fKey];
            if (fOp === '=') return v === compareVal || String(v) === String(compareVal);
            if (fOp === '!=') return v !== compareVal;
            if (fOp === '>') return Number(v) > Number(compareVal);
            if (fOp === '<') return Number(v) < Number(compareVal);
            return false;
          });
        }
      }
      continue;
    }
    if (Array.isArray(current)) {
      current = current.map(item => typeof item === 'object' && item !== null ? (item as Record<string, unknown>)[part] : undefined).filter(v => v !== undefined);
    } else if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function executeMongodb(data: unknown, queryStr: string): unknown {
  // MongoDB-like find with query filter
  try {
    const query = JSON.parse(queryStr);
    if (!Array.isArray(data)) {
      if (typeof data === 'object' && data !== null) {
        // Try to find an array in top-level keys
        const arrays = Object.values(data as Record<string, unknown>).filter(Array.isArray);
        if (arrays.length > 0) data = arrays[0];
        else return matchesMongo(data, query) ? data : null;
      } else {
        return data;
      }
    }
    return (data as unknown[]).filter(item => matchesMongo(item, query));
  } catch (err) {
    throw new Error(`Invalid MongoDB query: ${err}`);
  }
}

function matchesMongo(item: unknown, query: Record<string, unknown>): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  
  for (const [key, condition] of Object.entries(query)) {
    if (key === '$and') {
      if (!Array.isArray(condition)) return false;
      return condition.every(c => matchesMongo(item, c as Record<string, unknown>));
    }
    if (key === '$or') {
      if (!Array.isArray(condition)) return false;
      return condition.some(c => matchesMongo(item, c as Record<string, unknown>));
    }
    if (key === '$not') {
      return !matchesMongo(item, condition as Record<string, unknown>);
    }
    
    const fieldVal = obj[key];
    if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
      const ops = condition as Record<string, unknown>;
      for (const [op, opVal] of Object.entries(ops)) {
        switch (op) {
          case '$eq': if (fieldVal !== opVal) return false; break;
          case '$ne': if (fieldVal === opVal) return false; break;
          case '$gt': if (Number(fieldVal) <= Number(opVal)) return false; break;
          case '$gte': if (Number(fieldVal) < Number(opVal)) return false; break;
          case '$lt': if (Number(fieldVal) >= Number(opVal)) return false; break;
          case '$lte': if (Number(fieldVal) > Number(opVal)) return false; break;
          case '$in': if (!Array.isArray(opVal) || !opVal.includes(fieldVal)) return false; break;
          case '$nin': if (Array.isArray(opVal) && opVal.includes(fieldVal)) return false; break;
          case '$exists': if ((opVal && fieldVal === undefined) || (!opVal && fieldVal !== undefined)) return false; break;
          case '$regex': {
            const re = new RegExp(String(opVal));
            if (!re.test(String(fieldVal))) return false;
            break;
          }
        }
      }
    } else {
      // Direct equality
      if (fieldVal !== condition && JSON.stringify(fieldVal) !== JSON.stringify(condition)) return false;
    }
  }
  return true;
}

// ─── RFC 6902 Diff Patch ──────────────────────────────────────────────
function handleDiffPatch(leftStr: string, rightStr: string) {
  const start = performance.now();
  try {
    const left = JSON.parse(leftStr);
    const right = JSON.parse(rightStr);
    const patch: DiffPatchOp[] = [];
    generatePatch(left, right, '', patch);
    respond({ type: 'diffPatchResult', payload: { patch, time: performance.now() - start } });
  } catch (err) {
    respond({ type: 'error', payload: { message: `DiffPatch error: ${err}` } });
  }
}

function generatePatch(left: unknown, right: unknown, path: string, ops: DiffPatchOp[]): void {
  if (left === right) return;
  if (left === undefined && right !== undefined) {
    ops.push({ op: 'add', path: path || '/', value: right });
    return;
  }
  if (right === undefined && left !== undefined) {
    ops.push({ op: 'remove', path: path || '/' });
    return;
  }

  const leftType = typeof left;
  const rightType = typeof right;

  if (leftType !== rightType || Array.isArray(left) !== Array.isArray(right) || left === null !== (right === null)) {
    ops.push({ op: 'replace', path: path || '/', value: right });
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    // For arrays, generate replace/add/remove ops
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= left.length) {
        ops.push({ op: 'add', path: `${path}/${i}`, value: right[i] });
      } else if (i >= right.length) {
        // Remove from end first to maintain indices
        ops.push({ op: 'remove', path: `${path}/${i}` });
      } else {
        generatePatch(left[i], right[i], `${path}/${i}`, ops);
      }
    }
    return;
  }

  if (leftType === 'object' && left !== null && right !== null) {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftObj);
    const rightKeys = Object.keys(rightObj);

    for (const key of rightKeys) {
      const escapedKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
      if (!(key in leftObj)) {
        ops.push({ op: 'add', path: `${path}/${escapedKey}`, value: rightObj[key] });
      } else {
        generatePatch(leftObj[key], rightObj[key], `${path}/${escapedKey}`, ops);
      }
    }
    for (const key of leftKeys) {
      if (!(key in rightObj)) {
        const escapedKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
        ops.push({ op: 'remove', path: `${path}/${escapedKey}` });
      }
    }
    return;
  }

  // Primitive values differ
  ops.push({ op: 'replace', path: path || '/', value: right });
}

// ─── Log Analyzer ─────────────────────────────────────────────────────
function handleAnalyzeLogs(jsonStr: string) {
  const start = performance.now();
  try {
    const data = JSON.parse(jsonStr);
    let entries: LogEntry[] = [];
    const rawEntries: Record<string, unknown>[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'object' && item !== null) rawEntries.push(item as Record<string, unknown>);
      }
    } else if (typeof data === 'object' && data !== null) {
      // Find the first array in top-level keys
      for (const v of Object.values(data as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          for (const item of v) {
            if (typeof item === 'object' && item !== null) rawEntries.push(item as Record<string, unknown>);
          }
          break;
        }
      }
      if (rawEntries.length === 0) rawEntries.push(data as Record<string, unknown>);
    }

    entries = rawEntries.map((raw, index) => ({
      index,
      level: detectLevel(raw),
      timestamp: detectTimestamp(raw),
      message: detectMessage(raw),
      raw,
    }));

    const stats = computeLogStats(entries, rawEntries);
    respond({ type: 'analyzeLogsResult', payload: { entries, stats, time: performance.now() - start } });
  } catch (err) {
    respond({ type: 'error', payload: { message: `Log analysis error: ${err}` } });
  }
}

function detectLevel(entry: Record<string, unknown>): LogLevel {
  const levelKeys = ['level', 'severity', 'log_level', 'logLevel', 'type', 'priority'];
  for (const key of levelKeys) {
    if (key in entry) {
      const val = String(entry[key]).toLowerCase();
      if (val.includes('error') || val.includes('fatal') || val.includes('critical')) return 'error';
      if (val.includes('warn')) return 'warn';
      if (val.includes('info')) return 'info';
      if (val.includes('debug')) return 'debug';
      if (val.includes('trace') || val.includes('verbose')) return 'trace';
    }
  }
  // Check message content as fallback
  const msg = String(entry.message || entry.msg || entry.text || '').toLowerCase();
  if (msg.includes('error') || msg.includes('exception') || msg.includes('fatal')) return 'error';
  if (msg.includes('warn')) return 'warn';
  return 'unknown';
}

function detectTimestamp(entry: Record<string, unknown>): string | undefined {
  const tsKeys = ['timestamp', 'time', 'date', 'datetime', 'ts', '@timestamp', 'created_at', 'createdAt'];
  for (const key of tsKeys) {
    if (key in entry) return String(entry[key]);
  }
  return undefined;
}

function detectMessage(entry: Record<string, unknown>): string {
  const msgKeys = ['message', 'msg', 'text', 'description', 'body', 'log'];
  for (const key of msgKeys) {
    if (key in entry) return String(entry[key]);
  }
  return JSON.stringify(entry);
}

function computeLogStats(entries: LogEntry[], rawEntries: Record<string, unknown>[]): LogStats {
  const byLevel: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0, trace: 0, unknown: 0 };
  const timestamps: string[] = [];

  for (const e of entries) {
    byLevel[e.level] = (byLevel[e.level] || 0) + 1;
    if (e.timestamp) timestamps.push(e.timestamp);
  }

  // Compute top fields
  const fieldCounts = new Map<string, number>();
  for (const raw of rawEntries) {
    for (const key of Object.keys(raw)) {
      fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
    }
  }
  const topFields = [...fieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([field, count]) => ({ field, count }));

  const stats: LogStats = {
    total: entries.length,
    byLevel,
    topFields,
  };

  if (timestamps.length > 0) {
    timestamps.sort();
    stats.timeRange = { start: timestamps[0], end: timestamps[timestamps.length - 1] };
  }

  return stats;
}

// ─── Flatten ──────────────────────────────────────────────────────────
function handleFlatten(input: string, options: FlattenOptions) {
  const start = performance.now();
  const data = JSON.parse(input);
  const result: Record<string, unknown> = {};
  const delim = options.delimiter || '.';

  function recurse(obj: unknown, prefix: string, depth: number) {
    if (options.maxDepth !== undefined && depth >= options.maxDepth) {
      result[prefix] = obj;
      return;
    }
    if (obj !== null && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        if (options.safe) {
          result[prefix] = obj;
        } else {
          obj.forEach((item, i) => recurse(item, prefix ? `${prefix}${delim}${i}` : `${i}`, depth + 1));
        }
      } else {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          recurse(v, prefix ? `${prefix}${delim}${k}` : k, depth + 1);
        }
      }
    } else {
      result[prefix] = obj;
    }
  }

  recurse(data, '', 0);
  respond({ type: 'flattenResult', payload: { result: JSON.stringify(result, null, 2), time: performance.now() - start } });
}

function handleUnflatten(input: string, delimiter: string) {
  const start = performance.now();
  const flat = JSON.parse(input) as Record<string, unknown>;
  const delim = delimiter || '.';
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(delim);
    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];
      const isNextIdx = /^\d+$/.test(nextPart);
      if (!(part in current)) {
        current[part] = isNextIdx ? [] : {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  respond({ type: 'unflattenResult', payload: { result: JSON.stringify(result, null, 2), time: performance.now() - start } });
}

// ─── DB Schema ────────────────────────────────────────────────────────
function handleGenerateDbSchema(input: string, dialect: DbSchemaDialect, tableName: string) {
  const start = performance.now();
  const data = JSON.parse(input);
  const tblName = tableName || 'my_table';

  if (dialect === 'mongodb') {
    const schema = generateMongoSchema(data, tblName);
    respond({ type: 'dbSchemaResult', payload: { sql: schema, dialect, tables: 1, indexes: [], time: performance.now() - start } });
    return;
  }

  const lines: string[] = [];
  const indexes: string[] = [];
  const tables: string[] = [];

  function inferSqlType(val: unknown, d: DbSchemaDialect): string {
    if (val === null) return 'TEXT';
    switch (typeof val) {
      case 'string': {
        const s = val as string;
        if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(s)) return d === 'postgresql' ? 'TIMESTAMPTZ' : 'DATETIME';
        if (s.length > 255) return 'TEXT';
        return d === 'postgresql' ? 'VARCHAR(255)' : 'VARCHAR(255)';
      }
      case 'number': return Number.isInteger(val) ? (d === 'sqlite' ? 'INTEGER' : 'BIGINT') : (d === 'postgresql' ? 'DOUBLE PRECISION' : 'DOUBLE');
      case 'boolean': return d === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
      default: return 'TEXT';
    }
  }

  function processObject(obj: Record<string, unknown>, name: string) {
    const cols: string[] = [];
    cols.push(`  id ${dialect === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : dialect === 'postgresql' ? 'SERIAL PRIMARY KEY' : 'INT AUTO_INCREMENT PRIMARY KEY'}`);

    for (const [key, val] of Object.entries(obj)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        const childTable = `${name}_${key}`;
        processObject(val as Record<string, unknown>, childTable);
        cols.push(`  ${key}_id ${dialect === 'sqlite' ? 'INTEGER' : 'INT'} REFERENCES ${childTable}(id)`);
        indexes.push(`CREATE INDEX idx_${name}_${key}_id ON ${name}(${key}_id);`);
      } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
        const childTable = `${name}_${key}`;
        processObject(val[0] as Record<string, unknown>, childTable);
        // Add foreign key from child to parent
      } else {
        cols.push(`  ${key} ${inferSqlType(val, dialect)}`);
      }
    }
    tables.push(name);
    lines.push(`CREATE TABLE ${name} (\n${cols.join(',\n')}\n);\n`);
  }

  const sample = Array.isArray(data) ? (data[0] ?? {}) : data;
  if (typeof sample === 'object' && sample !== null) {
    processObject(sample as Record<string, unknown>, tblName);
  }

  const sql = lines.join('\n') + (indexes.length > 0 ? '\n' + indexes.join('\n') : '');
  respond({ type: 'dbSchemaResult', payload: { sql, dialect, tables: tables.length, indexes, time: performance.now() - start } });
}

function generateMongoSchema(data: unknown, collection: string): string {
  const sample = Array.isArray(data) ? data[0] : data;
  const lines: string[] = [];
  lines.push(`// MongoDB collection: ${collection}`);
  lines.push(`db.createCollection("${collection}", {`);
  lines.push(`  validator: {`);
  lines.push(`    $jsonSchema: ${JSON.stringify(inferJsonSchema(sample), null, 6).split('\n').map((l, i) => i === 0 ? l : '      ' + l).join('\n')}`);
  lines.push(`  }`);
  lines.push(`});`);
  lines.push('');
  lines.push(`// Suggested indexes:`);
  if (typeof sample === 'object' && sample !== null) {
    for (const key of Object.keys(sample as Record<string, unknown>)) {
      if (key === 'id' || key === '_id' || key.endsWith('Id') || key.endsWith('_id')) {
        lines.push(`db.${collection}.createIndex({ "${key}": 1 });`);
      }
    }
  }
  return lines.join('\n');
}

function inferJsonSchema(val: unknown): Record<string, unknown> {
  if (val === null) return { bsonType: 'null' };
  if (Array.isArray(val)) {
    return { bsonType: 'array', items: val.length > 0 ? inferJsonSchema(val[0]) : {} };
  }
  switch (typeof val) {
    case 'string': return { bsonType: 'string' };
    case 'number': return Number.isInteger(val) ? { bsonType: 'int' } : { bsonType: 'double' };
    case 'boolean': return { bsonType: 'bool' };
    case 'object': {
      const props: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        props[k] = inferJsonSchema(v);
        if (v !== null && v !== undefined) required.push(k);
      }
      return { bsonType: 'object', required, properties: props };
    }
    default: return {};
  }
}

// ─── Contract Testing ─────────────────────────────────────────────────
function handleGenerateContract(input: string, _schemaStr: string | undefined, framework: ContractTestFramework) {
  const start = performance.now();
  const data = JSON.parse(input);
  const assertions: ContractAssertion[] = [];

  function buildAssertions(obj: unknown, path: string) {
    if (obj === null) {
      assertions.push({ path, type: 'null', required: true });
      return;
    }
    if (Array.isArray(obj)) {
      assertions.push({ path, type: 'array', required: true });
      if (obj.length > 0) buildAssertions(obj[0], `${path}[0]`);
      return;
    }
    if (typeof obj === 'object') {
      assertions.push({ path, type: 'object', required: true });
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        buildAssertions(v, path ? `${path}.${k}` : k);
      }
      return;
    }
    assertions.push({ path, type: typeof obj, required: true, value: obj });
  }

  buildAssertions(data, '');

  let code = '';
  if (framework === 'jest') {
    code = generateJestTests(assertions);
  } else if (framework === 'mocha') {
    code = generateMochaTests(assertions);
  } else {
    code = generateJunitTests(assertions);
  }

  respond({ type: 'contractResult', payload: { assertions, code, framework, time: performance.now() - start } });
}

function generateJestTests(assertions: ContractAssertion[]): string {
  const lines: string[] = [];
  lines.push(`describe('JSON Contract Tests', () => {`);
  lines.push(`  const response = /* your response data */;`);
  lines.push('');
  for (const a of assertions) {
    const accessor = a.path ? `response.${a.path.replace(/\[(\d+)\]/g, '[$1]')}` : 'response';
    if (a.type === 'object') {
      lines.push(`  test('${a.path || 'root'} should be an object', () => {`);
      lines.push(`    expect(typeof ${accessor}).toBe('object');`);
      lines.push(`    expect(${accessor}).not.toBeNull();`);
      lines.push(`  });`);
    } else if (a.type === 'array') {
      lines.push(`  test('${a.path} should be an array', () => {`);
      lines.push(`    expect(Array.isArray(${accessor})).toBe(true);`);
      lines.push(`  });`);
    } else if (a.type === 'null') {
      lines.push(`  test('${a.path} should be null', () => {`);
      lines.push(`    expect(${accessor}).toBeNull();`);
      lines.push(`  });`);
    } else {
      lines.push(`  test('${a.path} should be ${a.type}', () => {`);
      lines.push(`    expect(typeof ${accessor}).toBe('${a.type}');`);
      if (a.required) lines.push(`    expect(${accessor}).toBeDefined();`);
      lines.push(`  });`);
    }
    lines.push('');
  }
  lines.push(`});`);
  return lines.join('\n');
}

function generateMochaTests(assertions: ContractAssertion[]): string {
  const lines: string[] = [];
  lines.push(`const { expect } = require('chai');`);
  lines.push('');
  lines.push(`describe('JSON Contract Tests', function() {`);
  lines.push(`  const response = /* your response data */;`);
  lines.push('');
  for (const a of assertions) {
    const accessor = a.path ? `response.${a.path}` : 'response';
    if (a.type === 'object') {
      lines.push(`  it('${a.path || 'root'} should be an object', function() {`);
      lines.push(`    expect(${accessor}).to.be.an('object');`);
      lines.push(`  });`);
    } else if (a.type === 'array') {
      lines.push(`  it('${a.path} should be an array', function() {`);
      lines.push(`    expect(${accessor}).to.be.an('array');`);
      lines.push(`  });`);
    } else {
      lines.push(`  it('${a.path} should be ${a.type}', function() {`);
      lines.push(`    expect(${accessor}).to.be.a('${a.type}');`);
      lines.push(`  });`);
    }
    lines.push('');
  }
  lines.push(`});`);
  return lines.join('\n');
}

function generateJunitTests(assertions: ContractAssertion[]): string {
  const lines: string[] = [];
  lines.push(`import org.junit.Test;`);
  lines.push(`import static org.junit.Assert.*;`);
  lines.push(`import com.google.gson.JsonParser;`);
  lines.push(`import com.google.gson.JsonObject;`);
  lines.push('');
  lines.push(`public class JsonContractTest {`);
  lines.push(`    private static final String JSON = "/* your response */";`);
  lines.push(`    private static final JsonObject root = JsonParser.parseString(JSON).getAsJsonObject();`);
  lines.push('');
  for (const a of assertions) {
    const methodName = `test_${(a.path || 'root').replace(/[.\[\]]/g, '_')}`;
    lines.push(`    @Test`);
    lines.push(`    public void ${methodName}() {`);
    if (a.type === 'object') {
      lines.push(`        assertTrue(root.get("${a.path}").isJsonObject());`);
    } else if (a.type === 'array') {
      lines.push(`        assertTrue(root.get("${a.path}").isJsonArray());`);
    } else if (a.type === 'string') {
      lines.push(`        assertTrue(root.get("${a.path}").isJsonPrimitive());`);
    } else {
      lines.push(`        assertNotNull(root.get("${a.path}"));`);
    }
    lines.push(`    }`);
    lines.push('');
  }
  lines.push(`}`);
  return lines.join('\n');
}

// ─── OpenAPI ──────────────────────────────────────────────────────────
function handleGenerateOpenApi(input: string, title: string, basePath: string) {
  const start = performance.now();
  const data = JSON.parse(input);
  const sample = Array.isArray(data) ? data[0] : data;
  const path = basePath || '/api/resource';
  const schemaName = title.replace(/\s+/g, '') || 'Resource';

  function toOpenApiSchema(val: unknown): Record<string, unknown> {
    if (val === null) return { type: 'string', nullable: true };
    if (Array.isArray(val)) {
      return { type: 'array', items: val.length > 0 ? toOpenApiSchema(val[0]) : {} };
    }
    switch (typeof val) {
      case 'string': {
        const s = val as string;
        if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(s)) return { type: 'string', format: 'date-time' };
        if (/^[^@]+@[^@]+\.[^@]+$/.test(s)) return { type: 'string', format: 'email' };
        if (/^https?:\/\//.test(s)) return { type: 'string', format: 'uri' };
        return { type: 'string' };
      }
      case 'number': return Number.isInteger(val) ? { type: 'integer' } : { type: 'number' };
      case 'boolean': return { type: 'boolean' };
      case 'object': {
        const props: Record<string, unknown> = {};
        const required: string[] = [];
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          props[k] = toOpenApiSchema(v);
          if (v !== null && v !== undefined) required.push(k);
        }
        return { type: 'object', properties: props, required };
      }
      default: return { type: 'string' };
    }
  }

  const schema = toOpenApiSchema(sample);
  const spec = {
    openapi: '3.0.3',
    info: { title: title || 'API', version: '1.0.0', description: `Auto-generated from JSON sample` },
    paths: {
      [path]: {
        get: {
          summary: `List ${schemaName}`,
          responses: {
            '200': {
              description: 'Successful response',
              content: { 'application/json': { schema: Array.isArray(data) ? { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } } : { $ref: `#/components/schemas/${schemaName}` } } },
            }
          }
        },
        post: {
          summary: `Create ${schemaName}`,
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
          responses: { '201': { description: 'Created' } }
        }
      },
      [`${path}/{id}`]: {
        get: {
          summary: `Get ${schemaName} by ID`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } } }
        },
        put: {
          summary: `Update ${schemaName}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
          responses: { '200': { description: 'Updated' } }
        },
        delete: {
          summary: `Delete ${schemaName}`,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '204': { description: 'Deleted' } }
        }
      }
    },
    components: { schemas: { [schemaName]: schema } }
  };

  respond({ type: 'openApiResult', payload: { spec: JSON.stringify(spec, null, 2), time: performance.now() - start } });
}

// ─── GraphQL ──────────────────────────────────────────────────────────
function handleGenerateGraphql(input: string, mode: GraphqlOutputMode, rootName: string) {
  const start = performance.now();
  const data = JSON.parse(input);
  const sample = Array.isArray(data) ? data[0] : data;
  const name = rootName || 'Root';

  if (mode === 'schema') {
    const types: string[] = [];
    generateGraphqlTypes(sample, name, types);
    types.push('');
    types.push(`type Query {`);
    types.push(`  ${name.toLowerCase()}: ${name}`);
    types.push(`  ${name.toLowerCase()}s: [${name}!]!`);
    types.push(`}`);
    respond({ type: 'graphqlResult', payload: { output: types.join('\n'), time: performance.now() - start } });
  } else {
    const query = generateGraphqlQuery(sample, name, 0);
    respond({ type: 'graphqlResult', payload: { output: query, time: performance.now() - start } });
  }
}

function generateGraphqlTypes(val: unknown, name: string, types: string[]): string {
  if (val === null) return 'String';
  if (Array.isArray(val)) {
    const itemType = val.length > 0 ? generateGraphqlTypes(val[0], name + 'Item', types) : 'String';
    return `[${itemType}]`;
  }
  switch (typeof val) {
    case 'string': return 'String';
    case 'number': return Number.isInteger(val) ? 'Int' : 'Float';
    case 'boolean': return 'Boolean';
    case 'object': {
      const fields: string[] = [];
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        const childName = name + k.charAt(0).toUpperCase() + k.slice(1);
        const fieldType = generateGraphqlTypes(v, childName, types);
        fields.push(`  ${k}: ${fieldType}`);
      }
      types.push(`type ${name} {`);
      types.push(fields.join('\n'));
      types.push(`}`);
      types.push('');
      return name;
    }
    default: return 'String';
  }
}

function generateGraphqlQuery(val: unknown, _name: string, depth: number): string {
  if (val === null || typeof val !== 'object') return '';
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  if (depth === 0) lines.push(`query {`);
  if (typeof val === 'object' && !Array.isArray(val)) {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        lines.push(`${indent}  ${k} {`);
        const inner = generateGraphqlQuery(v, k, depth + 2);
        if (inner) lines.push(inner);
        lines.push(`${indent}  }`);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        lines.push(`${indent}  ${k} {`);
        const inner = generateGraphqlQuery(v[0], k, depth + 2);
        if (inner) lines.push(inner);
        lines.push(`${indent}  }`);
      } else {
        lines.push(`${indent}  ${k}`);
      }
    }
  }
  if (depth === 0) lines.push(`}`);
  return lines.join('\n');
}

// ─── Workflow ─────────────────────────────────────────────────────────
function handleRunWorkflow(input: string, steps: WorkflowStep[]) {
  const start = performance.now();
  let current = JSON.parse(input);
  const stepResults: WorkflowResult['stepResults'] = [];

  for (const step of steps) {
    if (!step.enabled) continue;
    const stepStart = performance.now();
    try {
      current = executeWorkflowStep(current, step);
      stepResults.push({
        stepId: step.id,
        output: JSON.stringify(current, null, 2),
        time: performance.now() - stepStart,
      });
    } catch (err) {
      stepResults.push({
        stepId: step.id,
        output: JSON.stringify(current, null, 2),
        error: String(err),
        time: performance.now() - stepStart,
      });
      break;
    }
  }

  respond({
    type: 'workflowResult',
    payload: {
      stepResults,
      finalOutput: JSON.stringify(current, null, 2),
      totalTime: performance.now() - start,
    },
  });
}

function executeWorkflowStep(data: unknown, step: WorkflowStep): unknown {
  switch (step.type) {
    case 'map': {
      if (!Array.isArray(data)) throw new Error('map requires an array');
      const expr = step.config.trim();
      return (data as unknown[]).map((item) => {
        if (expr.startsWith('{') && expr.endsWith('}')) {
          // Simple field selection: { field1, field2 }
          const fields = expr.slice(1, -1).split(',').map(f => f.trim());
          const result: Record<string, unknown> = {};
          for (const f of fields) {
            const [from, to] = f.includes(':') ? f.split(':').map(s => s.trim()) : [f, f];
            result[to] = getNestedValue(item, from);
          }
          return result;
        }
        return item;
      });
    }
    case 'filter': {
      if (!Array.isArray(data)) throw new Error('filter requires an array');
      const [field, op, val] = parseFilterExpression(step.config);
      return (data as Record<string, unknown>[]).filter(item => {
        const itemVal = getNestedValue(item, field);
        switch (op) {
          case '==': return String(itemVal) === val;
          case '!=': return String(itemVal) !== val;
          case '>': return Number(itemVal) > Number(val);
          case '<': return Number(itemVal) < Number(val);
          case '>=': return Number(itemVal) >= Number(val);
          case '<=': return Number(itemVal) <= Number(val);
          case 'contains': return String(itemVal).includes(val);
          default: return true;
        }
      });
    }
    case 'sort': {
      if (!Array.isArray(data)) throw new Error('sort requires an array');
      const parts = step.config.trim().split(/\s+/);
      const field = parts[0];
      const desc = parts[1]?.toLowerCase() === 'desc';
      return [...(data as Record<string, unknown>[])].sort((a, b) => {
        const va = getNestedValue(a, field);
        const vb = getNestedValue(b, field);
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return desc ? -cmp : cmp;
      });
    }
    case 'pick': {
      const fields = step.config.split(',').map(f => f.trim());
      if (Array.isArray(data)) {
        return (data as Record<string, unknown>[]).map(item => {
          const r: Record<string, unknown> = {};
          for (const f of fields) r[f] = getNestedValue(item, f);
          return r;
        });
      }
      const r: Record<string, unknown> = {};
      for (const f of fields) r[f] = getNestedValue(data, f);
      return r;
    }
    case 'omit': {
      const fields = new Set(step.config.split(',').map(f => f.trim()));
      if (Array.isArray(data)) {
        return (data as Record<string, unknown>[]).map(item => {
          const r: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(item)) if (!fields.has(k)) r[k] = v;
          return r;
        });
      }
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) if (!fields.has(k)) r[k] = v;
      return r;
    }
    case 'rename': {
      const mappings = step.config.split(',').map(s => s.trim().split(':').map(x => x.trim()));
      const renameMap = new Map(mappings.map(([from, to]) => [from, to]));
      if (Array.isArray(data)) {
        return (data as Record<string, unknown>[]).map(item => {
          const r: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(item)) r[renameMap.get(k) || k] = v;
          return r;
        });
      }
      const r: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) r[renameMap.get(k) || k] = v;
      return r;
    }
    case 'custom': {
      // Evaluate expression using Function constructor (sandboxed in worker)
      const fn = new Function('data', `"use strict"; return (${step.config})(data);`);
      return fn(data);
    }
    case 'jq':
    default: {
      // Simple jq-like path access
      const path = step.config.trim();
      if (path.startsWith('.')) {
        return getNestedValue(data, path.slice(1));
      }
      return data;
    }
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current === null || current === undefined) return undefined;
    const arrMatch = p.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      current = (current as Record<string, unknown>)[arrMatch[1]];
      if (Array.isArray(current)) current = current[Number(arrMatch[2])];
    } else {
      current = (current as Record<string, unknown>)[p];
    }
  }
  return current;
}

function parseFilterExpression(expr: string): [string, string, string] {
  const ops = ['>=', '<=', '!=', '==', '>', '<', 'contains'];
  for (const op of ops) {
    const idx = expr.indexOf(op);
    if (idx !== -1) {
      return [expr.slice(0, idx).trim(), op, expr.slice(idx + op.length).trim().replace(/^["']|["']$/g, '')];
    }
  }
  return [expr, '==', 'true'];
}

// ─── Patch Studio ─────────────────────────────────────────────────────
function handleApplyPatch(input: string, patch: PatchOperation[]) {
  const start = performance.now();
  let data = JSON.parse(input);

  for (const op of patch) {
    data = applyPatchOp(data, op);
  }

  respond({ type: 'patchResult', payload: { result: JSON.stringify(data, null, 2), time: performance.now() - start } });
}

function applyPatchOp(data: unknown, op: PatchOperation): unknown {
  const pathParts = op.path.split('/').filter(Boolean);

  function navigateTo(obj: unknown, parts: string[]): { parent: unknown; key: string } {
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (Array.isArray(current)) current = current[Number(p)];
      else current = (current as Record<string, unknown>)[p];
    }
    return { parent: current, key: parts[parts.length - 1] };
  }

  switch (op.op) {
    case 'add': {
      if (pathParts.length === 0) return op.value;
      const { parent, key } = navigateTo(data, pathParts);
      if (Array.isArray(parent)) {
        if (key === '-') parent.push(op.value);
        else parent.splice(Number(key), 0, op.value);
      } else {
        (parent as Record<string, unknown>)[key] = op.value;
      }
      return data;
    }
    case 'remove': {
      const { parent, key } = navigateTo(data, pathParts);
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete (parent as Record<string, unknown>)[key];
      return data;
    }
    case 'replace': {
      const { parent, key } = navigateTo(data, pathParts);
      if (Array.isArray(parent)) parent[Number(key)] = op.value;
      else (parent as Record<string, unknown>)[key] = op.value;
      return data;
    }
    case 'move': {
      if (!op.from) return data;
      const fromParts = op.from.split('/').filter(Boolean);
      const { parent: fromParent, key: fromKey } = navigateTo(data, fromParts);
      const val = Array.isArray(fromParent) ? fromParent[Number(fromKey)] : (fromParent as Record<string, unknown>)[fromKey];
      // Remove from source
      if (Array.isArray(fromParent)) fromParent.splice(Number(fromKey), 1);
      else delete (fromParent as Record<string, unknown>)[fromKey];
      // Add to target
      const { parent: toParent, key: toKey } = navigateTo(data, pathParts);
      if (Array.isArray(toParent)) toParent.splice(Number(toKey), 0, val);
      else (toParent as Record<string, unknown>)[toKey] = val;
      return data;
    }
    case 'copy': {
      if (!op.from) return data;
      const fromParts = op.from.split('/').filter(Boolean);
      const { parent: fromParent, key: fromKey } = navigateTo(data, fromParts);
      const val = Array.isArray(fromParent) ? fromParent[Number(fromKey)] : (fromParent as Record<string, unknown>)[fromKey];
      const { parent: toParent, key: toKey } = navigateTo(data, pathParts);
      if (Array.isArray(toParent)) toParent.splice(Number(toKey), 0, JSON.parse(JSON.stringify(val)));
      else (toParent as Record<string, unknown>)[toKey] = JSON.parse(JSON.stringify(val));
      return data;
    }
    case 'test': {
      const { parent, key } = navigateTo(data, pathParts);
      const actual = Array.isArray(parent) ? parent[Number(key)] : (parent as Record<string, unknown>)[key];
      if (JSON.stringify(actual) !== JSON.stringify(op.value)) {
        throw new Error(`Test failed at ${op.path}: expected ${JSON.stringify(op.value)}, got ${JSON.stringify(actual)}`);
      }
      return data;
    }
    default: return data;
  }
}

// ─── Path Explorer ────────────────────────────────────────────────────
function handleExplorePaths(input: string, expression: string) {
  const start = performance.now();
  const data = JSON.parse(input);
  const results: PathResult[] = [];

  if (expression.startsWith('$')) {
    // JSONPath-like
    evaluateJsonPath(data, expression, '$', results);
  } else if (expression.startsWith('.') || !expression) {
    // Simple dot path
    const val = getNestedValue(data, expression.replace(/^\./, ''));
    results.push({ path: expression || '$', value: val, type: getValueType(val) });
  } else {
    // Key search - find all paths matching the expression
    findAllPaths(data, expression, '$', results);
  }

  respond({ type: 'pathExplorerResult', payload: { results, time: performance.now() - start } });
}

function evaluateJsonPath(data: unknown, expr: string, currentPath: string, results: PathResult[]) {
  const parts = expr.replace(/^\$\.?/, '').split('.');
  let nodes: Array<{ val: unknown; path: string }> = [{ val: data, path: currentPath }];

  for (const part of parts) {
    if (!part) continue;
    const nextNodes: typeof nodes = [];

    for (const node of nodes) {
      if (part === '*') {
        if (Array.isArray(node.val)) {
          node.val.forEach((item, i) => nextNodes.push({ val: item, path: `${node.path}[${i}]` }));
        } else if (typeof node.val === 'object' && node.val !== null) {
          for (const [k, v] of Object.entries(node.val as Record<string, unknown>)) {
            nextNodes.push({ val: v, path: `${node.path}.${k}` });
          }
        }
      } else if (part.includes('[') && part.includes(']')) {
        const key = part.replace(/\[.*\]/, '');
        const indexStr = part.match(/\[(.+)\]/)?.[1];
        let val = key ? (node.val as Record<string, unknown>)?.[key] : node.val;
        if (indexStr === '*' && Array.isArray(val)) {
          val = val as unknown[];
          (val as unknown[]).forEach((item, i) => nextNodes.push({ val: item, path: `${node.path}.${key}[${i}]` }));
        } else if (indexStr !== undefined) {
          const idx = Number(indexStr);
          if (Array.isArray(val) && !isNaN(idx)) {
            nextNodes.push({ val: val[idx], path: `${node.path}.${key}[${idx}]` });
          }
        }
      } else {
        if (typeof node.val === 'object' && node.val !== null && !Array.isArray(node.val)) {
          const v = (node.val as Record<string, unknown>)[part];
          if (v !== undefined) nextNodes.push({ val: v, path: `${node.path}.${part}` });
        }
      }
    }
    nodes = nextNodes;
  }

  for (const n of nodes) {
    results.push({ path: n.path, value: n.val, type: getValueType(n.val) });
  }
}

function findAllPaths(data: unknown, search: string, currentPath: string, results: PathResult[]) {
  if (data === null || typeof data !== 'object') return;
  if (Array.isArray(data)) {
    data.forEach((item, i) => findAllPaths(item, search, `${currentPath}[${i}]`, results));
  } else {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const p = `${currentPath}.${k}`;
      if (k.toLowerCase().includes(search.toLowerCase())) {
        results.push({ path: p, value: v, type: getValueType(v) });
      }
      if (typeof v === 'object' && v !== null) {
        findAllPaths(v, search, p, results);
      }
    }
  }
}

// ─── Mock Data ────────────────────────────────────────────────────────
function handleGenerateMock(input: string, options: MockOptions) {
  const start = performance.now();
  const data = JSON.parse(input);
  const sample = Array.isArray(data) ? data[0] : data;
  const count = options.count || 10;
  let seed = options.seed || Date.now();

  // Simple seeded random
  function random(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  function randomString(len: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return Array.from({ length: len }, () => chars[Math.floor(random() * chars.length)]).join('');
  }

  function randomName(): string {
    const first = ['James', 'Mary', 'John', 'Linda', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'David', 'Elizabeth'];
    const last = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];
    return `${first[Math.floor(random() * first.length)]} ${last[Math.floor(random() * last.length)]}`;
  }

  function randomEmail(): string {
    return `${randomString(8)}@${randomString(5)}.com`;
  }

  function generateMockValue(val: unknown, key: string): unknown {
    if (val === null) return null;
    if (Array.isArray(val)) {
      const len = Math.max(1, Math.floor(random() * 5));
      return Array.from({ length: len }, () => val.length > 0 ? generateMockValue(val[0], key) : null);
    }
    switch (typeof val) {
      case 'string': {
        const kl = key.toLowerCase();
        if (kl.includes('email')) return randomEmail();
        if (kl.includes('name') || kl.includes('author')) return randomName();
        if (kl.includes('date') || kl.includes('time') || kl.includes('created') || kl.includes('updated')) {
          const d = new Date(Date.now() - Math.floor(random() * 365 * 24 * 60 * 60 * 1000));
          return d.toISOString();
        }
        if (kl.includes('url') || kl.includes('link') || kl.includes('href')) return `https://example.com/${randomString(8)}`;
        if (kl.includes('phone')) return `+1${Math.floor(random() * 9000000000 + 1000000000)}`;
        if (kl.includes('id') || kl.includes('uuid')) return `${randomString(8)}-${randomString(4)}-${randomString(4)}-${randomString(12)}`;
        if (kl.includes('description') || kl.includes('bio') || kl.includes('text')) return `${randomString(20)} ${randomString(15)} ${randomString(10)}`;
        if (kl.includes('city')) return ['New York', 'London', 'Tokyo', 'Paris', 'Berlin'][Math.floor(random() * 5)];
        if (kl.includes('country')) return ['US', 'UK', 'JP', 'FR', 'DE'][Math.floor(random() * 5)];
        if (kl.includes('color')) return ['#' + Math.floor(random() * 16777215).toString(16).padStart(6, '0')][0];
        if (kl.includes('status')) return ['active', 'inactive', 'pending', 'archived'][Math.floor(random() * 4)];
        return randomString(Math.max(3, (val as string).length));
      }
      case 'number': {
        const kl = key.toLowerCase();
        if (kl.includes('age')) return Math.floor(random() * 60 + 18);
        if (kl.includes('price') || kl.includes('amount') || kl.includes('cost')) return Math.round(random() * 10000) / 100;
        if (kl.includes('count') || kl.includes('quantity')) return Math.floor(random() * 100);
        if (Number.isInteger(val)) return Math.floor(random() * 1000);
        return Math.round(random() * 10000) / 100;
      }
      case 'boolean': return random() > 0.5;
      case 'object': {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          result[k] = generateMockValue(v, k);
        }
        return result;
      }
      default: return val;
    }
  }

  const results = Array.from({ length: count }, () => generateMockValue(sample, ''));
  respond({ type: 'mockDataResult', payload: { result: JSON.stringify(results, null, 2), time: performance.now() - start } });
}

// ─── Data Masking ─────────────────────────────────────────────────────
function handleMaskData(input: string, config: MaskingConfig) {
  const start = performance.now();
  const data = JSON.parse(input);
  const fieldSet = new Set(config.fields.map(f => f.toLowerCase()));

  function maskValue(val: unknown, rule: string): unknown {
    switch (rule) {
      case 'redact': return '***REDACTED***';
      case 'hash': return hashString(String(val));
      case 'partial': {
        const s = String(val);
        if (s.length <= 4) return '****';
        return s.slice(0, 2) + '*'.repeat(s.length - 4) + s.slice(-2);
      }
      case 'randomize': {
        if (typeof val === 'number') return Math.floor(Math.random() * 1000);
        if (typeof val === 'string') return Array.from({ length: val.length }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
        return val;
      }
      case 'nullify': return null;
      default: return '***';
    }
  }

  function processNode(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => processNode(item));
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (fieldSet.has(k.toLowerCase())) {
          result[k] = config.preserveStructure && typeof v === 'object' && v !== null
            ? processNode(v)
            : maskValue(v, config.rule);
        } else {
          result[k] = typeof v === 'object' && v !== null ? processNode(v) : v;
        }
      }
      return result;
    }
    return obj;
  }

  const result = processNode(data);
  respond({ type: 'maskDataResult', payload: { result: JSON.stringify(result, null, 2), time: performance.now() - start } });
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'h_' + Math.abs(hash).toString(16).padStart(8, '0');
}

// ─── Schema Drift ─────────────────────────────────────────────────────
function handleAnalyzeSchemaDrift(schemaA: string, schemaB: string) {
  const start = performance.now();
  const a = JSON.parse(schemaA);
  const b = JSON.parse(schemaB);
  const drifts: SchemaDrift[] = [];

  function compare(objA: Record<string, unknown>, objB: Record<string, unknown>, path: string) {
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

    for (const key of allKeys) {
      const fullPath = path ? `${path}.${key}` : key;
      const inA = key in objA;
      const inB = key in objB;

      if (inA && !inB) {
        drifts.push({ path: fullPath, change: 'removed', before: describeSchema(objA[key]), severity: 'breaking' });
      } else if (!inA && inB) {
        drifts.push({ path: fullPath, change: 'added', after: describeSchema(objB[key]), severity: 'non-breaking' });
      } else {
        // Both present
        const valA = objA[key];
        const valB = objB[key];

        if (key === 'type' && valA !== valB) {
          drifts.push({ path, change: 'type-changed', before: String(valA), after: String(valB), severity: 'breaking' });
        }
        if (key === 'required' && JSON.stringify(valA) !== JSON.stringify(valB)) {
          drifts.push({ path, change: 'required-changed', before: JSON.stringify(valA), after: JSON.stringify(valB), severity: 'breaking' });
        }
        if (['minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'format', 'enum'].includes(key) && JSON.stringify(valA) !== JSON.stringify(valB)) {
          drifts.push({ path: fullPath, change: 'constraint-changed', before: JSON.stringify(valA), after: JSON.stringify(valB), severity: 'non-breaking' });
        }

        // Recurse into nested schemas
        if (key === 'properties' && typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null) {
          compare(valA as Record<string, unknown>, valB as Record<string, unknown>, path ? `${path}.properties` : 'properties');
        }
        if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null && !Array.isArray(valA) && !Array.isArray(valB)) {
          if (!['properties', 'required'].includes(key)) {
            compare(valA as Record<string, unknown>, valB as Record<string, unknown>, fullPath);
          }
        }
      }
    }
  }

  compare(a, b, '');
  respond({ type: 'schemaDriftResult', payload: { drifts, time: performance.now() - start } });
}

function describeSchema(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.type) return String(obj.type);
    return JSON.stringify(val).slice(0, 100);
  }
  return String(val);
}
