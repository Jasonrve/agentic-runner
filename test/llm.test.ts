import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChatCompletionsUrl, parseResponse } from '../src/llm.ts';

test('buildChatCompletionsUrl normalizes a root endpoint to v1 chat completions', () => {
  assert.equal(buildChatCompletionsUrl('https://bifrost.workside.win/'), 'https://bifrost.workside.win/v1/chat/completions');
});

test('buildChatCompletionsUrl preserves existing v1 endpoints', () => {
  assert.equal(buildChatCompletionsUrl('https://bifrost.workside.win/v1'), 'https://bifrost.workside.win/v1/chat/completions');
});

test('buildChatCompletionsUrl preserves direct chat completions URLs', () => {
  assert.equal(buildChatCompletionsUrl('https://proxy.example/chat/completions'), 'https://proxy.example/chat/completions');
});

test('parseResponse supports security report JSON', () => {
  const response = parseResponse(JSON.stringify({
    title: 'Terraform governance review',
    summary: 'The changed Terraform has security and governance gaps.',
    verdict: 'warn',
    findings: [
      {
        severity: 'high',
        title: 'Public ingress exposure',
        details: '0.0.0.0/0 is used for HTTPS.',
        recommendation: 'Restrict the CIDR blocks to trusted networks.',
      },
    ],
    next_steps: ['Tighten ingress', 'Add missing tags'],
    notes: ['Generated from the governance docs.'],
  }));

  assert.equal(response.title, 'Terraform governance review');
  assert.equal(response.summary, 'The changed Terraform has security and governance gaps.');
  assert.equal(response.verdict, 'warn');
  assert.equal(response.signal, 'attention');
  assert.equal(response.findings?.length, 1);
  assert.equal(response.findings?.[0].severity, 'high');
  assert.match(response.highlights[0], /Public ingress exposure/);
});
