import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroundedInvestigationArtifacts,
  computeGraphLayout,
  deduplicateAndRankSources,
  evaluateSourceAuthority,
  filterInvestigations,
  formatRelativeTime,
  sanitizeExternalUrl,
} from './investigationLogic';
import type { InvestigationSummary, RawRetrievedSource } from '../types/investigation';

test('sanitizeExternalUrl allows http/https and rejects unsafe schemes', () => {
  assert.equal(sanitizeExternalUrl('https://nature.com/articles/123'), 'https://nature.com/articles/123');
  assert.equal(sanitizeExternalUrl('http://example.org/data'), 'http://example.org/data');
  assert.equal(sanitizeExternalUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeExternalUrl('not-a-url'), null);
  assert.equal(sanitizeExternalUrl(''), null);
});

test('deduplicateAndRankSources removes duplicates and prioritizes primary/academic sources over blogs', () => {
  const raw: RawRetrievedSource[] = [
    { id: '1', title: 'My Blog on Batteries', url: 'https://medium.com/my-blog-batteries', snippet: 'Opinion piece' },
    { id: '2', title: 'IEA Global EV Outlook', url: 'https://www.iea.org/reports/global-ev-outlook', snippet: 'Official statistics on lithium-ion pack prices dropping to $115/kWh.' },
    { id: '3', title: 'IEA Global EV Outlook Duplicate', url: 'https://www.iea.org/reports/global-ev-outlook/#section-2', snippet: 'Duplicate anchor' },
    { id: '4', title: 'Battery Chemistry Cost Paper', url: 'https://arxiv.org/abs/2501.01234', snippet: 'Peer-reviewed study on LFP cell manufacturing yields.' },
    { id: '5', title: 'Bad JS URL', url: 'javascript:void(0)', snippet: 'Should be rejected' },
  ];

  const ranked = deduplicateAndRankSources(raw, 10);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].id, 'S1');
  assert.ok(ranked[0].url.includes('iea.org'), 'Government/intergovernmental source should rank first');
  assert.ok(ranked[1].url.includes('arxiv.org'), 'Academic source should rank second');
  assert.ok(ranked[2].url.includes('medium.com'), 'Blog should rank lowest');
});

test('evaluateSourceAuthority explains quality factors transparently without fabricated scores', () => {
  const gov = evaluateSourceAuthority('https://www.nih.gov/research/study', 'NIH Clinical Trial', '2025-04');
  assert.equal(gov.qualityTier, 'Strong');
  assert.equal(gov.sourceType, 'Government');
  assert.ok(gov.qualityFactors.length >= 2);

  const blog = evaluateSourceAuthority('https://reddit.com/r/science/post', 'Discussion thread');
  assert.equal(blog.qualityTier, 'Caution');
});

test('buildGroundedInvestigationArtifacts strips phantom source IDs and downgrades unsupported Known claims', () => {
  const retrieved: RawRetrievedSource[] = [
    { id: 'S1', title: 'Official Energy Report', url: 'https://www.iea.org/report', snippet: 'Pack prices fell 14%.' },
    { id: 'S2', title: 'Industry Analysis', url: 'https://www.reuters.com/ev-prices', snippet: 'Tariffs keep retail prices elevated.' },
  ];

  const grounded = buildGroundedInvestigationArtifacts('Why are EV prices still high?', retrieved, {
    title: 'EV Retail Pricing Factors',
    hypotheses: [
      { id: 'H1', title: 'Battery pack costs remain significant', summary: 'Cell costs dropped but remain a major share.', status: 'leading', confidence: 'High' },
      { id: 'H2', title: 'Tariffs and trim mix offset cell savings', summary: 'Automakers prioritize higher-margin trims.', status: 'plausible', confidence: 'Medium' },
    ],
    claims: [
      {
        id: 'C1',
        text: 'Pack prices fell 14% year over year.',
        classification: 'Known',
        confidence: 'High',
        hypothesisIds: ['H1'],
        supportingSourceIds: ['S1', 'S999'], // S999 is fabricated and must be stripped
        contradictingSourceIds: [],
      },
      {
        id: 'C2',
        text: 'Unverified rumor about secret subsidies.',
        classification: 'Known',
        confidence: 'High',
        hypothesisIds: ['H2'],
        supportingSourceIds: ['S404'], // completely fabricated source
        contradictingSourceIds: [],
      },
    ],
    contradictions: [
      {
        topic: 'Pass-through timing',
        sourceAId: 'S1',
        claimAText: 'Lower pack costs rapidly cut retail prices.',
        sourceBId: 'S2',
        claimBText: 'Tariffs delay retail price cuts.',
        disagreementSummary: 'Disagreement on retail pass-through speed.',
        possibleReasons: ['Regional tariff differences'],
      },
      {
        topic: 'Phantom contradiction',
        sourceAId: 'S1',
        claimAText: 'Valid',
        sourceBId: 'S999', // invalid source -> must be dropped
        claimBText: 'Fabricated',
        disagreementSummary: 'Should be filtered out',
      },
    ],
  });

  assert.equal(grounded.sources.length, 2);
  assert.deepEqual(grounded.claims[0].supportingSourceIds, ['S1']);
  assert.equal(grounded.claims[0].classification, 'Known');

  // Claim 2 had only phantom source S404 -> must be stripped & downgraded from Known/High
  assert.deepEqual(grounded.claims[1].supportingSourceIds, []);
  assert.equal(grounded.claims[1].classification, 'Inferred');
  assert.equal(grounded.claims[1].confidence, 'Medium');

  // Phantom contradiction referencing S999 must be dropped
  assert.equal(grounded.contradictions.length, 1);
  assert.equal(grounded.contradictions[0].topic, 'Pass-through timing');

  // Canonical graph relationships should be populated
  assert.ok(grounded.relationships.some((r) => r.sourceNodeId === 'S1' && r.targetNodeId === 'C1' && r.type === 'SUPPORTS'));
  assert.ok(grounded.relationships.some((r) => r.sourceNodeId === 'S1' && r.targetNodeId === 'S2' && r.type === 'CONTRADICTS'));
});

