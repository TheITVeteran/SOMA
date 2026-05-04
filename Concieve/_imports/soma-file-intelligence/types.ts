
export interface FileSystemNode {
  id: string;
  name: string;
  kind: 'file' | 'directory';
  path: string;
  handle?: FileSystemHandle;
  children?: FileSystemNode[];
  parentId?: string | null;
  metadata?: FileMetadata;
  content?: string; // For text files, we cache content for the demo
  isIndexed: boolean;
  isVirtual?: boolean; // New: For Universe/Mesh simulation
  // New Addons
  creationTime?: number; // For Time Slider
  lineage?: {
    derivedFrom?: string[]; // IDs of parent files
    citations?: string[];   // IDs of cited files
  };
  lifecycleStatus?: 'active' | 'stale' | 'dead'; // For Dead File Detection
}

export interface FileMetadata {
  size: number;
  lastModified: number;
  type: string;
  extension: string;
  keywords: string[];
  summary?: string;
  version?: number;
  integrityStatus?: 'secure' | 'tampered' | 'unknown';
  accessCount?: number;
}

export interface SmartFolder {
  id: string;
  name: string;
  query: string;
  color: string;
}

export interface Chunk {
  id: string;
  fileId: string;
  filePath: string;
  content: string;
  startOffset: number;
  endOffset: number;
  relevanceScore?: number; // Added during query
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'contains' | 'references' | 'similar_to';
}

export interface QueryResult {
  answer: string;
  citations: Chunk[];
  relevantNodes: string[]; // IDs of relevant nodes for graph highlighting
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  INDEXING = 'INDEXING',
  READY = 'READY',
}

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ChatMessage {
  type: 'user' | 'agent';
  content: string;
  citations?: Chunk[];
  isStreaming?: boolean;
  retrievalStatus?: {
    state: 'searching' | 'reading' | 'reasoning' | 'complete';
    filesFound?: string[];
  };
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

export type GraphViewMode = 'standard' | 'heatmap' | 'temporal' | 'integrity' | 'lifecycle';
