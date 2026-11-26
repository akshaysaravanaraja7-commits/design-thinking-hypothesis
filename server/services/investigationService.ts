import crypto from 'node:crypto';
import type {
  ChatMessage,
  Hypothesis,
  Investigation,
  RawRetrievedSource,
} from '../../src/types/investigation';
import {
  buildGroundedInvestigationArtifacts,
  buildRelationshipsFromState,
  deduplicateAndRankSources,
} from '../../src/utils/investigationLogic';
import { classifyGeminiError, type GeminiErrorCode } from '../ai/geminiErrors';
import {
  buildFastResearchPlan,
  decideFollowUpStrategy,
  detectQuickIntent,
  streamConversationalConclusion,
  streamDirectChatReply,
  streamFollowUpReply,
  synthesizeStructuredInvestigation,
} from '../ai/geminiService';
import { investigationRepository } from '../repository/investigationRepository';
import { resolveSearchProvider } from '../search/searchProvider';

export type StreamEvent =
  | { type: 'progress'; stage: string }
  | { type: 'investigation'; investigation: Investigation }
  | { type: 'token'; text: string }
  | { type: 'done'; investigation: Investigation }
  | { type: 'error'; message: string; code?: GeminiErrorCode };

export type EventEmitter = (event: StreamEvent) => void;

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

export function toFriendlyError(err: unknown): {
  code: GeminiErrorCode;
  message: string;
} {
  const classified = classifyGeminiError(err);
  return {
    code: classified.code,
    message: classified.userMessage,
  };
}

export function toFriendlyErrorMessage(err: unknown): string {
  return toFriendlyError(err).message;
}

async function emitTextChunksSmoothly(text: string, emit: EventEmitter): Promise<void> {
  const words = text.split(/(\s+)/);
  let buffer = '';
  for (let i = 0; i < words.length; i++) {
    buffer += words[i];
    if (buffer.length >= 24 || i === words.length - 1) {
      emit({ type: 'token', text: buffer });
      buffer = '';
    }
  }
}

export async function createInvestigationRecord(question: string): Promise<Investigation> {
  const now = new Date().toISOString();
  const cleanQuestion = question.trim();
  const inv: Investigation = {
    id: makeId('inv'),
    title: cleanQuestion.length > 68 ? `${cleanQuestion.slice(0, 67)}…` : cleanQuestion,
    question: cleanQuestion,
    status: 'investigating',
    isDemo: false,
    isSaved: false,
    searchMode: 'live_grounding',
    createdAt: now,
    updatedAt: now,
    subQuestions: [],
    hypotheses: [],
    claims: [],
    sources: [],
    contradictions: [],
    uncertainties: [],
    relationships: [],
    messages: [
      {
        id: makeId('msg'),
        role: 'user',
        content: cleanQuestion,
        createdAt: now,
      },
    ],
    followUpSuggestions: [],
    conclusion: '',
  };
  return investigationRepository.save(inv);
}

