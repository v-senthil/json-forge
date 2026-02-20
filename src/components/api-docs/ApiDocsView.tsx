/* ===================================================================
 * ApiDocsView - Interactive OpenAPI documentation viewer.
 * Parses OpenAPI spec (JSON/YAML) and renders interactive API docs
 * with "Try it out" functionality.
 * =================================================================== */

import { useState, useCallback, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  FileJson2,
  Play,
  ChevronDown,
  ChevronRight,
  Lock,
  Copy,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  FileCode,
  Key,
  Server,
} from 'lucide-react';
import { JsonEditor } from '../common/JsonEditor';
import { useToast } from '../common/Toast';

// ------------------------ Types ------------------------

interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  options?: Operation;
  head?: Operation;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, { value: unknown }>;
}

interface Response {
  description?: string;
  headers?: Record<string, { description?: string; schema?: SchemaObject }>;
  content?: Record<string, MediaType>;
}

interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  description?: string;
  example?: unknown;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  additionalProperties?: boolean | SchemaObject;
}

interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}

interface EndpointInfo {
  path: string;
  method: string;
  operation: Operation;
  pathParams: Parameter[];
}

interface TryItState {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  auth: { type: string; value: string };
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
}

// ------------------------ YAML Parser ------------------------

function parseYaml(yaml: string): unknown {
  // Simple YAML parser for basic OpenAPI specs
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: -1 }];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    const indent = line.search(/\S/);
    const content = line.trim();
    
    // Pop from stack until we find the right parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    
    const parent = stack[stack.length - 1].obj;
    
    if (content.startsWith('- ')) {
      // Array item
      const val = content.slice(2).trim();
      const lastKey = Object.keys(parent).pop();
      if (lastKey && Array.isArray(parent[lastKey])) {
        if (val.includes(':')) {
          const obj: Record<string, unknown> = {};
          const [k, v] = val.split(':').map(s => s.trim());
          obj[k] = parseYamlValue(v);
          (parent[lastKey] as unknown[]).push(obj);
          stack.push({ obj, indent: indent + 2 });
        } else {
          (parent[lastKey] as unknown[]).push(parseYamlValue(val));
        }
      }
    } else if (content.includes(':')) {
      const colonIdx = content.indexOf(':');
      const key = content.slice(0, colonIdx).trim();
      const value = content.slice(colonIdx + 1).trim();
      
      if (value === '' || value === '|' || value === '>') {
        // Object or multiline string
        const nextLine = lines[i + 1];
        const nextIndent = nextLine ? nextLine.search(/\S/) : -1;
        
        if (nextIndent > indent && nextLine?.trim().startsWith('- ')) {
          parent[key] = [];
        } else if (nextIndent > indent) {
          const newObj: Record<string, unknown> = {};
          parent[key] = newObj;
          stack.push({ obj: newObj, indent });
        } else {
          parent[key] = '';
        }
      } else {
        parent[key] = parseYamlValue(value);
      }
    }
  }
  
  return result;
}

function parseYamlValue(val: string): unknown {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

// ------------------------ Helper Functions ------------------------

function parseSpec(input: string): OpenApiSpec | null {
  const trimmed = input.trim();
  
  // Try JSON first
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  
  // Try YAML
  try {
    return parseYaml(trimmed) as OpenApiSpec;
  } catch {
    return null;
  }
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    get: '#61affe',
    post: '#49cc90',
    put: '#fca130',
    delete: '#f93e3e',
    patch: '#50e3c2',
    options: '#0d5aa7',
    head: '#9012fe',
  };
  return colors[method.toLowerCase()] || '#999';
}

function resolveRef(ref: string, spec: OpenApiSpec): SchemaObject | null {
  if (!ref.startsWith('#/')) return null;
  const path = ref.slice(2).split('/');
  let current: unknown = spec;
  for (const key of path) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  return current as SchemaObject;
}

