export type ResponseSignal = 'success' | 'attention' | 'blocked';
export type ContextMode = 'diff' | 'full' | 'hybrid' | 'agentic';

export interface FileRequest {
  path: string;
  reason: string;
  mode?: 'full' | 'snippet' | 'diff';
}

export interface WorkflowResponse {
  title: string;
  answer: string;
  signal: ResponseSignal;
  highlights: string[];
  next_steps: string[];
  notes: string[];
  requests?: FileRequest[];
}

export type ReviewReport = WorkflowResponse;

export interface ReviewInputs {
  prompt: string;
  context: string;
  llmBaseUrl: string;
  llmApiKey: string;
  model: string;
  prNumber: number | null;
  postComment: boolean;
  failOnFindings: boolean;
  commentMarker: string;
  dryRun: boolean;
  mockResponseFile: string;
  contextMode: ContextMode;
  focusPaths: string[];
  extraContextPaths: string[];
  maxFileChars: number;
  maxFollowUpRounds: number;
}

export interface RepoContext {
  repoRoot: string;
  baseSha: string;
  headSha: string;
  changedFiles: string[];
  diffText: string;
  extraFiles: LoadedFile[];
}

export interface LoadedFile {
  path: string;
  content: string;
  truncated: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
}

export interface AgenticChatResult {
  response: WorkflowResponse;
  rawContent: string;
}

export interface ReviewDeps {
  chat: (request: ChatRequest, messages: ChatMessage[]) => Promise<AgenticChatResult>;
  loadFiles: (repoRoot: string, paths: string[], maxChars: number) => Promise<LoadedFile[]>;
  fetchRepoContext: (inputs: ReviewInputs) => Promise<RepoContext>;
}
