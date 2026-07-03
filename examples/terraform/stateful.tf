resource "aws_db_instance" "demo" {
  identifier           = "agentic-runner-demo"
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  username             = "demo"
  password             = local.db_password
  skip_final_snapshot  = true
  publicly_accessible  = false
  storage_encrypted    = true
  deletion_protection  = false
}