function getSchemaType(schema: SchemaObject | undefined, spec: OpenApiSpec): string {
  if (!schema) return 'unknown';
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    return resolved ? getSchemaType(resolved, spec) : schema.$ref.split('/').pop() || 'unknown';
  }
  if (schema.type === 'array' && schema.items) {
    return `${getSchemaType(schema.items, spec)}[]`;
  }
  return schema.type || 'object';
}

function generateExampleFromSchema(schema: SchemaObject | undefined, spec: OpenApiSpec, depth = 0): unknown {
  if (!schema || depth > 5) return null;
  
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    return resolved ? generateExampleFromSchema(resolved, spec, depth + 1) : {};
  }
  
  if (schema.example !== undefined) return schema.example;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date') return '2024-01-01';
      if (schema.format === 'date-time') return '2024-01-01T12:00:00Z';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uri') return 'https://example.com';
      if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
      return 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      if (schema.items) {
        return [generateExampleFromSchema(schema.items, spec, depth + 1)];
      }
      return [];
    case 'object':
    default:
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateExampleFromSchema(prop, spec, depth + 1);
        }
        return obj;
      }
      if (schema.allOf) {
        const merged: Record<string, unknown> = {};
        for (const subSchema of schema.allOf) {
          Object.assign(merged, generateExampleFromSchema(subSchema, spec, depth + 1));
        }
        return merged;
      }
      return {};
  }
}

function extractEndpoints(spec: OpenApiSpec): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];
  
  if (!spec.paths) return endpoints;
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    // Extract path params from the URL pattern (e.g., {groupId} from /groups/{groupId})
    const pathParamMatches = path.match(/\{([^}]+)\}/g) || [];
    const pathParamNames = pathParamMatches.map(m => m.slice(1, -1));
    
    // Get explicitly defined path params
    const explicitPathParams = pathItem.parameters?.filter(p => p.in === 'path') || [];
    
    for (const method of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const) {
      const operation = pathItem[method];
      if (operation) {
        // Merge explicit params with auto-detected ones
        const operationPathParams = operation.parameters?.filter(p => p.in === 'path') || [];
        const allExplicitParams = [...explicitPathParams, ...operationPathParams];
        
        // Create params for any path variables not explicitly defined
        const autoDetectedParams: Parameter[] = pathParamNames
          .filter(name => !allExplicitParams.some(p => p.name === name))
          .map(name => ({
            name,
            in: 'path' as const,
            required: true,
            schema: { type: 'string' },
            description: `Path parameter: ${name}`,
          }));
        
        endpoints.push({
          path,
          method,
          operation,
          pathParams: [...allExplicitParams, ...autoDetectedParams],
        });
      }
    }
  }
  
  return endpoints;
}

// ------------------------ Sub-Components ------------------------

