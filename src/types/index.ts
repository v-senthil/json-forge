/* ===================================================================
 * Type definitions for the JSON Formatter application.
 * Centralized types ensure consistency across all modules.
 * =================================================================== */

/** The active view tab in the application */
export type ViewTab =
  | 'formatter'
  | 'tree'
  | 'diagram'
  | 'api-docs'
  | 'schema'
  | 'diff'
  | 'search'
  | 'query'
  | 'codegen'
  | 'import-export'
  | 'jwt'
  | 'logs'
  | 'snapshots'
  | 'profiler'
  | 'flatten'
  | 'db-schema'
  | 'contract'
  | 'streaming'
  | 'encryption'
  | 'openapi'
  | 'graphql'
  | 'workflow'
  | 'patch-studio'
  | 'path-explorer'
  | 'mock-data'
  | 'data-masking'
  | 'schema-drift';

/** Theme preference */
export type Theme = 'light' | 'dark';

/** Parsing result from Web Worker */
export interface ParseResult {
  success: boolean;
  data?: unknown;
  formatted?: string;
  minified?: string;
  error?: ParseError;
  /** Size in bytes of the original input */
  size: number;
  /** Time taken to parse in ms */
  parseTime: number;
}

/** Detailed parse error with location info */
export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  position?: number;
}

/** Tree node for the Tree View */
export interface TreeNode {
  id: string;
  key: string;
  value: unknown;
  type: JsonValueType;
  path: string;
  depth: number;
  children?: TreeNode[];
  childCount?: number;
  isExpanded?: boolean;
  /** Preview string for collapsed nodes */
  preview: string;
}

/** JSON value types */
export type JsonValueType =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null';

/** Diagram node data for React Flow */
export interface DiagramNodeData {
  label: string;
  type: JsonValueType;
  value?: string;
  childCount?: number;
  path: string;
  isExpanded: boolean;
}

/** JSON Schema (simplified Draft 2020-12 subset) */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  [key: string]: unknown;
}

/** Schema validation error */
export interface SchemaValidationError {
  path: string;
  message: string;
  keyword: string;
  params?: Record<string, unknown>;
}

/** Diff result between two JSON values */
export interface DiffResult {
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  path: string;
  key: string;
  oldValue?: unknown;
  newValue?: unknown;
  children?: DiffResult[];
}

/** Web Worker message types */
export type WorkerRequest =
  | { type: 'parse'; payload: string }
  | { type: 'format'; payload: { data: string; indent: number } }
  | { type: 'minify'; payload: string }
  | { type: 'generateSchema'; payload: string }
  | { type: 'validate'; payload: { json: string; schema: string } }
  | { type: 'diff'; payload: { left: string; right: string } }
  | { type: 'buildTree'; payload: string }
  | { type: 'search'; payload: { json: string; options: SearchOptions } }
  | { type: 'profile'; payload: string }
  | { type: 'generateCode'; payload: { json: string; options: CodeGenOptions } }
  | { type: 'query'; payload: { json: string; query: string; language: QueryLanguage } }
  | { type: 'diffPatch'; payload: { left: string; right: string } }
  | { type: 'analyzeLogs'; payload: string }
  | { type: 'flatten'; payload: { json: string; options: FlattenOptions } }
  | { type: 'unflatten'; payload: { json: string; delimiter: string } }
  | { type: 'generateDbSchema'; payload: { json: string; dialect: DbSchemaDialect; tableName: string } }
  | { type: 'generateContract'; payload: { json: string; schema?: string; framework: ContractTestFramework } }
  | { type: 'generateOpenApi'; payload: { json: string; title: string; basePath: string } }
  | { type: 'generateGraphql'; payload: { json: string; mode: GraphqlOutputMode; rootName: string } }
  | { type: 'runWorkflow'; payload: { json: string; steps: WorkflowStep[] } }
  | { type: 'applyPatch'; payload: { json: string; patch: PatchOperation[] } }
  | { type: 'explorePaths'; payload: { json: string; expression: string } }
  | { type: 'generateMock'; payload: { json: string; options: MockOptions } }
  | { type: 'maskData'; payload: { json: string; config: MaskingConfig } }
  | { type: 'analyzeSchemaDrift'; payload: { schemaA: string; schemaB: string } };

