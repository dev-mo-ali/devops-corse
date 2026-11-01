# Prompt for Codex in VS Code

Copy the prompt below into Codex with your intended project folder open in VS Code.

---

You are a Terraform instructor and AWS infrastructure engineer. Create a small, beginner-friendly Terraform project in this workspace. Implement the files directly; do not stop at a plan or explanation.

## Goal

Help me learn Terraform by creating, inspecting, changing and deleting one AWS EC2 instance. Prioritize readable code, useful comments and a clear README. This is a learning project, not a production platform.

## Before editing

- Read any applicable AGENTS.md instructions and inspect the workspace.
- Create the project in `terraform-simple-project/`. If that folder already contains work, inspect and preserve it rather than overwriting unrelated files.
- Check the installed Terraform version and consult current official HashiCorp and AWS provider documentation for the syntax you use.
- Do not install or upgrade system tools automatically. If a required tool is missing or incompatible, explain what I need to install.

## Infrastructure

Create only these four managed resources:

1. A VPC with CIDR `10.42.0.0/16`.
2. A subnet with CIDR `10.42.1.0/24`, referencing the VPC.
3. A dedicated security group with no inbound or outbound rules.
4. One EC2 instance in that subnet, referencing the security group.

Use these defaults and requirements:

- AWS region: `us-east-1`, configurable through an input variable.
- Instance type: `t3.micro`, configurable through an input variable.
- Instance Name tag: `terraform-student`, configurable through an input variable.
- AMI ID: required input with no hard-coded default. Explain how I select an available Amazon Linux x86_64 AMI in the chosen region, compatible with the instance type and an 8 GiB root volume.
- Disable public IP assignment on the subnet and instance.
- Require IMDSv2. Use an encrypted 8 GiB gp3 root volume with deletion on instance termination.
- Use common tags such as `Project = "terraform-learning"` and `ManagedBy = "Terraform"`.
- Use resource references so Terraform infers dependencies; do not add unnecessary `depends_on` arguments.
- Use local state for this first project.

This is an isolated infrastructure lifecycle lab. Do not add SSH access, key pairs, internet gateways, NAT gateways, load balancers, databases, application installation, provisioners, modules, remote state, workspaces, CI/CD or extra cloud services. Clearly explain that the instance will not be reachable from the internet and that AWS charges may apply.

## Files to create

```text
terraform-simple-project/
  main.tf
  variables.tf
  outputs.tf
  terraform.tfvars.example
  .gitignore
  README.md
```

- `main.tf`: Terraform and provider requirements, provider configuration, common tag locals, and the four resources. Add short comments explaining each block and its relationships.
- `variables.tf`: typed inputs with descriptions and sensible defaults. Validate the AMI ID format, but explain that format validation cannot prove an AMI exists or is compatible.
- `outputs.tf`: instance ID, private IP address, VPC ID and subnet ID, each with a description.
- `terraform.tfvars.example`: example values and an obvious AMI placeholder that must be replaced. No credentials.
- `.gitignore`: exclude `.terraform/`, state files and backups, saved plans, local variable-value files and diagnostic logs. Keep the example input file trackable. Do not ignore `.terraform.lock.hcl`.
- `README.md`: a practical walkthrough for a beginner using VS Code on Windows with PowerShell.

Keep configuration in these files, without abstraction layers or additional dependencies. Choose explicit compatible Terraform and AWS provider version constraints and explain them briefly.

## README walkthrough

Include these steps in order, with commands I can copy:

1. Explain what each file does and include a simple diagram showing VPC → subnet → EC2, with the security group attached to EC2.
2. List prerequisites: Terraform, AWS CLI, an AWS sandbox account, an authorized profile and appropriate EC2/VPC permissions.
3. Show how to use an existing AWS profile in PowerShell with `$env:AWS_PROFILE`. Include IAM Identity Center login as an option if my organization uses it. Never ask me to paste credentials into Terraform files or chat.
4. Show how I can confirm my account with `aws sts get-caller-identity` before deploying.
5. Copy `terraform.tfvars.example` to `terraform.tfvars`, then replace the AMI placeholder. Explain region and CPU architecture compatibility.
6. Run `terraform init`, `terraform fmt`, and `terraform validate`. Explain what each checks and what it does not check.
7. Run `terraform plan -out=lab.tfplan` and `terraform show lab.tfplan`. For a new state, explain why four resource additions are expected.
8. Explain that `terraform apply lab.tfplan` creates billable resources and executes the saved plan without a second confirmation prompt. Tell me to review the plan first.
9. Inspect outputs, use `terraform state list`, verify the instance in the AWS console, and run another plan to check for no changes.
10. Change only the instance Name tag through the input variable. Create and review another plan, then apply it to observe an in-place tag update.
11. Clean up using `terraform plan -destroy -out=cleanup.tfplan`, inspect that plan, and execute it with `terraform apply cleanup.tfplan`. Confirm the instance and root volume are removed and state has no managed resources left.
12. Explain common problems: expired credentials, wrong account/region, invalid AMI, incompatible architecture, insufficient permissions and quota limits.

Include a short glossary for provider, resource, variable, local, output, plan and state. Explain that deleting a state file does not delete AWS resources. Link the relevant official documentation.

## Validation and execution boundary

- You may run local formatting checks, `terraform init -backend=false` to install declared providers, and `terraform validate`, when tools and network access are available.
- Do not run AWS commands, `terraform plan`, `terraform apply`, `terraform destroy`, import or state-changing commands on my behalf. Put those commands in the README for me to run.
- Do not create a real `terraform.tfvars` containing guessed account-specific values.
- Do not weaken version constraints merely to make validation pass on an incompatible local Terraform installation.
- Report exactly which checks passed, which were blocked and why. Do not claim the project has been deployed or tested against AWS.

## Completion

After creating the files, give me a concise summary, the project folder path, validation results and the first steps I should run. Keep the result simple enough that I can read every file and understand how the resources connect.
