import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGeminiError, redactSecrets } from './geminiErrors';
import { detectQuickIntent } from './geminiService';

test('classifyGeminiError distinguishes missing key, auth, quota, rate limit, grounding, model, timeout, and 503 overload', () => {
  assert.equal(
    classifyGeminiError(new Error('GEMINI_API_KEY_MISSING')).code,
    'GEMINI_API_KEY_MISSING'
  );

  assert.equal(
    classifyGeminiError({ status: 403, message: 'API_KEY_INVALID' }).code,
    'GEMINI_AUTH_ERROR'
  );

  assert.equal(
    classifyGeminiError({ status: 429, message: 'Exceeded your current quota for free_tier' }).code,
    'GEMINI_QUOTA_ERROR'
  );

  assert.equal(
    classifyGeminiError({ status: 429, message: 'Rate limit exceeded, slow down' }).code,
    'GEMINI_RATE_LIMIT'
  );

  const groundingErr = classifyGeminiError(
    { status: 403, message: 'Google Search grounding requires billing enabled' },
    { isSearchGrounding: true }
  );
  assert.equal(groundingErr.code, 'GEMINI_SEARCH_GROUNDING_UNAVAILABLE');
  assert.match(groundingErr.userMessage, /Google Search grounding is unavailable/i);

  assert.equal(
    classifyGeminiError({ status: 404, message: 'models/foo is not found' }, { model: 'foo' }).code,
    'GEMINI_MODEL_ERROR'
  );

  assert.equal(
    classifyGeminiError({ status: 504, message: 'DEADLINE_EXCEEDED timeout' }).code,
    'GEMINI_TIMEOUT'
  );

  const overloadErr = classifyGeminiError({
    status: 503,
    message: 'This model is currently experiencing high demand. UNAVAILABLE',
  });
  assert.equal(overloadErr.code, 'GEMINI_RESPONSE_ERROR');
  assert.equal(overloadErr.retryable, true);
  assert.equal(overloadErr.shouldFallbackModel, true);
});

test('redactSecrets strips API keys and Bearer tokens safely', () => {
  const cleaned = redactSecrets('Failed with key AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234 and Bearer secret.token.xyz');
  assert.doesNotMatch(cleaned, /AIzaSy/);
  assert.doesNotMatch(cleaned, /secret\.token/);
  assert.match(cleaned, /\[REDACTED_KEY\]/);
});

test('detectQuickIntent routes greetings vs explicit research prompts accurately', () => {
  assert.equal(detectQuickIntent('Hello').isGreeting, true);
  assert.equal(detectQuickIntent('Hello').explicitResearch, false);

  assert.equal(detectQuickIntent('What are metals and non-metals?').isGreeting, false);
  assert.equal(detectQuickIntent('What are metals and non-metals?').explicitResearch, false);

  assert.equal(
    detectQuickIntent('Investigate the differences between metals and non-metals using reliable sources.')
      .explicitResearch,
    true
  );
});
