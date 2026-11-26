import { GoogleGenAI, Type } from '@google/genai';
import type { ChatMessage, Investigation, RawRetrievedSource } from '../../src/types/investigation';
import type { RawAiSynthesisPayload } from '../../src/utils/investigationLogic';
import {
  classifyGeminiError,
  HypothesisAiError,
  redactSecrets,
} from './geminiErrors';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

let preferredHealthyModel: { model: string; expiresAt: number } | null = null;

export function getConfiguredModel(): string {
  const configured = (process.env.GEMINI_MODEL || '').trim();
  return configured || DEFAULT_GEMINI_MODEL;
}

export function markModelHealthy(model: string): void {
  preferredHealthyModel = {
    model,
    expiresAt: Date.now() + 120_000,
  };
}

export function getCandidateModels(): string[] {
  const explicit = (process.env.GEMINI_MODEL || '').trim();
  if (explicit) {
    return [explicit];
  }
  const list: string[] = [];
  if (preferredHealthyModel && preferredHealthyModel.expiresAt > Date.now()) {
    list.push(preferredHealthyModel.model);
  }
  list.push(DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL);
  return Array.from(new Set(list));
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new HypothesisAiError({
      code: 'GEMINI_API_KEY_MISSING',
      userMessage: 'Gemini API key is not configured.',
      httpStatus: 500,
      retryable: false,
      shouldFallbackModel: false,
    });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a Gemini SDK call with exponential backoff on transient failures (503/429)
 * and automatic fallback across active models when a model hits quota or high demand.
 */
export async function callWithResilience<T>(
  operation: (ai: GoogleGenAI, model: string) => Promise<T>,
  context: { isSearchGrounding?: boolean; maxRounds?: number } = {}
): Promise<{ result: T; modelUsed: string }> {
  const ai = getGeminiClient();
  const allCandidates = getCandidateModels();
  const maxRounds = context.maxRounds ?? 3;
  const skippedModels = new Set<string>();
  const errorsByModel = new Map<string, { err: unknown; classified: ReturnType<typeof classifyGeminiError> }>();

  const backoffMs = [900, 2200, 4000];

  for (let round = 0; round < maxRounds; round++) {
    const activeCandidates = allCandidates.filter((m) => !skippedModels.has(m));
    if (activeCandidates.length === 0) break;

    let anyRetryableInRound = false;

    for (const model of activeCandidates) {
      try {
        const result = await operation(ai, model);
        markModelHealthy(model);
        return { result, modelUsed: model };
      } catch (err) {
        const classified = classifyGeminiError(err, {
          model,
          isSearchGrounding: context.isSearchGrounding,
        });
        errorsByModel.set(model, { err, classified });

        console.warn(
          `[HYPOTHESIS] Gemini call failed on ${model} (round ${round + 1}/${maxRounds}, ${classified.code}):`,
          redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 280)
        );

        // Fatal non-fallback error (e.g., invalid API key) -> fail immediately
        if (!classified.retryable && !classified.shouldFallbackModel) {
          throw new HypothesisAiError(classified);
        }

        // If this model hit a non-retryable error (e.g. quota exhausted / model not found),
        // don't keep hammering it on later rounds; try the remaining candidate models.
        if (!classified.retryable) {
          skippedModels.add(model);
        } else {
          anyRetryableInRound = true;
        }

        // Brief pause before trying the next candidate model
        if (activeCandidates.length > 1) {
          await sleep(300);
        }
      }
    }

    if (!anyRetryableInRound) break;
    if (round < maxRounds - 1) {
      await sleep(backoffMs[round] ?? 3000);
    }
  }

  // Pick the most actionable error to surface to the caller:
  // prefer auth/key/grounding/quota errors over generic 503 if all models failed,
  // or surface the primary model's classified error.
  const allFailures = Array.from(errorsByModel.values());
  const prioritized =
    allFailures.find((f) => f.classified.code === 'GEMINI_API_KEY_MISSING') ||
    allFailures.find((f) => f.classified.code === 'GEMINI_AUTH_ERROR') ||
    allFailures.find((f) => f.classified.code === 'GEMINI_SEARCH_GROUNDING_UNAVAILABLE') ||
    allFailures.find((f) => f.classified.code === 'GEMINI_RESPONSE_ERROR') ||
    allFailures.find((f) => f.classified.code === 'GEMINI_RATE_LIMIT') ||
    allFailures.find((f) => f.classified.code === 'GEMINI_QUOTA_ERROR') ||
    allFailures[allFailures.length - 1];

  if (prioritized) {
    throw new HypothesisAiError(prioritized.classified);
  }

  throw new HypothesisAiError(
    classifyGeminiError(new Error('No active Gemini models responded.'), {
      model: allCandidates[0] || DEFAULT_GEMINI_MODEL,
      isSearchGrounding: context.isSearchGrounding,
    })
  );
}