function SchemaDisplay({ schema, spec, level = 0 }: { schema: SchemaObject; spec: OpenApiSpec; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec);
    const name = schema.$ref.split('/').pop();
    return (
      <div style={{ marginLeft: level * 12 }}>
        <span 
          style={{ color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {name}
        </span>
        {expanded && resolved && <SchemaDisplay schema={resolved} spec={spec} level={level + 1} />}
      </div>
    );
  }
  
  if (schema.type === 'object' && schema.properties) {
    return (
      <div style={{ marginLeft: level * 12 }}>
        {Object.entries(schema.properties).map(([key, prop]) => {
          const isRequired = schema.required?.includes(key);
          const hasNestedContent = (prop.type === 'object' && prop.properties) || 
                                    prop.$ref || 
                                    (prop.type === 'array' && prop.items);
          return (
            <div key={key} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: level === 0 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 500 }}>{key}</span>
                {isRequired && <span style={{ color: '#f87171', fontSize: '0.6875rem' }}>*</span>}
                <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {getSchemaType(prop, spec)}
                </span>
              </div>
              {prop.description && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.6875rem', marginTop: 2, marginLeft: 8 }}>
                  {prop.description}
                </div>
              )}
              {/* Render nested schemas */}
              {hasNestedContent && (
                <div style={{ marginTop: 8 }}>
                  {prop.type === 'object' && prop.properties && (
                    <SchemaDisplay schema={prop} spec={spec} level={level + 1} />
                  )}
                  {prop.$ref && <SchemaDisplay schema={prop} spec={spec} level={level + 1} />}
                  {prop.type === 'array' && prop.items && (
                    <SchemaDisplay schema={prop.items} spec={spec} level={level + 1} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  
  if (schema.type === 'array' && schema.items) {
    return (
      <div style={{ marginLeft: level * 12 }}>
        <SchemaDisplay schema={schema.items} spec={spec} level={level} />
      </div>
    );
  }
  
  return (
    <span style={{ color: 'var(--accent)', fontFamily: 'monospace', marginLeft: level * 12 }}>
      {schema.type || 'any'}
      {schema.format && <span style={{ color: 'var(--text-muted)' }}> ({schema.format})</span>}
    </span>
  );
}

function ParameterTable({ params, title, icon }: { params: Parameter[]; title: string; icon: React.ReactNode }) {
  if (params.length === 0) return null;
  
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
        {icon}
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg-tertiary)' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Type</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Required</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param, idx) => (
            <tr key={idx} style={{ background: 'var(--bg-secondary)' }}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {param.name}
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--accent)' }}>
                {param.schema?.type || 'string'}
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                {param.required ? <span style={{ color: '#f87171' }}>Yes</span> : 'No'}
              </td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                {param.description || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TryItOutPanel({
  endpoint,
  spec,
  baseUrl,
}: {
  endpoint: EndpointInfo;
  spec: OpenApiSpec;
  baseUrl: string;
}) {
  const { showToast } = useToast();
  const [state, setState] = useState<TryItState>(() => {
    // Initialize with default values
    const pathParams: Record<string, string> = {};
    const queryParams: Record<string, string> = {};
    const headers: Record<string, string> = {};
    
    // Path params
    endpoint.pathParams.forEach((p) => {
      pathParams[p.name] = p.example?.toString() || '';
    });
    
    // Query params
    endpoint.operation.parameters?.filter(p => p.in === 'query').forEach((p) => {
      queryParams[p.name] = p.example?.toString() || '';
    });
    
    // Header params
    endpoint.operation.parameters?.filter(p => p.in === 'header').forEach((p) => {
      headers[p.name] = p.example?.toString() || '';
    });
    
    // Request body
    let body = '';
    const requestBody = endpoint.operation.requestBody;
    if (requestBody?.content) {
      const jsonContent = requestBody.content['application/json'];
      if (jsonContent) {
        const example = jsonContent.example || 
          (jsonContent.examples && Object.values(jsonContent.examples)[0]?.value) ||
          (jsonContent.schema && generateExampleFromSchema(jsonContent.schema, spec));
        body = example ? JSON.stringify(example, null, 2) : '';
      }
    }
    
    return { pathParams, queryParams, headers, body, auth: { type: 'none', value: '' } };
  });
  
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  
  const queryParams = endpoint.operation.parameters?.filter(p => p.in === 'query') || [];
  const headerParams = endpoint.operation.parameters?.filter(p => p.in === 'header') || [];
  
  const buildUrl = useCallback(() => {
    let url = baseUrl + endpoint.path;
    
    // Replace path params
    for (const [key, value] of Object.entries(state.pathParams)) {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    }
    
    // Add query params
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(state.queryParams)) {
      if (value) searchParams.append(key, value);
    }
    const queryString = searchParams.toString();
    if (queryString) url += '?' + queryString;
    
    return url;
  }, [baseUrl, endpoint.path, state.pathParams, state.queryParams]);
  
  const handleExecute = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    
    const url = buildUrl();
    const headers: Record<string, string> = { ...state.headers };
    
    // Add custom headers
    customHeaders.forEach(({ key, value }) => {
      if (key) headers[key] = value;
    });
    
    // Add auth header
    if (state.auth.type === 'bearer' && state.auth.value) {
      headers['Authorization'] = `Bearer ${state.auth.value}`;
    } else if (state.auth.type === 'basic' && state.auth.value) {
      headers['Authorization'] = `Basic ${btoa(state.auth.value)}`;
    } else if (state.auth.type === 'apikey' && state.auth.value) {
      headers['X-API-Key'] = state.auth.value;
    }
    
    // Add content type for body
    if (state.body && ['post', 'put', 'patch'].includes(endpoint.method)) {
      headers['Content-Type'] = 'application/json';
    }
    
    const startTime = performance.now();
    
    try {
      const fetchOptions: RequestInit = {
        method: endpoint.method.toUpperCase(),
        headers,
        mode: 'cors',
      };
      
      if (state.body && ['post', 'put', 'patch'].includes(endpoint.method)) {
        fetchOptions.body = state.body;
      }
      
      const res = await fetch(url, fetchOptions);
      const endTime = performance.now();
      
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      let responseBody = '';
      try {
        const text = await res.text();
        // Try to format as JSON
        try {
          responseBody = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          responseBody = text;
        }
      } catch {
        responseBody = '[Could not read response body]';
      }
      
      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        time: Math.round(endTime - startTime),
      });
    } catch (err) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: `Error: ${err instanceof Error ? err.message : String(err)}\n\nThis may be due to CORS restrictions. Try using a browser extension to enable CORS or test with a local server.`,
        time: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [buildUrl, state, customHeaders, endpoint.method]);
  
  return (
    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Play size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Try it out</span>
      </div>
      
      {/* Base URL */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
          Request URL
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '4px 8px',
            borderRadius: 4,
            background: getMethodColor(endpoint.method),
            color: '#fff',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            {endpoint.method}
          </span>
          <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 4, fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            {buildUrl()}
          </code>
        </div>
      </div>
      
      {/* Authentication */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
          <Key size={12} /> Authentication
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={state.auth.type}
            onChange={(e) => setState(s => ({ ...s, auth: { ...s.auth, type: e.target.value } }))}
            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth (user:pass)</option>
            <option value="apikey">API Key</option>
          </select>
          {state.auth.type !== 'none' && (
            <input
              type={state.auth.type === 'bearer' || state.auth.type === 'apikey' ? 'password' : 'text'}
              placeholder={state.auth.type === 'basic' ? 'username:password' : 'Enter token/key'}
              value={state.auth.value}
              onChange={(e) => setState(s => ({ ...s, auth: { ...s.auth, value: e.target.value } }))}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
            />
          )}
        </div>
      </div>
      
      {/* Path Parameters */}
      {endpoint.pathParams.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
            Path Parameters
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {endpoint.pathParams.map((param) => (
              <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 100, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{param.name}</span>
                <input
                  value={state.pathParams[param.name] || ''}
                  onChange={(e) => setState(s => ({ ...s, pathParams: { ...s.pathParams, [param.name]: e.target.value } }))}
                  placeholder={param.example?.toString() || param.schema?.type || 'value'}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Query Parameters */}
      {queryParams.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
            Query Parameters
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queryParams.map((param) => (
              <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 100, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {param.name}
                  {param.required && <span style={{ color: '#f87171' }}>*</span>}
                </span>
                <input
                  value={state.queryParams[param.name] || ''}
                  onChange={(e) => setState(s => ({ ...s, queryParams: { ...s.queryParams, [param.name]: e.target.value } }))}
                  placeholder={param.example?.toString() || param.schema?.type || 'value'}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Headers */}
      {headerParams.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
            Headers
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {headerParams.map((param) => (
              <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 120, fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {param.name}
                  {param.required && <span style={{ color: '#f87171' }}>*</span>}
                </span>
                <input
                  value={state.headers[param.name] || ''}
                  onChange={(e) => setState(s => ({ ...s, headers: { ...s.headers, [param.name]: e.target.value } }))}
                  placeholder={param.example?.toString() || 'value'}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Custom Headers */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
          Custom Headers
          <button
            onClick={() => setCustomHeaders(h => [...h, { key: '', value: '' }])}
            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 2 }}
          >
            <Plus size={12} />
          </button>
        </label>
        {customHeaders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {customHeaders.map((header, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={header.key}
                  onChange={(e) => {
                    const newHeaders = [...customHeaders];
                    newHeaders[idx].key = e.target.value;
                    setCustomHeaders(newHeaders);
                  }}
                  placeholder="Header name"
                  style={{ width: 120, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                />
                <input
                  value={header.value}
                  onChange={(e) => {
                    const newHeaders = [...customHeaders];
                    newHeaders[idx].value = e.target.value;
                    setCustomHeaders(newHeaders);
                  }}
                  placeholder="Value"
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                />
                <button
                  onClick={() => setCustomHeaders(h => h.filter((_, i) => i !== idx))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Request Body */}
      {['post', 'put', 'patch'].includes(endpoint.method) && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
            Request Body (JSON)
          </label>
          <div style={{ height: 150, border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
            <JsonEditor
              value={state.body}
              onChange={(val) => setState(s => ({ ...s, body: val || '' }))}
              language="json"
            />
          </div>
        </div>
      )}
      
      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 4,
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
        {loading ? 'Sending...' : 'Execute'}
      </button>
      
      {/* Response */}
      {response && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>Response</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: response.status >= 200 && response.status < 300 ? '#49cc90' : response.status >= 400 ? '#f93e3e' : '#fca130',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {response.status} {response.statusText}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{response.time}ms</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(response.body);
                showToast('Response copied!', 'success');
              }}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <Copy size={14} />
            </button>
          </div>
          
          {/* Response Headers */}
          {Object.keys(response.headers).length > 0 && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                Response Headers ({Object.keys(response.headers).length})
              </summary>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 4, fontSize: '0.6875rem', border: '1px solid var(--border-color)' }}>
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--accent)' }}>{key}:</span> {value}
                  </div>
                ))}
              </div>
            </details>
          )}
          
          {/* Response Body */}
          <div style={{ height: 200, border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
            <JsonEditor
              value={response.body}
              readOnly
              language="json"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointDetails({
  endpoint,
  spec,
  baseUrl,
}: {
  endpoint: EndpointInfo;
  spec: OpenApiSpec;
  baseUrl: string;
}) {
  const [showTryIt, setShowTryIt] = useState(false);
  
  const pathParams = endpoint.pathParams;
  const queryParams = endpoint.operation.parameters?.filter(p => p.in === 'query') || [];
  const headerParams = endpoint.operation.parameters?.filter(p => p.in === 'header') || [];
  const requestBody = endpoint.operation.requestBody;
  const responses = endpoint.operation.responses || {};
  
  return (
    <div style={{ padding: 16 }}>
      {/* Operation Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{
          padding: '4px 10px',
          borderRadius: 4,
          background: getMethodColor(endpoint.method),
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {endpoint.method}
        </span>
        <code style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
          {endpoint.path}
        </code>
        {endpoint.operation.deprecated && (
          <span style={{ padding: '2px 6px', borderRadius: 4, background: '#f93e3e33', color: '#f93e3e', fontSize: '0.6875rem' }}>
            Deprecated
          </span>
        )}
      </div>
      
      {/* Summary & Description */}
      {endpoint.operation.summary && (
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{endpoint.operation.summary}</h3>
      )}
      {endpoint.operation.description && (
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {endpoint.operation.description}
        </p>
      )}
      
      {/* Tags */}
      {endpoint.operation.tags && endpoint.operation.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {endpoint.operation.tags.map((tag) => (
            <span key={tag} style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary)', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {/* Parameters */}
      <ParameterTable params={pathParams} title="Path Parameters" icon={<FileCode size={14} />} />
      <ParameterTable params={queryParams} title="Query Parameters" icon={<FileCode size={14} />} />
      <ParameterTable params={headerParams} title="Headers" icon={<FileCode size={14} />} />
      
      {/* Request Body */}
      {requestBody && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
            <FileCode size={14} />
            Request Body
            {requestBody.required && <span style={{ color: '#f87171', fontSize: '0.6875rem' }}>required</span>}
          </div>
          {requestBody.description && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{requestBody.description}</p>
          )}
          {requestBody.content && Object.entries(requestBody.content).map(([mediaType, content]) => (
            <div key={mediaType} style={{ marginBottom: 8 }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{mediaType}</span>
              {content.schema && (
                <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 4 }}>
                  <SchemaDisplay schema={content.schema} spec={spec} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Responses */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
          <FileCode size={14} />
          Responses
        </div>
        {Object.entries(responses).map(([code, response]) => (
          <div key={code} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 4, borderLeft: `3px solid ${code.startsWith('2') ? '#49cc90' : code.startsWith('4') || code.startsWith('5') ? '#f93e3e' : '#fca130'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: code.startsWith('2') ? '#49cc90' : code.startsWith('4') || code.startsWith('5') ? '#f93e3e' : '#fca130' }}>{code}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{response.description}</span>
            </div>
            {response.content && Object.entries(response.content).map(([mediaType, content]) => (
              <div key={mediaType}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{mediaType}</span>
                {content.schema && (
                  <div style={{ marginTop: 8 }}>
                    <SchemaDisplay schema={content.schema} spec={spec} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Try it out */}
      <button
        onClick={() => setShowTryIt(!showTryIt)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 4,
          border: '1px solid var(--accent)',
          background: showTryIt ? 'var(--accent)' : 'transparent',
          color: showTryIt ? '#fff' : 'var(--accent)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Play size={14} />
        {showTryIt ? 'Hide Try it out' : 'Try it out'}
      </button>
      
      {showTryIt && <TryItOutPanel endpoint={endpoint} spec={spec} baseUrl={baseUrl} />}
    </div>
  );
}

// ------------------------ Main Component ------------------------

export function ApiDocsView() {
  const { showToast } = useToast();
  const [specInput, setSpecInput] = useState('');
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleParse = useCallback(() => {
    if (!specInput.trim()) {
      showToast('Please enter an OpenAPI spec', 'error');
      return;
    }
    
    const parsed = parseSpec(specInput);
    if (!parsed) {
      showToast('Failed to parse spec. Check JSON/YAML syntax.', 'error');
      return;
    }
    
    if (!parsed.openapi && !parsed.swagger) {
      showToast('Not a valid OpenAPI/Swagger spec', 'error');
      return;
    }
    
    setSpec(parsed);
    
    // Set default base URL
    if (parsed.servers && parsed.servers.length > 0) {
      setBaseUrl(parsed.servers[0].url);
    } else {
      setBaseUrl('https://api.example.com');
    }
    
    showToast('OpenAPI spec loaded!', 'success');
  }, [specInput, showToast]);
  
  const endpoints = useMemo(() => spec ? extractEndpoints(spec) : [], [spec]);
  
  const filteredEndpoints = useMemo(() => {
    if (!searchQuery) return endpoints;
    const q = searchQuery.toLowerCase();
    return endpoints.filter(e => 
      e.path.toLowerCase().includes(q) ||
      e.method.toLowerCase().includes(q) ||
      e.operation.summary?.toLowerCase().includes(q) ||
      e.operation.operationId?.toLowerCase().includes(q) ||
      e.operation.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [endpoints, searchQuery]);
  
  const groupedByTag = useMemo(() => {
    const groups: Record<string, EndpointInfo[]> = { 'default': [] };
    
    for (const endpoint of filteredEndpoints) {
      const tags = endpoint.operation.tags || ['default'];
      for (const tag of tags) {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(endpoint);
      }
    }
    
    // Remove empty default
    if (groups['default'].length === 0) delete groups['default'];
    
    return groups;
  }, [filteredEndpoints]);
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <FileJson2 size={16} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
          API Documentation
        </span>
        
        {spec && (
          <>
            <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Server size={12} color="var(--text-muted)" />
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Base URL"
                style={{
                  width: 250,
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                }}
              />
            </div>
            <button
              onClick={() => { setSpec(null); setSelectedEndpoint(null); setSpecInput(''); }}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Load New Spec
            </button>
          </>
        )}
      </div>
      
      {/* Main Content */}
      {!spec ? (
        /* Spec Input View */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Paste your OpenAPI/Swagger specification (JSON or YAML):
            </span>
            <button
              onClick={handleParse}
              style={{
                marginLeft: 'auto',
                padding: '6px 16px',
                borderRadius: 4,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Play size={14} /> Load Spec
            </button>
          </div>
          <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
            <JsonEditor
              value={specInput}
              onChange={(val) => setSpecInput(val || '')}
              language="json"
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Supports OpenAPI 3.x and Swagger 2.0 specifications
          </div>
        </div>
      ) : (
        /* Documentation View */
        <Group orientation="horizontal" style={{ flex: 1 }}>
          {/* Sidebar - Endpoints List */}
          <Panel defaultSize={25} minSize={20}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              {/* API Info */}
              <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{spec.info?.title || 'API'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', background: 'var(--accent)', color: '#fff', borderRadius: 4 }}>
                    {spec.openapi || spec.swagger}
                  </span>
                  {spec.info?.version && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>v{spec.info.version}</span>
                  )}
                </div>
                {spec.info?.description && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {spec.info.description}
                  </p>
                )}
              </div>
              
              {/* Search */}
              <div style={{ padding: 8, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search endpoints..."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                  }}
                />
              </div>
              
              {/* Endpoints List */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {Object.entries(groupedByTag).map(([tag, tagEndpoints]) => (
                  <div key={tag}>
                    <div style={{
                      padding: '8px 12px',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {tag}
                    </div>
                    {tagEndpoints.map((endpoint, idx) => (
                      <div
                        key={`${endpoint.method}-${endpoint.path}-${idx}`}
                        onClick={() => setSelectedEndpoint(endpoint)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          background: selectedEndpoint === endpoint ? 'var(--bg-tertiary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: getMethodColor(endpoint.method),
                          color: '#fff',
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          minWidth: 40,
                          textAlign: 'center',
                        }}>
                          {endpoint.method}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          textDecoration: endpoint.operation.deprecated ? 'line-through' : 'none',
                          opacity: endpoint.operation.deprecated ? 0.5 : 1,
                        }}>
                          {endpoint.path}
                        </span>
                        {endpoint.operation.security && endpoint.operation.security.length > 0 && (
                          <Lock size={10} color="var(--text-muted)" />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              
              {/* Stats */}
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.6875rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                gap: 16,
                background: 'var(--bg-secondary)',
              }}>
                <span>{endpoints.length} endpoints</span>
                <span>{Object.keys(groupedByTag).length} tags</span>
              </div>
            </div>
          </Panel>
          
          <Separator />
          
          {/* Main Content - Endpoint Details */}
          <Panel defaultSize={75} minSize={40}>
            <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-primary)' }}>
              {selectedEndpoint ? (
                <EndpointDetails endpoint={selectedEndpoint} spec={spec} baseUrl={baseUrl} />
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  gap: 16,
                }}>
                  <FileJson2 size={48} />
                  <span style={{ fontSize: '0.875rem' }}>Select an endpoint to view documentation</span>
                </div>
              )}
            </div>
          </Panel>
        </Group>
      )}
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
