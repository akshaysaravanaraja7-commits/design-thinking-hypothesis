export type ClaimClassification = 'Known' | 'Inferred' | 'Speculative';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type HypothesisStatus = 'leading' | 'plausible' | 'contested' | 'weak' | 'user_added';
export type RelationshipType = 'SUPPORTS' | 'CONTRADICTS' | 'RELATED_TO' | 'DERIVED_FROM';
export type SourceQualityTier = 'Strong' | 'Moderate' | 'Caution';
export type SearchMode = 'live_grounding' | 'external_search' | 'demo' | 'unavailable';

export type SourceType =
  | 'Primary Source'
  | 'Official Documentation'
  | 'Government'
  | 'Academic Paper'
  | 'University'
  | 'Research Organization'
  | 'Journalism'
  | 'Specialist Publication'
  | 'Web Article';

export interface SourceQualityFactor {
  factor: string;
  assessment: string;
}

export interface Source {
  id: string;
  citationIndex: number;
  title: string;
  url: string;
  domain: string;
  publishedDate?: string;
  sourceType: SourceType;
  excerpt: string;
  whyItMatters: string;
  qualityTier: SourceQualityTier;
  qualityFactors: SourceQualityFactor[];
  supportedClaimIds: string[];
  contradictedClaimIds: string[];
}

export interface Claim {
  id: string;
  text: string;
  classification: ClaimClassification;
  confidence: ConfidenceLevel;
  hypothesisIds: string[];
  supportingSourceIds: string[];
  contradictingSourceIds: string[];
  reasoning: string;
  uncertainty: string;
  lastVerified?: string;
}

export interface Hypothesis {
  id: string;
  title: string;
  summary: string;
  status: HypothesisStatus;
  confidence: ConfidenceLevel;
  supportingClaimIds: string[];
  contradictingClaimIds: string[];
  isUserAdded?: boolean;
}

export interface Contradiction {
  id: string;
  topic: string;
  sourceAId: string;
  claimAText: string;
  sourceBId: string;
  claimBText: string;
  disagreementSummary: string;
  possibleReasons: string[];
}

export interface Relationship {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: RelationshipType;
  label?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  actionType?: string;
}

export interface Investigation {
  id: string;
  title: string;
  question: string;
  status: 'investigating' | 'complete' | 'error';
  isDemo: boolean;
  isSaved: boolean;
  searchMode: SearchMode;
  searchNotice?: string;
  createdAt: string;
  updatedAt: string;
  subQuestions: string[];
  hypotheses: Hypothesis[];
  claims: Claim[];
  sources: Source[];
  contradictions: Contradiction[];
  uncertainties: string[];
  relationships: Relationship[];
  messages: ChatMessage[];
  followUpSuggestions: string[];
  conclusion: string;
}

export interface InvestigationSummary {
  id: string;
  title: string;
  question: string;
  status: 'investigating' | 'complete' | 'error';
  isDemo: boolean;
  isSaved: boolean;
  searchMode: SearchMode;
  updatedAt: string;
  sourceCount: number;
  hypothesisCount: number;
  claimCount: number;
  contradictionCount: number;
}

export interface GraphNodePosition {
  id: string;
  kind: 'question' | 'hypothesis' | 'claim' | 'source';
  label: string;
  sublabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: string;
  classification?: ClaimClassification;
  confidence?: ConfidenceLevel;
  qualityTier?: SourceQualityTier;
}

export interface GraphEdgeLayout {
  id: string;
  from: GraphNodePosition;
  to: GraphNodePosition;
  type: RelationshipType;
}

export interface GraphLayoutResult {
  nodes: GraphNodePosition[];
  edges: GraphEdgeLayout[];
  width: number;
  height: number;
}

export interface RawRetrievedSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  queryUsed?: string;
}
