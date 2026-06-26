import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { context as githubContext } from '@actions/github';
import { ContextMode, LoadedFile, RepoContext, ReviewInputs } from './types.ts';

const execFileAsync = promisify(execFile);

export function parsePathList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 20 * 1024 * 1024 });
  return stdout.toString();
}

function resolveBaseHead(): { baseSha: string; headSha: string } {
  const payload = githubContext.payload as Record<string, unknown>;
  const pullRequest = payload.pull_request as { base?: { sha?: string }; head?: { sha?: string } } | undefined;

  if (pullRequest?.base?.sha && pullRequest?.head?.sha) {
    return { baseSha: pullRequest.base.sha, headSha: pullRequest.head.sha };
  }

  const before = typeof payload.before === 'string' ? payload.before : '';
  const sha = typeof githubContext.sha === 'string' ? githubContext.sha : '';
  if (before && sha) {
    return { baseSha: before, headSha: sha };
  }

  return { baseSha: 'HEAD~1', headSha: 'HEAD' };
}

async function readTrackedFile(repoRoot: string, relativePath: string, maxChars: number): Promise<LoadedFile> {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const normalizedRoot = path.resolve(repoRoot) + path.sep;
  if (!absolutePath.startsWith(normalizedRoot)) {
    throw new Error(`Refusing to read path outside repository: ${relativePath}`);
  }

  const content = await fs.readFile(absolutePath, 'utf8');
  if (content.length <= maxChars) {
    return { path: relativePath, content, truncated: false };
  }

  return { path: relativePath, content: `${content.slice(0, maxChars)}\n...<truncated>...`, truncated: true };
}

export async function loadFiles(repoRoot: string, paths: string[], maxChars: number): Promise<LoadedFile[]> {
  const uniquePaths = [...new Set(paths.map((item) => item.trim()).filter(Boolean))];
  const loaded: LoadedFile[] = [];
  for (const filePath of uniquePaths) {
    try {
      loaded.push(await readTrackedFile(repoRoot, filePath, maxChars));
    } catch (error) {
      loaded.push({ path: filePath, content: `Unable to load ${filePath}: ${(error as Error).message}`, truncated: false });
    }
  }
  return loaded;
}

export async function fetchRepoContext(inputs: ReviewInputs): Promise<RepoContext> {
  const repoRoot = (await runGit(['rev-parse', '--show-toplevel'], process.cwd())).trim();
  const { baseSha, headSha } = resolveBaseHead();
  const focusPaths = inputs.focusPaths.length > 0 ? [...new Set(inputs.focusPaths.map((item) => item.trim()).filter(Boolean))] : [];
  const targetPaths = focusPaths.length > 0 ? focusPaths : undefined;
  try {
    await runGit(['fetch', '--no-tags', '--depth=1', 'origin', baseSha, headSha], repoRoot);
  } catch {
    // Best effort: some local or fixture-based runs already have the SHAs available.
  }
  const changedFilesRaw = targetPaths
    ? targetPaths.join('\n')
    : await runGit(['diff', '--name-only', baseSha, headSha], repoRoot);
  const changedFiles = changedFilesRaw.split('\n').map((item) => item.trim()).filter(Boolean);

  const diffArgs = ['diff', '--unified=0', baseSha, headSha, '--', ...(targetPaths ?? changedFiles)];
  const diffText = changedFiles.length > 0 ? await runGit(diffArgs, repoRoot) : await runGit(['diff', '--unified=0', baseSha, headSha], repoRoot);

  const loadedPaths = [...new Set([
    ...inputs.extraContextPaths,
    ...focusPaths,
    ...(inputs.contextMode === 'full' || inputs.contextMode === 'hybrid' ? changedFiles : []),
  ])];
  const extraFiles = loadedPaths.length > 0 ? await loadFiles(repoRoot, loadedPaths, inputs.maxFileChars) : [];

  return { repoRoot, baseSha, headSha, changedFiles, diffText, extraFiles };
}

export function buildContextNarrative(repo: RepoContext, mode: ContextMode): string {
  const lines: string[] = [];
  const repoName = process.env.GITHUB_REPOSITORY || 'unknown/unknown';
  lines.push(`Repository: ${repoName}`);
  const payloadIssue = githubContext.payload.issue as { number?: number } | undefined;
  if (typeof payloadIssue?.number === 'number') {
    lines.push(`PR: #${payloadIssue.number}`);
  }
  lines.push(`Base SHA: ${repo.baseSha}`);
  lines.push(`Head SHA: ${repo.headSha}`);
  lines.push('');
  lines.push('Changed files:');
  if (repo.changedFiles.length > 0) {
    for (const file of repo.changedFiles) {
      lines.push(`- ${file}`);
    }
  } else {
    lines.push('- None');
  }
  lines.push('');

  if (repo.extraFiles.length > 0) {
    lines.push('Extra file context:');
    for (const file of repo.extraFiles) {
      lines.push(`### ${file.path}`);
      lines.push('```');
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('Diff:');
  lines.push('```diff');
  lines.push(repo.diffText || 'No diff available.');
  lines.push('```');
  lines.push('');

  if (mode === 'agentic') {
    lines.push('Agentic instruction:');
    lines.push('If more file contents are needed, return a JSON array in `requests` with the paths and reasons.');
    lines.push('');
  }

  return lines.join('\n');
}
