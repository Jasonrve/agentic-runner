import { ReviewReport, Severity, Verdict } from './types.ts';

type SeverityMeta = {
  icon: string;
  label: string;
};

const severityMeta: Record<Severity, SeverityMeta> = {
  critical: { icon: '🟥', label: 'CRITICAL' },
  high: { icon: '🔴', label: 'HIGH' },
  medium: { icon: '🟠', label: 'MEDIUM' },
  low: { icon: '🟢', label: 'LOW' },
};

const verdictMeta: Record<Verdict, SeverityMeta> = {
  fail: { icon: '⛔', label: 'FAIL' },
  warn: { icon: '⚠️', label: 'WARN' },
  pass: { icon: '✅', label: 'PASS' },
};

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function countSeverities(report: ReviewReport): Record<Severity, number> {
  return report.findings.reduce(
    (acc, finding) => ({
      ...acc,
      [finding.severity]: acc[finding.severity] + 1,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

function formatVerdict(verdict: Verdict): string {
  const meta = verdictMeta[verdict];
  return `${meta.icon} **${meta.label}**`;
}

function formatSeverity(severity: Severity): string {
  const meta = severityMeta[severity];
  return `${meta.icon} **${meta.label}**`;
}

export function renderMarkdown(report: ReviewReport): string {
  const findings = report.findings ?? [];
  const nextSteps = report.next_steps ?? [];
  const notes = report.notes ?? [];
  const severityCounts = countSeverities(report);
  const verdict = verdictMeta[report.verdict];

  const lines: string[] = [];
  lines.push(`# ${verdict.icon} ${report.title || 'Agentic Runner Report'}`);
  lines.push('');
  lines.push('## 📌 At a glance');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| Verdict | ${formatVerdict(report.verdict)} |`);
  lines.push(`| Total findings | **${findings.length}** |`);
  lines.push(`| Critical | **${severityCounts.critical}** |`);
  lines.push(`| High | **${severityCounts.high}** |`);
  lines.push(`| Medium | **${severityCounts.medium}** |`);
  lines.push(`| Low | **${severityCounts.low}** |`);
  lines.push('');

  if (report.summary) {
    lines.push('## 🧭 Executive summary');
    lines.push('');
    lines.push(`> ${report.summary}`);
    lines.push('');
  }

  lines.push('## 🚨 Findings');
  lines.push('');
  if (findings.length > 0) {
    lines.push('| # | Severity | Finding | Why it matters | Recommendation |');
    lines.push('|---|---|---|---|---|');
    findings.forEach((finding, index) => {
      lines.push(
        `| ${index + 1} | ${formatSeverity(finding.severity)} | **${escapeCell(finding.title)}** | ${escapeCell(finding.details)} | ${escapeCell(finding.recommendation)} |`,
      );
    });
    lines.push('');

    lines.push('### Detail cards');
    lines.push('');
    findings.forEach((finding, index) => {
      lines.push(`#### ${formatSeverity(finding.severity)} Finding ${index + 1}: ${finding.title}`);
      lines.push('');
      lines.push(`> **Why it matters:** ${finding.details}`);
      lines.push(`> **Recommended fix:** ${finding.recommendation}`);
      lines.push('');
    });
  } else {
    lines.push('✅ No findings reported.');
    lines.push('');
  }

  lines.push('## ✅ Next steps');
  lines.push('');
  if (nextSteps.length > 0) {
    for (const step of nextSteps) {
      lines.push(`- [ ] ${step}`);
    }
  } else {
    lines.push('- [ ] None');
  }
  lines.push('');

  if (notes.length > 0) {
    lines.push('## 📝 Notes');
    lines.push('');
    for (const note of notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
