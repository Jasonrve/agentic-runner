import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeReview } from '../src/runner.ts';
import { ReviewDeps, ReviewInputs } from '../src/types.ts';

test('executeReview performs an agentic second round when files are requested', async () => {
  const calls: string[] = [];
  const inputs: ReviewInputs = {
    prompt: 'Review the Terraform governance changes',
    context: 'Repo governance docs',
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
            summary: 'Need one more file to complete the security review.',
            signal: 'attention',
            verdict: 'warn',
            findings: [],
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
          summary: 'The Terraform still has one public ingress issue and one missing governance tag.',
          signal: 'attention',
          verdict: 'warn',
          findings: [
            {
              severity: 'high',
              title: 'Public ingress exposure',
              details: '0.0.0.0/0 remains on the ingress rule.',
              recommendation: 'Restrict ingress to trusted networks.',
            },
          ],
          highlights: ['Used the requested file context.'],
          next_steps: ['Tighten ingress'],
          notes: [],
        },
        rawContent: '{}',
      };
    },
  };

  const result = await executeReview(inputs, deps);

  assert.equal(calls.length, 2);
  assert.match(calls[1], /contents of main.tf/);
  assert.equal(result.response.verdict, 'warn');
  assert.match(result.markdown, /## Findings/);
  assert.match(result.markdown, /Public ingress exposure/);
});
