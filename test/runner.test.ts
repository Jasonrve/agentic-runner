import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeReview } from '../src/runner.ts';
import { ReviewDeps, ReviewInputs } from '../src/types.ts';

test('executeReview performs an agentic second round when files are requested', async () => {
  const calls: string[] = [];
  const inputs: ReviewInputs = {
    prompt: 'Answer the question about the changed Terraform',
    context: 'Repo rules',
    llmBaseUrl: 'https://example.invalid/v1',
    llmApiKey: 'dummy',
    model: 'openai/gpt-4o-mini',
    prNumber: null,
    postComment: false,
    failOnFindings: false,
    commentMarker: '<!-- agentic-runner -->',
    dryRun: true,
    mockResponseFile: '',
    contextMode: 'agentic',
    focusPaths: [],
    extraContextPaths: [],
    maxFileChars: 2000,
    maxFollowUpRounds: 1,
  };

  const deps: ReviewDeps = {
    fetchRepoContext: async () => ({
      repoRoot: '/tmp/repo',
      baseSha: 'base',
      headSha: 'head',
      changedFiles: ['main.tf'],
      diffText: 'diff --git a/main.tf b/main.tf',
      extraFiles: [],
    }),
    loadFiles: async (_repoRoot: string, paths: string[]) => paths.map((path: string) => ({ path, content: `contents of ${path}`, truncated: false })),
    chat: async (_request, messages) => {
      calls.push(messages.map((message) => `${message.role}:${message.content}`).join('\n---\n'));
      if (calls.length === 1) {
        return {
          response: {
            title: 'Initial pass',
            answer: 'Need one more file to answer the question.',
            signal: 'attention',
            highlights: [],
            next_steps: [],
            notes: [],
            requests: [{ path: 'main.tf', reason: 'Need the full file', mode: 'full' }],
          },
          rawContent: '{}',
        };
      }

      return {
        response: {
          title: 'Final answer',
          answer: 'Two words changed and the PR should mention the public ingress exposure.',
          signal: 'success',
          highlights: ['Used the requested file context.'],
          next_steps: [],
          notes: [],
        },
        rawContent: '{}',
      };
    },
  };

  const result = await executeReview(inputs, deps);

  assert.equal(calls.length, 2);
  assert.match(calls[1], /contents of main.tf/);
  assert.equal(result.response.signal, 'success');
  assert.match(result.markdown, /Two words changed/);
  assert.doesNotMatch(result.markdown, /findings table/i);
});
