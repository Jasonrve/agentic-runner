import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChatCompletionsUrl } from '../src/llm.ts';

test('buildChatCompletionsUrl normalizes a root endpoint to v1 chat completions', () => {
  assert.equal(buildChatCompletionsUrl('https://bifrost.workside.win/'), 'https://bifrost.workside.win/v1/chat/completions');
});

test('buildChatCompletionsUrl preserves existing v1 endpoints', () => {
  assert.equal(buildChatCompletionsUrl('https://bifrost.workside.win/v1'), 'https://bifrost.workside.win/v1/chat/completions');
});

test('buildChatCompletionsUrl preserves direct chat completions URLs', () => {
  assert.equal(buildChatCompletionsUrl('https://proxy.example/chat/completions'), 'https://proxy.example/chat/completions');
});
