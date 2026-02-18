/* ===================================================================
 * TreeView - Expandable tree visualization of JSON data.
 * Features: virtualized rendering, search by key/value,
 * JSON path display, copy path on click.
 *
 * Uses react-virtuoso for efficient rendering of large trees.
 * =================================================================== */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useAppState } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { copyToClipboard } from '../../utils';
import {
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Hash,
  Type,
  ToggleLeft,
  Braces,
  Brackets,
  CircleSlash,
  X,
} from 'lucide-react';
import type { TreeNode, JsonValueType } from '../../types';

/** Flat tree node for virtualized rendering */
interface FlatNode {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isMatch: boolean;
}

const typeIcons: Record<JsonValueType, React.ReactNode> = {
  object: <Braces size={12} color="var(--accent)" />,
  array: <Brackets size={12} color="#c084fc" />,
  string: <Type size={12} color="#4ade80" />,
  number: <Hash size={12} color="#fbbf24" />,
  boolean: <ToggleLeft size={12} color="#f472b6" />,
  null: <CircleSlash size={12} color="var(--text-muted)" />,
};

const typeColors: Record<JsonValueType, string> = {
  object: 'var(--accent)',
  array: '#c084fc',
  string: '#4ade80',
  number: '#fbbf24',
  boolean: '#f472b6',
  null: 'var(--text-muted)',
};

const valueColors: Record<JsonValueType, string> = {
  object: 'var(--text-secondary)',
  array: 'var(--text-secondary)',
  string: '#4ade80',
  number: '#fbbf24',
  boolean: '#f472b6',
  null: '#94a3b8',
};

export function TreeView() {
  const { jsonInput, parseResult } = useAppState();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build tree from parsed data
  const rootNodes = useMemo(() => {
    if (!parseResult?.success || !parseResult.data) return [];
    return buildTree(parseResult.data, '$', 'root', 0);
  }, [parseResult]);

  // Auto-expand first two levels
  useEffect(() => {
    const initial = new Set<string>();
    const expand = (nodes: TreeNode[], depth: number) => {
      if (depth > 1) return;
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          initial.add(node.id);
          expand(node.children, depth + 1);
        }
      }
    };
    expand(rootNodes, 0);
    setExpandedNodes(initial);
  }, [rootNodes]);

  // Flatten tree for virtualized rendering
  const flatNodes = useMemo(() => {
    const result: FlatNode[] = [];
    const matchLower = searchQuery.toLowerCase();

    const flatten = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        const isMatch =
          matchLower.length > 0 &&
          (node.key.toLowerCase().includes(matchLower) ||
            node.preview.toLowerCase().includes(matchLower) ||
            node.path.toLowerCase().includes(matchLower));

        const hasChildren = (node.children?.length ?? 0) > 0;
        const isExpanded = expandedNodes.has(node.id);

        result.push({ node, depth, isExpanded, hasChildren, isMatch });

        if (isExpanded && node.children) {
          flatten(node.children, depth + 1);
        }
      }
    };

    flatten(rootNodes, 0);
    return result;
  }, [rootNodes, expandedNodes, searchQuery]);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          all.add(node.id);
          collect(node.children);
        }
      }
    };
    collect(rootNodes);
    setExpandedNodes(all);
  }, [rootNodes]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const handleCopyPath = useCallback(
    async (path: string) => {
      await copyToClipboard(path);
      showToast(`Copied: ${path}`);
    },
    [showToast]
  );

  if (!jsonInput.trim()) {
    return (
      <div style={emptyStyle}>
        Enter JSON in the Formatter tab to view the tree structure.
      </div>
    );
  }

  if (!parseResult?.success) {
    return (
      <div style={{ ...emptyStyle, color: 'var(--error)' }}>
        Fix JSON errors to view the tree.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search & Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            flex: 1,
            maxWidth: '400px',
            padding: '0.375rem 0.625rem',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search keys, values, or paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} color="var(--text-muted)" />
            </button>
          )}
        </div>

        <button onClick={expandAll} style={toolbarBtnStyle}>
          Expand All
        </button>
        <button onClick={collapseAll} style={toolbarBtnStyle}>
          Collapse All
        </button>

        {searchQuery && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {flatNodes.filter((n) => n.isMatch).length} matches
          </span>
        )}
      </div>

      {/* Virtualized Tree */}
      <div style={{ flex: 1 }}>
        <Virtuoso
          totalCount={flatNodes.length}
          itemContent={(index) => {
            const { node, depth, isExpanded, hasChildren, isMatch } = flatNodes[index];
            return (
              <TreeNodeRow
                key={node.id}
                node={node}
                depth={depth}
                isExpanded={isExpanded}
                hasChildren={hasChildren}
                isMatch={isMatch}
                onToggle={toggleNode}
                onCopyPath={handleCopyPath}
              />
            );
          }}
          style={{ height: '100%', background: 'var(--bg-primary)' }}
          overscan={50}
        />
      </div>
    </div>
  );
}

