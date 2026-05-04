
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type AuditStatus = 'active' | 'review' | 'blocked' | 'completed';
export type MessageType = 'message' | 'alert' | 'decision' | 'assumption' | 'soma' | 'system' | 'ai';
export type ActorType = "USER" | "THINKER" | "SYSTEM";
export type UUID = string;

export interface Participant {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isOnline: boolean;
}

export interface EvidenceRef {
  type: "transaction" | "document" | "rule" | "external";
  id: string;
  note?: string;
}

export interface DecisionOption {
  label: string;
  description?: string;
}

export interface GravityRecord {
  decisionId: UUID;
  downstreamCount: number;
  financialImpact: number; // in millions
  riskAmplification: number; // 0-10 scale
}

export interface Assumption {
  id: UUID;
  label: string;
  description?: string;
  confidence: number; // 0–1
  lastVerifiedAt: number;
  decayRate: number; // confidence loss per day
  evidence: EvidenceRef[];
}

export interface DecisionNode {
  id: UUID;
  previousHash: string | null;
  hash: string;
  timestamp: number;
  actor: ActorType;
  changeType: 'ADDITION' | 'REVISION' | 'IMPORT';
  contextSnapshot: Record<string, any>;
  optionsConsidered: DecisionOption[];
  decisionTaken: string;
  title: string;
  rationale: string;
  userNote?: string; 
  confidence: number; 
  isConflict?: boolean; 
  riskAcknowledged: boolean;
  assumptionsUsed: UUID[];
  evidence: EvidenceRef[];
  gravity?: GravityRecord;
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  impact: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'mitigated' | 'open' | 'active';
  ownerId: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: string;
  ownerId: string;
  updatedAt: string;
  isVerified: boolean;
  version: string;
  hash: string;
  source: 'EMAIL' | 'CLOUD' | 'DATABASE' | 'MANUAL';
  sourceMeta?: {
    sender?: string;
    subject?: string;
    path?: string;
  };
  somaIntel?: {
    summary: string;
    extractedFigures: { label: string; value: string }[];
    riskSignals: string[];
    relevanceScore: number;
    linkedNodes: string[]; // IDs of Ledger nodes
  };
  ingestionStatus: 'READY' | 'PROCESSING' | 'FAILED';
}

export interface Audit {
  id: number;
  title: string;
  client: string;
  objective: string;
  status: AuditStatus;
  priority: Priority;
  progress: number;
  participants: Participant[];
  lastActivity: string;
  dueDate: string;
  tasks: {
    completed: number;
    total: number;
  };
  unreadMessages: number;
  team: string[];
}

export interface Message {
  id: number;
  senderId: string;
  message: string;
  timestamp: string;
  type: MessageType;
  metadata?: any;
  attachments?: string[];
}

export interface AIResponse {
  analysis: string;
  interventionRequired: boolean;
  detectedContradictions: string[];
  newDecisionsToTrack: string[];
  confidenceScore: number;
}

export interface ProjectSnapshot {
  projectId: UUID;
  companyId: UUID;
  startedAt: number;
  decisionCount: number;
  overrides: number;
  avgConfidence: number;
  confidenceTrend: "IMPROVING" | "STABLE" | "DECAYING";
  auditVisibility: number; 
  assumptionWeakness: number; 
  gravityScore: number;
}

export interface IntelligenceBrief {
  generatedAt: number;
  situationSummary: string;
  patternComparison: string;
  whatsDifferent: { label: string; detail: string; intensity: string }[];
  quietRisks: { label: string; detail: string; severity: string }[];
  recommendation?: string;
}
