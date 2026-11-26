import type { Investigation, InvestigationSummary } from '../types/investigation';

export type SseEvent =
  | { type: 'progress'; stage: string }
  | { type: 'investigation'; investigation: Investigation }
  | { type: 'token'; text: string }
  | { type: 'done'; investigation: Investigation }
  | { type: 'error'; message: string; code?: string };

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function listInvestigations(): Promise<InvestigationSummary[]> {
  const res = await fetch('/api/investigations');
  const data = await readJson<{ investigations: InvestigationSummary[] }>(res);
  return data.investigations;
}

export async function getInvestigation(id: string): Promise<Investigation> {
  const res = await fetch(`/api/investigations/${encodeURIComponent(id)}`);
  const data = await readJson<{ investigation: Investigation }>(res);
  return data.investigation;
}

export async function createInvestigation(question: string): Promise<Investigation> {
  const res = await fetch('/api/investigations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  const data = await readJson<{ investigation: Investigation }>(res);
  return data.investigation;
}

export async function updateInvestigationMeta(
  id: string,
  patch: { isSaved?: boolean; title?: string }
): Promise<Investigation> {
  const res = await fetch(`/api/investigations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await readJson<{ investigation: Investigation }>(res);
  return data.investigation;
}

export async function deleteInvestigation(id: string): Promise<void> {
  const res = await fetch(`/api/investigations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await readJson<{ deleted: boolean }>(res);
}

export async function addHypothesis(
  investigationId: string,
  title: string,
  summary: string
): Promise<Investigation> {
  const res = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/hypotheses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, summary }),
  });
  const data = await readJson<{ investigation: Investigation }>(res);
  return data.investigation;
}

export async function removeHypothesis(
  investigationId: string,
  hypothesisId: string
): Promise<Investigation> {
  const res = await fetch(
    `/api/investigations/${encodeURIComponent(investigationId)}/hypotheses/${encodeURIComponent(hypothesisId)}`,
    { method: 'DELETE' }
  );
  const data = await readJson<{ investigation: Investigation }>(res);
  return data.investigation;
}

async function consumeSse(
  url: string,
  body: Record<string, unknown>,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || `Investigation stream failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response is not supported in this browser.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const parsed = JSON.parse(jsonStr) as SseEvent;
        onEvent(parsed);
      } catch {
        // Ignore malformed partial frame
      }
    }
  }
}

export function streamResearch(
  investigationId: string,
  options: { directive?: string; regenerateOnly?: boolean },
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return consumeSse(
    `/api/investigations/${encodeURIComponent(investigationId)}/research`,
    options,
    onEvent,
    signal
  );
}

export function streamMessage(
  investigationId: string,
  message: string,
  actionType: string | undefined,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return consumeSse(
    `/api/investigations/${encodeURIComponent(investigationId)}/message`,
    { message, actionType },
    onEvent,
    signal
  );
}

export function streamChallengeClaim(
  investigationId: string,
  claimId: string,
  claimText: string,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return consumeSse(
    `/api/investigations/${encodeURIComponent(investigationId)}/challenge`,
    { claimId, claimText },
    onEvent,
    signal
  );
}

export function streamInvestigateDeeper(
  investigationId: string,
  target: string,
  mode: 'deeper' | 'opposing' | 'primary',
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return consumeSse(
    `/api/investigations/${encodeURIComponent(investigationId)}/deeper`,
    { target, mode },
    onEvent,
    signal
  );
}
