# Terraform review guidance

The demo workflow answers a question about the example Terraform fixture and writes a direct PR comment.

Demo rules:

- flag any public ingress exposure from `0.0.0.0/0`
- flag missing `owner` tags on resources
- keep the answer short and actionable
- prefer one PR comment that gets updated on reruns instead of creating duplicates
