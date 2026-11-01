# Terraform EC2 learning lab

Companion to `terraform.html`. This creates four managed resources: a VPC, subnet, security group and private EC2 instance. There is no public IP, internet gateway, NAT gateway, or remote access. EC2 and EBS charges may apply.

## Prerequisites

- Terraform >= 1.10 and < 2.0; the configuration selects AWS provider 6.x.
- An AWS sandbox account, an enabled region and an authorized temporary-credential profile with appropriate EC2/VPC permissions.
- An available Amazon Linux x86_64 AMI in that region compatible with t3.micro and an 8 GiB root volume. Check quotas and pricing before applying.

## Run in PowerShell

If your organization uses IAM Identity Center, configure its supplied settings:

```powershell
aws configure sso --profile terraform-lab
aws sso login --profile terraform-lab
$env:AWS_PROFILE = "terraform-lab"
aws sts get-caller-identity
Copy-Item terraform.tfvars.example terraform.tfvars
```

Edit terraform.tfvars and replace the AMI placeholder. Confirm the account and region. From this directory:

```text
terraform init
terraform fmt -check
terraform validate
terraform plan -out=lab.tfplan
terraform show lab.tfplan
```

For a fresh state, expect 4 additions and no updates/deletions. After reviewing every action, `terraform apply lab.tfplan` executes the saved plan without another confirmation prompt. Then run `terraform output` and `terraform plan`; expect an instance ID, private IP and no further changes. Verify the instance and encrypted root volume in AWS.

Change `name` in terraform.tfvars and repeat plan/review/apply to observe an in-place tag update. These are expected outcomes, not a record of a live deployment.

## Cleanup

Use the same directory, credentials, backend and workspace:

```text
terraform plan -destroy -out=cleanup.tfplan
terraform show cleanup.tfplan
terraform apply cleanup.tfplan
terraform state list
```

The apply command deletes managed lab resources. Confirm the instance is terminated and the root volume is removed. Do not delete state before cleanup. Protect state, plans and credentials; commit configuration and the generated .terraform.lock.hcl, not secret input values or runtime artifacts.

## References

- https://developer.hashicorp.com/terraform/tutorials/aws-get-started
- https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance
