import type { RawRetrievedSource, SearchMode } from '../../src/types/investigation';
import { deduplicateAndRankSources, sanitizeExternalUrl } from '../../src/utils/investigationLogic';
import { classifyGeminiError, type GeminiErrorCode } from '../ai/geminiErrors';
import { callWithResilience } from '../ai/geminiService';

export interface SearchExecutionResult {
  sources: RawRetrievedSource[];
  groundedNotes: string[];
  mode: SearchMode;
  notice?: string;
  errorCode?: GeminiErrorCode;
}

export interface SearchProvider {
  readonly name: string;
  readonly mode: SearchMode;
  isAvailable(): boolean;
  searchMultiQuery(queries: string[], maxSources?: number): Promise<SearchExecutionResult>;
}

const REQUEST_TIMEOUT_MS = 14000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Optional External Provider 1: Google Custom Search JSON API (SEARCH_PROVIDER=google_cse)
 */
class GoogleCustomSearchProvider implements SearchProvider {
  readonly name = 'google_cse';
  readonly mode: SearchMode = 'external_search';

  isAvailable(): boolean {
    return Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_ENGINE_ID);
  }

  async searchMultiQuery(queries: string[], maxSources = 12): Promise<SearchExecutionResult> {
    const apiKey = process.env.SEARCH_API_KEY || '';
    const cx = process.env.SEARCH_ENGINE_ID || '';

    const settled = await Promise.allSettled(
      queries.slice(0, 3).map(async (q) => {
        const endpoint = new URL('https://www.googleapis.com/customsearch/v1');
        endpoint.searchParams.set('key', apiKey);
        endpoint.searchParams.set('cx', cx);
        endpoint.searchParams.set('q', q);
        endpoint.searchParams.set('num', '5');

        const res = await fetchWithTimeout(endpoint.toString());
        if (!res.ok) throw new Error(`Google CSE HTTP ${res.status}`);
        const json = (await res.json()) as {
          items?: Array<{ title?: string; link?: string; snippet?: string }>;
        };
        return (json.items || []).map<RawRetrievedSource>((item, idx) => ({
          id: `cse-${idx}`,
          title: item.title || 'Untitled result',
          url: item.link || '',
          snippet: item.snippet || '',
          queryUsed: q,
        }));
      })
    );

    const collected: RawRetrievedSource[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') collected.push(...outcome.value);
    }

    const sources = deduplicateAndRankSources(collected, maxSources);
    return {
      sources,
      groundedNotes: sources.map((s) => `[${s.id}] ${s.title} (${s.url}): ${s.snippet}`),
      mode: sources.length > 0 ? 'external_search' : 'unavailable',
      notice:
        sources.length === 0
          ? 'Live web research did not return usable results from Google Custom Search.'
          : undefined,
    };
  }
}

/**
 * Optional External Provider 2: Tavily Search API (SEARCH_PROVIDER=tavily)
 */
class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily';
  readonly mode: SearchMode = 'external_search';

  isAvailable(): boolean {
    return Boolean(process.env.SEARCH_API_KEY);
  }

  async searchMultiQuery(queries: string[], maxSources = 12): Promise<SearchExecutionResult> {
    const apiKey = process.env.SEARCH_API_KEY || '';

    const settled = await Promise.allSettled(
      queries.slice(0, 3).map(async (q) => {
        const res = await fetchWithTimeout('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query: q,
            search_depth: 'advanced',
            max_results: 5,
          }),
        });
        if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
        const json = (await res.json()) as {
          results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
        };
        return (json.results || []).map<RawRetrievedSource>((item, idx) => ({
          id: `tav-${idx}`,
          title: item.title || 'Untitled result',
          url: item.url || '',
          snippet: item.content || '',
          publishedDate: item.published_date,
          queryUsed: q,
        }));
      })
    );

    const collected: RawRetrievedSource[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') collected.push(...outcome.value);
    }

    const sources = deduplicateAndRankSources(collected, maxSources);
    return {
      sources,
      groundedNotes: sources.map((s) => `[${s.id}] ${s.title} (${s.url}): ${s.snippet}`),
      mode: sources.length > 0 ? 'external_search' : 'unavailable',
      notice:
        sources.length === 0
          ? 'Live web research did not return usable results from Tavily.'
          : undefined,
    };
  }
}

/**
 * Optional External Provider 3: Brave Search API (SEARCH_PROVIDER=brave)
 */
