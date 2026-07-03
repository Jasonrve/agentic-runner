import { ReviewFinding, WorkflowResponse } from './types.ts';

type VerdictMeta = {
  icon: string;
  label: string;
};

const verdictMeta: Record<'pass' | 'warn' | 'fail', VerdictMeta> = {
  pass: { icon: '✅', label: 'PASS' },
  warn: { icon: '⚠️', label: 'WARN' },
  fail: { icon: '⛔', label: 'FAIL' },
};

const severityMeta: Record<ReviewFinding['severity'], { icon: string; label: string }> = {
  critical: { icon: '🟥', label: 'CRITICAL' },
  high: { icon: '🔴', label: 'HIGH' },
  medium: { icon: '🟠', label: 'MEDIUM' },
  low: { icon: '🟡', label: 'LOW' },
};

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function countSeverities(findings: ReviewFinding[]): Record<ReviewFinding['severity'], number> {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

function formatVerdict(verdict: 'pass' | 'warn' | 'fail'): string {
  const meta = verdictMeta[verdict];
  return `${meta.icon} **${meta.label}**`;
}

export function renderMarkdown(response: WorkflowResponse): string {
  const findings = response.findings ?? [];
  const highlights = response.highlights ?? [];
  const nextSteps = response.next_steps ?? [];
  const notes = response.notes ?? [];
  const requests = response.requests ?? [];
  const verdict = response.verdict ?? (response.signal === 'blocked' ? 'fail' : response.signal === 'attention' ? 'warn' : 'pass');
  const verdictInfo = verdictMeta[verdict];
  const severityCounts = countSeverities(findings);
  const hasReport = findings.length > 0 || response.summary || response.verdict;

  const lines: string[] = [];
  lines.push(`# ${verdictInfo.icon} ${response.title || 'Agentic Runner Report'}`);
  lines.push('');
  lines.push(`> ${verdictInfo.label}`);
  lines.push('');

  if (hasReport) {
    lines.push('## At a glance');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|---|---|');
    lines.push(`| Verdict | ${formatVerdict(verdict)} |`);
    lines.push(`| Total findings | **${findings.length}** |`);
    lines.push(`| Critical | **${severityCounts.critical}** |`);
    lines.push(`| High | **${severityCounts.high}** |`);
    lines.push(`| Medium | **${severityCounts.medium}** |`);
    lines.push(`| Low | **${severityCounts.low}** |`);
    lines.push('');
  }

  if (response.summary) {
    lines.push('## Executive summary');
    lines.push('');
    lines.push(`> ${response.summary.trim()}`);
    lines.push('');
  } else if (response.answer && !hasReport) {
    lines.push('## Answer');
    lines.push('');
    lines.push(response.answer.trim());
    lines.push('');
  }

  if (findings.length > 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('| # | Severity | Finding | Why it matters | Recommendation |');
    lines.push('|---|---|---|---|---|');
    findings.forEach((finding, index) => {
      const meta = severityMeta[finding.severity];
      lines.push(
        `| ${index + 1} | ${meta.icon} **${meta.label}** | **${escapeCell(finding.title)}** | ${escapeCell(finding.details)} | ${escapeCell(finding.recommendation)} |`,
      );
    });
    lines.push('');

    lines.push('### Detail cards');
    lines.push('');
    findings.forEach((finding, index) => {
      const meta = severityMeta[finding.severity];
      lines.push(`#### ${meta.icon} **${meta.label}** Finding ${index + 1}: ${finding.title}`);
      lines.push('');
      lines.push(`> **Why it matters:** ${finding.details}`);
      lines.push(`> **Recommended fix:** ${finding.recommendation}`);
      lines.push('');
    });
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
    lines.push('## Next steps');
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
