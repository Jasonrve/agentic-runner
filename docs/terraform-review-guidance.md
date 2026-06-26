# Terraform review guidance

The demo workflow scans the example Terraform fixture and highlights the most important findings in a PR comment.

Demo rules:

- flag any public ingress exposure from `0.0.0.0/0`
- flag missing `owner` tags on resources
- keep the report short and actionable
- prefer one PR comment that gets updated on reruns instead of creating duplicates