class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  readonly mode: SearchMode = 'external_search';

  isAvailable(): boolean {
    return Boolean(process.env.SEARCH_API_KEY);
  }

  async searchMultiQuery(queries: string[], maxSources = 12): Promise<SearchExecutionResult> {
    const apiKey = process.env.SEARCH_API_KEY || '';

    const settled = await Promise.allSettled(
      queries.slice(0, 3).map(async (q) => {
        const endpoint = new URL('https://api.search.brave.com/res/v1/web/search');
        endpoint.searchParams.set('q', q);
        endpoint.searchParams.set('count', '5');
        const res = await fetchWithTimeout(endpoint.toString(), {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': apiKey,
          },
        });
        if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}`);
        const json = (await res.json()) as {
          web?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string }> };
        };
        return (json.web?.results || []).map<RawRetrievedSource>((item, idx) => ({
          id: `brv-${idx}`,
          title: item.title || 'Untitled result',
          url: item.url || '',
          snippet: item.description || '',
          publishedDate: item.age,
          queryUsed: q,
        }));
      })
    );

    const collected: RawRetrievedSource[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') collected.push(...outcome.value);
    }

    const sources = deduplicateAndRankSources(collected, maxSources);
    return {
      sources,
      groundedNotes: sources.map((s) => `[${s.id}] ${s.title} (${s.url}): ${s.snippet}`),
      mode: sources.length > 0 ? 'external_search' : 'unavailable',
      notice:
        sources.length === 0
          ? 'Live web research did not return usable results from Brave Search.'
          : undefined,
    };
  }
}

/**
 * Default Live Provider: Gemini Native Google Search Grounding (no extra search API keys needed).
 * Runs focused grounded queries, falls back cleanly across active Gemini models on 503 spikes,
 * extracts ONLY genuinely returned groundingChunks (web.uri + web.title) + groundingSupports,
 * and surfaces explicit diagnostic errors if Google Search grounding is unavailable for the project.
 */
export class GeminiGroundedSearchProvider implements SearchProvider {
  readonly name = 'gemini_grounding';
  readonly mode: SearchMode = 'live_grounding';

  isAvailable(): boolean {
    return Boolean((process.env.GEMINI_API_KEY || '').trim());
  }

  private async runSingleGroundedQuery(
    query: string,
    qIndex: number
  ): Promise<{ retrieved: RawRetrievedSource[]; note: string }> {
    const { result: response } = await callWithResilience(
      (ai, model) =>
        ai.models.generateContent({
          model,
          contents: `Use Google Search to gather factual, verifiable evidence for: "${query}".
Prioritize primary sources, universities, textbooks/encyclopedias, scientific organizations, government data, and established publications.
Summarize the key findings, numbers, exceptions, and any disagreements concisely in 4-6 factual bullet points.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        }),
      { isSearchGrounding: true, maxRounds: 2 }
    );

    const summaryText = (response.text || '').trim();
    const metadata = response.candidates?.[0]?.groundingMetadata;
    const chunks = metadata?.groundingChunks || [];
    const supports = metadata?.groundingSupports || [];

    const snippetByChunkIdx = new Map<number, string[]>();
    for (const sup of supports) {
      const segText = sup.segment?.text?.trim();
      if (!segText) continue;
      for (const idx of sup.groundingChunkIndices || []) {
        const list = snippetByChunkIdx.get(idx) || [];
        if (list.length < 2) list.push(segText);
        snippetByChunkIdx.set(idx, list);
      }
    }

    const retrieved: RawRetrievedSource[] = [];
    chunks.forEach((chunk, cIdx) => {
      const uri = sanitizeExternalUrl(chunk.web?.uri);
      if (!uri) return;
      const title = (chunk.web?.title || '').trim() || uri;
      const matchedSegments = snippetByChunkIdx.get(cIdx) || [];
      const snippet = matchedSegments.join(' ').trim() || summaryText.slice(0, 260);
      retrieved.push({
        id: `g-${qIndex}-${cIdx}`,
        title,
        url: uri,
        snippet,
        queryUsed: query,
      });
    });

    return {
      retrieved,
      note: summaryText ? `Query "${query}":\n${summaryText}` : '',
    };
  }

  async searchMultiQuery(queries: string[], maxSources = 12): Promise<SearchExecutionResult> {
    if (!this.isAvailable()) {
      return {
        sources: [],
        groundedNotes: [],
        mode: 'unavailable',
        errorCode: 'GEMINI_API_KEY_MISSING',
        notice: 'Gemini API key is not configured, so live Google Search grounding could not run.',
      };
    }

    // Run 1 comprehensive multi-angle Google Search grounded call (Gemini executes multiple web queries internally)
    const primaryQuery = queries.filter(Boolean).slice(0, 2).join(' — ');
    if (!primaryQuery) {
      return { sources: [], groundedNotes: [], mode: 'unavailable' };
    }

    const settled = await Promise.allSettled([
      this.runSingleGroundedQuery(primaryQuery, 0),
    ]);

    const allRaw: RawRetrievedSource[] = [];
    const groundedNotes: string[] = [];
    let firstError: unknown = null;

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        allRaw.push(...outcome.value.retrieved);
        if (outcome.value.note) groundedNotes.push(outcome.value.note);
      } else if (!firstError) {
        firstError = outcome.reason;
      }
    }

    const sources = deduplicateAndRankSources(allRaw, maxSources);

    if (sources.length === 0) {
      if (firstError) {
        const classified = classifyGeminiError(firstError, { isSearchGrounding: true });
        return {
          sources: [],
          groundedNotes,
          mode: 'unavailable',
          errorCode: classified.code,
          notice: classified.userMessage,
        };
      }
      return {
        sources: [],
        groundedNotes,
        mode: 'unavailable',
        notice:
          'Google Search grounding did not return retrievable web citations for this query. The response below reflects Gemini reasoning without external web citations.',
      };
    }

    return {
      sources,
      groundedNotes,
      mode: 'live_grounding',
    };
  }
}

export function resolveSearchProvider(): SearchProvider {
  const configured = (process.env.SEARCH_PROVIDER || 'gemini_grounding').toLowerCase().trim();

  if (configured === 'google_cse') {
    const provider = new GoogleCustomSearchProvider();
    if (provider.isAvailable()) return provider;
  }
  if (configured === 'tavily') {
    const provider = new TavilySearchProvider();
    if (provider.isAvailable()) return provider;
  }
  if (configured === 'brave') {
    const provider = new BraveSearchProvider();
    if (provider.isAvailable()) return provider;
  }

  return new GeminiGroundedSearchProvider();
}