export type WorkerResponse =
  | { type: 'parseResult'; payload: ParseResult }
  | { type: 'formatResult'; payload: { formatted: string; time: number } }
  | { type: 'minifyResult'; payload: { minified: string; time: number } }
  | { type: 'schemaResult'; payload: { schema: JsonSchema; time: number } }
  | { type: 'validateResult'; payload: { valid: boolean; errors: SchemaValidationError[]; time: number } }
  | { type: 'diffResult'; payload: { diffs: DiffResult[]; time: number } }
  | { type: 'treeResult'; payload: { nodes: TreeNode[]; time: number } }
  | { type: 'searchResult'; payload: { matches: SearchMatch[]; time: number } }
  | { type: 'profileResult'; payload: ProfileMetrics }
  | { type: 'codegenResult'; payload: CodeGenResult }
  | { type: 'queryResult'; payload: QueryResult }
  | { type: 'diffPatchResult'; payload: { patch: DiffPatchOp[]; time: number } }
  | { type: 'analyzeLogsResult'; payload: { entries: LogEntry[]; stats: LogStats; time: number } }
  | { type: 'flattenResult'; payload: { result: string; time: number } }
  | { type: 'unflattenResult'; payload: { result: string; time: number } }
  | { type: 'dbSchemaResult'; payload: DbSchemaResult }
  | { type: 'contractResult'; payload: ContractTestResult }
  | { type: 'openApiResult'; payload: { spec: string; time: number } }
  | { type: 'graphqlResult'; payload: { output: string; time: number } }
  | { type: 'workflowResult'; payload: WorkflowResult }
  | { type: 'patchResult'; payload: { result: string; time: number } }
  | { type: 'pathExplorerResult'; payload: { results: PathResult[]; time: number } }
  | { type: 'mockDataResult'; payload: { result: string; time: number } }
  | { type: 'maskDataResult'; payload: { result: string; time: number } }
  | { type: 'schemaDriftResult'; payload: { drifts: SchemaDrift[]; time: number } }
  | { type: 'error'; payload: { message: string } };

/* ─── Search & Filter Types ──────────────────────────────────────── */

export type SearchMode = 'key' | 'value' | 'regex' | 'type' | 'path';

export interface SearchOptions {
  mode: SearchMode;
  query: string;
  caseSensitive: boolean;
  fuzzy: boolean;
}

export interface SearchMatch {
  path: string;
  key: string;
  value: unknown;
  type: JsonValueType;
  matchContext?: string;
}

/* ─── Query Types ────────────────────────────────────────────────── */

export type QueryLanguage = 'jq' | 'jsonata' | 'mongodb';

export interface QueryResult {
  result: string;
  time: number;
  error?: string;
}

/* ─── Code Generation Types ──────────────────────────────────────── */

export type CodeGenLanguage = 'typescript' | 'java' | 'go' | 'python' | 'csharp';

export interface CodeGenOptions {
  language: CodeGenLanguage;
  rootName: string;
  optionalFields: boolean;
  strictTyping: boolean;
  enumDetection: boolean;
}

export interface CodeGenResult {
  code: string;
  language: CodeGenLanguage;
  time: number;
}

/* ─── Import/Export Types ────────────────────────────────────────── */

export type ImportFormat = 'csv' | 'yaml' | 'xml' | 'url' | 'file';
export type ExportFormat = 'csv' | 'yaml' | 'sql' | 'markdown' | 'excel';

/* ─── JWT Types ──────────────────────────────────────────────────── */

export interface JwtDecoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

