import { ResponseSignal, WorkflowResponse } from './types.ts';

type SignalMeta = {
  icon: string;
  label: string;
};

const signalMeta: Record<ResponseSignal, SignalMeta> = {
  blocked: { icon: '⛔', label: 'BLOCKED' },
  attention: { icon: '⚠️', label: 'ATTENTION' },
  success: { icon: '✅', label: 'SUCCESS' },
};

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

export function renderMarkdown(response: WorkflowResponse): string {
  const highlights = response.highlights ?? [];
  const nextSteps = response.next_steps ?? [];
  const notes = response.notes ?? [];
  const requests = response.requests ?? [];
  const signal = signalMeta[response.signal];

  const lines: string[] = [];
  lines.push(`# ${signal.icon} ${response.title || 'Agentic Runner Response'}`);
  lines.push('');
  lines.push(`> ${signal.label}`);
  lines.push('');

  if (response.answer) {
    lines.push('## Answer');
    lines.push('');
    lines.push(response.answer.trim());
    lines.push('');
  }

  if (highlights.length > 0) {
    lines.push('## Highlights');
    lines.push('');
    for (const item of highlights) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (requests.length > 0) {
    lines.push('## Follow-up requests');
    lines.push('');
    requests.forEach((request, index) => {
      lines.push(`- ${index + 1}. **${escapeCell(request.path)}** — ${escapeCell(request.reason)}`);
    });
    lines.push('');
  }

  if (nextSteps.length > 0) {
    lines.push('## Suggested next steps');
    lines.push('');
    for (const step of nextSteps) {
      lines.push(`- [ ] ${step}`);
    }
    lines.push('');
  }

  if (notes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