export async function runFullInvestigation(
  investigationId: string,
  emit: EventEmitter,
  options?: { directive?: string; extraQueries?: string[]; regenerateOnly?: boolean }
): Promise<Investigation> {
  const existing = await investigationRepository.getById(investigationId);
  if (!existing) {
    throw new Error('INVESTIGATION_NOT_FOUND');
  }

  let current: Investigation = { ...existing, status: 'investigating' };
  await investigationRepository.save(current);

  try {
    if (options?.regenerateOnly) {
      emit({ type: 'progress', stage: 'Writing answer...' });
      const streamed =
        current.sources.length > 0 || current.hypotheses.length > 0
          ? await streamConversationalConclusion(
              current,
              options.directive ||
                'Re-synthesize the conclusion with fresh clarity based strictly on collected evidence.',
              (token) => emit({ type: 'token', text: token })
            )
          : await streamDirectChatReply(current.question, current.messages, (token) =>
              emit({ type: 'token', text: token })
            );

      const assistantMessage: ChatMessage = {
        id: makeId('msg'),
        role: 'assistant',
        content: streamed,
        createdAt: new Date().toISOString(),
        actionType: 'regenerate',
      };

      current = await investigationRepository.save({
        ...current,
        status: 'complete',
        conclusion: streamed,
        messages: [...current.messages, assistantMessage],
      });
      emit({ type: 'done', investigation: current });
      return current;
    }

    emit({ type: 'progress', stage: 'Understanding question...' });
    const plan = buildFastResearchPlan(
      options?.directive ? `${current.question} (${options.directive})` : current.question
    );

    // MODE 1: NORMAL CHAT (1 Gemini streaming call — fast, natural, zero wasted quota)
    if (plan.mode === 'chat' && !options?.directive && !(options?.extraQueries?.length)) {
      emit({ type: 'progress', stage: 'Writing answer...' });
      const streamedText = await streamDirectChatReply(
        current.question,
        current.messages,
        (token) => emit({ type: 'token', text: token })
      );

      const assistantMessage: ChatMessage = {
        id: makeId('msg'),
        role: 'assistant',
        content: streamedText,
        createdAt: new Date().toISOString(),
      };

      const isGreeting = detectQuickIntent(current.question).isGreeting;
      const followUps = isGreeting
        ? []
        : [
            'Investigate this using reliable sources',
            'Give me the scientific reason',
            'Which difference is the most important?',
            'Challenge that conclusion',
          ];

      current = await investigationRepository.save({
        ...current,
        title: plan.title || current.title,
        status: 'complete',
        searchNotice: undefined,
        conclusion: streamedText,
        followUpSuggestions: followUps,
        messages: [...current.messages, assistantMessage],
      });

      emit({ type: 'done', investigation: current });
      return current;
    }

    // MODE 2: INVESTIGATION MODE (1 grounded search call + 1 synthesis call = 2 calls total!)
    emit({ type: 'progress', stage: 'Investigating...' });

    const queries = Array.from(
      new Set([...(options?.extraQueries || []), ...plan.searchQueries])
    ).slice(0, 2);

    let retrievedSources: RawRetrievedSource[] = current.isDemo
      ? []
      : current.sources.map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          snippet: s.excerpt,
          publishedDate: s.publishedDate,
        }));
    let groundedNotes: string[] = [];
    let searchMode = current.searchMode;
    let searchNotice: string | undefined;

    if (plan.needsWebResearch && queries.length > 0) {
      emit({ type: 'progress', stage: 'Checking sources...' });
      const searchProvider = resolveSearchProvider();
      const searchRes = await searchProvider.searchMultiQuery(queries, 12);
      searchMode = searchRes.mode;
      searchNotice = searchRes.notice;
      groundedNotes = searchRes.groundedNotes;

      const mergedRaw = [...retrievedSources, ...searchRes.sources];
      retrievedSources = deduplicateAndRankSources(mergedRaw, 15);
    }

    emit({ type: 'progress', stage: 'Comparing evidence...' });

    const aiPayload = await synthesizeStructuredInvestigation(
      current.question,
      plan,
      retrievedSources,
      groundedNotes,
      searchNotice,
      current.hypotheses
    );

    const grounded = buildGroundedInvestigationArtifacts(
      current.question,
      retrievedSources,
      aiPayload
    );

    const userAdded = current.hypotheses.filter(
      (h) =>
        h.isUserAdded &&
        !grounded.hypotheses.some(
          (gh) => gh.title.toLowerCase() === h.title.toLowerCase()
        )
    );
    const mergedHypotheses = [...grounded.hypotheses, ...userAdded];
    const relationships = buildRelationshipsFromState(
      mergedHypotheses,
      grounded.claims,
      grounded.contradictions
    );

    current = await investigationRepository.save({
      ...current,
      isDemo: false,
      title: grounded.title,
      searchMode,
      searchNotice,
      subQuestions: grounded.subQuestions.length > 0 ? grounded.subQuestions : plan.subQuestions,
      hypotheses: mergedHypotheses,
      claims: grounded.claims,
      sources: grounded.sources,
      contradictions: grounded.contradictions,
      uncertainties: grounded.uncertainties,
      relationships,
      followUpSuggestions: grounded.followUpSuggestions,
    });

    // Populate Research Tree, Graph, and Evidence immediately
    emit({ type: 'investigation', investigation: current });
    emit({ type: 'progress', stage: 'Writing answer...' });

    let finalConclusion = (grounded.conclusion || '').trim();
    if (finalConclusion.length >= 60) {
      await emitTextChunksSmoothly(finalConclusion, emit);
    } else {
      finalConclusion = await streamConversationalConclusion(
        current,
        options?.directive,
        (token) => emit({ type: 'token', text: token })
      );
    }

    const assistantMessage: ChatMessage = {
      id: makeId('msg'),
      role: 'assistant',
      content: finalConclusion,
      createdAt: new Date().toISOString(),
    };

    current = await investigationRepository.save({
      ...current,
      status: 'complete',
      conclusion: finalConclusion,
      messages: [...current.messages, assistantMessage],
    });

    emit({ type: 'done', investigation: current });
    return current;
  } catch (err) {
    await investigationRepository.save({
      ...current,
      status: 'error',
    });
    throw err;
  }
}