export interface GeminiHealthReport {
  gemini: 'ok' | 'error';
  model: string;
  searchGrounding: 'available' | 'unavailable';
  errorCode?: string;
  reason?: string;
  groundingChunksSample?: number;
}

export async function checkGeminiHealth(): Promise<GeminiHealthReport> {
  const configuredModel = getConfiguredModel();
  try {
    getGeminiClient();
  } catch (err) {
    const classified = classifyGeminiError(err, { model: configuredModel });
    return {
      gemini: 'error',
      model: configuredModel,
      searchGrounding: 'unavailable',
      errorCode: classified.code,
      reason: classified.userMessage,
    };
  }

  let workingModel: string;
  try {
    const { result: basic, modelUsed } = await callWithResilience(
      (ai, m) =>
        ai.models.generateContent({
          model: m,
          contents: 'Reply with OK.',
        }),
      { maxRounds: 2 }
    );
    if (!basic.text || !basic.text.trim()) {
      return {
        gemini: 'error',
        model: modelUsed,
        searchGrounding: 'unavailable',
        errorCode: 'GEMINI_RESPONSE_ERROR',
        reason: 'Gemini returned an empty response during the health check.',
      };
    }
    workingModel = modelUsed;
  } catch (err) {
    const classified = classifyGeminiError(err, { model: configuredModel });
    return {
      gemini: 'error',
      model: configuredModel,
      searchGrounding: 'unavailable',
      errorCode: classified.code,
      reason: classified.userMessage,
    };
  }

  try {
    const { result: grounded, modelUsed } = await callWithResilience(
      (ai, m) =>
        ai.models.generateContent({
          model: m,
          contents: 'What is the atomic number of copper? Answer in one sentence.',
          config: {
            tools: [{ googleSearch: {} }],
          },
        }),
      { isSearchGrounding: true, maxRounds: 2 }
    );
    const chunks = grounded.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return {
      gemini: 'ok',
      model: modelUsed,
      searchGrounding: 'available',
      groundingChunksSample: chunks.length,
    };
  } catch (err) {
    const classified = classifyGeminiError(err, {
      model: workingModel,
      isSearchGrounding: true,
    });
    console.warn(
      `[HYPOTHESIS] Gemini search grounding check failed (${classified.code}):`,
      redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 280)
    );
    return {
      gemini: 'ok',
      model: workingModel,
      searchGrounding: 'unavailable',
      errorCode: classified.code,
      reason: classified.userMessage,
    };
  }
}

function safeParseJson<T>(rawText: string | undefined): Partial<T> {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return {};
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Partial<T>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Partial<T>;
    }
    throw new Error('MALFORMED_AI_JSON');
  }
}

export type QueryIntentMode = 'chat' | 'investigation';

export interface ResearchPlan {
  title: string;
  mode: QueryIntentMode;
  needsWebResearch: boolean;
  explicitlyRequestedResearch: boolean;
  subQuestions: string[];
  initialHypotheses: Array<{ title: string; summary: string }>;
  searchQueries: string[];
}

export interface FollowUpDecision {
  needsNewSearch: boolean;
  explicitlyRequestedResearch: boolean;
  searchQueries: string[];
  focusTopic: string;
}

