import { ChatMessage, ChatRequest, FileRequest, ReviewReport, WorkflowResponse } from './types.ts';

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return trimmed;
}

function normalizeSignal(value: unknown): WorkflowResponse['signal'] {
  if (value === 'blocked') return 'blocked';
  if (value === 'attention' || value === 'warn') return 'attention';
  return 'success';
}

function mapFindingsToHighlights(findings: Array<Record<string, unknown>>): string[] {
  return findings
    .map((finding) => {
      const title = String(finding.title ?? '').trim();
      const details = String(finding.details ?? '').trim();
      const recommendation = String(finding.recommendation ?? '').trim();
      return [title, details, recommendation].filter(Boolean).join(' — ');
    })
    .filter(Boolean);
}

export function parseResponse(content: string): WorkflowResponse {
  const payload = JSON.parse(stripCodeFence(content)) as Record<string, unknown> & {
    summary?: unknown;
    verdict?: unknown;
    findings?: unknown;
    highlights?: unknown;
    next_steps?: unknown;
    notes?: unknown;
    requests?: unknown;
    answer?: unknown;
    signal?: unknown;
  };
  const findings = Array.isArray(payload.findings) ? (payload.findings as Array<Record<string, unknown>>) : [];
  const highlights = Array.isArray(payload.highlights)
    ? payload.highlights.map(String).filter(Boolean)
    : mapFindingsToHighlights(findings);

  return {
    title: String(payload.title ?? 'Agentic Runner Response'),
    answer: String(payload.answer ?? payload.summary ?? ''),
    signal: normalizeSignal(payload.signal ?? payload.verdict),
    highlights,
    next_steps: Array.isArray(payload.next_steps) ? payload.next_steps.map(String).filter(Boolean) : [],
    notes: Array.isArray(payload.notes) ? payload.notes.map(String).filter(Boolean) : [],
    requests: Array.isArray(payload.requests)
      ? payload.requests.map((request: Record<string, unknown>) => ({
          path: String(request.path ?? ''),
          reason: String(request.reason ?? ''),
          mode: (request.mode as FileRequest['mode']) ?? 'full',
        }))
      : undefined,
  };
}

export function buildSystemPrompt(): string {
  return [
    'You are a disciplined LLM workflow assistant.',
    'Answer the user request directly and concisely; do not use a report layout.',
    'Return ONLY valid JSON in this shape:',
    '{',
    '  "title": string,',
    '  "answer": string,',
    '  "signal": "success" | "attention" | "blocked",',
    '  "highlights": [string],',
    '  "next_steps": [string],',
    '  "notes": [string],',
    '  "requests"?: [{ "path": string, "reason": string, "mode"?: "full" | "snippet" | "diff" }]',
    '}',
    'Use answer for the direct response the user asked for.',
    'Use highlights for short bullets or key observations.',
    'Use next_steps only when there is a real follow-up action.',
    'If you need more file contents, populate requests with exact file paths and why they are needed.',
    'Keep the output suitable for a GitHub PR comment.',
  ].join('\n');
}

export function buildMessages(prompt: string, context: string, followUp?: string): ChatMessage[] {
  const userContent = followUp ? `${prompt}\n\n${context}\n\n${followUp}` : `${prompt}\n\n${context}`;
  return [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: userContent },
  ];
}

export function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '/v1/chat/completions';
  }
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  if (/\/v\d+(?:\/)?$/i.test(trimmed)) {
    return `${trimmed.replace(/\/+$/, '')}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

export async function callLlm(request: ChatRequest, baseUrl: string, apiKey: string): Promise<WorkflowResponse> {
  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = raw.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM response did not include message content');
  }

  return parseResponse(content);
}
