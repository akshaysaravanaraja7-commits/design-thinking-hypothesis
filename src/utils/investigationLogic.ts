import type {
  Claim,
  ClaimClassification,
  ConfidenceLevel,
  Contradiction,
  GraphEdgeLayout,
  GraphLayoutResult,
  GraphNodePosition,
  Hypothesis,
  HypothesisStatus,
  Investigation,
  InvestigationSummary,
  RawRetrievedSource,
  Relationship,
  RelationshipType,
  Source,
  SourceQualityFactor,
  SourceQualityTier,
  SourceType,
} from '../types/investigation';

/**
 * Strictly validates external URLs to allow only http: and https: schemes.
 * Returns null for javascript:, data:, file:, or malformed URLs.
 */
export function sanitizeExternalUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

const GOVERNMENT_PATTERNS = [/\.gov(\.[a-z]{2})?$/i, /\.mil$/i, /europa\.eu$/i, /who\.int$/i, /un\.org$/i, /worldbank\.org$/i, /imf\.org$/i, /oecd\.org$/i, /iea\.org$/i, /federalreserve\.gov$/i, /bls\.gov$/i, /nih\.gov$/i, /cdc\.gov$/i];
const ACADEMIC_PATTERNS = [/\.edu(\.[a-z]{2})?$/i, /\.ac\.[a-z]{2}$/i, /arxiv\.org$/i, /nature\.com$/i, /science\.org$/i, /thelancet\.com$/i, /nejm\.org$/i, /pubmed\.ncbi\.nlm\.nih\.gov$/i, /ieee\.org$/i, /acm\.org$/i, /springer\.com$/i, /sciencedirect\.com$/i, /jstor\.org$/i, /plos\.org$/i, /biorxiv\.org$/i, /ssrn\.com$/i, /nber\.org$/i];
const RESEARCH_ORG_PATTERNS = [/pewresearch\.org$/i, /brookings\.edu$/i, /rand\.org$/i, /bnef\.com$/i, /bloombergnef\.com$/i, /ourworldindata\.org$/i, /rmi\.org$/i, /ipcc\.ch$/i, /nasa\.gov$/i, /noaa\.gov$/i, /mckinsey\.com$/i, /gartner\.com$/i, /mit\.edu$/i, /stanford\.edu$/i];
const OFFICIAL_DOC_PATTERNS = [/^docs\./i, /developer\./i, /github\.com$/i, /rfc-editor\.org$/i, /w3\.org$/i, /sec\.gov$/i, /investor\./i];
const JOURNALISM_PATTERNS = [/reuters\.com$/i, /apnews\.com$/i, /ft\.com$/i, /economist\.com$/i, /wsj\.com$/i, /nytimes\.com$/i, /bloomberg\.com$/i, /bbc\.(com|co\.uk)$/i, /theguardian\.com$/i, /washingtonpost\.com$/i, /arstechnica\.com$/i, /wired\.com$/i, /quantamagazine\.org$/i, /scientificamerican\.com$/i, /technologyreview\.com$/i];
const LOW_AUTHORITY_PATTERNS = [/medium\.com$/i, /quora\.com$/i, /reddit\.com$/i, /pinterest\./i, /facebook\.com$/i, /twitter\.com$/i, /x\.com$/i, /linkedin\.com$/i, /blogspot\./i, /wordpress\.com$/i, /substack\.com$/i];

export interface SourceAuthorityAssessment {
  sourceType: SourceType;
  qualityTier: SourceQualityTier;
  rankWeight: number;
  qualityFactors: SourceQualityFactor[];
}

/**
 * Transparent, explainable source authority classification.
 * Never invents an opaque numerical trust score; instead explains concrete factors.
 */
