# Learning lab: one isolated EC2 instance. AWS charges can apply.
terraform {
  required_version = ">= 1.10, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region enabled in your sandbox account."
  type        = string
  default     = "us-east-1"
}

variable "ami_id" {
  description = "Available Amazon Linux x86_64 AMI in the selected region, compatible with t3.micro."
  type        = string

  validation {
    condition     = can(regex("^ami-([0-9a-f]{8}|[0-9a-f]{17})$", var.ami_id))
    error_message = "Supply an actual AMI ID from your selected AWS region."
  }
}

variable "name" {
  description = "Name tag for the lab instance."
  type        = string
  default     = "terraform-student"
}

locals {
  common_tags = {
    Project   = "terraform-course"
    ManagedBy = "Terraform"
  }
}

resource "aws_vpc" "lab" {
  cidr_block = "10.42.0.0/16"
  tags       = local.common_tags
}

resource "aws_subnet" "lab" {
  vpc_id                  = aws_vpc.lab.id
  cidr_block              = "10.42.1.0/24"
  map_public_ip_on_launch = false
  tags                    = local.common_tags
}

resource "aws_security_group" "lab" {
  name_prefix = "terraform-lab-"
  description = "Isolated learning instance: no inbound or outbound rules"
  vpc_id      = aws_vpc.lab.id
  tags        = local.common_tags
}

resource "aws_instance" "lab" {
  ami                         = var.ami_id
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.lab.id
  vpc_security_group_ids      = [aws_security_group.lab.id]
  associate_public_ip_address = false

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = 8
    delete_on_termination = true
  }

  tags = merge(local.common_tags, { Name = var.name })
}

output "instance_id" {
  description = "ID of the EC2 instance managed by this lab."
  value       = aws_instance.lab.id
}

output "private_ip" {
  description = "Private address; this lab does not configure remote access."
  value       = aws_instance.lab.private_ip
}
