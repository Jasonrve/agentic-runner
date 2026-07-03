# agentic-runner

`agentic-runner` is a generic GitHub Action for LLM workflows and injected context.
It can render a concise Markdown answer, upsert a single PR comment, and work with either a live OpenAI-compatible model or a precomputed JSON response.

## What it does

- accepts a prompt plus optional injected context
- supports `diff`, `full`, `hybrid`, and `agentic` context modes
- loads extra context files into the prompt
- calls any OpenAI-compatible LLM endpoint
- renders a clean Markdown response with:
  - direct answer
  - highlights
  - next steps
- upserts one stable PR comment instead of creating duplicates
- can fail the workflow when the response signals attention is needed
- supports a fixture path for deterministic local validation and tests

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
| `fail_on_findings` | no | `false` | Exit non-zero when the response signals attention or blocking issues |
| `comment_marker` | no | `<!-- agentic-runner -->` | Stable marker for comment upsert |
| `dry_run` | no | `false` | Render output without posting a comment |
| `mock_response_file` | no | `` | Validation helper for local/CI demo runs |
| `context_mode` | no | `diff` | Context strategy (`diff`, `full`, `hybrid`, `agentic`) |
| `focus_paths` | no | `` | File paths to focus the workflow on |
| `extra_context_paths` | no | `` | Comma or newline separated file paths to always include |
| `max_file_chars` | no | `12000` | Maximum characters to load per file |
| `max_follow_up_rounds` | no | `1` | Max extra rounds in agentic mode |

## Generic usage

```yaml
name: LLM workflow answer

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  answer:
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
            Answer the user's question directly using the changed files and injected context.
          context_mode: diff
          focus_paths: |
            docs/rules.md
          fail_on_findings: true
```

## Demo workflow in this repo

This repository includes a PR workflow that produces a Terraform security report from the example fixture and comments on the PR with a concise governance review.
The demo is powered by Bifrost and uses the repository secrets below:

- `BIFROST_ENDPOINT` = `https://bifrost.workside.win/`
- `BIFROST_VIRTUAL_KEY` = your Bifrost virtual key

The demo workflow uses the real LLM-backed action end to end.

- workflow: `.github/workflows/demo-terraform-scan.yml`
- focus file: `examples/terraform/main.tf`
- guidance: `docs/terraform-review-guidance.md`

## Local validation

- `npm test` exercises the TypeScript rendering and agentic follow-up flow
- `npm run build` bundles `dist/index.js`
- the demo workflow exercises the comment-upsert path end to end against Bifrost and a real Terraform security report workflow

## LLM contract

The action expects an OpenAI-compatible chat completions API.
It posts to:

```text
POST {llm_base_url}/v1/chat/completions
```

If you already pass a URL that ends in `/v1` or `/chat/completions`, the action will normalize it correctly.
