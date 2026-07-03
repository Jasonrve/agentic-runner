import { ChatMessage, ChatRequest, FileRequest, ReviewFinding, ReviewVerdict, WorkflowResponse } from './types.ts';

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return trimmed;
}

function normalizeSignal(value: unknown): WorkflowResponse['signal'] {
  if (value === 'blocked' || value === 'fail') return 'blocked';
  if (value === 'attention' || value === 'warn') return 'attention';
  return 'success';
}

function normalizeVerdict(value: unknown): ReviewVerdict | undefined {
  if (value === 'pass' || value === 'warn' || value === 'fail') return value;
  if (value === 'attention') return 'warn';
  if (value === 'blocked') return 'fail';
  return undefined;
}

function normalizeFinding(finding: Record<string, unknown>): ReviewFinding {
  return {
    severity: ['critical', 'high', 'medium', 'low'].includes(String(finding.severity))
      ? (String(finding.severity) as ReviewFinding['severity'])
      : 'medium',
    title: String(finding.title ?? '').trim(),
    details: String(finding.details ?? '').trim(),
    recommendation: String(finding.recommendation ?? '').trim(),
  };
}

function mapFindingsToHighlights(findings: ReviewFinding[]): string[] {
  return findings
    .map((finding) => [finding.title, finding.details, finding.recommendation].filter(Boolean).join(' — '))
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
  const findings = Array.isArray(payload.findings)
    ? payload.findings.map((finding) => normalizeFinding(finding as Record<string, unknown>))
    : [];
  const highlights = Array.isArray(payload.highlights)
    ? payload.highlights.map(String).filter(Boolean)
    : mapFindingsToHighlights(findings);
  const verdict = normalizeVerdict(payload.verdict ?? payload.signal);

  return {
    title: String(payload.title ?? 'Agentic Runner Response'),
    answer: String(payload.answer ?? payload.summary ?? ''),
    summary: String(payload.summary ?? payload.answer ?? ''),
    signal: normalizeSignal(payload.signal ?? payload.verdict),
    verdict,
    findings,
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
    'You are a senior Terraform security reviewer.',
    'Follow the repository governance docs provided in the prompt as the source of truth.',
    'Inspect the changed Terraform files first, then request additional Terraform files only when needed to confirm shared locals, modules, variables, stateful resources, or governance context.',
    'Return ONLY valid JSON in this shape:',
    '{',
    '  "title": string,',
    '  "summary": string,',
    '  "verdict": "pass" | "warn" | "fail",',
    '  "findings": [{ "severity": "critical" | "high" | "medium" | "low", "title": string, "details": string, "recommendation": string }],',
    '  "next_steps": [string],',
    '  "notes": [string],',
    '  "requests"?: [{ "path": string, "reason": string, "mode"?: "full" | "snippet" | "diff" }]',
    '}',
    'Use findings for concrete security or governance issues only.',
    'Use next_steps for actionable remediation items.',
    'If extra context is needed, populate requests with exact file paths and why they matter.',
    'Keep the output concise, specific, and suitable for a GitHub PR comment.',
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
