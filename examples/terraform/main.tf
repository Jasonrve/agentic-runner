terraform {
  required_version = ">= 1.5.0"
}

resource "aws_security_group" "demo" {
  name        = "agentic-runner-demo"
  description = "Safe demo security group for the agentic-runner example workflow"

  ingress {
    description = "HTTPS from the office"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    service    = "agentic-runner-demo"
    environment = "demo"
  }
}
