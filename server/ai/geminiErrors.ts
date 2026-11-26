export type GeminiErrorCode =
  | 'GEMINI_API_KEY_MISSING'
  | 'GEMINI_AUTH_ERROR'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_QUOTA_ERROR'
  | 'GEMINI_SEARCH_GROUNDING_UNAVAILABLE'
  | 'GEMINI_MODEL_ERROR'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_RESPONSE_ERROR';

export interface ClassifiedGeminiError {
  code: GeminiErrorCode;
  userMessage: string;
  httpStatus?: number;
  retryable: boolean;
  shouldFallbackModel: boolean;
}

export class HypothesisAiError extends Error {
  readonly code: GeminiErrorCode;
  readonly userMessage: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly shouldFallbackModel: boolean;

  constructor(info: ClassifiedGeminiError) {
    super(info.userMessage);
    this.name = 'HypothesisAiError';
    this.code = info.code;
    this.userMessage = info.userMessage;
    this.httpStatus = info.httpStatus;
    this.retryable = info.retryable;
    this.shouldFallbackModel = info.shouldFallbackModel;
  }
}

export function redactSecrets(input: string): string {
  return (input || '')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function extractRawDetails(err: unknown): { message: string; status?: number } {
  if (err instanceof HypothesisAiError) {
    return { message: err.message, status: err.httpStatus };
  }
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    code?: number | string;
    message?: string;
  };
  const status =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.statusCode === 'number'
        ? anyErr.statusCode
        : typeof anyErr?.code === 'number'
          ? anyErr.code
          : undefined;
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof anyErr?.message === 'string'
        ? anyErr.message
        : String(err ?? '');
  return { message: rawMessage, status };
}

/**
 * Classifies Gemini SDK / HTTP errors into explicit, user-safe diagnostic codes.
 * Never exposes API keys, stack traces, or internal server paths.
 */
export function classifyGeminiError(
  err: unknown,
  context: { model?: string; isSearchGrounding?: boolean } = {}
): ClassifiedGeminiError {
  if (err instanceof HypothesisAiError) {
    return {
      code: err.code,
      userMessage: err.userMessage,
      httpStatus: err.httpStatus,
      retryable: err.retryable,
      shouldFallbackModel: err.shouldFallbackModel,
    };
  }

  const { message, status } = extractRawDetails(err);
  const lower = message.toLowerCase();
  const modelLabel = context.model || process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

  // 1. Missing API key
  if (
    message.includes('GEMINI_API_KEY_MISSING') ||
    lower.includes('api key must be set') ||
    lower.includes('api key should be set')
  ) {
    return {
      code: 'GEMINI_API_KEY_MISSING',
      userMessage: 'Gemini API key is not configured.',
      httpStatus: 500,
      retryable: false,
      shouldFallbackModel: false,
    };
  }

  // 2. Timeout / abort
  if (
    lower.includes('aborterror') ||
    lower.includes('aborted') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('deadline_exceeded') ||
    status === 504
  ) {
    return {
      code: 'GEMINI_TIMEOUT',
      userMessage: 'The investigation took too long and was stopped. Try again.',
      httpStatus: 504,
      retryable: true,
      shouldFallbackModel: true,
    };
  }

  // 3. Explicit invalid credentials (always auth error, even during grounding)
  if (
    status === 401 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('unauthenticated')
  ) {
    return {
      code: 'GEMINI_AUTH_ERROR',
      userMessage: 'Gemini rejected the API credentials.',
      httpStatus: status || 401,
      retryable: false,
      shouldFallbackModel: false,
    };
  }

  // 4. Google Search grounding unavailable / tool restriction
  if (
    context.isSearchGrounding &&
    (lower.includes('google_search') ||
      lower.includes('googlesearch') ||
      lower.includes('search grounding') ||
      lower.includes('grounding') ||
      lower.includes('search tool') ||
      lower.includes('tool use') ||
      lower.includes('not supported') ||
      lower.includes('billing') ||
      status === 400 ||
      status === 403)
  ) {
    return {
      code: 'GEMINI_SEARCH_GROUNDING_UNAVAILABLE',
      userMessage:
        'Gemini responded, but Google Search grounding is unavailable for this API project. Enable the required Gemini API billing/search-grounding access or configure an alternative SearchProvider.',
      httpStatus: status || 403,
      retryable: false,
      shouldFallbackModel: status === 400 && lower.includes('not supported'),
    };
  }

  // 5. General permission / auth rejection
  if (
    status === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('insufficient authentication')
  ) {
    return {
      code: 'GEMINI_AUTH_ERROR',
      userMessage: 'Gemini rejected the API credentials.',
      httpStatus: 403,
      retryable: false,
      shouldFallbackModel: false,
    };
  }

  // 6. Quota vs Rate Limit (429 / RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    if (
      lower.includes('quota') ||
      lower.includes('billing') ||
      lower.includes('daily') ||
      lower.includes('free_tier') ||
      lower.includes('exceeded your current quota')
    ) {
      return {
        code: 'GEMINI_QUOTA_ERROR',
        userMessage: 'Gemini API quota has been reached.',
        httpStatus: 429,
        retryable: false,
        shouldFallbackModel: true,
      };
    }
    return {
      code: 'GEMINI_RATE_LIMIT',
      userMessage: 'Gemini API rate limit reached. Wait a moment and try again.',
      httpStatus: 429,
      retryable: true,
      shouldFallbackModel: true,
    };
  }

  // 7. Model error (404 / unsupported model / invalid model argument)
  if (
    status === 404 ||
    lower.includes('404') ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('unsupported model') ||
    lower.includes('model not found') ||
    lower.includes('not supported for generatecontent') ||
    (status === 400 && (lower.includes('model') || lower.includes('thinking')))
  ) {
    return {
      code: 'GEMINI_MODEL_ERROR',
      userMessage: `The configured Gemini model (${modelLabel}) is unavailable or unsupported for this request.`,
      httpStatus: status || 404,
      retryable: false,
      shouldFallbackModel: true,
    };
  }

  // 8. Temporary high demand / overloaded model (503 UNAVAILABLE)
  if (
    status === 503 ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return {
      code: 'GEMINI_RESPONSE_ERROR',
      userMessage: `Gemini model (${modelLabel}) is temporarily overloaded due to high demand. Try again in a moment.`,
      httpStatus: 503,
      retryable: true,
      shouldFallbackModel: true,
    };
  }

  // 9. Malformed / empty / generic response error
  if (
    message.includes('MALFORMED_AI_JSON') ||
    lower.includes('empty response') ||
    lower.includes('unexpected token')
  ) {
    return {
      code: 'GEMINI_RESPONSE_ERROR',
      userMessage: 'Gemini returned an incomplete response structure. Please try again.',
      httpStatus: 502,
      retryable: true,
      shouldFallbackModel: false,
    };
  }

  return {
    code: 'GEMINI_RESPONSE_ERROR',
    userMessage: 'Gemini could not complete this request right now. Please try again.',
    httpStatus: status || 502,
    retryable: status === 500 || status === 502 || lower.includes('internal'),
    shouldFallbackModel: status === 500 || status === 502,
  };
}