const PURE_GREETING_RE =
  /^(hi|hello|hey|yo|hiya|good\s+(morning|afternoon|evening)|how\s+are\s+you|what'?s\s+up|thanks|thank\s+you|ok|okay|cool|nice|bye|goodbye)[!?. ]*$/i;

const EXPLICIT_RESEARCH_RE =
  /\b(investigate|research|evidence|sources?|citations?|studies|study|data|verify|fact[- ]?check|proof|prove|disprove|counter[- ]?evidence|opposing|challenge|compare\s+the\s+causes|why\s+(did|does|are|is|do)|what\s+caused|actually\s+effective|reliable\s+sources?|which\s+.*\s+is\s+better)\b/i;

/**
 * Deterministic zero-latency intent router (saves an entire Gemini API call per user turn!).
 * - Greetings & conceptual prompts ("Hello", "What are metals and non-metals?", "metals and non metals")
 *   -> Normal Chat Mode (1 fast streaming Gemini call).
 * - Research / causal / evidence prompts ("Investigate ...", "Why are EV battery prices falling?",
 *   "Find evidence", "Challenge that conclusion") -> Investigation Mode (Google Search grounding + synthesis).
 */
export function detectQuickIntent(input: string): {
  isGreeting: boolean;
  explicitResearch: boolean;
  mode: QueryIntentMode;
} {
  const cleaned = input.trim();
  const isGreeting = PURE_GREETING_RE.test(cleaned);
  const explicitResearch = !isGreeting && EXPLICIT_RESEARCH_RE.test(cleaned);
  return {
    isGreeting,
    explicitResearch,
    mode: explicitResearch ? 'investigation' : 'chat',
  };
}

/**
 * Builds a clean investigation plan deterministically (0 extra API calls!) so
 * Gemini RPM budget goes exclusively into real grounded search & deep synthesis.
 */
export function buildFastResearchPlan(question: string): ResearchPlan {
  const clean = question.trim();
  const intent = detectQuickIntent(clean);
  const title = clean.length > 64 ? `${clean.slice(0, 63).trim()}…` : clean;

  if (intent.mode === 'chat') {
    return {
      title: intent.isGreeting ? 'Quick conversation' : title,
      mode: 'chat',
      needsWebResearch: false,
      explicitlyRequestedResearch: false,
      subQuestions: [],
      initialHypotheses: [],
      searchQueries: [],
    };
  }

  return {
    title,
    mode: 'investigation',
    needsWebResearch: true,
    explicitlyRequestedResearch: intent.explicitResearch,
    subQuestions: [
      `What are the primary factual drivers or core mechanisms behind: ${clean}`,
      `What credible studies, primary data, or authoritative references address this?`,
      `What notable exceptions, edge cases, or opposing interpretations exist?`,
    ],
    initialHypotheses: [],
    searchQueries: [clean],
  };
}

export function decideFollowUpStrategy(
  investigation: Investigation,
  userMessage: string,
  actionType?: string
): FollowUpDecision {
  const forceSearch =
    actionType === 'challenge' ||
    actionType === 'opposing' ||
    actionType === 'primary' ||
    actionType === 'deeper' ||
    /\b(find\s+evidence|find\s+sources|reliable\s+sources|challenge\s+that|challenge\s+this|opposing\s+evidence|counter[- ]?evidence|verify|fact[- ]?check|primary\s+sources|investigate|search\s+for)\b/i.test(
      userMessage
    );

  if (forceSearch) {
    const query =
      actionType === 'challenge' || actionType === 'opposing' || /challenge|opposing|counter/i.test(userMessage)
        ? `${investigation.question} counterarguments exceptions criticism opposing evidence`
        : `${investigation.question} ${userMessage}`;
    return {
      needsNewSearch: true,
      explicitlyRequestedResearch: true,
      searchQueries: [query.slice(0, 180)],
      focusTopic: userMessage,
    };
  }

  return {
    needsNewSearch: false,
    explicitlyRequestedResearch: false,
    searchQueries: [],
    focusTopic: userMessage,
  };
}

const RESEARCHER_VOICE_GUIDE = `Voice & Personality Rules (STRICT):
- Sound like an incisive, thoughtful human researcher speaking directly to a smart colleague.
- NEVER use robotic boilerplate such as "Certainly!", "I'd be happy to assist", "According to the provided information", "As an AI language model", "Here is the answer:", or "Step 1: Processing query."
- Be direct, natural, clear, and honest about uncertainty.
- Adapt structure naturally to the question. Use clean Markdown (concise paragraphs, ### headings only where genuinely helpful, bold key terms).
- Cite retrieved sources inline using exact bracketed numbers like [1], [2] ONLY when real retrieved sources are provided in the prompt. NEVER invent a citation number, URL, author, study, or statistic not present in the retrieved evidence.
- If no live web sources were retrieved, do NOT fabricate citations or pretend you browsed the web.`;

export async function streamDirectChatReply(
  question: string,
  history: ChatMessage[],
  onToken: (text: string) => void
): Promise<string> {
  const recentHistory = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'HYPOTHESIS'}: ${m.content}`)
    .join('\n\n');

  const prompt =
    history.length > 1
      ? `Conversation so far:\n${recentHistory}\n\nRespond naturally and directly to the user's latest message ("${question}").`
      : `User message: "${question}"\n\nRespond naturally, clearly, and conversationally. If it's a greeting, greet back warmly in 1-2 crisp sentences and invite a question or topic to investigate. If it's a conceptual topic (e.g., metals and non-metals), give a clear, engaging explanation that covers the key differences and interesting exceptions naturally.`;

  const { result: stream } = await callWithResilience((ai, model) =>
    ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        systemInstruction: RESEARCHER_VOICE_GUIDE,
      },
    })
  );

  let fullText = '';
  for await (const chunk of stream) {
    const piece = chunk.text || '';
    if (piece) {
      fullText += piece;
      onToken(piece);
    }
  }
  return fullText;
}

