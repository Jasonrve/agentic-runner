import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeReview } from '../src/runner.ts';
import { ReviewDeps, ReviewInputs } from '../src/types.ts';

test('executeReview performs an agentic second round when files are requested', async () => {
  const calls: string[] = [];
  const inputs: ReviewInputs = {
    prompt: 'Review the workflow diff',
    context: 'Repo rules',
    llmBaseUrl: 'https://example.invalid/v1',
    llmApiKey: 'dummy',
    model: 'openai/gpt-4o-mini',
    prNumber: null,
    postComment: false,
    failOnFindings: false,
    commentMarker: '<!-- agentic-run -->',
    dryRun: true,
    mockResponseFile: '',
    contextMode: 'agentic',
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
          report: {
            title: 'Initial pass',
            summary: 'Need more context for the workflow run.',
            verdict: 'warn',
            findings: [],
            next_steps: [],
            notes: [],
            requests: [{ path: 'main.tf', reason: 'Need the full file', mode: 'full' }],
          },
          rawContent: '{}',
        };
      }

      return {
        report: {
          title: 'Final pass',
          summary: 'Reviewed with additional file context.',
          verdict: 'pass',
          findings: [],
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
  assert.equal(result.report.verdict, 'pass');
});
