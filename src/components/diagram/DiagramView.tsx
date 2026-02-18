/* ===================================================================
 * DiagramView - Visualize JSON structure as a node graph.
 * Uses React Flow for interactive pan/zoom graph rendering.
 *
 * Architecture: Converts JSON to nodes/edges only when data changes.
 * Uses memoization to prevent re-renders on pan/zoom actions.
 * Supports: expand/collapse, hover details, export as PNG/SVG.
 * =================================================================== */

import { useMemo, useCallback, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  type Node,
  type Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type NodeProps,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { Download, Image } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import type { JsonValueType } from '../../types';

/* ─── Custom Node Component ────────────────────────────────────────── */

interface CustomNodeData {
  label: string;
  type: JsonValueType;
  value?: string;
  childCount?: number;
  path: string;
}

const nodeColors: Record<JsonValueType, { bg: string; border: string; badge: string }> = {
  object: { bg: '#eff6ff', border: '#3b82f6', badge: '#3b82f6' },
  array: { bg: '#faf5ff', border: '#a855f7', badge: '#a855f7' },
  string: { bg: '#f0fdf4', border: '#22c55e', badge: '#22c55e' },
  number: { bg: '#fffbeb', border: '#f59e0b', badge: '#f59e0b' },
  boolean: { bg: '#fdf2f8', border: '#ec4899', badge: '#ec4899' },
  null: { bg: '#f8fafc', border: '#94a3b8', badge: '#94a3b8' },
};

const darkNodeColors: Record<JsonValueType, { bg: string; border: string; badge: string }> = {
  object: { bg: '#1e3a5f', border: '#60a5fa', badge: '#60a5fa' },
  array: { bg: '#3b1f5c', border: '#c084fc', badge: '#c084fc' },
  string: { bg: '#052e16', border: '#4ade80', badge: '#4ade80' },
  number: { bg: '#451a03', border: '#fbbf24', badge: '#fbbf24' },
  boolean: { bg: '#4a1942', border: '#f472b6', badge: '#f472b6' },
  null: { bg: '#1e293b', border: '#64748b', badge: '#64748b' },
};

function CustomNode({ data }: NodeProps<CustomNodeData>) {
  const { theme } = useAppState();
  const colors = theme === 'dark' ? darkNodeColors : nodeColors;
  const c = colors[data.type];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 12px',
        borderRadius: '8px',
        border: `2px solid ${c.border}`,
        background: c.bg,
        minWidth: '120px',
        maxWidth: '240px',
        boxShadow: hovered ? `0 4px 12px ${c.border}40` : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: c.border }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '3px',
            background: c.badge,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {data.type}
          {data.childCount !== undefined ? ` (${data.childCount})` : ''}
        </span>
      </div>

      <div
        style={{
          fontWeight: 600,
          fontSize: '12px',
          color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
          marginBottom: data.value ? '2px' : 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.label}
      </div>

      {data.value && (
        <div
          style={{
            fontSize: '10px',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.value}
        </div>
      )}

      {/* Hover tooltip with path */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '-24px',
            left: 0,
            fontSize: '9px',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            fontFamily: 'monospace',
            background: theme === 'dark' ? '#0f172a' : '#ffffff',
            padding: '2px 6px',
            borderRadius: '3px',
            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          {data.path}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: c.border }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { custom: CustomNode };

/* ─── Main DiagramView Component ───────────────────────────────────── */

/**
 * MAX_DIAGRAM_NODES limits how many nodes we render to prevent
 * browser slowdown with very large JSON payloads.
 */
const MAX_DIAGRAM_NODES = 500;

export function DiagramView() {
  const { parseResult, jsonInput, theme } = useAppState();
  const { showToast } = useToast();

  // Build graph nodes & edges from JSON data
  const { initialNodes, initialEdges, truncated } = useMemo(() => {
    if (!parseResult?.success || !parseResult.data) {
      return { initialNodes: [] as Node[], initialEdges: [] as Edge[], truncated: false };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let counter = 0;
    let truncated = false;

    const buildGraph = (
      value: unknown,
      key: string,
      path: string,
      parentId: string | null,
      x: number,
      y: number,
      depth: number,
    ): number => {
      if (counter >= MAX_DIAGRAM_NODES) {
        truncated = true;
        return x;
      }

      const id = `d-${counter++}`;
      const type = getType(value);
      const nodeData: CustomNodeData = {
        label: key,
        type,
        path,
      };

      if (type === 'object' || type === 'array') {
        const children = type === 'object'
          ? Object.entries(value as Record<string, unknown>)
          : (value as unknown[]).map((v, i) => [`[${i}]`, v] as [string, unknown]);
        nodeData.childCount = children.length;

        // Limit children shown per node for performance
        const maxChildren = depth < 2 ? 20 : 10;
        if (children.length > maxChildren) {
          nodeData.value = `... +${children.length - maxChildren} more`;
        }
      } else {
        nodeData.value = formatValue(value, type);
      }

      nodes.push({
        id,
        type: 'custom',
        position: { x, y },
        data: nodeData,
      });

      if (parentId) {
        edges.push({
          id: `e-${parentId}-${id}`,
          source: parentId,
          target: id,
          animated: false,
          style: { stroke: theme === 'dark' ? '#475569' : '#cbd5e1', strokeWidth: 1.5 },
        });
      }

      // Layout children
      if ((type === 'object' || type === 'array') && depth < 6) {
        const children = type === 'object'
          ? Object.entries(value as Record<string, unknown>)
          : (value as unknown[]).map((v, i) => [`[${i}]`, v] as [string, unknown]);

        const maxChildren = depth < 2 ? 20 : 10;
        const visibleChildren = children.slice(0, maxChildren);
        const childWidth = 200;
        const totalWidth = visibleChildren.length * childWidth;
        let childX = x - totalWidth / 2 + childWidth / 2;

        for (const [childKey, childValue] of visibleChildren) {
          const childPath = type === 'object'
            ? `${path}.${childKey}`
            : `${path}${childKey}`;

          childX = buildGraph(
            childValue,
            String(childKey),
            childPath,
            id,
            childX,
            y + 120,
            depth + 1,
          );
          childX += childWidth;
        }
      }

      return x;
    };

    buildGraph(parseResult.data, 'root', '$', null, 0, 0, 0);
    return { initialNodes: nodes, initialEdges: edges, truncated };
  }, [parseResult, theme]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleExport = useCallback(
    async (format: 'png' | 'svg') => {
      const el = document.querySelector('.react-flow') as HTMLElement;
      if (!el) return;

      try {
        const fn = format === 'png' ? toPng : toSvg;
        const dataUrl = await fn(el, {
          backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        });
        const link = document.createElement('a');
        link.download = `json-diagram.${format}`;
        link.href = dataUrl;
        link.click();
        showToast(`Exported as ${format.toUpperCase()}`);
      } catch {
        showToast('Export failed', 'error');
      }
    },
    [theme, showToast]
  );

  if (!jsonInput.trim()) {
    return (
      <div style={emptyStyle}>
        Enter JSON in the Formatter tab to visualize the structure.
      </div>
    );
  }

  if (!parseResult?.success) {
    return (
      <div style={{ ...emptyStyle, color: 'var(--error)' }}>
        Fix JSON errors to view the diagram.
      </div>
    );
  }

  if (initialNodes.length === 0) {
    return <div style={emptyStyle}>No data to visualize.</div>;
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Export toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          zIndex: 10,
          display: 'flex',
          gap: '0.375rem',
        }}
      >
        {truncated && (
          <span
            style={{
              padding: '0.375rem 0.625rem',
              background: 'var(--warning-bg)',
              color: 'var(--warning)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            Showing {MAX_DIAGRAM_NODES} of {countNodes(parseResult.data)} nodes
          </span>
        )}
        <button onClick={() => handleExport('png')} style={exportBtnStyle} title="Export as PNG">
          <Image size={14} /> PNG
        </button>
        <button onClick={() => handleExport('svg')} style={exportBtnStyle} title="Export as SVG">
          <Download size={14} /> SVG
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={theme === 'dark' ? '#334155' : '#e2e8f0'}
        />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const colors = theme === 'dark' ? darkNodeColors : nodeColors;
            return colors[(n.data as CustomNodeData).type]?.border || '#94a3b8';
          }}
          maskColor={theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
        />
      </ReactFlow>
    </div>
  );
}

/* ─── Helper Functions ─────────────────────────────────────────────── */

function getType(value: unknown): JsonValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonValueType;
}

function formatValue(value: unknown, type: JsonValueType): string {
  if (type === 'string') {
    const str = value as string;
    return str.length > 30 ? `"${str.substring(0, 30)}..."` : `"${str}"`;
  }
  if (type === 'null') return 'null';
  return String(value);
}

function countNodes(value: unknown): number {
  if (value === null || typeof value !== 'object') return 1;
  if (Array.isArray(value)) return 1 + value.reduce((acc, v) => acc + countNodes(v), 0);
  return 1 + Object.values(value as Record<string, unknown>).reduce<number>((acc, v) => acc + countNodes(v), 0);
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

const exportBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.375rem 0.625rem',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 500,
};