export async function synthesizeStructuredInvestigation(
  question: string,
  plan: ResearchPlan,
  retrievedSources: RawRetrievedSource[],
  groundedNotes: string[],
  searchNotice?: string,
  existingHypotheses?: Investigation['hypotheses']
): Promise<RawAiSynthesisPayload> {
  const sourcesBlock =
    retrievedSources.length > 0
      ? retrievedSources
          .map(
            (s, idx) =>
              `[${idx + 1}] ID: ${s.id} | Title: ${s.title} | URL: ${s.url} | Date: ${s.publishedDate || 'unknown'}\nExcerpt: ${s.snippet.slice(0, 400)}`
          )
          .join('\n\n')
      : 'NO LIVE SOURCES RETRIEVED. Do not invent any source IDs, URLs, or citations. Leave supportingSourceIds and contradictingSourceIds empty, and classify unverified claims honestly as Inferred or Speculative.';

  const userAddedHint =
    existingHypotheses && existingHypotheses.some((h) => h.isUserAdded)
      ? `\nPreserve these user-added hypotheses in your evaluation:\n${existingHypotheses
          .filter((h) => h.isUserAdded)
          .map((h) => `- ${h.title}: ${h.summary}`)
          .join('\n')}`
      : '';

  const prompt = `You are the evidence synthesis and reasoning engine for HYPOTHESIS.
Question: "${question}"${userAddedHint}
${searchNotice ? `Live search status: ${searchNotice}\n` : ''}
RETRIEVED SOURCES (ONLY cite IDs from this exact list: ${retrievedSources.map((s) => s.id).join(', ') || 'NONE'}):
${sourcesBlock}

${groundedNotes.length > 0 ? `GROUNDED RESEARCH NOTES:\n${groundedNotes.join('\n---\n').slice(0, 3500)}` : ''}

Produce a rigorous, honest JSON investigation object containing:
1. "title": Concise 4-8 word investigation title.
2. "subQuestions": 3 focused analytical sub-questions exploring mechanisms, evidence, and exceptions.
3. "hypotheses": 3-4 competing hypotheses or key explanatory dimensions (IDs H1, H2, ...). Set status to "leading", "plausible", "contested", or "weak", and confidence to "High", "Medium", or "Low".
4. "claims": 4-7 concrete claims (IDs C1, C2, ...) linked to hypothesisIds:
   - "Known": directly supported by retrieved sources
   - "Inferred": reasoned synthesis or established principle not directly backed by a retrieved citation here
   - "Speculative": uncertain or weakly supported
   - Populate supportingSourceIds and contradictingSourceIds ONLY with valid source IDs (e.g. "S1", "S2") from the retrieved list above (or [] if NONE).
   - Provide clear "reasoning" and explicit "uncertainty" for every claim.
5. "sourceNotes": For retrieved sources used, concise grounded "excerpt" and "whyItMatters".
6. "contradictions": 0-2 genuine disagreements or tensions between retrieved sources (ONLY referencing valid source IDs — never fabricate conflict or fake source IDs).
7. "uncertainties": 2-3 concrete nuances, edge cases, or remaining uncertainties.
8. "followUpSuggestions": 4 smart, contextual follow-up prompts (e.g., "Which difference is the most important?", "Challenge that conclusion", "Find primary sources").
9. "conclusion": A natural, human-researcher Markdown answer (200-320 words) directly answering the user's question.
   - Sound like a sharp human researcher (NO robotic boilerplate like "According to the provided information" or "Step 1").
   - Cite real retrieved sources inline with exact [1], [2] numbers matching the source list above ONLY when sources exist.
   - If NO live sources were retrieved, do NOT invent citations; briefly note that live web grounding was unavailable while still delivering an insightful, honest analysis.`;

  const { result: response } = await callWithResilience((ai, model) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            hypotheses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  status: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                },
                required: ['id', 'title', 'summary', 'status', 'confidence'],
              },
            },
            claims: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  classification: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                  hypothesisIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  supportingSourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  contradictingSourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  reasoning: { type: Type.STRING },
                  uncertainty: { type: Type.STRING },
                },
                required: [
                  'id',
                  'text',
                  'classification',
                  'confidence',
                  'hypothesisIds',
                  'supportingSourceIds',
                  'contradictingSourceIds',
                  'reasoning',
                  'uncertainty',
                ],
              },
            },
            sourceNotes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sourceId: { type: Type.STRING },
                  excerpt: { type: Type.STRING },
                  whyItMatters: { type: Type.STRING },
                  publishedDate: { type: Type.STRING },
                },
                required: ['sourceId', 'whyItMatters'],
              },
            },
            contradictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  sourceAId: { type: Type.STRING },
                  claimAText: { type: Type.STRING },
                  sourceBId: { type: Type.STRING },
                  claimBText: { type: Type.STRING },
                  disagreementSummary: { type: Type.STRING },
                  possibleReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'topic',
                  'sourceAId',
                  'claimAText',
                  'sourceBId',
                  'claimBText',
                  'disagreementSummary',
                  'possibleReasons',
                ],
              },
            },
            uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            conclusion: { type: Type.STRING },
          },
          required: [
            'title',
            'hypotheses',
            'claims',
            'uncertainties',
            'followUpSuggestions',
            'conclusion',
          ],
        },
      },
    })
  );

  return safeParseJson<RawAiSynthesisPayload>(response.text) as RawAiSynthesisPayload;
}