/* ─── Log Analyzer Types ─────────────────────────────────────────── */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown';

export interface LogEntry {
  index: number;
  level: LogLevel;
  timestamp?: string;
  message: string;
  raw: Record<string, unknown>;
}

export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  timeRange?: { start: string; end: string };
  topFields: Array<{ field: string; count: number }>;
}

/* ─── Snapshot Types ─────────────────────────────────────────────── */

export interface Snapshot {
  id: string;
  tag: string;
  timestamp: number;
  json: string;
  size: number;
}

/* ─── Profiler Types ─────────────────────────────────────────────── */

export interface ProfileMetrics {
  totalNodes: number;
  maxDepth: number;
  maxBreadth: number;
  estimatedMemory: number;
  parseTime: number;
  uniqueKeys: number;
  typeDistribution: Record<string, number>;
  depthDistribution: Record<string, number>;
}

/* ─── Diff Patch Types (RFC 6902) ────────────────────────────────── */

export interface DiffPatchOp {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

/* ─── Plugin Types ───────────────────────────────────────────────── */

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  tab: ViewTab;
  order?: number;
}

/* ─── Flatten / Unflatten Types ──────────────────────────────────── */

export interface FlattenOptions {
  delimiter: string;
  safe: boolean; // preserve arrays as arrays
  maxDepth?: number;
}

/* ─── DB Schema Types ────────────────────────────────────────────── */

export type DbSchemaDialect = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';

export interface DbSchemaResult {
  sql: string;
  dialect: DbSchemaDialect;
  tables: number;
  indexes: string[];
  time: number;
}

/* ─── Contract Testing Types ─────────────────────────────────────── */

export type ContractTestFramework = 'jest' | 'mocha' | 'junit';

export interface ContractAssertion {
  path: string;
  type: string;
  required: boolean;
  pattern?: string;
  value?: unknown;
}

export interface ContractTestResult {
  assertions: ContractAssertion[];
  code: string;
  framework: ContractTestFramework;
  time: number;
}

/* ─── Encryption Types ───────────────────────────────────────────── */

export type EncryptionMode = 'aes-encrypt' | 'aes-decrypt' | 'base64-encode' | 'base64-decode' | 'hmac' | 'hash';
export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

/* ─── OpenAPI Types ──────────────────────────────────────────────── */

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
}

/* ─── GraphQL Types ──────────────────────────────────────────────── */

export type GraphqlOutputMode = 'schema' | 'query';

/* ─── Workflow Types ─────────────────────────────────────────────── */

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'jq' | 'map' | 'filter' | 'sort' | 'pick' | 'omit' | 'rename' | 'custom';
  config: string;
  enabled: boolean;
}

export interface WorkflowResult {
  stepResults: Array<{ stepId: string; output: string; error?: string; time: number }>;
  finalOutput: string;
  totalTime: number;
}

/* ─── JSON Patch Studio Types ────────────────────────────────────── */

export interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

/* ─── Path Explorer Types ────────────────────────────────────────── */

export interface PathResult {
  path: string;
  value: unknown;
  type: JsonValueType;
}

/* ─── Mock Data Types ────────────────────────────────────────────── */

export type MockStrategy = 'random' | 'faker' | 'sequential' | 'fixed';

export interface MockOptions {
  count: number;
  locale: string;
  seed?: number;
}

/* ─── Data Masking Types ─────────────────────────────────────────── */

export type MaskingRule = 'redact' | 'hash' | 'partial' | 'randomize' | 'nullify';

export interface MaskingConfig {
  fields: string[];
  rule: MaskingRule;
  preserveStructure: boolean;
}

/* ─── Schema Drift Types ────────────────────────────────────────── */

export interface SchemaDrift {
  path: string;
  change: 'added' | 'removed' | 'type-changed' | 'required-changed' | 'constraint-changed';
  before?: string;
  after?: string;
  severity: 'breaking' | 'non-breaking' | 'info';
}