export function evaluateSourceAuthority(
  url: string,
  title: string,
  publishedDate?: string
): SourceAuthorityAssessment {
  const domain = extractDomain(url);
  const factors: SourceQualityFactor[] = [];
  let sourceType: SourceType = 'Web Article';
  let qualityTier: SourceQualityTier = 'Moderate';
  let rankWeight = 50;

  if (ACADEMIC_PATTERNS.some((p) => p.test(domain))) {
    sourceType = /\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$/i.test(domain)
      ? 'University'
      : 'Academic Paper';
    qualityTier = 'Strong';
    rankWeight = 92;
    factors.push(
      { factor: 'Primary / Academic', assessment: 'Peer-reviewed journal, preprint archive, or university research domain' },
      { factor: 'Methodology', assessment: 'Typically reports explicit study design, datasets, and limitations' }
    );
  } else if (GOVERNMENT_PATTERNS.some((p) => p.test(domain))) {
    sourceType = 'Government';
    qualityTier = 'Strong';
    rankWeight = 94;
    factors.push(
      { factor: 'Primary Authority', assessment: 'Official public agency, intergovernmental body, or statistical bureau' },
      { factor: 'Verification', assessment: 'Published datasets and official regulatory filings are directly auditable' }
    );
  } else if (OFFICIAL_DOC_PATTERNS.some((p) => p.test(domain))) {
    sourceType = 'Official Documentation';
    qualityTier = 'Strong';
    rankWeight = 88;
    factors.push(
      { factor: 'Primary Source', assessment: 'Direct technical documentation, standard, or primary filing' },
      { factor: 'Potential Bias', assessment: 'Authoritative for specifications; check independent benchmarks for performance claims' }
    );
  } else if (RESEARCH_ORG_PATTERNS.some((p) => p.test(domain))) {
    sourceType = 'Research Organization';
    qualityTier = 'Strong';
    rankWeight = 86;
    factors.push(
      { factor: 'Authority', assessment: 'Established policy, market, or scientific research institute' },
      { factor: 'Corroboration', assessment: 'Synthesizes longitudinal datasets; cross-check assumptions against primary data' }
    );
  } else if (JOURNALISM_PATTERNS.some((p) => p.test(domain))) {
    sourceType = 'Journalism';
    qualityTier = 'Moderate';
    rankWeight = 76;
    factors.push(
      { factor: 'Editorial Standards', assessment: 'Established newsroom or specialist science/tech publication with editorial review' },
      { factor: 'Primary vs Secondary', assessment: 'Secondary reporting; strongest when corroborated by underlying primary data' }
    );
  } else if (LOW_AUTHORITY_PATTERNS.some((p) => p.test(domain))) {
    sourceType = 'Web Article';
    qualityTier = 'Caution';
    rankWeight = 28;
    factors.push(
      { factor: 'Verification Caution', assessment: 'Self-published blog, forum, or community post without formal peer review' },
      { factor: 'Potential Bias', assessment: 'Treat claims as hypotheses to verify against primary or institutional evidence' }
    );
  } else {
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('report') || lowerTitle.includes('study') || lowerTitle.includes('analysis') || lowerTitle.includes('benchmark')) {
      sourceType = 'Specialist Publication';
      qualityTier = 'Moderate';
      rankWeight = 64;
      factors.push(
        { factor: 'Specificity', assessment: 'Domain-focused analysis or industry report' },
        { factor: 'Verification', assessment: 'Secondary or specialist source; evaluate methodology and potential commercial bias' }
      );
    } else {
      factors.push(
        { factor: 'Source Type', assessment: 'General web publication with unverified editorial process' },
        { factor: 'Corroboration', assessment: 'Requires cross-checking with independent primary sources' }
      );
    }
  }

  if (publishedDate) {
    factors.push({
      factor: 'Publication Date',
      assessment: `Dated ${publishedDate} — check whether newer figures supersede this snapshot`,
    });
  } else {
    factors.push({
      factor: 'Recency',
      assessment: 'Publication date not explicitly exposed in metadata; verify timeliness before relying on time-sensitive numbers',
    });
  }

  return { sourceType, qualityTier, rankWeight, qualityFactors: factors };
}

/**
 * Deduplicates retrieved web sources by normalized URL (and near-duplicate domain+title),
 * then ranks higher-authority sources first and caps to maxSources (default 15).
 */
