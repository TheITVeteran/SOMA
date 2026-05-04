
import React from 'react';
import { Participant, Audit, DecisionNode, Message, Assumption, Risk, ProjectFile } from './types';

// Icons set with optional title prop for accessibility and to resolve TS errors at call sites.
export const Icons = {
  Home: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  FileText: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
  ),
  Users: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  AlertCircle: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  ),
  Clock: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  MoreVertical: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
  ),
  Paperclip: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
  ),
  Ledger: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  ),
  Shield: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  Folder: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
  ),
  Calendar: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  Activity: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  Messages: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ),
  Settings: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  Search: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  Bell: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  ),
  Plus: ({ size = 14, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  Send: ({ size = 18, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  ),
  Zap: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  ),
  Upload: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  ),
  X: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  Filter: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  ),
  Database: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
  ),
  Cloud: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2-1.3-3.7-3.2-4.2C18.1 6.5 15.1 4 11.5 4 8.5 4 6 5.8 5 8.4 2.7 9.1 1 11.1 1 13.5c0 3 2.5 5.5 5.5 5.5h11z"/></svg>
  ),
  Mail: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  ),
  StickyNote: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z"/><polyline points="15 3 15 9 21 9"/></svg>
  ),
  Check: ({ size = 20, className = "", title = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{title && <title>{title}</title>}<polyline points="20 6 9 17 4 12"/></svg>
  )
};