export async function handleFollowUpMessage(
  investigationId: string,
  userContent: string,
  emit: EventEmitter,
  actionType?: string
): Promise<Investigation> {
  const existing = await investigationRepository.getById(investigationId);
  if (!existing) {
    throw new Error('INVESTIGATION_NOT_FOUND');
  }

  const cleanMessage = userContent.trim();
  const userMessage: ChatMessage = {
    id: makeId('msg'),
    role: 'user',
    content: cleanMessage,
    createdAt: new Date().toISOString(),
    actionType,
  };

  let current = await investigationRepository.save({
    ...existing,
    messages: [...existing.messages, userMessage],
  });
  emit({ type: 'investigation', investigation: current });

  emit({ type: 'progress', stage: 'Understanding question...' });
  const strategy = decideFollowUpStrategy(current, cleanMessage, actionType);

  let extraNotes: string[] = [];
  let groundingNotice: string | undefined;

  if (strategy.needsNewSearch && !current.isDemo) {
    emit({ type: 'progress', stage: 'Checking sources...' });
    const provider = resolveSearchProvider();
    const queries =
      strategy.searchQueries.length > 0
        ? strategy.searchQueries
        : [`${current.question} ${cleanMessage}`];
    const searchRes = await provider.searchMultiQuery(queries, 8);
    extraNotes = searchRes.groundedNotes;
    groundingNotice = searchRes.notice;

    if (searchRes.sources.length > 0) {
      emit({ type: 'progress', stage: 'Comparing evidence...' });
      const mergedRaw: RawRetrievedSource[] = [
        ...current.sources.map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          snippet: s.excerpt,
          publishedDate: s.publishedDate,
        })),
        ...searchRes.sources,
      ];
      const deduped = deduplicateAndRankSources(mergedRaw, 15);
      const aiPayload = await synthesizeStructuredInvestigation(
        `${current.question} — Follow-up angle: ${cleanMessage}`,
        buildFastResearchPlan(current.question),
        deduped,
        extraNotes,
        searchRes.notice,
        current.hypotheses
      );

      const grounded = buildGroundedInvestigationArtifacts(
        current.question,
        deduped,
        aiPayload
      );
      const userAdded = current.hypotheses.filter(
        (h) =>
          h.isUserAdded &&
          !grounded.hypotheses.some(
            (gh) => gh.title.toLowerCase() === h.title.toLowerCase()
          )
      );
      const mergedHypotheses = [...grounded.hypotheses, ...userAdded];
      const relationships = buildRelationshipsFromState(
        mergedHypotheses,
        grounded.claims,
        grounded.contradictions
      );

      current = await investigationRepository.save({
        ...current,
        searchMode: searchRes.mode,
        searchNotice: searchRes.notice,
        hypotheses: mergedHypotheses,
        claims: grounded.claims,
        sources: grounded.sources,
        contradictions: grounded.contradictions,
        uncertainties: grounded.uncertainties,
        relationships,
        followUpSuggestions: grounded.followUpSuggestions,
      });
      emit({ type: 'investigation', investigation: current });
    } else if (searchRes.notice) {
      current = await investigationRepository.save({
        ...current,
        searchMode: searchRes.mode,
        searchNotice: searchRes.notice,
      });
      emit({ type: 'investigation', investigation: current });
    }
  }

  emit({ type: 'progress', stage: 'Writing answer...' });
  const reply = await streamFollowUpReply(
    current,
    cleanMessage,
    extraNotes,
    groundingNotice,
    (token) => emit({ type: 'token', text: token })
  );

  const assistantMessage: ChatMessage = {
    id: makeId('msg'),
    role: 'assistant',
    content: reply,
    createdAt: new Date().toISOString(),
    actionType,
  };

  current = await investigationRepository.save({
    ...current,
    status: 'complete',
    messages: [...current.messages, assistantMessage],
  });
  emit({ type: 'done', investigation: current });
  return current;
}

export async function addCustomHypothesis(
  investigationId: string,
  title: string,
  summary: string
): Promise<Investigation | null> {
  const existing = await investigationRepository.getById(investigationId);
  if (!existing) return null;

  const nextNum = existing.hypotheses.length + 1;
  const newHypothesis: Hypothesis = {
    id: `H${nextNum}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    title: title.trim(),
    summary: summary.trim() || 'User-proposed competing explanation to investigate.',
    status: 'user_added',
    confidence: 'Low',
    supportingClaimIds: [],
    contradictingClaimIds: [],
    isUserAdded: true,
  };

  const hypotheses = [...existing.hypotheses, newHypothesis];
  const relationships = buildRelationshipsFromState(
    hypotheses,
    existing.claims,
    existing.contradictions
  );

  return investigationRepository.save({
    ...existing,
    hypotheses,
    relationships,
  });
}

export async function removeHypothesis(
  investigationId: string,
  hypothesisId: string
): Promise<Investigation | null> {
  const existing = await investigationRepository.getById(investigationId);
  if (!existing) return null;

  const hypotheses = existing.hypotheses.filter((h) => h.id !== hypothesisId);
  const claims = existing.claims.map((c) => ({
    ...c,
    hypothesisIds: c.hypothesisIds.filter((id) => id !== hypothesisId),
  }));
  const relationships = buildRelationshipsFromState(
    hypotheses,
    claims,
    existing.contradictions
  );

  return investigationRepository.save({
    ...existing,
    hypotheses,
    claims,
    relationships,
  });
}