export async function streamConversationalConclusion(
  investigation: Investigation,
  directive: string | undefined,
  onToken: (text: string) => void
): Promise<string> {
  const sourceList = investigation.sources
    .map(
      (s) =>
        `[${s.citationIndex}] (${s.id}) ${s.title} — ${s.domain} [${s.sourceType}, ${s.qualityTier}]: ${s.excerpt}`
    )
    .join('\n');

  const hypList = investigation.hypotheses
    .map((h) => `- ${h.title} (${h.status}, ${h.confidence} confidence): ${h.summary}`)
    .join('\n');

  const claimList = investigation.claims
    .map(
      (c) =>
        `- [${c.classification} / ${c.confidence}] ${c.text} (Supported: ${c.supportingSourceIds.join(',') || 'none'}; Contradicted: ${c.contradictingSourceIds.join(',') || 'none'})`
    )
    .join('\n');

  const prompt = `Investigation question: "${investigation.question}"
${directive ? `Specific angle / user request: ${directive}\n` : ''}
Search mode: ${investigation.searchMode}${investigation.searchNotice ? `\nSearch status note: ${investigation.searchNotice}` : ''}

COMPETING HYPOTHESES / DIMENSIONS:
${hypList || 'None yet'}

EXTRACTED CLAIMS:
${claimList || 'None yet'}

RETRIEVED SOURCES (cite ONLY with exact [1], [2] numbers from this list):
${sourceList || 'No live web sources retrieved.'}

Write a clear, natural, human-researcher synthesis answering the user's question (around 200-320 words).`;

  const { result: stream } = await callWithResilience((ai, model) =>
    ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        systemInstruction: RESEARCHER_VOICE_GUIDE,
      },
    })
  );

  let fullText = '';
  for await (const chunk of stream) {
    const piece = chunk.text || '';
    if (piece) {
      fullText += piece;
      onToken(piece);
    }
  }
  return fullText;
}

