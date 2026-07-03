import * as core from '@actions/core';
import * as github from '@actions/github';
import { buildContextNarrative, fetchRepoContext, loadFiles, parsePathList } from './context.ts';
import { buildMessages, callLlm, parseResponse } from './llm.ts';
import { renderMarkdown } from './render.ts';
import { AgenticChatResult, ReviewDeps, ReviewInputs, WorkflowResponse } from './types.ts';

export async function executeReview(inputs: ReviewInputs, deps?: ReviewDeps): Promise<{ response: WorkflowResponse; markdown: string; repoRoot: string }> {
  const actualDeps = deps ?? (await buildDeps(inputs));
  const repoContext = await actualDeps.fetchRepoContext(inputs);
  const contextNarrative = buildContextNarrative(repoContext, inputs.contextMode);

  const initialMessages = buildMessages(inputs.prompt, contextNarrative + (inputs.context ? `\n\n${inputs.context}` : ''));
  const first = await actualDeps.chat(
    {
      model: inputs.model,
      temperature: 0.2,
      messages: initialMessages,
    },
    initialMessages,
  );

  let response = first.response;

  if (inputs.contextMode === 'agentic' && Array.isArray(response.requests) && response.requests.length > 0 && inputs.maxFollowUpRounds > 0) {
    const requestedPaths = response.requests.map((request) => request.path).filter(Boolean);
    const requestedFiles = await actualDeps.loadFiles(repoContext.repoRoot, requestedPaths, inputs.maxFileChars);
    const followUp = [
      'The model requested additional file context.',
      'Requested files:',
      ...requestedFiles.flatMap((file) => [
        `### ${file.path}`,
        '```',
        file.content,
        '```',
        '',
      ]),
      'Return a complete final JSON response without mentioning this follow-up exchange.',
    ].join('\n');

    const followUpMessages = buildMessages(inputs.prompt, contextNarrative + (inputs.context ? `\n\n${inputs.context}` : ''), followUp);
    const second = await actualDeps.chat(
      {
        model: inputs.model,
        temperature: 0.2,
        messages: followUpMessages,
      },
      followUpMessages,
    );
    response = second.response;
  }

  const markdown = renderMarkdown(response);
  return { response, markdown, repoRoot: repoContext.repoRoot };
}

export function parseInputs(): ReviewInputs {
  const contextMode = (core.getInput('context_mode') || 'diff').trim() as ReviewInputs['contextMode'];
  return {
    prompt: core.getInput('prompt', { required: true }),
    context: core.getInput('context'),
    llmBaseUrl: core.getInput('llm_base_url'),
    llmApiKey: core.getInput('llm_api_key'),
    model: core.getInput('model') || 'openai/gpt-4o-mini',
    prNumber: (() => {
      const raw = core.getInput('pr_number');
      if (raw) return Number(raw);
      const payload = github.context.payload as { pull_request?: { number?: number }; issue?: { number?: number } };
      return payload.pull_request?.number ?? payload.issue?.number ?? null;
    })(),
    postComment: core.getInput('post_comment') !== 'false',
    failOnFindings: core.getInput('fail_on_findings') === 'true',
    commentMarker: core.getInput('comment_marker') || '<!-- agentic-runner -->',
    dryRun: core.getInput('dry_run') === 'true',
    mockResponseFile: core.getInput('mock_response_file'),
    contextMode: ['diff', 'full', 'hybrid', 'agentic'].includes(contextMode) ? contextMode : 'diff',
    focusPaths: parsePathList(core.getInput('focus_paths')),
    extraContextPaths: parsePathList(core.getInput('extra_context_paths')),
    maxFileChars: Number(core.getInput('max_file_chars') || '12000'),
    maxFollowUpRounds: Number(core.getInput('max_follow_up_rounds') || '1'),
  };
}

function parseMockResponse(path: string): WorkflowResponse {
  const raw = require('node:fs').readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed?.choices?.[0]?.message?.content) {
    return parseResponse(parsed.choices[0].message.content);
  }
  return parseResponse(raw);
}

async function buildDeps(inputs: ReviewInputs): Promise<ReviewDeps> {
  return {
    fetchRepoContext,
    loadFiles,
    chat: async (request, _messages): Promise<AgenticChatResult> => {
      if (inputs.mockResponseFile) {
        const response = parseMockResponse(inputs.mockResponseFile);
        return { response, rawContent: JSON.stringify(response) };
      }
      if (!inputs.llmBaseUrl) {
        throw new Error('llm_base_url is required');
      }
      if (!inputs.llmApiKey) {
        throw new Error('llm_api_key is required');
      }
      const response = await callLlm(request, inputs.llmBaseUrl, inputs.llmApiKey);
      return { response, rawContent: JSON.stringify(response) };
    },
  };
}

export async function main(): Promise<void> {
  try {
    const inputs = parseInputs();
    const deps = await buildDeps(inputs);
    const result = await executeReview(inputs, deps);

    core.setOutput('signal', result.response.signal);
    core.setOutput('answer', result.response.answer);
    core.setOutput('comment_body', result.markdown);

    if (inputs.postComment && !inputs.dryRun) {
      const octokit = github.getOctokit(core.getInput('github_token') || process.env.GITHUB_TOKEN || '');
      const body = `${inputs.commentMarker}\n\n${result.markdown}`;
      const issueNumber = inputs.prNumber;
      if (issueNumber) {
        const comments = await octokit.paginate(octokit.rest.issues.listComments, {
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: issueNumber,
          per_page: 100,
        });
        const existing = comments.find((comment) => comment.body?.includes(inputs.commentMarker));
        if (existing) {
          const updated = await octokit.rest.issues.updateComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            comment_id: existing.id,
            body,
          });
          core.setOutput('comment_url', updated.data.html_url);
        } else {
          const created = await octokit.rest.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: issueNumber,
            body,
          });
          core.setOutput('comment_url', created.data.html_url);
        }
      }
    }

    if (inputs.failOnFindings && result.response.signal !== 'success') {
      core.setFailed('agentic-runner response indicates attention is needed');
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
