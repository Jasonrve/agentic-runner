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

test('parseResponse supports direct answers and legacy report-shaped JSON', () => {
  const response = parseResponse(JSON.stringify({
    title: 'Terraform answer',
    answer: 'Two words changed.',
    signal: 'attention',
    highlights: ['Public ingress exposure'],
    next_steps: ['Restrict ingress'],
  }));

  assert.equal(response.title, 'Terraform answer');
  assert.equal(response.answer, 'Two words changed.');
  assert.equal(response.signal, 'attention');
  assert.deepEqual(response.highlights, ['Public ingress exposure']);
});