export function deduplicateAndRankSources(
  rawSources: RawRetrievedSource[],
  maxSources = 15
): RawRetrievedSource[] {
  const seenUrl = new Set<string>();
  const seenDomainTitle = new Set<string>();
  const unique: Array<{ source: RawRetrievedSource; weight: number }> = [];

  for (const item of rawSources) {
    const safeUrl = sanitizeExternalUrl(item.url);
    if (!safeUrl) continue;

    const normalizedUrl = safeUrl.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
    if (seenUrl.has(normalizedUrl)) continue;

    const domain = extractDomain(safeUrl);
    const normalizedTitle = (item.title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    const domainTitleKey = `${domain}::${normalizedTitle.slice(0, 60)}`;
    if (normalizedTitle.length > 8 && seenDomainTitle.has(domainTitleKey)) continue;

    seenUrl.add(normalizedUrl);
    if (normalizedTitle.length > 8) seenDomainTitle.add(domainTitleKey);

    const authority = evaluateSourceAuthority(safeUrl, item.title, item.publishedDate);
    unique.push({
      source: {
        ...item,
        url: safeUrl,
        title: (item.title || domain).trim(),
        snippet: (item.snippet || '').trim(),
      },
      weight: authority.rankWeight + (item.snippet.length > 80 ? 5 : 0),
    });
  }

  unique.sort((a, b) => b.weight - a.weight);

  // Assign deterministic sequential IDs S1..Sn
  return unique.slice(0, maxSources).map((entry, idx) => ({
    ...entry.source,
    id: `S${idx + 1}`,
  }));
}

function normalizeClassification(val: string | undefined): ClaimClassification {
  if (val === 'Known' || val === 'Inferred' || val === 'Speculative') return val;
  const lower = (val || '').toLowerCase();
  if (lower.includes('known') || lower.includes('fact') || lower.includes('verified')) return 'Known';
  if (lower.includes('specul')) return 'Speculative';
  return 'Inferred';
}

function normalizeConfidence(val: string | undefined): ConfidenceLevel {
  if (val === 'High' || val === 'Medium' || val === 'Low') return val;
  const lower = (val || '').toLowerCase();
  if (lower.includes('high')) return 'High';
  if (lower.includes('low')) return 'Low';
  return 'Medium';
}

function normalizeHypothesisStatus(val: string | undefined): HypothesisStatus {
  if (val === 'leading' || val === 'plausible' || val === 'contested' || val === 'weak' || val === 'user_added') {
    return val;
  }
  const lower = (val || '').toLowerCase();
  if (lower.includes('lead') || lower.includes('strong')) return 'leading';
  if (lower.includes('contest') || lower.includes('conflict')) return 'contested';
  if (lower.includes('weak') || lower.includes('unlikely')) return 'weak';
  return 'plausible';
}

export interface RawAiSynthesisPayload {
  title?: string;
  subQuestions?: string[];
  hypotheses?: Array<{
    id?: string;
    title: string;
    summary: string;
    status?: string;
    confidence?: string;
  }>;
  claims?: Array<{
    id?: string;
    text: string;
    classification?: string;
    confidence?: string;
    hypothesisIds?: string[];
    supportingSourceIds?: string[];
    contradictingSourceIds?: string[];
    reasoning?: string;
    uncertainty?: string;
  }>;
  sourceNotes?: Array<{
    sourceId: string;
    whyItMatters?: string;
    excerpt?: string;
    publishedDate?: string;
  }>;
  contradictions?: Array<{
    id?: string;
    topic: string;
    sourceAId: string;
    claimAText: string;
    sourceBId: string;
    claimBText: string;
    disagreementSummary: string;
    possibleReasons?: string[];
  }>;
  uncertainties?: string[];
  followUpSuggestions?: string[];
  conclusion?: string;
}

/**
 * Anti-hallucination validator & graph builder.
 * Strictly binds all claims, contradictions, and source cards to the actually retrieved sources.
 * Never fabricates source URLs or retains phantom citations.
 */
export function buildGroundedInvestigationArtifacts(
  question: string,
  retrievedSources: RawRetrievedSource[],
  rawAi: RawAiSynthesisPayload
): Pick<
  Investigation,
  | 'title'
  | 'subQuestions'
  | 'hypotheses'
  | 'claims'
  | 'sources'
  | 'contradictions'
  | 'uncertainties'
  | 'relationships'
  | 'followUpSuggestions'
  | 'conclusion'
> {
  const validSourceIds = new Set(retrievedSources.map((s) => s.id));
  const noteBySourceId = new Map(
    (rawAi.sourceNotes || []).map((n) => [n.sourceId, n])
  );

  // 1. Build grounded Source objects strictly from retrievedSources
  const sources: Source[] = retrievedSources.map((raw, idx) => {
    const note = noteBySourceId.get(raw.id);
    const publishedDate = note?.publishedDate || raw.publishedDate;
    const authority = evaluateSourceAuthority(raw.url, raw.title, publishedDate);
    return {
      id: raw.id,
      citationIndex: idx + 1,
      title: raw.title,
      url: raw.url,
      domain: extractDomain(raw.url),
      publishedDate,
      sourceType: authority.sourceType,
      excerpt: (note?.excerpt || raw.snippet || 'Retrieved passage used during cross-source analysis.').trim(),
      whyItMatters: (note?.whyItMatters || `Provides ${authority.sourceType.toLowerCase()} context relevant to the investigation.`).trim(),
      qualityTier: authority.qualityTier,
      qualityFactors: authority.qualityFactors,
      supportedClaimIds: [],
      contradictedClaimIds: [],
    };
  });

  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  // 2. Build Hypotheses
  const hypotheses: Hypothesis[] = (rawAi.hypotheses || []).slice(0, 6).map((h, idx) => ({
    id: h.id && /^H\d+$/i.test(h.id) ? h.id.toUpperCase() : `H${idx + 1}`,
    title: (h.title || `Hypothesis ${idx + 1}`).trim(),
    summary: (h.summary || '').trim(),
    status: normalizeHypothesisStatus(h.status),
    confidence: normalizeConfidence(h.confidence),
    supportingClaimIds: [],
    contradictingClaimIds: [],
  }));

  const validHypothesisIds = new Set(hypotheses.map((h) => h.id));

  // 3. Build Claims strictly referencing valid retrieved sources & valid hypotheses
  const verifiedDate = new Date().toISOString().slice(0, 10);
  const claims: Claim[] = (rawAi.claims || []).slice(0, 14).map((c, idx) => {
    const id = c.id && /^C\d+$/i.test(c.id) ? c.id.toUpperCase() : `C${idx + 1}`;
    const supportingSourceIds = Array.from(
      new Set((c.supportingSourceIds || []).filter((sid) => validSourceIds.has(sid)))
    );
    const contradictingSourceIds = Array.from(
      new Set((c.contradictingSourceIds || []).filter((sid) => validSourceIds.has(sid)))
    );
    const hypothesisIds = Array.from(
      new Set((c.hypothesisIds || []).filter((hid) => validHypothesisIds.has(hid)))
    );
    if (hypothesisIds.length === 0 && hypotheses.length > 0) {
      hypothesisIds.push(hypotheses[0].id);
    }

    // Downgrade classification if claiming "Known" without any verified supporting source
    let classification = normalizeClassification(c.classification);
    let confidence = normalizeConfidence(c.confidence);
    if (supportingSourceIds.length === 0 && classification === 'Known') {
      classification = 'Inferred';
      if (confidence === 'High') confidence = 'Medium';
    }

    return {
      id,
      text: (c.text || '').trim(),
      classification,
      confidence,
      hypothesisIds,
      supportingSourceIds,
      contradictingSourceIds,
      reasoning: (c.reasoning || 'Evaluated against retrieved sources during synthesis.').trim(),
      uncertainty: (
        c.uncertainty ||
        (supportingSourceIds.length === 0
          ? 'Not directly verified by an independent retrieved source in this pass.'
          : 'Dependent on the scope and recency of cited sources.')
      ).trim(),
      lastVerified: supportingSourceIds.length > 0 ? verifiedDate : undefined,
    };
  }).filter((c) => c.text.length > 0);

  // Back-populate links on Sources and Hypotheses
  for (const claim of claims) {
    for (const sid of claim.supportingSourceIds) {
      const s = sourceMap.get(sid);
      if (s && !s.supportedClaimIds.includes(claim.id)) {
        s.supportedClaimIds.push(claim.id);
      }
    }
    for (const sid of claim.contradictingSourceIds) {
      const s = sourceMap.get(sid);
      if (s && !s.contradictedClaimIds.includes(claim.id)) {
        s.contradictedClaimIds.push(claim.id);
      }
    }
    for (const hid of claim.hypothesisIds) {
      const h = hypotheses.find((item) => item.id === hid);
      if (!h) continue;
      if (claim.contradictingSourceIds.length > claim.supportingSourceIds.length) {
        if (!h.contradictingClaimIds.includes(claim.id)) {
          h.contradictingClaimIds.push(claim.id);
        }
      } else if (!h.supportingClaimIds.includes(claim.id)) {
        h.supportingClaimIds.push(claim.id);
      }
    }
  }

  // 4. Validate Contradictions (both sources must exist in retrievedSources!)
  const contradictions: Contradiction[] = (rawAi.contradictions || [])
    .filter(
      (ct) =>
        ct &&
        validSourceIds.has(ct.sourceAId) &&
        validSourceIds.has(ct.sourceBId) &&
        ct.sourceAId !== ct.sourceBId
    )
    .slice(0, 6)
    .map((ct, idx) => ({
      id: ct.id || `X${idx + 1}`,
      topic: (ct.topic || 'Conflicting evidence').trim(),
      sourceAId: ct.sourceAId,
      claimAText: (ct.claimAText || '').trim(),
      sourceBId: ct.sourceBId,
      claimBText: (ct.claimBText || '').trim(),
      disagreementSummary: (ct.disagreementSummary || '').trim(),
      possibleReasons: (ct.possibleReasons || ['Different methodologies or time periods']).slice(0, 5),
    }));

  // 5. Build canonical Relationship graph edges
  const relationships = buildRelationshipsFromState(hypotheses, claims, contradictions);

  return {
    title: (rawAi.title || question.slice(0, 72)).trim(),
    subQuestions: (rawAi.subQuestions || []).filter(Boolean).slice(0, 5),
    hypotheses,
    claims,
    sources,
    contradictions,
    uncertainties: (rawAi.uncertainties || []).filter(Boolean).slice(0, 6),
    relationships,
    followUpSuggestions: (rawAi.followUpSuggestions || [
      'Find opposing evidence',
      'Which claim is weakest?',
      'Compare the strongest sources',
      'Find primary sources',
    ])
      .filter(Boolean)
      .slice(0, 5),
    conclusion: (rawAi.conclusion || '').trim(),
  };
}

export function buildRelationshipsFromState(
  hypotheses: Hypothesis[],
  claims: Claim[],
  contradictions: Contradiction[]
): Relationship[] {
  const relationships: Relationship[] = [];
  const seen = new Set<string>();

  const pushEdge = (sourceNodeId: string, targetNodeId: string, type: RelationshipType, label?: string) => {
    const key = `${sourceNodeId}->${targetNodeId}:${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    relationships.push({
      id: `R-${relationships.length + 1}`,
      sourceNodeId,
      targetNodeId,
      type,
      label,
    });
  };

  for (const h of hypotheses) {
    pushEdge(h.id, 'ROOT', 'DERIVED_FROM', 'explores');
  }

  for (const c of claims) {
    for (const hid of c.hypothesisIds) {
      const isMostlyContradicted =
        c.contradictingSourceIds.length > 0 &&
        c.contradictingSourceIds.length >= c.supportingSourceIds.length;
      pushEdge(c.id, hid, isMostlyContradicted ? 'CONTRADICTS' : 'SUPPORTS');
    }
    for (const sid of c.supportingSourceIds) {
      pushEdge(sid, c.id, 'SUPPORTS');
    }
    for (const sid of c.contradictingSourceIds) {
      pushEdge(sid, c.id, 'CONTRADICTS');
    }
  }

  for (const ct of contradictions) {
    pushEdge(ct.sourceAId, ct.sourceBId, 'CONTRADICTS', ct.topic);
  }

  return relationships;
}

/**
 * Computes a deterministic, non-overlapping 4-tier layered layout for the Investigation Graph:
 * Tier 0 (top): Root Question
 * Tier 1: Competing Hypotheses
 * Tier 2: Claims
 * Tier 3 (bottom): Retrieved Sources
 */
export function computeGraphLayout(
  investigation: Pick<Investigation, 'question' | 'hypotheses' | 'claims' | 'sources' | 'relationships'>,
  edgeFilter: 'ALL' | 'SUPPORTS' | 'CONTRADICTS' = 'ALL'
): GraphLayoutResult {
  const nodes: GraphNodePosition[] = [];
  const nodeMap = new Map<string, GraphNodePosition>();

  const hypCount = Math.max(1, investigation.hypotheses.length);
  const claimCount = Math.max(1, investigation.claims.length);
  const sourceCount = Math.max(1, Math.min(investigation.sources.length, 10));

  const maxRowItems = Math.max(hypCount, claimCount, sourceCount);
  const canvasWidth = Math.max(840, maxRowItems * 188 + 110);

  // Tier 0: Root Question
  const rootWidth = 320;
  const rootHeight = 68;
  const rootNode: GraphNodePosition = {
    id: 'ROOT',
    kind: 'question',
    label: truncateLabel(investigation.question, 74),
    sublabel: 'Root Question',
    x: (canvasWidth - rootWidth) / 2,
    y: 28,
    width: rootWidth,
    height: rootHeight,
  };
  nodes.push(rootNode);
  nodeMap.set(rootNode.id, rootNode);

  // Helper to place a horizontal row centered cleanly
  const placeRow = <T>(
    items: T[],
    y: number,
    cardW: number,
    cardH: number,
    gap: number,
    mapper: (item: T, x: number, y: number, w: number, h: number) => GraphNodePosition
  ) => {
    if (items.length === 0) return;
    const totalW = items.length * cardW + (items.length - 1) * gap;
    const startX = Math.max(76, (canvasWidth - totalW) / 2);
    items.forEach((item, index) => {
      const x = startX + index * (cardW + gap);
      const node = mapper(item, x, y, cardW, cardH);
      nodes.push(node);
      nodeMap.set(node.id, node);
    });
  };

  // Tier 1: Hypotheses
  placeRow(investigation.hypotheses, 152, 186, 74, 20, (h, x, y, w, hgt) => ({
    id: h.id,
    kind: 'hypothesis',
    label: truncateLabel(h.title, 44),
    sublabel: `${h.status.replace('_', ' ')} · ${h.confidence}`,
    x,
    y,
    width: w,
    height: hgt,
    status: h.status,
    confidence: h.confidence,
  }));

  // Tier 2: Claims
  const visibleClaims = investigation.claims.slice(0, 10);
  placeRow(visibleClaims, 300, 172, 78, 16, (c, x, y, w, hgt) => ({
    id: c.id,
    kind: 'claim',
    label: truncateLabel(c.text, 50),
    sublabel: `${c.classification} · ${c.confidence}`,
    x,
    y,
    width: w,
    height: hgt,
    classification: c.classification,
    confidence: c.confidence,
  }));

  // Tier 3: Sources (prioritize those connected to claims)
  const visibleSources = investigation.sources.slice(0, 10);
  placeRow(visibleSources, 456, 168, 66, 16, (s, x, y, w, hgt) => ({
    id: s.id,
    kind: 'source',
    label: truncateLabel(s.title, 38),
    sublabel: `[${s.citationIndex}] ${s.domain}`,
    x,
    y,
    width: w,
    height: hgt,
    qualityTier: s.qualityTier,
  }));

  // Build edges
  const edges: GraphEdgeLayout[] = [];
  for (const rel of investigation.relationships) {
    if (edgeFilter !== 'ALL' && rel.type !== edgeFilter) continue;
    const from = nodeMap.get(rel.sourceNodeId);
    const to = nodeMap.get(rel.targetNodeId);
    if (!from || !to) continue;
    edges.push({
      id: rel.id,
      from,
      to,
      type: rel.type,
    });
  }

  return {
    nodes,
    edges,
    width: canvasWidth,
    height: 576,
  };
}

export function truncateLabel(text: string, maxLen: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

export function toInvestigationSummary(inv: Investigation): InvestigationSummary {
  return {
    id: inv.id,
    title: inv.title,
    question: inv.question,
    status: inv.status,
    isDemo: inv.isDemo,
    isSaved: inv.isSaved,
    searchMode: inv.searchMode,
    updatedAt: inv.updatedAt,
    sourceCount: inv.sources.length,
    hypothesisCount: inv.hypotheses.length,
    claimCount: inv.claims.length,
    contradictionCount: inv.contradictions.length,
  };
}

export function filterInvestigations(
  items: InvestigationSummary[],
  query: string,
  onlySaved: boolean
): InvestigationSummary[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (onlySaved && !item.isSaved) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.question.toLowerCase().includes(q)
    );
  });
}

export function formatRelativeTime(isoDate: string, nowMs = Date.now()): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return 'Recently';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
