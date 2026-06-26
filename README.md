# agentic-runner

`agentic-runner` is a generic GitHub Action for LLM workflows and injected context.
It can render a structured Markdown report, upsert a single PR comment, and work with either a live OpenAI-compatible model or a precomputed JSON report.

## What it does

- accepts a prompt plus optional injected context
- supports `diff`, `full`, `hybrid`, and `agentic` context modes
- loads extra context files into the prompt
- calls any OpenAI-compatible LLM endpoint
- renders a clean Markdown report with:
  - verdict
  - summary
  - findings table
  - next steps
- upserts one stable PR comment instead of creating duplicates
- can fail the workflow when findings are present
- supports a fixture path for deterministic demos and CI validation

## Inputs

| Input | Required | Default | Purpose |
|---|---:|---|---|
| `prompt` | yes | — | Main instruction for the workflow |
| `context` | no | `` | Extra context appended to the prompt |
| `llm_base_url` | no | `` | OpenAI-compatible LLM base URL |
| `llm_api_key` | no | `` | OpenAI-compatible LLM API key |
| `model` | no | `openai/gpt-4o-mini` | Model to use |
| `pr_number` | no | `` | PR number to comment on |
| `post_comment` | no | `true` | Upsert the PR comment |
| `fail_on_findings` | no | `false` | Exit non-zero when findings exist |
| `comment_marker` | no | `<!-- agentic-runner -->` | Stable marker for comment upsert |
| `dry_run` | no | `false` | Render output without posting a comment |
| `mock_response_file` | no | `` | Validation helper for local/CI demo runs |
| `context_mode` | no | `diff` | Context strategy (`diff`, `full`, `hybrid`, `agentic`) |
| `extra_context_paths` | no | `` | Comma or newline separated file paths to always include |
| `max_file_chars` | no | `12000` | Maximum characters to load per file |
| `max_follow_up_rounds` | no | `1` | Max extra rounds in agentic mode |

## Generic usage

```yaml
name: LLM workflow report

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run agentic-runner
        uses: Jasonrve/agentic-runner@v1
        with:
          github_token: ${{ github.token }}
          llm_base_url: ${{ secrets.LLM_BASE_URL }}
          llm_api_key: ${{ secrets.LLM_API_KEY }}
          prompt: |
            Review the changed files in this PR and return a concise report of findings.
          context_mode: agentic
          extra_context_paths: |
            docs/rules.md
          fail_on_findings: true
```

## Demo workflow in this repo

This repository includes a PR workflow that scans the example Terraform fixture and comments on the PR with the findings report.
The demo is deterministic so it can run without any external LLM credentials.

- workflow: `.github/workflows/demo-terraform-scan.yml`
- example Terraform: `examples/terraform/main.tf`
- demo scanner: `scripts/scan-terraform-demo.mjs`

The demo scanner produces a JSON report, and `agentic-runner` turns that report into the PR comment.

## Local validation

- `npm test` exercises the TypeScript rendering and agentic follow-up flow
- `npm run build` bundles `dist/index.js`
- the demo workflow exercises the comment-upsert path with a deterministic report fixture

## LLM contract

The action expects an OpenAI-compatible chat completions API.
It posts to:

```text
POST {llm_base_url}/chat/completions
```

If your provider uses a different path, point `llm_base_url` at a compatible gateway.
