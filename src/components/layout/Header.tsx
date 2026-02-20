/* ===================================================================
 * Header component with tab navigation, theme toggle,
 * and file upload/download actions.
 * =================================================================== */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../stores/AppStore';
import { useToast } from '../common/Toast';
import { readFileAsText } from '../../utils';
import type { ViewTab } from '../../types';
import {
  Moon,
  Sun,
  Upload,
  Braces,
  TreePine,
  GitBranch,
  FileJson,
  GitCompare,
  Search,
  Terminal,
  Code2,
  ArrowRightLeft,
  KeyRound,
  FileText,
  Camera,
  Activity,
  Layers,
  Database,
  ShieldCheck,
  Zap,
  Lock,
  FileJson2,
  Workflow,
  Wrench,
  Compass,
  Wand2,
  EyeOff,
  GitMerge,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const tabs: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: 'formatter', label: 'Formatter', icon: <Braces size={14} /> },
  { id: 'tree', label: 'Tree', icon: <TreePine size={14} /> },
  { id: 'diagram', label: 'Diagram', icon: <GitBranch size={14} /> },
  { id: 'api-docs', label: 'API Docs', icon: <FileJson2 size={14} /> },
  { id: 'schema', label: 'Schema', icon: <FileJson size={14} /> },
  { id: 'diff', label: 'Diff', icon: <GitCompare size={14} /> },
  { id: 'search', label: 'Search', icon: <Search size={14} /> },
  { id: 'query', label: 'Query', icon: <Terminal size={14} /> },
  { id: 'codegen', label: 'CodeGen', icon: <Code2 size={14} /> },
  { id: 'import-export', label: 'Import/Export', icon: <ArrowRightLeft size={14} /> },
  { id: 'jwt', label: 'JWT', icon: <KeyRound size={14} /> },
  { id: 'logs', label: 'Logs', icon: <FileText size={14} /> },
  { id: 'snapshots', label: 'Snapshots', icon: <Camera size={14} /> },
  { id: 'profiler', label: 'Profiler', icon: <Activity size={14} /> },
  { id: 'flatten', label: 'Flatten', icon: <Layers size={14} /> },
  { id: 'db-schema', label: 'DB Schema', icon: <Database size={14} /> },
  { id: 'contract', label: 'Contract', icon: <ShieldCheck size={14} /> },
  { id: 'streaming', label: 'Streaming', icon: <Zap size={14} /> },
  { id: 'encryption', label: 'Encrypt', icon: <Lock size={14} /> },
  { id: 'openapi', label: 'OpenAPI', icon: <FileJson2 size={14} /> },
  { id: 'graphql', label: 'GraphQL', icon: <Braces size={14} /> },
  { id: 'workflow', label: 'Workflow', icon: <Workflow size={14} /> },
  { id: 'patch-studio', label: 'Patch', icon: <Wrench size={14} /> },
  { id: 'path-explorer', label: 'Path', icon: <Compass size={14} /> },
  { id: 'mock-data', label: 'Mock', icon: <Wand2 size={14} /> },
  { id: 'data-masking', label: 'Masking', icon: <EyeOff size={14} /> },
  { id: 'schema-drift', label: 'Drift', icon: <GitMerge size={14} /> },
];

export function Header() {
  const { theme, activeTab } = useAppState();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  // Scroll active tab into view when it changes
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const activeButton = el.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = navRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'SET_THEME', payload: theme === 'dark' ? 'light' : 'dark' });
  }, [theme, dispatch]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
        showToast('File too large (max 50MB)', 'error');
        return;
      }

      try {
        const text = await readFileAsText(file);
        dispatch({ type: 'SET_JSON_INPUT', payload: text });
        showToast(`Loaded ${file.name}`, 'success');
      } catch {
        showToast('Failed to read file', 'error');
      }

      // Reset input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [dispatch, showToast]
  );

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}
    >
      {/* Top row: Logo + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          height: '40px',
          gap: '0.5rem',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 700,
            fontSize: '0.9375rem',
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
          }}
        >
          <Braces size={20} />
          JSONForge
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonl,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload JSON file"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.3125rem 0.625rem',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.6875rem',
            }}
          >
            <Upload size={13} />
            Upload
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Bottom row: Tabs with scroll arrows */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid var(--border-color)',
          position: 'relative',
        }}
      >
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '34px',
              border: 'none',
              background: 'linear-gradient(to right, var(--bg-secondary) 60%, transparent)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              flexShrink: 0,
              zIndex: 2,
              position: 'absolute',
              left: 0,
            }}
          >
            <ChevronLeft size={14} />
          </button>
        )}

        <nav
          ref={navRef}
          style={{
            display: 'flex',
            gap: '1px',
            flex: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            padding: '3px 4px',
            paddingLeft: canScrollLeft ? '24px' : '4px',
            paddingRight: canScrollRight ? '24px' : '4px',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.3125rem 0.5rem',
                  border: isActive
                    ? '1px solid var(--accent)'
                    : '1px solid transparent',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap' as const,
                  background: isActive
                    ? 'var(--tab-active-bg)'
                    : 'transparent',
                  color: isActive
                    ? 'var(--tab-active-text)'
                    : 'var(--text-primary)',
                  transition: 'all 0.15s',
                  opacity: isActive ? 1 : 0.8,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '34px',
              border: 'none',
              background: 'linear-gradient(to left, var(--bg-secondary) 60%, transparent)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              flexShrink: 0,
              zIndex: 2,
              position: 'absolute',
              right: 0,
            }}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