export const PARTICIPANTS: Participant[] = [
  { id: 'p1', name: 'Jane Cooper', role: 'Audit Lead', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane', isOnline: true },
  { id: 'p2', name: 'Jenny Wilson', role: 'Compliance', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jenny', isOnline: true },
  { id: 'p3', name: 'Brooklyn Simon', role: 'Analyst', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Brooklyn', isOnline: true },
  { id: 'p4', name: 'Theresa Angel', role: 'Director', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Theresa', isOnline: false },
  { id: 'p5', name: 'Kim Minji', role: 'Principal', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kim', isOnline: true },
  { id: 'soma', name: 'SOMA AI', role: 'Intelligence', avatar: 'S', isOnline: true }
];

export const MOCK_FILES: ProjectFile[] = [
  { 
    id: 'f1', 
    name: 'EMEA_BalanceSheet.xlsx', 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
    size: '14MB', 
    ownerId: 'p3', 
    updatedAt: '2h ago', 
    isVerified: true, 
    version: '2.4',
    hash: '0x7e8a9b2c...',
    source: 'EMAIL',
    sourceMeta: { sender: 'finance.emea@nexus.com', subject: 'Q4 Finalized Ledger' },
    ingestionStatus: 'READY',
    somaIntel: {
      summary: "Consolidated balance sheet for EMEA region. High correlation with Ledger Node #D1. Key liability fields extracted.",
      extractedFigures: [{ label: "Net Exposure", value: "$142.8M" }, { label: "Tax Liability", value: "$12.4M" }],
      riskSignals: ["Inconsistent depreciation logic in French subsidiary node #4"],
      relevanceScore: 0.94,
      linkedNodes: ['d1']
    }
  },
  { 
    id: 'f2', 
    name: 'Compliance_Protocol.pdf', 
    type: 'application/pdf', 
    size: '2MB', 
    ownerId: 'p2', 
    updatedAt: '4h ago', 
    isVerified: true, 
    version: '1.0',
    hash: '0x1c2d3e4f...',
    source: 'CLOUD',
    sourceMeta: { path: '/Shared/Audit/Protocols' },
    ingestionStatus: 'READY',
    somaIntel: {
      summary: "Standard operating protocol for multijurisdictional filing. Contains mandate for regional reporting depth.",
      extractedFigures: [],
      riskSignals: [],
      relevanceScore: 0.65,
      linkedNodes: []
    }
  },
  {
    id: 'f3',
    name: 'Dublin_Contractors_B_Type.json',
    type: 'application/json',
    size: '450KB',
    ownerId: 'system',
    updatedAt: '12m ago',
    isVerified: true,
    version: '3.1',
    hash: '0x9a8b7c6d...',
    source: 'DATABASE',
    sourceMeta: { path: 'hr-nexus-db' },
    ingestionStatus: 'PROCESSING',
    somaIntel: {
      summary: "Mapping file for labor classification. High risk of conflict with French regional subsidiary rules.",
      extractedFigures: [{ label: "Headcount", value: "1,240" }],
      riskSignals: ["Duplicate ID detected in block #X22", "Non-compliant tax bracket mapping"],
      relevanceScore: 0.99,
      linkedNodes: ['d2']
    }
  }
];

export const MOCK_DECISIONS: DecisionNode[] = [
  { 
    id: 'd0', 
    title: 'Genesis State', 
    rationale: 'Initial audit parameters locked. Scope defined for EMEA region.', 
    confidence: 1.0, 
    actor: 'SYSTEM', 
    changeType: 'IMPORT',
    timestamp: Date.now() - 172800000, 
    previousHash: '000000000000', 
    hash: '5a2d8e...9f4b', 
    contextSnapshot: { stage: 'GENESIS' },
    optionsConsidered: [{ label: 'Baseline', description: 'Standard audit protocol established.' }],
    decisionTaken: 'Baseline',
    riskAcknowledged: false,
    assumptionsUsed: [],
    evidence: []
  },
  { 
    id: 'd1', 
    title: 'Asset Re-valuation', 
    rationale: 'Volatility in French subsidiary requires manual valuation override.', 
    confidence: 0.78, 
    actor: 'THINKER', 
    changeType: 'ADDITION',
    timestamp: Date.now() - 3600000, 
    previousHash: '5a2d8e...9f4b', 
    hash: '8f2c3a...e1d4', 
    contextSnapshot: { subs: 'EMEA', currency: 'EUR' },
    optionsConsidered: [
      { label: 'Automated Feed', description: 'Use standard Bloomberg ticker data (high latency risk).' },
      { label: 'Manual Override', description: 'Selected: Force $4.2M baseline based on regional auditor reports.' }
    ],
    decisionTaken: 'Manual Override',
    riskAcknowledged: true,
    assumptionsUsed: ['a1'],
    evidence: [{ type: 'document', id: 'FR-AUDIT-22' }],
    gravity: { decisionId: 'd1', downstreamCount: 4, financialImpact: 4.2, riskAmplification: 7 },
    userNote: "Verified with regional VP. Manual override is necessary due to data latency."
  },
  { 
    id: 'd2', 
    title: 'Tax Recognition Conflict', 
    rationale: 'Duplicate file upload detected from Dublin node with conflicting tax brackets.', 
    confidence: 0.32, 
    actor: 'SYSTEM', 
    changeType: 'IMPORT',
    isConflict: true,
    timestamp: Date.now() - 7200000, 
    previousHash: '8f2c3a...e1d4', 
    hash: '5e9b1f...ERROR',
    contextSnapshot: { tax_jurisdiction: 'IRL' },
    optionsConsidered: [
      { label: 'Reject Node', description: 'Block integration until manual reconcile.' }
    ],
    decisionTaken: 'Reject Node',
    riskAcknowledged: false,
    assumptionsUsed: ['a2'],
    evidence: [{ type: 'transaction', id: 'TX-DB-402' }],
    gravity: { decisionId: 'd2', downstreamCount: 1, financialImpact: 0.8, riskAmplification: 9 }
  }
];

export const INITIAL_AUDIT: Audit = {
  id: 1,
  title: "Nexus Q1 Liability Audit",
  client: "Nexus Global",
  objective: "Determine total financial risk exposure across EMEA subsidiaries before Jan 15 filing.",
  status: "active",
  priority: "critical",
  progress: 68,
  participants: PARTICIPANTS,
  lastActivity: "2 mins ago",
  dueDate: "2024-03-31",
  tasks: { completed: 24, total: 32 },
  unreadMessages: 4,
  team: ["Sarah Chen", "Mike Rodriguez", "David Kim", "Wendy Principal"]
};

export const MOCK_MESSAGES: Message[] = [
  { id: 1, senderId: 'p2', message: "Morning 👋 Lets join us Wendy!", timestamp: "12:49", type: 'message' },
  { id: 2, senderId: 'p4', message: "Sure Jenny :)", timestamp: "13:00", type: 'message' },
  { id: 3, senderId: 'soma', message: "ALERT: Contradiction detected in Dublin ledger vs. French subsidiary labor classification.", timestamp: "13:20", type: 'soma' }
];
