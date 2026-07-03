import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/render.ts';

test('renderMarkdown formats a concise answer instead of a report template', () => {
  const output = renderMarkdown({
    title: 'Terraform answer',
    answer: 'Two words changed in the Terraform file, and the PR should mention the public ingress exposure and missing owner tag.',
    signal: 'attention',
    highlights: ['Public HTTPS ingress from 0.0.0.0/0', 'Missing owner tag'],
    next_steps: ['Restrict ingress to trusted CIDRs', 'Add an owner tag'],
    notes: ['Focused on the example Terraform file.'],
  });

  assert.match(output, /# ⚠️ Terraform answer/);
  assert.match(output, /> ATTENTION/);
  assert.match(output, /## Answer/);
  assert.match(output, /Two words changed in the Terraform file/);
  assert.match(output, /## Highlights/);
  assert.match(output, /- Public HTTPS ingress from 0.0.0.0\/0/);
  assert.match(output, /## Suggested next steps/);
  assert.match(output, /- \[ \] Restrict ingress to trusted CIDRs/);
  assert.match(output, /## Notes/);
  assert.doesNotMatch(output, /At a glance/);
  assert.doesNotMatch(output, /findings table/i);
});
