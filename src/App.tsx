/* ===================================================================
 * App - Root application component.
 * Composes the layout: Header, active view tab, and StatusBar.
 * Wraps each module in ErrorBoundary for fault isolation.
 * =================================================================== */

import { useAppState } from './stores/AppStore';
import { Header } from './components/layout/Header';
import { StatusBar } from './components/layout/StatusBar';
import { FormatterView } from './components/formatter/FormatterView';
import { TreeView } from './components/tree/TreeView';
import { DiagramView } from './components/diagram/DiagramView';
import { SchemaView } from './components/schema/SchemaView';
import { DiffView } from './components/diff/DiffView';
import { SearchView } from './components/search/SearchView';
import { QueryView } from './components/query/QueryView';
import { CodeGenView } from './components/codegen/CodeGenView';
import { ImportExportView } from './components/import-export/ImportExportView';
import { JwtView } from './components/jwt/JwtView';
import { LogView } from './components/logs/LogView';
import { SnapshotView } from './components/snapshots/SnapshotView';
import { ProfilerView } from './components/profiler/ProfilerView';
import { FlattenView } from './components/flatten/FlattenView';
import { DbSchemaView } from './components/db-schema/DbSchemaView';
import { ContractView } from './components/contract/ContractView';
import { StreamingView } from './components/streaming/StreamingView';
import { EncryptionView } from './components/encryption/EncryptionView';
import { OpenApiView } from './components/openapi/OpenApiView';
import { GraphqlView } from './components/graphql/GraphqlView';
import { WorkflowView } from './components/workflow/WorkflowView';
import { PatchStudioView } from './components/patch-studio/PatchStudioView';
import { PathExplorerView } from './components/path-explorer/PathExplorerView';
import { MockDataView } from './components/mock-data/MockDataView';
import { DataMaskingView } from './components/data-masking/DataMaskingView';
import { SchemaDriftView } from './components/schema-drift/SchemaDriftView';
import { ApiDocsView } from './components/api-docs/ApiDocsView';
import { ErrorBoundaryWrapper } from './components/common/ErrorBoundary';

export default function App() {
  const { theme, activeTab } = useAppState();

  return (
    <div className={theme} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ErrorBoundaryWrapper moduleName={activeTab}>
          {activeTab === 'formatter' && <FormatterView />}
          {activeTab === 'tree' && <TreeView />}
          {activeTab === 'diagram' && <DiagramView />}
          {activeTab === 'api-docs' && <ApiDocsView />}
          {activeTab === 'schema' && <SchemaView />}
          {activeTab === 'diff' && <DiffView />}
          {activeTab === 'search' && <SearchView />}
          {activeTab === 'query' && <QueryView />}
          {activeTab === 'codegen' && <CodeGenView />}
          {activeTab === 'import-export' && <ImportExportView />}
          {activeTab === 'jwt' && <JwtView />}
          {activeTab === 'logs' && <LogView />}
          {activeTab === 'snapshots' && <SnapshotView />}
          {activeTab === 'profiler' && <ProfilerView />}
          {activeTab === 'flatten' && <FlattenView />}
          {activeTab === 'db-schema' && <DbSchemaView />}
          {activeTab === 'contract' && <ContractView />}
          {activeTab === 'streaming' && <StreamingView />}
          {activeTab === 'encryption' && <EncryptionView />}
          {activeTab === 'openapi' && <OpenApiView />}
          {activeTab === 'graphql' && <GraphqlView />}
          {activeTab === 'workflow' && <WorkflowView />}
          {activeTab === 'patch-studio' && <PatchStudioView />}
          {activeTab === 'path-explorer' && <PathExplorerView />}
          {activeTab === 'mock-data' && <MockDataView />}
          {activeTab === 'data-masking' && <DataMaskingView />}
          {activeTab === 'schema-drift' && <SchemaDriftView />}
        </ErrorBoundaryWrapper>
      </main>

      <StatusBar />
    </div>
  );
}