export async function streamFollowUpReply(
  investigation: Investigation,
  userMessage: string,
  extraRetrievedNotes: string[],
  groundingNotice: string | undefined,
  onToken: (text: string) => void
): Promise<string> {
  const recentConversation = investigation.messages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'User' : 'HYPOTHESIS'}: ${m.content}`)
    .join('\n\n');

  const sourceList = investigation.sources
    .map(
      (s) =>
        `[${s.citationIndex}] ${s.title} (${s.domain}, ${s.sourceType}, quality: ${s.qualityTier}) — ${s.whyItMatters}`
    )
    .join('\n');

  const claimList = investigation.claims
    .map(
      (c) =>
        `- ${c.id} [${c.classification}, ${c.confidence}]: ${c.text} | Reasoning: ${c.reasoning} | Uncertainty: ${c.uncertainty}`
    )
    .join('\n');

  const prompt = `Ongoing conversation / investigation topic: "${investigation.question}"
${investigation.isDemo ? 'NOTE: This is an illustrative Demo Investigation (DEMO / ILLUSTRATIVE). Be transparent if asked about live web verification.\n' : ''}
${investigation.hypotheses.length > 0 ? `CURRENT HYPOTHESES:\n${investigation.hypotheses.map((h) => `- ${h.id}: ${h.title} (${h.status}, ${h.confidence}) — ${h.summary}`).join('\n')}\n` : ''}
${claimList ? `CURRENT CLAIMS:\n${claimList}\n` : ''}
${sourceList ? `COLLECTED SOURCES (cite inline with [1], [2], ...):\n${sourceList}\n` : ''}
${investigation.contradictions.length > 0 ? `CONTRADICTIONS:\n${investigation.contradictions.map((c) => `- ${c.topic}: ${c.disagreementSummary}`).join('\n')}\n` : ''}
${extraRetrievedNotes.length > 0 ? `NEWLY RETRIEVED WEB EVIDENCE:\n${extraRetrievedNotes.join('\n---\n').slice(0, 3000)}\n` : ''}
${groundingNotice ? `LIVE SEARCH NOTE: ${groundingNotice}\nDo NOT invent web sources or citations.\n` : ''}
CONVERSATION SO FAR:
${recentConversation}

USER'S NEW MESSAGE:
"${userMessage}"

Respond naturally, directly, and specifically using the full conversation context above.
- Resolve contextual references ("Why?", "Which one is more useful?", "Which difference is the most important?") directly from previous turns.
- If the user asks to challenge a conclusion or find opposing evidence, examine real exceptions, edge cases, counter-perspectives, and weaknesses in the prior claim—and if live web grounding was unavailable, state that honestly without inventing citations.`;

  const { result: stream } = await callWithResilience((ai, model) =>
    ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        systemInstruction: RESEARCHER_VOICE_GUIDE,
      },
    })
  );

  let fullText = '';
  for await (const chunk of stream) {
    const piece = chunk.text || '';
    if (piece) {
      fullText += piece;
      onToken(piece);
    }
  }
  return fullText;
}
