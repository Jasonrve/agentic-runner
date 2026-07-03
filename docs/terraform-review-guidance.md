# Terraform governance rules

Use this document as the source of truth for Terraform security scanning.

## Review requirements

- Flag missing tags (`owner`, `cost_center`, `data_classification`, `service`) as **high severity** when they are required by the repo's tagging standard.
- Flag risky public exposure, especially `0.0.0.0/0`, open ingress from the internet, or broad egress that is not justified by the change.
- Flag hardcoded secrets, access keys, tokens, or credentials anywhere in Terraform or supporting files.
- Flag stateful resources that lack `prevent_destroy` or equivalent explicit protection when deletion would be risky.
- Focus on the changed Terraform files first, then use the repo's governance rules and shared Terraform context to confirm whether additional files introduce hidden risk.
- In agentic mode, request exact file paths when more Terraform context is needed to complete the review.
- Produce a concise, well-formatted PR comment with a verdict, findings, and next steps.

## Comment style

- Keep the summary short and specific.
- Prefer concrete remediation advice over generic warnings.
- Call out when more context was required and list the files that were requested.
- Do not invent policy that is not in this file.
