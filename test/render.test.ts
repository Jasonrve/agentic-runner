import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/render.ts';

test('renderMarkdown formats a highlighted review summary and finding cards', () => {
  const output = renderMarkdown({
    title: 'Terraform Demo Review',
    summary: 'Missing owner tag on a security group.',
    verdict: 'warn',
    findings: [
      {
        severity: 'high',
        title: 'Missing owner tag',
        details: 'The resource is missing owner metadata.',
        recommendation: 'Add an owner tag before merging.',
      },
      {
        severity: 'medium',
        title: 'Weak governance metadata',
        details: 'The resource uses incomplete classification fields.',
        recommendation: 'Align all tags with the repository policy.',
      },
    ],
    next_steps: ['Add missing tags', 'Re-run the workflow'],
    notes: ['Focused on changed Terraform files.'],
  });

  assert.match(output, /# ⚠️ Terraform Demo Review/);
  assert.match(output, /## 📌 At a glance/);
  assert.match(output, /\| Verdict \| ⚠️ \*\*WARN\*\* \|/);
  assert.match(output, /\| Total findings \| \*\*2\*\* \|/);
  assert.match(output, /\| High \| \*\*1\*\* \|/);
  assert.match(output, /\| Medium \| \*\*1\*\* \|/);
  assert.match(output, /## 🧭 Executive summary/);
  assert.match(output, /> Missing owner tag on a security group\./);
  assert.match(output, /\| 1 \| 🔴 \*\*HIGH\*\* \| \*\*Missing owner tag\*\* \|/);
  assert.match(output, /#### 🔴 \*\*HIGH\*\* Finding 1: Missing owner tag/);
  assert.match(output, /- \[ \] Add missing tags/);
  assert.match(output, /## 📝 Notes/);
});
