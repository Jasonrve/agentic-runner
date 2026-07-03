import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/render.ts';

test('renderMarkdown formats a security report', () => {
  const output = renderMarkdown({
    title: 'Terraform governance review',
    summary: 'The changed Terraform introduces governance and exposure issues.',
    signal: 'attention',
    verdict: 'warn',
    findings: [
      {
        severity: 'high',
        title: 'Public HTTPS ingress exposed to the internet',
        details: 'The security group allows TCP/443 from 0.0.0.0/0.',
        recommendation: 'Restrict ingress to trusted CIDRs only.',
      },
      {
        severity: 'medium',
        title: 'Missing owner tag',
        details: 'The resource tags do not include owner.',
        recommendation: 'Add owner and related governance tags before merging.',
      },
    ],
    highlights: ['Public ingress', 'Missing owner tag'],
    next_steps: ['Restrict ingress', 'Add governance tags'],
    notes: ['Focused on the example Terraform file.'],
  });

  assert.match(output, /# ⚠️ Terraform governance review/);
  assert.match(output, /> WARN/);
  assert.match(output, /## At a glance/);
  assert.match(output, /\| Verdict \| ⚠️ \*\*WARN\*\* \|/);
  assert.match(output, /## Executive summary/);
  assert.match(output, /## Findings/);
  assert.match(output, /Public HTTPS ingress exposed to the internet/);
  assert.match(output, /## Detail cards/);
  assert.match(output, /## Next steps/);
  assert.doesNotMatch(output, /report template/i);
});