/* ─── TreeNodeRow Component ────────────────────────────────────────── */

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isMatch: boolean;
  onToggle: (id: string) => void;
  onCopyPath: (path: string) => void;
}

function TreeNodeRow({
  node,
  depth,
  isExpanded,
  hasChildren,
  isMatch,
  onToggle,
  onCopyPath,
}: TreeNodeRowProps) {
  const pathRef = useRef<HTMLSpanElement>(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.3125rem 0.5rem',
        paddingLeft: `${depth * 1.25 + 0.5}rem`,
        borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent)',
        background: isMatch ? 'var(--warning-bg)' : 'transparent',
        cursor: hasChildren ? 'pointer' : 'default',
        transition: 'background 0.1s',
        minHeight: '34px',
        fontSize: '0.8125rem',
      }}
      onClick={() => hasChildren && onToggle(node.id)}
      onMouseEnter={(e) => {
        if (!isMatch) e.currentTarget.style.background = 'var(--bg-secondary)';
      }}
      onMouseLeave={(e) => {
        if (!isMatch) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Expand/Collapse Icon */}
      <span style={{ width: '16px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown size={14} color="var(--text-muted)" />
          ) : (
            <ChevronRight size={14} color="var(--text-muted)" />
          )
        ) : null}
      </span>

      {/* Type Icon */}
      <span style={{ marginRight: '0.375rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {typeIcons[node.type]}
      </span>

      {/* Key */}
      <span
        style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginRight: '0.375rem',
          flexShrink: 0,
          letterSpacing: '-0.01em',
        }}
      >
        {node.key}
      </span>

      {/* Type badge */}
      <span
        style={{
          fontSize: '0.625rem',
          padding: '0.125rem 0.4375rem',
          borderRadius: '4px',
          background: `${typeColors[node.type]}25`,
          color: typeColors[node.type],
          border: `1px solid ${typeColors[node.type]}30`,
          marginRight: '0.5rem',
          flexShrink: 0,
          fontWeight: 600,
          lineHeight: 1.3,
        }}
      >
        {node.type}
        {node.childCount !== undefined ? ` (${node.childCount})` : ''}
      </span>

      {/* Value preview */}
      <span
        style={{
          color: valueColors[node.type],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
        }}
      >
        {!hasChildren || !isExpanded ? node.preview : ''}
      </span>

      {/* JSON Path */}
      <span
        ref={pathRef}
        onClick={(e) => {
          e.stopPropagation();
          onCopyPath(node.path);
        }}
        title={`Click to copy: ${node.path}`}
        style={{
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
          cursor: 'pointer',
          marginLeft: '0.5rem',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.125rem 0.375rem',
          borderRadius: '4px',
          border: '1px solid transparent',
          transition: 'all 0.15s',
          opacity: 0.7,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent-bg)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.opacity = '0.7';
        }}
      >
        <Copy size={10} />
        {node.path.length > 40 ? '...' + node.path.slice(-37) : node.path}
      </span>
    </div>
  );
}

/* ─── Tree Building ────────────────────────────────────────────────── */

let nodeId = 0;

function buildTree(value: unknown, path: string, key: string, depth: number): TreeNode[] {
  const id = `tn-${nodeId++}`;
  const type = getType(value);
  const preview = getPreview(value, type);
  const node: TreeNode = { id, key, value, type, path, depth, preview };

  if (type === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    node.childCount = entries.length;
    node.children = entries.flatMap(([k, v]) => buildTree(v, `${path}.${k}`, k, depth + 1));
  } else if (type === 'array') {
    const arr = value as unknown[];
    node.childCount = arr.length;
    node.children = arr.flatMap((item, i) => buildTree(item, `${path}[${i}]`, `[${i}]`, depth + 1));
  }

  return [node];
}

function getType(value: unknown): JsonValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonValueType;
}

function getPreview(value: unknown, type: JsonValueType): string {
  switch (type) {
    case 'object': {
      const keys = Object.keys(value as object);
      if (keys.length === 0) return '{}';
      return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
    }
    case 'array': {
      const arr = value as unknown[];
      return arr.length === 0 ? '[]' : `[${arr.length} items]`;
    }
    case 'string': {
      const str = value as string;
      return str.length > 60 ? `"${str.substring(0, 60)}..."` : `"${str}"`;
    }
    case 'null':
      return 'null';
    default:
      return String(value);
  }
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

const toolbarBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.625rem',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  background: 'var(--bg-primary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};
