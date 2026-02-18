/**
 * Plugin Architecture Registry
 * Each plugin registers itself with a manifest and provides a React component.
 * The registry is used by the Header and App to dynamically add tabs and routes.
 */
import type { PluginManifest, ViewTab } from '../types';

export interface PluginRegistration {
  manifest: PluginManifest;
  // Component will be lazily imported by the consumer
}

const plugins = new Map<ViewTab, PluginRegistration>();

export function registerPlugin(registration: PluginRegistration): void {
  plugins.set(registration.manifest.tab, registration);
}

export function getPlugin(tab: ViewTab): PluginRegistration | undefined {
  return plugins.get(tab);
}

export function getAllPlugins(): PluginRegistration[] {
  return Array.from(plugins.values()).sort((a, b) => (a.manifest.order ?? 0) - (b.manifest.order ?? 0));
}

// Register all built-in plugins
const builtinPlugins: PluginManifest[] = [
  { id: 'formatter', name: 'Formatter', description: 'Format & minify JSON', version: '1.0.0', tab: 'formatter', icon: 'Braces', order: 0 },
  { id: 'tree', name: 'Tree', description: 'Explore JSON tree structure', version: '1.0.0', tab: 'tree', icon: 'Network', order: 1 },
  { id: 'diagram', name: 'Diagram', description: 'Visualize JSON as a graph', version: '1.0.0', tab: 'diagram', icon: 'GitBranch', order: 2 },
  { id: 'schema', name: 'Schema', description: 'Generate & validate JSON Schema', version: '1.0.0', tab: 'schema', icon: 'Shield', order: 3 },
  { id: 'diff', name: 'Diff', description: 'Compare & merge JSON', version: '1.0.0', tab: 'diff', icon: 'GitCompare', order: 4 },
  { id: 'search', name: 'Search', description: 'Advanced JSON search & filter', version: '1.0.0', tab: 'search', icon: 'Search', order: 5 },
  { id: 'query', name: 'Query', description: 'JSON query playground', version: '1.0.0', tab: 'query', icon: 'Terminal', order: 6 },
  { id: 'codegen', name: 'CodeGen', description: 'Generate typed models from JSON', version: '1.0.0', tab: 'codegen', icon: 'Code', order: 7 },
  { id: 'import-export', name: 'Import/Export', description: 'Convert between formats', version: '1.0.0', tab: 'import-export', icon: 'ArrowLeftRight', order: 8 },
  { id: 'jwt', name: 'JWT', description: 'Decode & inspect JWT tokens', version: '1.0.0', tab: 'jwt', icon: 'Key', order: 9 },
  { id: 'logs', name: 'Logs', description: 'Analyze JSON logs', version: '1.0.0', tab: 'logs', icon: 'ScrollText', order: 10 },
  { id: 'snapshots', name: 'Snapshots', description: 'Version & snapshot management', version: '1.0.0', tab: 'snapshots', icon: 'Camera', order: 11 },
  { id: 'profiler', name: 'Profiler', description: 'JSON performance profiling', version: '1.0.0', tab: 'profiler', icon: 'Gauge', order: 12 },
  { id: 'flatten', name: 'Flatten', description: 'Flatten & unflatten nested JSON', version: '1.0.0', tab: 'flatten', icon: 'Layers', order: 13 },
  { id: 'db-schema', name: 'DB Schema', description: 'Generate database schemas from JSON', version: '1.0.0', tab: 'db-schema', icon: 'Database', order: 14 },
  { id: 'contract', name: 'Contract', description: 'Generate contract tests from JSON', version: '1.0.0', tab: 'contract', icon: 'ShieldCheck', order: 15 },
  { id: 'streaming', name: 'Streaming', description: 'Stream & chunk large JSON files', version: '1.0.0', tab: 'streaming', icon: 'Zap', order: 16 },
  { id: 'encryption', name: 'Encryption', description: 'Encrypt, decrypt & hash JSON', version: '1.0.0', tab: 'encryption', icon: 'Lock', order: 17 },
  { id: 'openapi', name: 'OpenAPI', description: 'Generate OpenAPI specs from JSON', version: '1.0.0', tab: 'openapi', icon: 'FileJson2', order: 18 },
  { id: 'graphql', name: 'GraphQL', description: 'Convert JSON to GraphQL schemas', version: '1.0.0', tab: 'graphql', icon: 'Braces', order: 19 },
  { id: 'workflow', name: 'Workflow', description: 'Build JSON transformation workflows', version: '1.0.0', tab: 'workflow', icon: 'Workflow', order: 20 },
  { id: 'patch-studio', name: 'Patch Studio', description: 'Visual JSON Patch (RFC 6902) editor', version: '1.0.0', tab: 'patch-studio', icon: 'Wrench', order: 21 },
  { id: 'path-explorer', name: 'Path Explorer', description: 'Explore JSON with path expressions', version: '1.0.0', tab: 'path-explorer', icon: 'Compass', order: 22 },
  { id: 'mock-data', name: 'Mock Data', description: 'Generate mock data from JSON templates', version: '1.0.0', tab: 'mock-data', icon: 'Wand2', order: 23 },
  { id: 'data-masking', name: 'Data Masking', description: 'Mask sensitive fields in JSON', version: '1.0.0', tab: 'data-masking', icon: 'EyeOff', order: 24 },
  { id: 'schema-drift', name: 'Schema Drift', description: 'Detect schema drift between versions', version: '1.0.0', tab: 'schema-drift', icon: 'GitMerge', order: 25 },
];

builtinPlugins.forEach(manifest => registerPlugin({ manifest }));
