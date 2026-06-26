import { ReviewReport, ChatMessage, ChatRequest, FileRequest } from './types.ts';

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return trimmed;
}

export function parseReport(content: string): ReviewReport {
  const payload = JSON.parse(stripCodeFence(content));
  return {
    title: String(payload.title ?? 'Agentic Run Report'),
    summary: String(payload.summary ?? ''),
    verdict: payload.verdict === 'fail' || payload.verdict === 'warn' ? payload.verdict : 'pass',
    findings: Array.isArray(payload.findings)
      ? payload.findings.map((finding: Record<string, unknown>) => ({
          severity: (finding.severity as ReviewReport['findings'][number]['severity']) ?? 'medium',
          title: String(finding.title ?? ''),
          details: String(finding.details ?? ''),
          recommendation: String(finding.recommendation ?? ''),
        }))
      : [],
    next_steps: Array.isArray(payload.next_steps) ? payload.next_steps.map(String) : [],
    notes: Array.isArray(payload.notes) ? payload.notes.map(String) : [],
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
    'Return ONLY valid JSON.',
    'Shape:',
    '{',
    '  "title": string,',
    '  "summary": string,',
    '  "verdict": "pass" | "warn" | "fail",',
    '  "findings": [{ "severity": "critical" | "high" | "medium" | "low", "title": string, "details": string, "recommendation": string }],',
    '  "next_steps": [string],',
    '  "notes": [string],',
    '  "requests"?: [{ "path": string, "reason": string, "mode"?: "full" | "snippet" | "diff" }]',
    '}',
    'Keep it concise, specific, and suitable for a GitHub PR comment.',
    'If you need more file contents, populate requests with the exact file paths and why they are needed.',
  ].join('\n');
}

export function buildMessages(prompt: string, context: string, followUp?: string): ChatMessage[] {
  const userContent = followUp ? `${prompt}\n\n${context}\n\n${followUp}` : `${prompt}\n\n${context}`;
  return [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: userContent },
  ];
}

export async function callLlm(request: ChatRequest, baseUrl: string, apiKey: string): Promise<ReviewReport> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
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

  return parseReport(content);
}