test('computeGraphLayout places nodes in non-overlapping horizontal tiers and supports edge filtering', () => {
  const retrieved: RawRetrievedSource[] = [
    { id: 'S1', title: 'Source One', url: 'https://nature.com/1', snippet: 'A' },
    { id: 'S2', title: 'Source Two', url: 'https://reuters.com/2', snippet: 'B' },
  ];
  const artifacts = buildGroundedInvestigationArtifacts('Test Question?', retrieved, {
    hypotheses: [
      { id: 'H1', title: 'Hyp A', summary: 'A', status: 'leading', confidence: 'High' },
      { id: 'H2', title: 'Hyp B', summary: 'B', status: 'contested', confidence: 'Medium' },
    ],
    claims: [
      { id: 'C1', text: 'Claim A', classification: 'Known', confidence: 'High', hypothesisIds: ['H1'], supportingSourceIds: ['S1'], contradictingSourceIds: ['S2'] },
    ],
  });

  const allLayout = computeGraphLayout({ question: 'Test Question?', ...artifacts }, 'ALL');
  assert.equal(allLayout.nodes.length, 6); // ROOT + 2H + 1C + 2S
  assert.ok(allLayout.edges.length >= 4);

  // Verify no two nodes in the same tier overlap horizontally
  const hyps = allLayout.nodes.filter((n) => n.kind === 'hypothesis');
  assert.ok(hyps[0].x + hyps[0].width < hyps[1].x, 'Hypotheses must not overlap horizontally');

  // Filter strictly for CONTRADICTS edges
  const contradictsOnly = computeGraphLayout({ question: 'Test Question?', ...artifacts }, 'CONTRADICTS');
  assert.ok(contradictsOnly.edges.every((e) => e.type === 'CONTRADICTS'));
  assert.ok(contradictsOnly.edges.length >= 1);
});

test('filterInvestigations and formatRelativeTime behave accurately', () => {
  const now = Date.parse('2026-11-25T12:00:00.000Z');
  assert.equal(formatRelativeTime('2026-11-25T11:59:30.000Z', now), 'Just now');
  assert.equal(formatRelativeTime('2026-11-25T11:45:00.000Z', now), '15m ago');
  assert.equal(formatRelativeTime('2026-11-25T09:00:00.000Z', now), '3h ago');

  const items: InvestigationSummary[] = [
    {
      id: '1',
      title: 'Why EV battery prices fell',
      question: 'Why are EV battery prices falling?',
      status: 'complete',
      isDemo: false,
      isSaved: true,
      searchMode: 'live_grounding',
      updatedAt: '2026-11-25T10:00:00.000Z',
      sourceCount: 10,
      hypothesisCount: 4,
      claimCount: 8,
      contradictionCount: 1,
    },
    {
      id: '2',
      title: 'Model X Dataset Y failure',
      question: 'Why does Model X fail on Dataset Y?',
      status: 'complete',
      isDemo: true,
      isSaved: false,
      searchMode: 'demo',
      updatedAt: '2026-11-25T08:00:00.000Z',
      sourceCount: 6,
      hypothesisCount: 4,
      claimCount: 7,
      contradictionCount: 2,
    },
  ];

  assert.equal(filterInvestigations(items, 'battery', false).length, 1);
  assert.equal(filterInvestigations(items, '', true).length, 1);
  assert.equal(filterInvestigations(items, 'model', true).length, 0);
});
