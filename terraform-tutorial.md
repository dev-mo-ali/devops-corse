# Terraform Tutorial

## Learn Terraform architecture and workflows with AWS

Terraform describes infrastructure as code. You write the desired configuration, review a proposed execution plan, and apply the approved changes. This tutorial explains how resources, providers, state, modules, and team workflows fit together, using AWS examples.

The lessons move from resource references and basic commands to reusable modules, remote state, security, and enterprise workflows.

## Contents

1. [Architecture and resource references](#1-architecture-and-resource-references)
2. [Terraform settings and provider versions](#2-terraform-settings-and-provider-versions)
3. [The dependency lock file](#3-the-dependency-lock-file)
4. [Initialize plan apply and destroy](#4-initialize-plan-apply-and-destroy)
5. [Local state and infrastructure tracking](#5-local-state-and-infrastructure-tracking)
6. [Large infrastructures refresh and targeting](#6-large-infrastructures-refresh-and-targeting)
7. [Provisioners and connections](#7-provisioners-and-connections)
8. [SSH keys and EC2 key pairs](#8-ssh-keys-and-ec2-key-pairs)
9. [Data sources](#9-data-sources)
10. [Provider aliases and AWS profiles](#10-provider-aliases-and-aws-profiles)
11. [Import existing resources](#11-import-existing-resources)
12. [Taint and resource replacement](#12-taint-and-resource-replacement)
13. [Formatting validation inspection and debugging](#13-formatting-validation-inspection-and-debugging)
14. [Variables and HCL expressions](#14-variables-and-hcl-expressions)
15. [Count for_each and splat expressions](#15-count-for_each-and-splat-expressions)
16. [Local values functions and dynamic blocks](#16-local-values-functions-and-dynamic-blocks)
17. [Local modules and module inputs](#17-local-modules-and-module-inputs)
18. [Module locals and child outputs](#18-module-locals-and-child-outputs)
19. [Registry modules sources and versions](#19-registry-modules-sources-and-versions)
20. [CLI workspaces](#20-cli-workspaces)
21. [Team collaboration and Git](#21-team-collaboration-and-git)
22. [Backends and state locking](#22-backends-and-state-locking)
23. [State management commands](#23-state-management-commands)
24. [Sharing remote state outputs](#24-sharing-remote-state-outputs)
25. [HCP Terraform and Terraform Enterprise](#25-hcp-terraform-and-terraform-enterprise)
26. [Sentinel policies](#26-sentinel-policies)
27. [Security and Vault](#27-security-and-vault)
28. [Dependency graphs and module downloads](#28-dependency-graphs-and-module-downloads)
29. [Publishing modules and private registries](#29-publishing-modules-and-private-registries)
30. [Air-gapped environments](#30-air-gapped-environments)
31. [Null resources and terraform_data](#31-null-resources-and-terraform_data)
32. [Resource lifecycle rules](#32-resource-lifecycle-rules)
33. [Variable validation](#33-variable-validation)
34. [Practice workflow](#34-practice-workflow)
35. [Technical corrections to the source](#35-technical-corrections-to-the-source)

## Before you begin

You should understand basic AWS concepts such as EC2 instances, VPCs, subnets, regions, and IAM permissions. To run AWS examples, you need Terraform, an AWS account, and authenticated AWS access with appropriate permissions.

Examples are independent teaching snippets unless a section explicitly groups them into files. Do not paste every example into one directory: several reuse resource names or show alternative configurations. Declare all referenced variables and providers when assembling a project.

Values such as account names, bucket names, instance IDs, and AMI IDs must match your environment. Use an AMI that exists in your chosen region and matches your instance architecture. Creating AWS resources can incur charges; review plans and remove learning resources when finished.

## 1 Architecture and resource references

Terraform has several cooperating parts:

| Component | Responsibility |
| --- | --- |
| Configuration | Describes the desired resources in `.tf` files |
| Terraform Core | Evaluates configuration, builds dependencies, and coordinates operations |
| Provider | Implements resource operations against an API such as AWS |
| State | Records the association between Terraform addresses and real objects |
| Backend | Determines where Terraform stores state and whether locking is supported |

### References across files

Terraform evaluates the `.tf` files in one module directory together. Filenames organize your code; they do not create separate namespaces or determine execution order. A resource in `compute.tf` can reference a resource in `network.tf` directly.

**network.tf**

```hcl
resource "aws_vpc" "main_vpc" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "Training-VPC"
  }
}

resource "aws_subnet" "app_subnet" {
  vpc_id            = aws_vpc.main_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"
}
```

**compute.tf**

```hcl
variable "ami_id" {
  type        = string
  description = "An available Linux AMI ID in us-east-1."
}

resource "aws_instance" "app_server" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.app_subnet.id

  tags = {
    Name = "App-Server"
  }
}
```

The reference syntax is:

```text
resource_type.resource_name.attribute
```

`aws_subnet.app_subnet.id` means “the ID of the subnet managed at this address.” It also tells Terraform that the instance depends on the subnet.

This example creates a subnet, but does not configure public internet access. A subnet name alone does not make it public; internet routing and the necessary instance networking settings must also exist.

### References across modules

Terraform does not automatically load subdirectories as part of the same module. Call them using `module` blocks. A child module exposes values with `output` blocks, and another module receives them through input variables.

```text
Network module output → Root module expression → Compute module input
```

### Implicit and explicit dependencies

The subnet's `vpc_id = aws_vpc.main_vpc.id` creates an **implicit dependency**. Terraform can infer the required order from the value reference.

Use `depends_on` for a real dependency that the value references do not express. For example, an instance may need an IAM policy attachment completed before its startup program accesses a service:

```hcl
# Inside the instance resource, when this attachment exists in your project:
depends_on = [aws_iam_role_policy_attachment.application_access]
```

This is an **explicit dependency**. It controls ordering; it does not grant permissions or guarantee that an application is healthy. Prefer ordinary references whenever they describe the relationship correctly.

## 2 Terraform settings and provider versions

The `terraform` block declares requirements and settings for the configuration. Place it in a file such as `versions.tf`.

```hcl
terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}
```

This preserves the source document's AWS provider 5.x example; it is not a claim that 5.x is the latest release. Select and test versions deliberately for your project. Later features may need a newer Terraform version than this introductory example.

| Setting | Meaning |
| --- | --- |
| `required_version` | Allowed Terraform CLI versions |
| `required_providers` | Provider source addresses and allowed versions |
| `provider "aws"` | Configuration for a provider, such as region or profile |
| `backend` | State storage configuration |
| `cloud` | Integration with HCP Terraform |

`~> 5.0` permits versions from 5.0 up to, but excluding, 6.0. `~> 5.31.0` permits 5.31.x releases but excludes 5.32.0. An exact constraint such as `5.31.0` allows only that version.

Backend settings are initialized before normal resource evaluation, so they cannot use ordinary input variables or resource references. A configuration cannot use both a `backend` block and a `cloud` block. See the [Terraform block reference](https://developer.hashicorp.com/terraform/language/block/terraform).

## 3 The dependency lock file

`terraform init` creates or updates `.terraform.lock.hcl` to record selected provider versions and package checksums.

### Location and ownership

The filename is always `.terraform.lock.hcl`. It belongs to the whole configuration and lives alongside the root module's `.tf` files in the working directory, rather than inside each child module.

### How initialization selects a provider

Terraform considers both the configuration's version constraints and any recorded selection:

| Situation | Result |
| --- | --- |
| No locked selection for this provider | Select the newest available version satisfying all applicable constraints, then record it. |
| A compatible version is already locked | Reuse that version, even when a newer release exists. |
| Run `terraform init -upgrade` | Reconsider the selection and choose the newest version allowed by the constraints. |

### What the file records

Its main fields are:

| Field | Purpose |
| --- | --- |
| `version` | The selected provider version |
| `constraints` | The version constraints considered when selecting it |
| `hashes` | Accepted checksums for provider packages |

### Checksum verification

When previously recorded checksums exist, an installed provider package must match at least one of them. If none match, Terraform reports an installation error. Investigate the package source and platform checksums before changing the lock file.

Commit this file to Git. Do not commit the downloaded `.terraform/` directory. The lock file coordinates provider selections across machines; checksums help detect unexpected package changes. They do not guarantee that a provider is safe or that entire environments are identical.

**The lock file tracks providers, not remote module versions.** Pin registry module versions separately and use stable Git references.

### Deliberate upgrades

To intentionally reconsider dependency selections within the configured constraints:

```shell
terraform init -upgrade
```

Review the resulting lock-file changes and infrastructure plan. Without `-upgrade`, initialization normally reuses compatible locked provider selections. If a changed constraint excludes the locked version, Terraform requires an upgrade rather than silently choosing another version.

For teams using multiple operating systems, the `terraform providers lock` command can prepare checksums for additional platforms. Let Terraform maintain the file rather than inventing hashes or editing it manually. See the [dependency lock file documentation](https://developer.hashicorp.com/terraform/language/files/dependency-lock).

## 4 Initialize plan apply and destroy

### Initialize

```shell
terraform init
```

Initialization prepares the backend, installs required modules and providers, and manages the provider lock file. Run it for a new working directory and after relevant dependency or backend changes.

### Plan

```shell
terraform plan
```

Terraform evaluates the configuration and dependency graph, reads the recorded state, and normally refreshes information about managed objects through providers. It calculates how to move from the observed infrastructure to the desired configuration.

| Plan symbol | Meaning |
| --- | --- |
| `+` | Create |
| `~` | Update in place |
| `-` | Destroy |
| `-/+` | Destroy and then replace |
| `+/-` | Create a replacement before destroying the old object |

A normal plan does not apply the proposed infrastructure changes. Planning may still access APIs, acquire a state lock, and read data sources. It is not an offline operation.

Save a plan when you want to apply the reviewed result:

```shell
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
```

Treat saved plans as sensitive artifacts. Applying a saved plan does not request the usual interactive approval. See the [plan command reference](https://developer.hashicorp.com/terraform/cli/commands/plan).

### Apply

```shell
terraform apply
```

Without a saved plan argument, Terraform creates a new plan and normally asks for approval. It does not automatically reuse the plan previously printed in your terminal.

Terraform asks providers to carry out operations in dependency order, allowing independent operations to run concurrently. It records successful changes in state and displays configured root outputs. A failed apply can leave partial changes; inspect the error and run a fresh plan before continuing.

### Destroy

```shell
terraform plan -destroy
terraform destroy
```

Destruction removes managed resources in an order consistent with their dependencies. It is not simply reverse creation time. For example, instances must usually be removed before the subnets they use.

Destroy operates on the selected configuration and state. It does not clean up every resource in an AWS account. Failed deletions, retained objects, or resources managed elsewhere may remain.

## 5 Local state and infrastructure tracking

State maps an address such as `aws_instance.app_server` to a real object such as an EC2 instance ID. It also records attributes, dependency information, outputs, and bookkeeping metadata such as lineage and serial numbers.

The default local backend stores state in `terraform.tfstate`. The file is JSON, but you should manage it through Terraform commands rather than edit it by hand. Serial numbers are bookkeeping, not encryption or a cryptographic integrity guarantee.

State allows Terraform to distinguish an existing managed instance from an unrelated instance. It is not a replacement for the configuration: the configuration expresses what you want, and state records the objects Terraform manages.

Local state works for individual exercises, but separate copies on colleagues' computers do not provide a shared view of infrastructure. For collaborative work, use shared state storage, appropriate permissions, backups, and supported locking.

State can contain secrets. Keep it out of Git, protect access, and enable encryption where the storage system supports it. Losing state does not immediately delete cloud resources, but reconstructing their Terraform associations can require recovery or import work.

## 6 Large infrastructures refresh and targeting

Large configurations can make planning slow because of provider API calls, graph evaluation, and the amount of state being processed. They can also expose many unrelated resources to a single mistaken change.

Separate independently managed layers into root configurations with distinct states when appropriate. Child modules organize code, but calling several child modules from one root does **not** automatically give each module its own state.

### Large infrastructure and API limits

A normal plan refreshes managed objects through provider APIs. With many EC2 instances, security groups, subnets, and buckets, these requests can encounter service throttling or API rate limits.

For example, a project might use these independently managed roots:

```text
infrastructure/
  network/      # VPC, subnets, security groups; its own state
  compute/      # EC2 and load balancer; its own state
  database/     # RDS; its own state
  storage/      # S3; its own state
```

Each directory contains its own root configuration and is initialized, planned, and applied separately. With a remote backend, give each root a distinct state location. Merely putting `ec2.tf`, `subnets.tf`, and `s3.tf` in the same directory still produces one root configuration using the same state.

Smaller states reduce the scope of each run, but do not increase AWS API quotas; simultaneous runs can still be throttled. Choose boundaries by ownership and lifecycle, and explicitly pass shared values such as subnet IDs between roots. Existing resources need a planned state migration; moving configuration files alone does not transfer their state associations.

### Skip refresh deliberately

```shell
terraform plan -refresh=false
```

This skips the normal refresh of managed resources and relies on recorded information. It can miss changes made outside Terraform and produce an incomplete or misleading plan. It does not guarantee that no API calls occur.

For example, an EC2 instance changed manually in AWS may still appear with its old attributes in this plan. Data sources such as `aws_region` or `aws_availability_zones` may still be evaluated and read; disabling managed-resource refresh is not an offline mode.

`lifecycle { ignore_changes = all }` is not a refresh control. It changes how Terraform plans updates to resource attributes.

### Target an exceptional operation

```shell
terraform plan -target=aws_instance.app_server
```

Targeting includes the selected resource and dependencies required for it; it is not guaranteed to affect only one object. Reserve it for recovery or exceptional situations. After a targeted apply, run a full plan to identify remaining changes. See the [planning options](https://developer.hashicorp.com/terraform/cli/commands/plan).

### S3 example: targeting with and without refresh

Assume the configuration already declares `resource "aws_s3_bucket" "course_bucket"`. The address is `aws_s3_bucket.course_bucket`: the resource type plus its local label, not the AWS bucket name or a `.tf` filename.

```shell
# Plan the bucket and its dependencies, with normal refresh.
terraform plan -target=aws_s3_bucket.course_bucket

# Exceptional diagnostic use: target while skipping normal refresh.
terraform plan -refresh=false -target=aws_s3_bucket.course_bucket

# Return to a complete plan with normal refresh.
terraform plan
```

The combined command can omit unrelated changes and miss drift in the targeted objects. Neither command applies changes. For routine independent deployments, use separate root configurations and states rather than repeatedly targeting part of one large state.

## 7 Provisioners and connections

Provisioners execute actions alongside a resource's lifecycle. Terraform does not model the resulting software configuration as thoroughly as it models provider-managed resources.

| Provisioner | Where it operates | Typical purpose |
| --- | --- | --- |
| `local-exec` | The machine running Terraform | Run a local command |
| `remote-exec` | A remote host through SSH or WinRM | Run remote commands |
| `file` | Copies from the execution machine to a remote host | Transfer a file or directory |

### Local execution

Inside an EC2 resource:

```hcl
provisioner "local-exec" {
  command = "echo ${self.public_ip} > ip_address.txt"
}
```

`self` refers to the current resource. In CI or remote execution, “local” means the runner, not your laptop. A root output is usually more useful than a provisioner just to display an IP address.

### Remote execution

The following fragment assumes an Ubuntu instance, a reachable IP address, SSH access from the Terraform runner, and a matching public key installed on the instance:

```hcl
connection {
  type        = "ssh"
  user        = "ubuntu"
  private_key = file(pathexpand("~/.ssh/id_rsa"))
  host        = self.public_ip
}

provisioner "remote-exec" {
  inline = [
    "sudo apt-get update",
    "sudo apt-get install -y nginx",
    "sudo systemctl enable --now nginx"
  ]
}
```

`type` selects the protocol, `user` selects the operating-system account, `private_key` supplies authentication material, and `host` identifies the destination. The username depends on the AMI: Ubuntu commonly uses `ubuntu`; Amazon Linux commonly uses `ec2-user`.

Changing a provisioner command does not, by itself, rerun it on an unchanged resource. A failed creation-time provisioner normally marks its resource as tainted so a later plan can replace it. Scripts should tolerate retries and avoid leaving inconsistent results.

Prefer instance user data or cloud-init for bootstrapping, prepared images for repeatable deployments, and configuration-management tools such as Ansible for ongoing operating-system management.

## 8 SSH keys and EC2 key pairs

A key pair has a public key and a private key. The public key can be installed on the instance. The private key remains with the authorized user or automation system.

### Generate a key locally

```shell
ssh-keygen -t rsa -b 4096 -C "terraform-training"
```

Choose a filename without overwriting an existing key. A typical result is:

```text
~/.ssh/id_rsa       Private key
~/.ssh/id_rsa.pub   Public key
```

Protect the private key. For interactive use, a passphrase and SSH agent provide protection without placing an unencrypted key in a repository. Terraform's SSH connection settings must match the authentication method you choose.

Register the public key with AWS:

```hcl
resource "aws_key_pair" "training" {
  key_name   = "terraform-training"
  public_key = file(pathexpand("~/.ssh/id_rsa.pub"))
}

# Inside the EC2 resource:
# key_name = aws_key_pair.training.key_name
```

### A key created in the AWS console

AWS provides the private key when creating the key pair and does not let you download it again later. AWS stores the public key. If the private key is lost, use an applicable access-recovery method, such as an already configured Systems Manager connection, to install a replacement public key. Creating or deleting an AWS key-pair record alone does not rotate the authorized keys inside an existing instance. See [Amazon EC2 key pairs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html).

### Generating a key with Terraform

The source also describes generating a key with the TLS provider and writing it locally. This is possible, but the private key is then stored in Terraform state.

```hcl
# Requires hashicorp/tls, hashicorp/local, and hashicorp/aws providers.
resource "tls_private_key" "training" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated" {
  key_name   = "terraform-generated-training"
  public_key = tls_private_key.training.public_key_openssh
}

resource "local_sensitive_file" "private_key" {
  content         = tls_private_key.training.private_key_pem
  filename        = "${path.module}/training-key.pem"
  file_permission = "0400"
}
```

`local_sensitive_file` reduces accidental display of the content; it does not remove the key from state. Unix file permissions also do not replace Windows access controls. Use this pattern only with an appropriate state and key-storage design.

## 9 Data sources

A `resource` block manages an object. A `data` block retrieves information for use in the configuration without taking over that object's lifecycle.

For example, retrieve a known existing VPC:

```hcl
variable "existing_vpc_id" {
  type = string
}

data "aws_vpc" "existing" {
  id = var.existing_vpc_id
}

output "existing_vpc_cidr" {
  value = data.aws_vpc.existing.cidr_block
}
```

The reference syntax is `data.TYPE.NAME.ATTRIBUTE`.

The source's AMI lookup example uses Canonical's Ubuntu images:

```hcl
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Inside a compatible x86 EC2 resource:
# ami = data.aws_ami.ubuntu.id
```

Confirm the publisher, image pattern, and availability in your AWS region. A “most recent” lookup can select a newer image on a later plan, which may replace an instance. Pin an approved AMI when you need controlled image upgrades.

## 10 Provider aliases and AWS profiles

Provider aliases allow multiple configurations of the same provider. For AWS, these can select different regions or credentials.

```hcl
provider "aws" {
  region  = "us-east-1"
  profile = "training-account"
}

provider "aws" {
  alias   = "frankfurt_prod"
  region  = "eu-central-1"
  profile = "production-account"
}

resource "aws_vpc" "us_vpc" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_vpc" "eu_vpc" {
  provider   = aws.frankfurt_prod
  cidr_block = "10.1.0.0/16"
}
```

The first VPC uses the unaliased provider. The second explicitly selects `aws.frankfurt_prod`. The named profiles must exist and be authenticated where Terraform actually runs. A profile name on your laptop is not automatically available to a remote runner.

You can pass an aliased configuration as a child module's default provider:

```hcl
module "europe_network" {
  source = "./modules/network"

  providers = {
    aws = aws.frankfurt_prod
  }
}
```

The child still declares its provider requirements. If a child refers to its own aliased provider names, it must also declare those names in `configuration_aliases`.

## 11 Import existing resources

Import associates an existing cloud object with a Terraform resource address. It is useful when infrastructure was created manually or previously managed elsewhere.

### Traditional CLI import

First write a resource block using values that match the real instance:

```hcl
resource "aws_instance" "legacy_server" {
  ami           = var.existing_ami_id
  instance_type = "t3.medium"
}
```

Then import its actual ID:

```shell
terraform import aws_instance.legacy_server i-0123456789abcdef0
terraform plan
```

Declare and assign `existing_ami_id` before running this example. CLI import updates the state association; it does not rewrite the resource block. If your code says `t3.micro` but the existing instance is `t3.medium`, a later plan may propose changing it.

### Configuration-driven import

Terraform 1.5 introduced import blocks:

```hcl
import {
  to = aws_instance.legacy_server
  id = "i-0123456789abcdef0"
}
```

With a matching resource block, `terraform plan` previews the import and any other proposed changes. `terraform apply` performs the approved operations. Review the entire plan: an import plan can also contain updates or replacements caused by configuration differences.

### Generate a starting configuration

For an import target without a resource block, use:

```shell
terraform plan -generate-config-out=generated_resources.tf
```

Use a new output filename. The generated configuration needs review and may need editing; it is not a guarantee of a perfect production configuration. Existing resource blocks are not automatically rewritten. See [configuration generation for import](https://developer.hashicorp.com/terraform/language/import/generating-configuration).

Manage each real object through one intended Terraform address. Do not import the same instance into multiple states and let them compete over it.

## 12 Taint and resource replacement

The older `terraform taint` command marks an object for replacement in state. The preferred explicit workflow is to request replacement while planning:

```shell
terraform plan -replace=aws_instance.app_server -out=replacement.tfplan
terraform show replacement.tfplan
terraform apply replacement.tfplan
```

You can also use `terraform apply -replace=aws_instance.app_server` for an interactive plan and apply.

Replacement can destroy data and change identifiers or IP addresses. Its ordering depends on lifecycle settings; the default is commonly destroy before create, while `create_before_destroy` can reverse the order when supported by the infrastructure design.

## 13 Formatting validation inspection and debugging

### Format

```shell
terraform fmt
terraform fmt -recursive
terraform fmt -check -recursive
```

The first two commands rewrite formatting. The third checks formatting without changing files.

### Validate

```shell
terraform init -backend=false
terraform validate
```

Validation checks configuration syntax and internal consistency using installed dependencies. It does not prove that your credentials, resource IDs, quotas, or deployment will work. Initialization may download dependencies even when backend initialization is disabled.

### Inspect

```shell
terraform show
terraform show tfplan
terraform state list
terraform state show aws_instance.app_server
terraform output
```

Use these to inspect state, saved plans, individual managed resources, and outputs. Machine-readable JSON output may reveal sensitive values; protect it accordingly.

### Refresh state

The old `terraform refresh` command is deprecated. Review a refresh-only plan instead:

```shell
terraform plan -refresh-only
terraform apply -refresh-only
```

Refresh-only mode updates Terraform's recorded view and outputs to reflect external changes, without proposing to modify remote objects to match configuration. The second command creates its own reviewable plan. See the [refresh command documentation](https://developer.hashicorp.com/terraform/cli/commands/refresh).

### Debug logging

There is no standard `terraform debug` command. Set logging environment variables.

**PowerShell**

```powershell
$env:TF_LOG = "DEBUG"
$env:TF_LOG_PATH = "terraform_debug.log"
terraform plan
Remove-Item Env:TF_LOG
Remove-Item Env:TF_LOG_PATH
```

**Bash**

```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform_debug.log
terraform plan
unset TF_LOG TF_LOG_PATH
```

`TRACE` is more verbose than `DEBUG`. Logs can contain sensitive information; keep them out of Git and restrict access.

## 14 Variables and HCL expressions

### Declare an input

```hcl
variable "instance_type" {
  description = "The EC2 instance type."
  type        = string
  default     = "t3.micro"
}
```

Read it with `var.instance_type`. Without a default, the caller must supply a value.

### Assign a value

In `terraform.tfvars`:

```hcl
instance_type = "t3.small"
```

Or pass it explicitly:

```shell
terraform plan -var="instance_type=t3.small"
terraform plan -var-file=development.tfvars
```

Or use an environment variable in PowerShell:

```powershell
$env:TF_VAR_instance_type = "t3.small"
```

For ordinary local CLI runs, increasing precedence is: variable defaults; `TF_VAR_` environment values; `terraform.tfvars`; `terraform.tfvars.json`; `*.auto.tfvars` and `*.auto.tfvars.json` in lexical order; then explicit `-var` and `-var-file` options in command-line order. HCP Terraform adds its own variable management rules. See [input variables](https://developer.hashicorp.com/terraform/language/values/variables).

### Types

| Type | Example value |
| --- | --- |
| `string` | `"development"` |
| `number` | `3` |
| `bool` | `true` |
| `list(string)` | `["web", "api"]` |
| `set(string)` | `toset(["web", "api"])` |
| `map(string)` | `{ Environment = "dev" }` |
| `object({ name = string, size = number })` | `{ name = "web", size = 2 }` |
| `tuple([string, number])` | `["web", 2]` |

Lists are ordered; sets represent unique values without meaningful order. Maps associate keys with values of one element type. Objects describe named attributes, and tuples describe positional elements.

### Strings and conditions

```hcl
locals {
  server_name   = "app-server-${var.environment}"
  instance_type = var.environment == "production" ? "t3.large" : "t3.micro"
}
```

`${...}` inserts an expression into a string. A conditional uses `condition ? true_value : false_value`.

### Names and comments

Use descriptive variable names, commonly in `snake_case`. Identifiers cannot begin with a digit. Some names are reserved for module arguments, including `source`, `version`, `providers`, `count`, `for_each`, `lifecycle`, `depends_on`, and `locals`.

```hcl
# A single-line comment.
// Another single-line comment.

/* A comment
   spanning multiple lines. */
```

## 15 Count for_each and splat expressions

### Count

`count` creates an indexed collection of instances:

```hcl
resource "aws_instance" "web" {
  count         = 3
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = var.subnet_id

  tags = {
    Name = "web-${count.index}"
  }
}

output "web_instance_ids" {
  value = aws_instance.web[*].id
}
```

Addresses include `aws_instance.web[0]` and `aws_instance.web[1]`. A splat expression extracts an attribute from each element of the collection.

### For each

Use `for_each` when stable keys describe the objects better than numeric positions:

```hcl
resource "aws_instance" "service" {
  for_each = {
    web = "t3.micro"
    api = "t3.small"
  }

  ami           = var.ami_id
  instance_type = each.value
  subnet_id     = var.subnet_id

  tags = {
    Name = each.key
  }
}

output "service_ids" {
  value = { for name, instance in aws_instance.service : name => instance.id }
}
```

The addresses are `aws_instance.service["web"]` and `aws_instance.service["api"]`. `for_each` accepts a map or set of strings, and its instance keys must be known before remote operations.

You cannot use `count` and `for_each` together on one block. A resource using `for_each` is a map, so use a `for` expression or `values(resource)[*].attribute` rather than applying a list splat directly to it. See [splat expressions](https://developer.hashicorp.com/terraform/language/expressions/splat).

## 16 Local values functions and dynamic blocks

### Local values

Locals name expressions for reuse within a module:

```hcl
locals {
  name_prefix = "${var.app_name}-${var.environment}"

  common_tags = {
    Environment = var.environment
    Project     = var.app_name
    ManagedBy   = "Terraform"
  }
}
```

Use `local.name_prefix` and `local.common_tags`. Callers set input variables; they do not directly override locals.

### Functions

| Function | Purpose |
| --- | --- |
| `file(path)` | Read an existing UTF-8 text file |
| `pathexpand(path)` | Expand a leading home-directory marker |
| `length(value)` | Count elements or characters |
| `lookup(map, key, default)` | Read a map value with a fallback |
| `merge(map1, map2)` | Combine maps; later keys take precedence |
| `cidrsubnet(prefix, newbits, netnum)` | Calculate a subnet prefix |
| `contains(collection, value)` | Test membership |
| `can(expression)` | Test whether an expression can evaluate successfully |

Terraform configurations do not define arbitrary user functions. Modern Terraform can also use provider-defined functions when supported by the selected versions.

### Dynamic nested blocks

Dynamic blocks generate repeated nested blocks. This example assumes `var.vpc_id` and a trusted internal CIDR are declared:

```hcl
variable "app_ports" {
  type    = set(number)
  default = [80, 443]
}

resource "aws_security_group" "app" {
  name_prefix = "training-app-"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.app_ports

    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = [var.trusted_cidr]
    }
  }
}
```

This generates ingress rules, not multiple security groups. Do not combine inline rules with separately managed rules for the same group without understanding the provider's ownership behavior. Dynamic blocks cannot generate lifecycle meta-arguments.

## 17 Local modules and module inputs

A module is a directory of Terraform configuration files. The root module is the configuration you run; child modules are called from it. Modules let you package a useful infrastructure capability and reuse it with different inputs.

A module contains `.tf` and/or `.tf.json` files in one directory. Subdirectories are separate modules; Terraform does not automatically include them. A child can also call other children. In the layout below, `my-terraform-project/` is the root and `modules/ec2_server/` is a local child module.

```text
my-terraform-project/
  versions.tf
  main.tf
  variables.tf
  outputs.tf
  modules/
    ec2_server/
      versions.tf
      main.tf
      variables.tf
      outputs.tf
```

### Child provider requirement

**modules/ec2_server/versions.tf**

```hcl
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}
```

### Child inputs

**modules/ec2_server/variables.tf**

```hcl
variable "ami_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "server_name" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}
```

### Child resource and outputs

**modules/ec2_server/main.tf**

```hcl
resource "aws_instance" "this" {
  ami           = var.ami_id
  subnet_id     = var.subnet_id
  instance_type = var.instance_type

  tags = {
    Name = var.server_name
  }
}
```

**modules/ec2_server/outputs.tf**

```hcl
output "instance_id" {
  description = "The ID of the managed EC2 instance."
  value       = aws_instance.this.id
}

output "private_ip" {
  description = "The instance private IP address."
  value       = aws_instance.this.private_ip
}
```

### Root call

With the AWS provider configured and root inputs `ami_id` and `subnet_id` declared:

```hcl
module "development_server" {
  source = "./modules/ec2_server"

  ami_id      = var.ami_id
  subnet_id   = var.subnet_id
  server_name = "development-web"
}

output "development_private_ip" {
  value = module.development_server.private_ip
}
```

The child uses the default `t3.micro`. Another call can pass `instance_type = "t3.medium"`. Root `.tfvars` values do not automatically flow into children: pass inputs explicitly in the module call.

### Reuse the module and override a default

Add this second call alongside `development_server` to reuse the same child code with different arguments:

```hcl
module "staging_server" {
  source = "./modules/ec2_server"

  ami_id        = var.ami_id
  subnet_id     = var.subnet_id
  server_name   = "staging-web"
  instance_type = "t3.medium"
}
```

| Call | Supplied instance type | Effective child value |
| --- | --- | --- |
| `development_server` | Omitted | Default: `t3.micro` |
| `staging_server` | `t3.medium` | Explicit argument: `t3.medium` |

Both calls would manage separate EC2 instances if applied. A required child input with no default must be supplied in the call. Use inputs for environment-specific settings such as the AMI, subnet, and instance size; constants remain appropriate for intentional internal choices.

The `./` path is relative to the calling module's directory. Run `terraform init` after adding a module call. See [module calls](https://developer.hashicorp.com/terraform/language/block/module) and [input variables](https://developer.hashicorp.com/terraform/language/values/variables).

## 18 Module locals and child outputs

Use locals inside a module to derive names, tags, or settings from its inputs:

```hcl
# Requires app_name, environment, and instance_tier inputs in this module.
locals {
  name_prefix            = "${var.app_name}-${var.environment}"
  computed_instance_type = var.instance_tier == "high" ? "t3.medium" : "t3.micro"

  common_tags = {
    Environment = var.environment
    Project     = var.app_name
    ManagedBy   = "Terraform"
  }

  server_tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-server"
  })
}
```

Keep this internal logic close to the resources that use it. Use explicit inputs for choices the caller should control. If building S3 names, also account for naming rules and global uniqueness.

### Locals versus input variables

| Feature | Input variable | Local value |
| --- | --- | --- |
| Declare | `variable "instance_type" { ... }` | `locals { instance_type = "t3.micro" }` |
| Reference inside this module | `var.instance_type` | `local.instance_type` |
| Set directly through a child-module call | Yes, when declared as an input | No |
| Main purpose | Expose a caller-configurable setting | Name and reuse an internal expression |

A literal local such as `instance_type = "t3.micro"` is fixed by the module code. A local derived from `var.instance_tier`, as above, changes when that input changes. Locals are expressions, not mutable storage or values guaranteed to stay identical between runs; some remain unknown until resource attributes are available.

Passing `instance_type` to a child that declares only a local with that name produces an unsupported-argument error. If the child declares an input but the resource uses an unrelated constant local, changing that input does not change the resource's instance type. Locals provide encapsulation, not a security or policy boundary. See [local values](https://developer.hashicorp.com/terraform/language/values/locals).

### Connect two child modules

Inside a network child module:

```hcl
output "subnet_id" {
  description = "The subnet available for application instances."
  value       = aws_subnet.main.id
}
```

In the root module:

```hcl
module "network" {
  source = "./modules/network"
  # Supply this module's required network inputs here.
}

module "application" {
  source = "./modules/ec2_server"

  ami_id      = var.ami_id
  subnet_id   = module.network.subnet_id
  server_name = "application-web"
}
```

The expression `module.network.subnet_id` establishes the dependency on the resources producing that output. A sibling module cannot directly reach into another child's internal resource namespace.

Expose a child output through a root output when users or other root configurations need to consume it.

### Reference a child security-group output

For a module call without `count` or `for_each`, use `module.<MODULE_NAME>.<OUTPUT_NAME>`. The module name is the call's label, and the output name is declared by the child. Internal resource names are not part of this public reference.

Suppose `modules/sg` already declares `aws_security_group.app` and accepts a `vpc_id` input. Add this to its `outputs.tf`:

```hcl
output "sg_id" {
  description = "Security group ID for application instances."
  value       = aws_security_group.app.id
}
```

In the parent, with the AWS provider configured and `vpc_id`, `subnet_id`, and `ami_id` inputs declared:

```hcl
module "sgmodule" {
  source = "./modules/sg"
  vpc_id = var.vpc_id
}

resource "aws_instance" "myapp" {
  ami                    = var.ami_id
  instance_type          = "t3.micro"
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [module.sgmodule.sg_id]
}

output "application_security_group_id" {
  value = module.sgmodule.sg_id
}
```

Use a subnet in the same VPC as the security group. The brackets form the collection expected by `vpc_security_group_ids`. The output reference creates the dependency automatically. The final root output also makes the value available through `terraform output`; child outputs are not automatically listed by that command. These snippets illustrate the connection and assume the child resource and inputs already exist. See [module outputs](https://developer.hashicorp.com/terraform/language/values/outputs).

## 19 Registry modules sources and versions

The public Terraform Registry provides modules and providers from different publishers. Registry publication alone does not prove that a module is official, secure, or suitable for your environment. Review its publisher, documentation, dependencies, and code.

### Registry example

This uses the historical module version from the source document:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"

  name = "training-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = false

  tags = {
    Environment = "training"
  }
}
```

NAT gateways are disabled here to keep this networking example smaller. The private subnets therefore do not gain internet access through a NAT gateway. Read the selected module version's requirements before use.

### Module sources

| Source | Example |
| --- | --- |
| Local directory | `./modules/ec2_server` |
| Public registry | `terraform-aws-modules/vpc/aws` |
| Private registry | `app.terraform.io/my-company/secure-s3/aws` |
| GitHub over HTTPS | `github.com/example/terraform-aws-ec2?ref=v1.2.0` |
| Bitbucket Git repository | `git::https://bitbucket.org/example/terraform-aws-ec2.git?ref=v1.2.0` |
| Other Git repository | `git::https://git.example.com/team/terraform-aws-ec2.git?ref=v1.2.0` |
| HTTPS archive | `https://modules.example.com/ec2-module.zip` |
| S3 archive | `s3::https://s3.amazonaws.com/example-modules/vpc.zip` |

Example domains and repositories are placeholders. The `version` argument applies to registry module sources. For Git, use `?ref=` with a reviewed commit or release tag; a branch name remains mutable.

### GitHub source over HTTPS or SSH

The module's `source` argument identifies where Terraform retrieves its code. Choose one of these alternative calls, replace the example repository, and supply the module's required inputs.

**HTTPS:**

```hcl
module "ec2_server" {
  source = "git::https://github.com/example/terraform-aws-ec2.git?ref=v1.2.0"
  # Add the inputs required by this module.
}
```

**SSH:**

```hcl
module "ec2_server" {
  source = "git::ssh://git@github.com/example/terraform-aws-ec2.git?ref=v1.2.0"
  # Add the inputs required by this module.
}
```

GitHub also supports the HTTPS shorthand `github.com/example/terraform-aws-ec2` and SSH form `git@github.com:example/terraform-aws-ec2.git`. Terraform invokes Git to retrieve Git sources. Private repositories require suitable Git credentials or SSH access on the machine running Terraform, including a CI runner. Keep credentials outside the source URL. See the [module source reference](https://developer.hashicorp.com/terraform/language/block/module#source).

### Select a branch, tag, or commit with ref

Without `?ref=`, Git sources use the repository's default branch referenced by `HEAD`; it is not necessarily named `main` or `master`. Put `ref` in the source URL as a query parameter, not as a separate module input.

| Selection | Source URL suffix | Meaning |
| --- | --- | --- |
| Branch | `?ref=development` | Follow the branch when retrieving or updating the module; its commit can change |
| Tag | `?ref=v1.2.0` | Select a named release; a tag can still be moved |
| Commit | `?ref=FULL_COMMIT_SHA` | Select a specific revision; replace the placeholder with an actual full commit hash |

```hcl
module "development_server" {
  source = "git::https://github.com/example/terraform-aws-ec2.git?ref=development"
  # Add the inputs required by this module.
}
```

For a module inside a repository, use a double slash before the subdirectory and put the query last: `git::https://github.com/example/infrastructure-modules.git//modules/ec2?ref=v1.2.0`.

Run `terraform init` after changing dependencies. Review upgrades deliberately. The provider lock file does not lock module versions, so module source constraints are essential for reproducibility.

An installed module is cached; a new commit on its branch is not automatically downloaded by every plan. `terraform init -upgrade` can update installed modules and providers, so review all resulting dependency changes. See [installing module versions](https://developer.hashicorp.com/terraform/language/modules/configuration#install-a-specific-version-of-the-module).

## 20 CLI workspaces

CLI workspaces maintain separate states for the same configuration. They can support similar temporary or test deployments.

### Start with the default workspace

Without creating additional workspaces, you use `default`. A working directory describes the resources managed by that configuration, not every resource in an AWS account. With the default local backend settings, its state is saved as `terraform.tfstate` alongside the configuration. State is stored elsewhere when a remote backend is configured.

### Create and switch workspaces

Run these commands in an initialized working directory. The names `dev` and `staging` must not already exist when running `new`:

```shell
terraform workspace -help
terraform workspace show
terraform workspace list
terraform workspace new dev
terraform workspace new staging
terraform workspace select dev
```

| Command | Purpose |
| --- | --- |
| `terraform workspace new NAME` | Create and select a workspace |
| `terraform workspace list` | List workspaces; `*` marks the selected one |
| `terraform workspace show` | Print the selected workspace name |
| `terraform workspace select NAME` | Switch to an existing workspace |
| `terraform workspace delete NAME` | Delete an unused workspace after switching away |

After the sequence above, `dev` is selected. A plain `workspace new` starts with empty state; it does not copy existing infrastructure or deploy resources. Switching workspaces does not move or destroy resources either. Subsequent plans use the selected state, so a fresh workspace can propose creating another set of resources.

### One configuration, separate state files

Every configuration starts with a `default` workspace. With the local backend, non-default workspace states are normally stored under `terraform.tfstate.d/WORKSPACE_NAME/terraform.tfstate` in the working directory, not under `.terraform/`. Remote backends use backend-specific storage layouts.

Example layout after state has been written, using default local-backend paths:

```text
workspace-demo/
  main.tf                   # Shared by all CLI workspaces
  variables.tf              # Shared input declarations
  .terraform.lock.hcl        # Shared provider selections
  .terraform/               # Local initialization metadata and cache
  terraform.tfstate         # default workspace state
  terraform.tfstate.d/
    dev/
      terraform.tfstate
    staging/
      terraform.tfstate
```

The workspace subdirectories contain state, not separate copies of `main.tf`. Local backend paths can be customized; see the [local backend reference](https://developer.hashicorp.com/terraform/language/backend/local).

### Choose settings for each workspace

Read the current name with `terraform.workspace`:

```hcl
locals {
  instance_type = terraform.workspace == "prod" ? "t3.large" : "t3.micro"
  name_prefix   = "application-${terraform.workspace}"
}
```

Use `local.instance_type` and `local.name_prefix` in resource arguments for these expressions to affect resources. Creating a workspace named `prod` does not choose an instance size by itself. Likewise, selecting `dev` does not automatically load `dev.tfvars`; pass an appropriate variable file explicitly if using that approach.

Workspaces separate state; they do not provide strong credential or access isolation. Separate root configurations and AWS accounts can reuse the same modules while enforcing different access boundaries.

### Remove an unused workspace

To delete an unused workspace, first select another one:

```shell
terraform workspace select default
terraform workspace delete staging
```

Normal deletion refuses a workspace with managed resources. A CLI workspace is also a different concept from an HCP Terraform workspace. See [CLI workspaces](https://developer.hashicorp.com/terraform/cli/workspaces).

The `default` workspace cannot be deleted. Deleting a workspace is not a substitute for destroying its infrastructure. See the [workspace creation](https://developer.hashicorp.com/terraform/cli/commands/workspace/new) and [workspace deletion](https://developer.hashicorp.com/terraform/cli/commands/workspace/delete) references.

## 21 Team collaboration and Git

### Why use a shared VCS repository?

A version control system (VCS) such as Git records configuration changes. A shared remote repository lets colleagues work on the same project, review proposed changes, and recover committed work if a laptop is lost or damaged. Only pushed work is available from that remote; uncommitted or unpushed changes still need protection.

Branches and pull requests provide a review history: who changed the infrastructure definition, what changed, and why. Reverting a Git commit changes the code, but does not itself roll back live infrastructure; review a new Terraform plan before applying the reverted configuration.

### Collaboration learning path

| Topic | Where to study it |
| --- | --- |
| Shared repositories, Git challenges, and `.gitignore` | This lesson |
| Reusing versioned module sources | [Lesson 19: module sources](terraform.html#slide-20) |
| Backends, S3 setup, migration, and locking | [Lesson 22: backends and state locking](terraform.html#slide-23) |
| Inspecting and managing resource state | [Lesson 23: state management commands](terraform.html#slide-24) |
| Reading outputs from another configuration | [Lesson 24: sharing remote state outputs](terraform.html#slide-25) |

### Code sharing and state sharing

| Team need | Mechanism |
| --- | --- |
| Share configuration and review changes | Git repository and pull requests |
| Keep one authoritative resource record | Shared remote state backend |
| Prevent competing state writes | Backend-supported state locking |
| Control who can deploy | Provider credentials, permissions, and the execution workflow |

Two teammates can clone identical code and still have conflicting local state files. Git does not coordinate Terraform writes or make concurrent applies safe. Use a properly configured shared backend, such as S3, with access controls and locking; keep state out of the source repository.

### A typical team workflow

A common team workflow is:

1. Change configuration on a branch.
2. Run formatting, validation, and appropriate checks.
3. Generate a plan in the intended account and workspace.
4. Review the code and plan together.
5. Apply through the team's approved execution process.
6. Keep state shared, protected, and locked during supported operations.

GitHub Actions, GitLab CI, and HCP Terraform can automate parts of this process. Automatic apply after merge is a configuration choice, not a universal behavior. VCS integration alone does not supply state locking; the execution and backend design must provide it.

### Credentials and sensitive files

Do not embed access keys or secret values in committed provider blocks, backend settings, scripts, or variable files. Supply authentication through approved profiles, short-lived credentials, or protected runner settings. A private repository still needs this separation.

Keeping a secret outside the repository does not guarantee that it stays out of Terraform artifacts. Resource attributes, input values, saved plans, logs, and state can contain sensitive data. `sensitive = true` redacts normal display but does not remove the value from state. Protect backend storage with restricted access, encryption, and recovery controls. See [sensitive data handling](https://developer.hashicorp.com/terraform/language/manage-sensitive-data).

### Example gitignore

Create a `.gitignore` text file in the repository. Its patterns exclude matching untracked files from normal Git staging. Commit the ignore file so teammates share those rules. It does not encrypt files, prevent forced additions, or stop tracking files already in Git.

```gitignore
# Downloaded providers, modules, and local backend metadata
.terraform/

# State and local workspace states
*.tfstate
*.tfstate.*
terraform.tfstate.d/
.terraform.tfstate.lock.info

# Saved plans and diagnostic logs
tfplan
*.tfplan
crash.log
crash.*.log
terraform_debug.log

# Private variable values
*.tfvars
*.tfvars.json
!example.tfvars
!example.tfvars.json

# Private keys
*.pem
*.ppk
id_rsa
id_ed25519

# Local overrides; explicitly allow reviewed shared overrides if needed
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# Local CLI credentials or configuration
.terraformrc
terraform.rc
credentials.tfrc.json
```

Commit `.terraform.lock.hcl`, configuration, documentation, and non-secret examples. Some teams intentionally commit reviewed, non-secret variable files; adapt the patterns to that policy. `.gitignore` does not remove a secret that was already committed.

The `!example.tfvars` rules are exceptions: inspect those files to ensure they contain only safe example values. The `.terraform/` pattern also matches directories with that name below the repository root. Add patterns for any differently named plan or credential files your workflow creates. Compare with [GitHub's Terraform ignore template](https://github.com/github/gitignore/blob/main/Terraform.gitignore) and the [Terraform style guide](https://developer.hashicorp.com/terraform/language/style).

### Review before committing

```shell
# Show which rule ignores this example file.
git check-ignore -v secrets.tfvars

# Review staged paths, then the staged content.
git status --short
git diff --cached
```

Run these checks locally and avoid sharing output containing secrets. If credentials were committed, revoke or rotate them and coordinate repository-history cleanup; adding an ignore rule alone cannot undo exposure. See [Git's ignore rules](https://git-scm.com/docs/gitignore).

## 22 Backends and state locking

Backends define state storage. Locking capabilities depend on the backend and its settings; not every backend supports them.

### Local versus remote state

Terraform persists state to track the real resources associated with configuration addresses. Without an explicit backend or HCP Terraform cloud configuration, it uses the local backend. For the default workspace, the default state path is `terraform.tfstate` in the root working directory. Local state is locked through operating-system APIs, but separate copies on teammates' computers do not become a shared record. See the [local backend](https://developer.hashicorp.com/terraform/language/backend/local).

A remote backend lets authorized team members and runners use the same state. Keep configuration and the provider lock file in Git, and keep state in protected backend storage. An S3 backend stores state remotely; it does not move Terraform execution into S3.

### Backend choices

| Backend type | State storage |
| --- | --- |
| `local` | Local filesystem |
| `s3` | Amazon S3 objects |
| `azurerm` | Azure Blob Storage |
| `gcs` | Google Cloud Storage |
| `consul` | Consul key/value store |
| `kubernetes` | Kubernetes Secret |
| `http` | An HTTP service implementing the backend interface |

Backend types are built into Terraform and have different authentication, locking, and workspace capabilities. The `etcd` and `etcdv3` backends shown in older course material are not supported in Terraform 1.3 or later; see the [backend implementation's removal notices](https://github.com/hashicorp/terraform/blob/main/internal/backend/init/init.go). Refer to the [backend overview](https://developer.hashicorp.com/terraform/language/backend) for supported choices.

### S3 backend

For Terraform 1.10 or later, an S3 configuration can use native lock files:

```hcl
terraform {
  required_version = ">= 1.10.0, < 2.0.0"

  backend "s3" {
    bucket       = "replace-with-your-state-bucket"
    key          = "networking/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

Create the bucket beforehand. Configure restricted access, versioning, public-access protection, and permissions for both the state and lock objects. Backend credentials are separate from provider configuration.

Here, `bucket` identifies the existing bucket, `key` is the state object's path, and `region` locates the bucket. `use_lockfile` enables a separate `.tflock` object. Supply backend authentication through an approved credential source rather than embedding access keys in this block.

### S3 permissions: state and lock objects

For the example above, scope permissions to these resources:

| Target | Required S3 actions |
| --- | --- |
| Bucket ARN: `arn:aws:s3:::replace-with-your-state-bucket` | `s3:ListBucket`, scoped to relevant prefixes |
| State ARN: `arn:aws:s3:::replace-with-your-state-bucket/networking/terraform.tfstate` | `s3:GetObject`, `s3:PutObject` |
| Lock ARN: `arn:aws:s3:::replace-with-your-state-bucket/networking/terraform.tfstate.tflock` | `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` |

Deleting the lock releases it; normal operations do not require deleting the default state object. Non-default CLI workspaces need permissions for their additional paths, including state deletion for workspace cleanup. Customer-managed KMS encryption also requires appropriate key permissions. See the [S3 backend permissions](https://developer.hashicorp.com/terraform/language/backend/s3#permissions-required).

### Legacy S3 locking with DynamoDB

Older configurations use `dynamodb_table` for locking. This method is deprecated; prefer native S3 lock files for supported Terraform versions. The following is an alternative historical configuration, not a second backend block to add alongside the earlier example:

```hcl
terraform {
  backend "s3" {
    bucket         = "replace-with-your-state-bucket"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

The table must already exist and have a partition key named exactly `LockID`, of type `String`. The backend identity needs `dynamodb:DescribeTable`, `dynamodb:GetItem`, `dynamodb:PutItem`, and `dynamodb:DeleteItem` on that table, in addition to S3 access.

S3 locking is opt-in: if neither `use_lockfile` nor `dynamodb_table` enables a mechanism, the backend does not lock state. Both settings can coexist during a coordinated migration; verify client compatibility before removing DynamoDB locking. See the [S3 locking documentation](https://developer.hashicorp.com/terraform/language/backend/s3#state-locking).

### Migrate an existing state

Back up the state, coordinate with other operators, configure the destination backend, then run:

```shell
terraform init -migrate-state
```

Review the migration prompts and verify the destination. `-reconfigure` is different: it reinitializes backend settings without performing the same state migration.

### Lock handling

Locking prevents competing operations from writing the same state simultaneously. It cannot coordinate two unrelated state files that both manage the same real object.

With a backend that supports locking and has it enabled, Terraform automatically acquires a lock for operations that could write state and releases it when finished. A successful lock may produce no visible message. A lock-acquisition failure stops the operation rather than allowing an unprotected write.

| Step | User A | User B |
| --- | --- | --- |
| First operation starts | Acquires the state lock | Has not started |
| Another operation starts | Holds the lock while working | Cannot acquire the same lock; retries if configured or exits with an error |
| First operation finishes | Releases the lock | Can acquire it on a later attempt |

The state lock protects concurrent access. It is different from `.terraform.lock.hcl`, which records provider selections. See [state locking](https://developer.hashicorp.com/terraform/language/state/locking).

### Wait for a busy state

```shell
terraform plan -lock-timeout=5m
```

This allows up to five minutes of lock-acquisition retries. It does not cancel another user's run or limit the total plan duration. If acquisition fails, read the error: the lock details may identify its ID, owner, operation, and creation time. Also check backend access or connectivity errors; not every locking failure means a stale lock.

### Recover from a stale lock

Use `force-unlock` only for your own stale lock when automatic unlocking failed. Confirm the original process or CI run has stopped, coordinate with teammates, and verify the working directory, backend, and workspace before proceeding. Unlocking an active operation can allow concurrent writers and damage state.

```shell
# Replace LOCK_ID with the exact ID reported by Terraform.
terraform force-unlock LOCK_ID
```

The full syntax is `terraform force-unlock [options] LOCK_ID`. The command removes the backend lock, not resources, and does not roll back an interrupted apply. The `-force` option skips confirmation; it does not make unlocking safer. Local state locks cannot be released by another process using this command; resolve the process holding the operating-system lock instead. After recovery, run a fresh plan to inspect the current situation. See the [force-unlock reference](https://developer.hashicorp.com/terraform/cli/commands/force-unlock).

Do not routinely bypass locking with `-lock=false`.

## 23 State management commands

| Command | Effect |
| --- | --- |
| `terraform state list` | List managed addresses |
| `terraform state show ADDRESS` | Inspect recorded attributes |
| `terraform state mv OLD NEW` | Change an object's state address |
| `terraform state rm ADDRESS` | Stop tracking an object without deleting it |
| `terraform state pull` | Print a snapshot of the current state |
| `terraform state push FILE` | Replace the selected backend's state with a local snapshot; advanced recovery operation |

### Inspect addresses and attributes

```shell
terraform state list
terraform state show aws_instance.app_server
```

Use an address returned by `state list`, not an AWS instance ID or its Name tag. For child resources, the address includes the module path. `state show` displays the recorded attributes of one resource instance; it is not a live AWS query. Sensitive fields may be redacted. See [state show](https://developer.hashicorp.com/terraform/cli/commands/state/show).

### Rename a resource without recreating it

Example rename:

```shell
terraform state mv aws_instance.old_name aws_instance.new_name
```

Coordinate the matching configuration change. For a reviewable refactor, a `moved` block can record the address change in code:

```hcl
moved {
  from = aws_instance.old_name
  to   = aws_instance.new_name
}
```

### Remove a resource from management

Example removal from management:

```shell
terraform state rm aws_instance.legacy_server
```

The instance remains in AWS. If its resource block remains in configuration, the next plan may propose creating another instance. Adjust the configuration and ownership deliberately.

Back up state before manual state operations, prevent concurrent changes, and review a full plan afterward. State snapshots may contain secrets.

### Pull a state snapshot

```shell
terraform state pull
```

This reads the selected backend, whether local or remote, and writes a raw snapshot to standard output. It does not automatically create a backup file. The installed Terraform version may upgrade the exported snapshot format. Save it securely if making a backup, preserve UTF-8 encoding without a byte-order mark, and check command success before using it. See [state pull](https://developer.hashicorp.com/terraform/cli/commands/state/pull).

### Push a reviewed recovery snapshot

```shell
# Advanced recovery only; FILE must be a reviewed state snapshot.
terraform state push recovered.tfstate
```

`state push` writes to the currently selected backend and workspace, including a local backend. It replaces state rather than merging snapshots or applying infrastructure changes. Confirm the destination, back up its current state, and stop competing operations first.

Terraform rejects mismatched state lineage and a destination with a newer serial number. These checks help prevent overwriting unrelated or newer state. Do not bypass them with `-force` as a routine fix. Prefer `terraform init -migrate-state` for a normal backend migration. See [state push](https://developer.hashicorp.com/terraform/cli/commands/state/push).

## 24 Sharing remote state outputs

`terraform_remote_state` reads the latest saved snapshot from a configured local or remote backend. It exposes root outputs through `data.terraform_remote_state.NAME.outputs.OUTPUT_NAME`; a child's output must first be exported by the producing root. Reading outputs does not transfer resource ownership.

### Share a subnet through S3

Independent root configurations can share selected values through root outputs. For example, a network configuration exports a subnet:

```hcl
output "subnet_id" {
  value = aws_subnet.app.id
}
```

An application configuration can read the saved output:

```hcl
data "terraform_remote_state" "networking" {
  backend = "s3"

  config = {
    bucket = "replace-with-your-state-bucket"
    key    = "networking/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_instance" "application" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = data.terraform_remote_state.networking.outputs.subnet_id
}
```

An EC2 `subnet_id` requires a subnet ID, not a VPC ID. The network state must already exist and contain the root output.

Although the data source exposes outputs, the credentials used to retrieve them can generally access the whole state snapshot. Publish shared values through a dedicated store when consumers should not read the full state. Remote-state references do not automatically schedule upstream applies. See [remote state data sources](https://developer.hashicorp.com/terraform/language/state/remote-state-data).

### Read an HCP Terraform workspace

This alternative uses the `remote` backend to read an existing workspace. Replace both names and configure credentials and state-sharing access:

```hcl
data "terraform_remote_state" "vpc" {
  backend = "remote"

  config = {
    organization = "example-organization"
    workspaces = {
      name = "vpc-prod"
    }
  }
}
```

For a saved `subnet_id` output, read `data.terraform_remote_state.vpc.outputs.subnet_id`. HashiCorp recommends `tfe_outputs` for HCP Terraform/Enterprise when consumers should retrieve outputs without full state access. The data source's backend identifies the state being read, not where the consumer stores its own state.

### Network team to web team: share an Elastic IP

The network team owns the allocation; the web team owns its association with an instance. Extend the preceding S3 example, keeping the two teams' state files separate.

```text
Network root: allocate EIP -> save root outputs in networking state (S3)
                                             |
Web root: read allocation ID <----------------+
          associate it with EC2 -> save association in separate web state
```

In the network configuration, with the AWS provider configured:

```hcl
resource "aws_eip" "web" {
  domain = "vpc"
}

output "web_eip_allocation_id" {
  value = aws_eip.web.id
}

output "web_public_ip" {
  value = aws_eip.web.public_ip
}
```

After the network team applies and saves those outputs, the web configuration can use its existing `networking` data source and `aws_instance.application` resource:

```hcl
resource "aws_eip_association" "web" {
  instance_id         = aws_instance.application.id
  allocation_id       = data.terraform_remote_state.networking.outputs.web_eip_allocation_id
  allow_reassociation = false
}
```

Use compatible AWS account, region, and network-border-group settings. This instance example assumes one attached network interface; otherwise specify the intended network interface instead. The allocation ID, not the public IP string, identifies the EIP for association. Keep association ownership in the web configuration rather than also setting `instance` on the network team's EIP. An EIP alone does not supply internet routing or security-group access. See [Elastic IP associations](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/eip_association).

## 25 HCP Terraform and Terraform Enterprise

The source calls the hosted service “Terraform Cloud.” Its current name is **HCP Terraform**. Terraform Enterprise is the self-managed offering. Their purpose is to centralize execution, state, collaboration, and governance; availability of specific features depends on the offering and configuration.

### Overview and learning route

This section covers the platform overview, offering types, execution modes, Cloud backend integration, supported VCS providers, and Sentinel. Continue to [Lesson 26: Sentinel policies](terraform.html#slide-27) for a policy example and enforcement levels.

### Hosted service versus self-managed platform

| Offering | Who operates the platform? | What the team manages |
| --- | --- | --- |
| HCP Terraform | HashiCorp hosts the service | Workspaces, configuration, credentials, access, and run settings |
| Terraform Enterprise | Your organization hosts its own installation | The platform infrastructure and administration, as well as its Terraform workflows |

An HCP Terraform subscription tier and a Terraform Enterprise installation are different choices. Enterprise is a self-hosted distribution with its own deployment and operational requirements. See the [Terraform Enterprise overview](https://developer.hashicorp.com/terraform/enterprise).

### HCP Terraform subscription plans

The documented plans are **Free, Essentials, Standard, and Premium**. Plans govern available capabilities and usage limits at the organization level; they do not change the Terraform language. Older training material may use different tier names. Check the [current plan comparison](https://developer.hashicorp.com/terraform/cloud-docs/overview) for entitlements and limits before choosing a plan. Plan names and VCS support in this lesson were checked on November 25, 2026.

### Workspace execution modes

An HCP Terraform workspace holds configuration-related settings, variables, state, and run history. Execution can be remote, local, or agent-based, depending on the workspace setup.

| Mode | Where plans and applies run | Main distinction |
| --- | --- | --- |
| Remote | HCP Terraform's managed workers | The service runs and coordinates Terraform operations |
| Agent | An agent in infrastructure you control | Runs can reach approved private infrastructure |
| Local | Your workstation or external runner | HCP Terraform stores state; execution stays with the CLI |

A workspace can inherit the project's default execution mode. In local mode, HCP Terraform does not evaluate workspace variables or variable sets; supply values where the CLI runs. The hosted run pipeline is not used simply because state is stored there. See [workspace execution settings](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/settings#execution-mode).

### Cloud backend and CLI integration

The `cloud` block connects the CLI configuration to an HCP Terraform or Terraform Enterprise workspace. The workspace's execution mode determines where operations run. For a modern configuration:

```hcl
terraform {
  cloud {
    organization = "my-company-devops-org"

    workspaces {
      name = "production-infrastructure"
    }
  }
}
```

Authenticate and initialize:

```shell
terraform login
terraform init
```

Use the actual organization and workspace. Protect the locally stored login token; credential files are not encrypted merely because the CLI manages them.

Older configurations can use:

```hcl
terraform {
  backend "remote" {
    organization = "my-company-devops-org"

    workspaces {
      name = "production-infrastructure"
    }
  }
}
```

These are alternatives, not blocks to combine. Configure AWS authentication where execution occurs; prefer supported short-lived credentials over embedding long-lived access keys. See the [Terraform configuration reference](https://developer.hashicorp.com/terraform/language/block/terraform).

For Terraform Enterprise, set `hostname` in the `cloud` block to your installation's hostname and authenticate to that host. The token used to reach the Terraform platform is separate from credentials used by providers to manage AWS resources.

### Supported VCS providers

HCP Terraform and Terraform Enterprise integrate with these provider families. The precise connection method depends on the product and VCS deployment:

| Provider family | Documented variants |
| --- | --- |
| GitHub | GitHub.com and GitHub Enterprise; App and OAuth options depend on the Terraform edition |
| GitLab | GitLab.com and self-managed GitLab EE/CE |
| Bitbucket | Bitbucket Cloud and Bitbucket Data Center |
| Azure DevOps | Azure DevOps Services and Azure DevOps Server |

Connect an authorized VCS integration, then choose the repository, branch, and Terraform working directory for a workspace. Pull requests can trigger speculative plans for review. Changes to the tracked branch can queue runs; applying them follows the workspace's approval and auto-apply settings. Connecting a repository does not automatically grant cloud-provider permissions. Follow the [VCS provider setup guides](https://developer.hashicorp.com/terraform/cloud-docs/vcs) for authentication and connectivity requirements.

### Where Sentinel fits

Sentinel evaluates policy as code against Terraform run data, for example to check required tags or allowed instance types. Policy sets associate rules with intended workspaces. A failed policy's effect depends on its enforcement level and override permissions.

```text
Configuration change -> Plan -> Configured policy checks -> Approval -> Apply
```

This illustrates a managed workspace run with manual approval. Sentinel checks belong to the configured platform workflow; a normal standalone CLI run does not automatically enforce the organization's policies. See [policy enforcement](https://developer.hashicorp.com/terraform/cloud-docs/policy-enforcement) and [Lesson 26](terraform.html#slide-27).

## 26 Sentinel policies

Sentinel implements policy as code. Policies can inspect Terraform run data and enforce rules before apply, such as allowed instance types or required tags.

This simplified example rejects creates and updates using `t3.large`:

```sentinel
import "tfplan/v2" as tfplan

instances = filter tfplan.resource_changes as _, rc {
  rc.type == "aws_instance" and
  (rc.change.actions contains "create" or rc.change.actions contains "update")
}

main = rule {
  all instances as _, instance {
    instance.change.after.instance_type is not "t3.large"
  }
}
```

Production policies need tests for unknown values, resource actions, and relevant exceptions. This policy is not a complete cost-control system.

| Enforcement level | Behavior on failure |
| --- | --- |
| Advisory | Reports the failure without blocking apply |
| Soft mandatory | Blocks until an authorized override |
| Hard mandatory | Blocks without a run-level override |

Attach policies to the intended workspaces through policy sets and review policy changes. See [Sentinel policy documentation](https://developer.hashicorp.com/terraform/cloud-docs/policy-enforcement/define-policies/custom-sentinel).

## 27 Security and Vault

Infrastructure code can repeat both good and bad settings at scale. Protect credentials, state, plans, and the execution process together.

Use least-privilege roles, separate environment access, reviewed dependency versions, state encryption, backups, and restricted state access. Keep secrets out of committed configuration and logs. The source names Trivy, Checkov, and TFLint as complementary checks; linting and scanning serve different purposes and do not replace plan review.

### Storing secrets: best practices

- Never hardcode passwords, access keys, or tokens in `.tf` files, variable defaults, or other files committed to Git, including private repositories.
- Store real secrets in an approved secrets manager. Supply them only to the users and processes that need them, preferably with short-lived credentials.
- Avoid unprotected plaintext copies in `.tfvars`, shell startup files, logs, or saved plans. Restrict and encrypt stored state and backups.
- A committed secret can spread through Git history, clones, build systems, and backups. Deleting the current line or adding `.gitignore` does not remove those copies. Revoke or rotate an exposed credential and follow your repository cleanup process.

Repository access does not provide a complete record of who used a copied secret. Central secret access controls and auditing help, but copies outside the manager still need protection. Review [team collaboration and .gitignore](terraform.html#slide-22) for the repository rules.

### Sensitive does not mean absent from state

Mark private inputs and any outputs that expose them with `sensitive = true`. This fictional phone number example has no default: supply its value at runtime.

```hcl
variable "phone_number" {
  type      = string
  sensitive = true
}

# Teaching example: only expose a private output when it is needed.
output "phone_number" {
  value     = var.phone_number
  sensitive = true
}
```

Normal plan/apply displays redact the value as `(sensitive value)`. **Redaction is not encryption:** the value can still be stored in state and saved plans. Commands such as `terraform output -raw phone_number` and `terraform output -json` can reveal sensitive outputs; protect their destinations too. See [HashiCorp's sensitive-data guide](https://developer.hashicorp.com/terraform/language/manage-sensitive-data).

### Supply inputs through environment variables

`TF_VAR_<name>` supplies a declared root input variable: `TF_VAR_phone_number` maps to `var.phone_number`. Pass it explicitly as an argument if a child module needs it. For local CLI runs, variable files and explicit `-var`/`-var-file` arguments can override this value; see [input precedence](terraform.html#slide-15).

Use the fictional value below to learn the syntax. Run Terraform in the same terminal while the variable is set, then remove it.

#### Bash on Linux, WSL, or Git Bash

```bash
# Fictional demo value only.
export TF_VAR_phone_number="1234-5678"
terraform plan

# Remove it from this shell's environment.
unset TF_VAR_phone_number
```

#### PowerShell on Windows or Linux

```powershell
# Fictional demo value only; applies to this process and its children.
$env:TF_VAR_phone_number = "1234-5678"
terraform plan

# Remove it from this PowerShell process's environment.
Remove-Item Env:TF_VAR_phone_number
```

Environment variables keep a value out of the configuration file; they do not encrypt it or prevent Terraform from storing it. A literal typed into a terminal may remain in shell history, and exported values are inherited by child processes. For real secrets, use your approved secret manager or CI secret injection instead of pasting literals into commands. Unsetting a variable does not erase history, existing child-process copies, state, or saved plans.

Continue with the [environment variables course](environment-variables.html#terraform) and the [Terraform environment-variable reference](https://developer.hashicorp.com/terraform/cli/config/environment-variables#tf_var_name).

### Vault integration

HashiCorp Vault is a separate secrets-management service. It centralizes secret storage, access policies, and auditing and can issue dynamic credentials through suitable secrets engines. Terraform connects through the `hashicorp/vault` provider. See the [Vault overview](https://developer.hashicorp.com/vault/docs/about-vault/what-is-vault).

A conceptual KV v2 read looks like this. It assumes a configured Vault server, a KV v2 engine mounted at `secret`, an existing `production/database` secret, and an authenticated identity with the required provider permissions:

```hcl
# Requires the hashicorp/vault provider and an authenticated Vault session.
provider "vault" {
  address = "https://vault.example.com:8200"
}

data "vault_kv_secret_v2" "database" {
  mount = "secret"
  name  = "production/database"
}

# A consuming expression could be:
# data.vault_kv_secret_v2.database.data["admin_password"]
```

Authenticate outside committed code using your team's supported method. For example, the provider supports an injected `VAULT_TOKEN`; never put a real token in this example. Keep TLS verification enabled and grant only the permissions needed for the run. Refer to the [Vault provider documentation](https://registry.terraform.io/providers/hashicorp/vault/latest/docs) for authentication and token requirements.

A KV read is not automatically a dynamically generated credential. Ordinary data sources can persist their retrieved secrets in state, and consuming resources may persist them too. Secret rotation in Vault also does not automatically update every downstream service.

Newer Terraform and provider versions support ephemeral values and write-only arguments in specific contexts. Use those only where the whole data path supports them; otherwise treat state as sensitive. See [managing sensitive data](https://developer.hashicorp.com/terraform/language/manage-sensitive-data).

Use the current [Vault installation guide](https://developer.hashicorp.com/vault/install) for your operating system. Installing the executable alone does not configure a secure Vault server.

For databases, also plan backups, deletion protection, and final snapshots. A tutorial's shortened database block is not a complete production database configuration.

## 28 Dependency graphs and module downloads

### Terraform graph

Run this from an initialized configuration directory. By default, Terraform produces a simplified dependency graph of resources and data sources:

```shell
terraform graph
```

This emits DOT text representing dependencies. With Graphviz installed, produce an SVG:

```shell
terraform graph | dot -Tsvg -o graph.svg
```

To visualize the operations for a saved plan instead:

```shell
terraform plan -out=tfplan
terraform graph -plan=tfplan | dot -Tsvg -o apply-graph.svg
```

The first command creates a plan; neither command applies it. Protect the saved plan because it can contain sensitive values. Graphviz is a separate program; its `dot` executable must be available on your PATH. Using `-o` lets Graphviz write the image directly on Bash or PowerShell.

Dependency edges point from a dependent toward the object it depends on. Graphs help explain relationships and investigate cycles, but they are not network traffic diagrams or guarantees of application readiness.

For the opening example:

```text
EC2 instance → Subnet → VPC
      depends on       depends on
```

Creation respects those dependencies; deletion normally reverses the dependency requirements.

DOT text can also be pasted into an online renderer, as demonstrated by WebGraphviz in the slides. Use only non-sensitive samples there; local rendering avoids sharing internal resource names and relationships. See the [graph command reference](https://developer.hashicorp.com/terraform/cli/commands/graph).

### Resource implicit dependency

Terraform infers ordering from references to other resources. Building on the [dependency introduction](terraform.html#slide-2), this fragment associates an Elastic IP with an existing EC2 resource in the same configuration:

```hcl
# Requires an aws_instance.myec2 resource and suitable VPC networking.
resource "aws_eip" "myeip" {
  domain   = "vpc"
  instance = aws_instance.myec2.id
}
```

The `instance` expression creates an implicit dependency on `aws_instance.myec2`. Terraform must obtain the instance ID before associating the address; the order of blocks in the file does not establish this relationship. Current AWS provider syntax uses `domain = "vpc"` instead of the older `vpc = "true"` shown in the slide. See the [Elastic IP resource reference](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/eip).

### Resource explicit dependency

Use `depends_on` when behavior requires an order that the input expressions do not reveal. Suppose an application's separately configured startup script expects an S3 bucket to exist, but the instance block never references the bucket's attributes:

```hcl
# Fragment: declare these inputs and configure AWS before using it.
resource "aws_s3_bucket" "application" {
  bucket = var.application_bucket_name
}

resource "aws_instance" "application" {
  ami                  = var.ami_id
  instance_type        = "t3.micro"
  subnet_id            = var.subnet_id
  iam_instance_profile = var.application_instance_profile

  # The application's startup behavior requires this bucket to exist.
  depends_on = [aws_s3_bucket.application]
}
```

This declares ordering only. Configure the startup script and S3 permissions separately. If an expression already references `aws_s3_bucket.application.id`, that reference supplies the dependency without an extra `depends_on`. Broad explicit dependencies can make more values unknown during planning, so document the hidden requirement and keep the list narrow. See [depends_on](https://developer.hashicorp.com/terraform/language/meta-arguments/depends_on).

### Terraform get

```shell
terraform get
terraform get -update
```

`get` installs child modules. `get -update` checks already installed modules for updates permitted by their sources and constraints. It does not configure the backend or install providers in the way full initialization does.

`terraform init` normally handles module installation along with other initialization work. Downloaded modules are stored under `.terraform/modules/`; local module sources remain references to local directories. Keep your authored modules in Git and exclude the downloaded cache.

For example, after adding a remote `module` block to the root configuration, `terraform get` downloads its source. Use `-update` deliberately when refreshing installed modules; an update can change their behavior. Review constraints and the resulting plan. See the [get command reference](https://developer.hashicorp.com/terraform/cli/commands/get).

## 29 Publishing modules and private registries

Publishing makes reusable infrastructure code discoverable by other users. The Terraform Registry presents release history, README content, examples, and documentation generated from module declarations, including inputs and outputs. Anyone meeting its publishing requirements can share a public module.

### Standard module structure

Use a predictable layout so readers and registry tooling can understand the module. A minimal recommended layout is:

```text
terraform-aws-training-network/
  README.md       # Purpose and usage
  main.tf         # Resources and module calls
  variables.tf    # Input declarations and descriptions
  outputs.tf      # Output declarations and descriptions
```

An expanded repository can add a license, version requirements, nested modules, and examples:

```text
terraform-aws-training-network/
  README.md
  LICENSE
  main.tf
  variables.tf
  outputs.tf
  versions.tf
  modules/
    subnet/
      README.md
      main.tf
      variables.tf
      outputs.tf
  examples/
    basic/
      README.md
      main.tf
      variables.tf
      outputs.tf
```

These filenames organize a module; Terraform loads its `.tf` files together. Nested directories are separate modules and require explicit calls. The repository root is the entry point; include optional directories only when useful. Describe each input and output, and explain prerequisites and usage in the README. See [standard module structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure).

### Publish a public module

The public registry's GitHub publishing workflow uses a public repository named `terraform-PROVIDER-NAME`, such as `terraform-aws-training-network`.

1. Organize a reusable root module and include a README, input and output descriptions, and examples. Add a short GitHub repository description.
2. Remove secrets, state, and local caches.
3. Create a semantic-version Git tag, such as `v1.0.0`.
4. Sign in to the registry through GitHub and select the repository for module publication.
5. Publish later versions as reviewed releases.

Tags use semantic versions; the `v` prefix is optional. Check the [public module publishing requirements](https://developer.hashicorp.com/terraform/registry/modules/publish) before publishing.

### Module versions and constraints

The optional `version` argument constrains modules installed from a registry, including public and private registries. Set it deliberately to control acceptable releases. This is the slide's historical version example, not a recommendation of the latest release:

```hcl
module "iam" {
  source  = "terraform-aws-modules/iam/aws"
  version = "5.24.0"
}
```

Check the selected release's README for its usable root module, submodules, and required inputs before using it in an application.

| Constraint | Allowed versions |
| --- | --- |
| `5.24.0` | Exactly 5.24.0 |
| `~> 5.24.0` | At least 5.24.0, below 5.25.0 |
| `~> 5.24` | At least 5.24.0, below 6.0.0 |
| `>= 5.24.0, < 6.0.0` | The stated inclusive lower and exclusive upper bounds |

Git and local sources do not accept this registry `version` argument. For Git, select a tag or commit with `?ref=...`; see [module sources](terraform.html#slide-20). Without a registry constraint, a fresh installation can select a newer release. Existing installations are normally reused until an update is requested.

The [dependency lock file](terraform.html#slide-4) records provider selections, not module versions. Review module upgrades explicitly and inspect a plan before applying. See the [module block reference](https://developer.hashicorp.com/terraform/language/block/module#version).

### Private registry

A private registry lets an organization distribute modules to authorized users. For example:

```hcl
module "secure_bucket" {
  source  = "app.terraform.io/my-company/secure-s3/aws"
  version = "1.0.0"

  bucket_name = "replace-with-a-unique-bucket-name"
}
```

This is a placeholder module interface; use the actual published inputs. Authenticate with the registry host and permissions appropriate to your organization.

A generic package server is not automatically a Terraform registry. It must implement the relevant protocol or expose a supported module source. Private publication also does not automatically make a module secure: review and test releases.

## 30 Air-gapped environments

An air-gapped environment has no public internet access. Terraform therefore needs locally reachable providers, module sources, backends, and infrastructure APIs.

On a connected preparation machine, download the selected providers for the target platform:

```shell
terraform providers mirror -platform=linux_amd64 ./provider-mirror
```

Transfer the mirror and reviewed configuration through the organization's approved process. On the isolated runner, configure a filesystem mirror:

```hcl
provider_installation {
  filesystem_mirror {
    path    = "/opt/terraform/provider-mirror"
    include = ["registry.terraform.io/*/*"]
  }
}
```

The absence of a `direct` block prevents direct provider installation from public registries. Place these settings in the CLI configuration, not a project's `.tf` file: normally `~/.terraformrc` on Unix or `%APPDATA%\terraform.rc` on Windows. Use an appropriate Windows path if needed. See [CLI configuration](https://developer.hashicorp.com/terraform/cli/config/config-file).

Mirror every required provider for the target operating system and architecture. Vendor modules or use reachable internal Git servers or registries. The dependency lock file does not itself make Terraform offline.

Choose a reachable backend. An S3-compatible internal service requires compatibility testing; it is not automatically identical to AWS S3. Provider installation also does not solve API connectivity: a fully isolated runner cannot manage public AWS endpoints without an approved network path.

## 31 Null resources and terraform_data

`null_resource` is a resource from the `hashicorp/null` provider. It does not create a cloud object, but it has a lifecycle and can host provisioners.

### What a null resource does

Terraform tracks the resource in state and can create, replace, or destroy it. By itself, it creates no VM, bucket, or other cloud infrastructure. A provisioner attached to it can still change real systems by running commands.

The optional `triggers` argument is a **map of strings**. Terraform compares its stored values with the new values to decide whether replacement is needed:

| Situation | Normal creation-time provisioner behavior |
| --- | --- |
| First apply creates the null resource | Runs once during creation |
| Later apply with unchanged triggers and no other replacement reason | Does not run again |
| A trigger value changes | Resource is replaced; provisioner runs on the new instance |
| No triggers configured | Runs on initial creation; no automatic repeat on every apply |

Unchanged triggers do not prevent other replacement causes, such as an explicit `-replace` request. A plan previews these actions; it does not run the provisioner. See the [null_resource reference](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource).

### Example: rerun setup when an endpoint changes

```hcl
# Requires hashicorp/null and an existing database resource.
resource "null_resource" "database_setup" {
  triggers = {
    endpoint = aws_db_instance.mysql.endpoint
  }

  provisioner "local-exec" {
    command = "./scripts/init-db.sh"

    environment = {
      DB_ENDPOINT = self.triggers.endpoint
    }
  }
}
```

The endpoint reference already creates an implicit dependency. If its value changes, Terraform replaces the null resource and runs its creation-time provisioner again. An unchanged trigger does not continually rerun the script.

The script must exist on the runner, have an appropriate interpreter, and tolerate retries. Terraform does not model every database change that the script makes.

Changing the script file alone does not change the endpoint trigger. To track script edits too, add a value such as `script_hash = filesha256("${path.module}/scripts/init-db.sh")` to the triggers map; that file must already exist when Terraform evaluates it. Avoid an always-changing trigger unless every apply should deliberately repeat the action.

### Local commands, remote commands, and data sources

- `local-exec` runs on the machine executing Terraform: your workstation or an automation runner. Its command can invoke Bash, PowerShell, Python, or `ansible-playbook` when those programs and the required files are available there.
- `remote-exec` runs on a remote machine using a configured connection, such as SSH or WinRM. The runner needs network access and authentication; the remote host must support the requested commands.
- A `data` block is a separate data-source declaration, not a provisioner to nest inside `null_resource`. You can reference a data-source attribute in `triggers` or provisioner settings, but the data source and the provisioner have different lifecycles.

For example, a `local-exec` command could be `python scripts/configure.py` or `ansible-playbook -i inventory.ini configure.yml`. These files are examples, not scripts supplied by this lesson. Set the working directory and interpreter explicitly when the runner's defaults differ from your workstation. Keep credentials out of command strings and make scripts safe to retry. See [provisioner guidance](https://developer.hashicorp.com/terraform/language/provisioners).

### Prefer terraform_data for new configurations

On Terraform 1.4 and later, built-in `terraform_data` can handle similar lifecycle needs without an external provider. Its `triggers_replace` argument explicitly requests replacement when its value changes:

```hcl
resource "terraform_data" "database_setup" {
  triggers_replace = [aws_db_instance.mysql.endpoint]

  provisioner "local-exec" {
    command = "./scripts/init-db.sh"

    environment = {
      DB_ENDPOINT = aws_db_instance.mysql.endpoint
    }
  }
}
```

Use provider-managed resources when possible. See the [terraform_data reference](https://developer.hashicorp.com/terraform/language/resources/terraform-data).

## 32 Resource lifecycle rules

The `lifecycle` meta-argument is a nested block inside a resource. It customizes Terraform's normal create, update, replacement, and destroy behavior. Terraform compares configuration with tracked infrastructure; some changes allow an in-place update, while others require replacement.

The examples below show individual rules. Merge the rules you need into the resource's `lifecycle` block.

### Prevent destruction

```hcl
lifecycle {
  prevent_destroy = true
}
```

Terraform rejects plans that would destroy the resource while this setting remains in configuration. Removing the entire resource block also removes this protection. Use service-level deletion controls and backups where needed.

Use lowercase `prevent_destroy`, correcting the slide's capitalization. It also blocks replacements that require deletion, but cannot stop someone deleting the object directly through a cloud console or API.

### Ignore selected updates

```hcl
lifecycle {
  ignore_changes = [tags["Owner"]]
}
```

This can let an external process manage an attribute after creation. It does not disable refresh. Ignoring `all` broadly gives up Terraform's normal update management for that resource.

To ignore the entire tags map, as in the slide, use this alternative:

```hcl
lifecycle {
  ignore_changes = [tags]
}
```

The configured tags still apply at creation. Later update plans ignore differences for those attributes, including changes in your configuration. Prefer `tags["Owner"]` when only that key is managed elsewhere.

### Create before destroy

```hcl
# Requires declared ami_id and subnet_id inputs, plus AWS configuration.
resource "aws_instance" "example" {
  ami           = var.ami_id
  instance_type = "t3.micro"
  subnet_id     = var.subnet_id

  lifecycle {
    create_before_destroy = true
  }
}
```

When replacement is necessary, the default order is destroy old, then create new. This rule reverses that order; it does not force replacement on every apply.

This changes replacement ordering. It does not guarantee zero downtime or application health; naming uniqueness, quotas, traffic switching, and readiness still matter.

### Replace when another managed value changes

```hcl
resource "terraform_data" "release" {
  input = var.release_version
}

# Inside the resource that should be replaced:
# lifecycle {
#   replace_triggered_by = [terraform_data.release]
# }
```

`replace_triggered_by` refers to managed resources or their attributes. Wrap a plain input in `terraform_data` when you need its changes represented by a resource lifecycle. See [lifecycle rules](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle).

## 33 Variable validation

Validation blocks express requirements for input values and provide useful error messages. A type constraint checks the kind of value; a nested `validation` block adds a custom rule. Its `condition` must evaluate to true for the value to pass. If it is false, Terraform reports `error_message` and blocks the operation.

### Validate an AMI input

This example checks the prefix and a minimum length, then passes the input to EC2:

```hcl
variable "server_ami" {
  type        = string
  nullable    = false
  description = "AMI ID for the EC2 instance in the selected AWS region."

  validation {
    condition     = length(var.server_ami) > 4 && startswith(var.server_ami, "ami-")
    error_message = "server_ami must start with ami- and contain at least one character after the prefix."
  }
}

# Fragment: configure AWS and declare subnet_id for your environment.
resource "aws_instance" "myec2" {
  ami           = var.server_ami
  instance_type = "t3.micro"
  subnet_id     = var.subnet_id

  tags = {
    Name = "Server using ${var.server_ami}"
  }
}
```

`startswith` avoids the slide's incorrect `substr(..., 0, 3)` comparison with the four-character prefix `ami-`. `nullable = false` rejects a null input.

| Example input | Result of this rule |
| --- | --- |
| `ami-0123456789abcdef0` | Passes this basic format check; fictional example |
| `i-0123456789abcdef0` | Fails: wrong prefix |
| `ami-` | Fails: nothing after the prefix |

Passing does not prove that an AMI exists, is accessible in your region, or matches the instance architecture. Even `ami-not-real` passes this deliberately simple rule. See [input validation](https://developer.hashicorp.com/terraform/language/validate#input-variable-validation).

### Restrict an input to supported choices

```hcl
variable "environment" {
  type        = string
  description = "The target deployment environment."

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}
```

### Validate a naming convention

```hcl
variable "project_name" {
  type = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Use only lowercase letters, digits, and hyphens."
  }
}
```

This pattern allows a leading digit or hyphen. To require a leading lowercase letter, use `^[a-z][a-z0-9-]*$` instead. Neither pattern alone validates every AWS resource's naming requirements.

Terraform evaluates conditions when their input values are known. Many failures are caught during planning; conditions depending on unknown values can be deferred. Validation improves errors but does not replace provider and service validation.

## 34 Practice workflow

### Terraform best practices

Use this checklist alongside the detailed lessons when preparing a project for team use.

#### Code and reusable modules

- Keep Terraform code in Git and review changes. Exclude state, backups, logs, saved plans, and downloaded providers/modules with `.gitignore`; commit `.terraform.lock.hcl`. See [team collaboration](terraform.html#slide-22).
- Run `terraform fmt` and `terraform validate`; an editor such as VS Code can help format code. Formatting is not validation, and validation does not confirm cloud permissions or deployment success.
- Use input variables for environment-specific choices, such as AMIs and instance sizes. Intentional internal constants do not all need to become inputs.
- Follow consistent resource-label and tag naming conventions. Reuse modules instead of copying resource definitions, and document each module's purpose, inputs, outputs, and examples in its README.
- Use locals and built-in functions to simplify repeated expressions. Keep expressions readable; see [functions and locals](terraform.html#slide-17).
- Constrain Terraform, provider, and external module versions and review upgrades. See the [HashiCorp style guide](https://developer.hashicorp.com/terraform/language/style).

#### State, environments, and credentials

- Store shared state in a secured remote backend, such as S3, with encryption, restricted access, and supported locking enabled. Keep recoverable backups or object versions and check your recovery procedure. See [backends and locking](terraform.html#slide-23).
- Use Terraform's state commands and declarative refactoring features instead of editing state JSON manually. Back up state before maintenance; see [state management](terraform.html#slide-24).
- Use CLI workspaces when several deployments can safely share a configuration and backend access. They separate state but are not an access-control boundary. Use separate configurations/backends where stronger isolation is required; see [workspaces](terraform.html#slide-21).
- Keep credentials out of code and committed variable files. Use approved authentication and secret injection, and protect state and plans that may retain sensitive data; see [security and Vault](terraform.html#slide-28).

#### Repeatable deployment and adoption

- Automate formatting, validation, and plan review in CI/CD. Control who can apply, serialize runs against the same state, and use appropriately scoped credentials.
- Use `terraform import` or import blocks to adopt existing objects when needed. Match the configuration to the imported object and review the next plan before applying; see [importing resources](terraform.html#slide-12).
- Put environment-specific inputs in a selected variable file when useful. Supply real secrets separately and check which file and workspace the run uses.

For an existing, initialized configuration with a prepared `dev.tfvars` file:

```shell
terraform fmt -check -recursive
terraform validate
terraform plan -var-file="dev.tfvars" -out=dev.tfplan
```

`fmt -check` reports formatting differences without rewriting files. `validate` checks configuration consistency; the plan evaluates the selected inputs against the target environment. Review the saved plan before an authorized apply, and protect it as sensitive data. See the [validate command reference](https://developer.hashicorp.com/terraform/cli/commands/validate).

### Guided practice

Use the opening VPC, subnet, and instance files in a dedicated learning directory, together with the introductory AWS settings. Supply a real, compatible AMI ID and authenticated access to `us-east-1`.

1. Initialize with `terraform init`.
2. Format with `terraform fmt`.
3. Check the configuration with `terraform validate`.
4. Run `terraform plan -var="ami_id=YOUR_REAL_AMI_ID" -out=training.tfplan`.
5. Review `terraform show training.tfplan`, including every resource and any deletion or replacement.
6. If the plan is correct, run `terraform apply training.tfplan`.
7. Inspect the resulting addresses with `terraform state list`.
8. Change a tag and plan again to observe an in-place update.
9. When finished, run `terraform destroy -var="ami_id=YOUR_REAL_AMI_ID"` and review the proposed deletions before confirming.

This exercise demonstrates resource creation and dependencies. It does not configure SSH access, public routing, a web application, or a production-ready network.

## 35 Technical corrections to the source

The following corrections keep the tutorial's examples and explanations consistent:

| Source issue | Correct interpretation |
| --- | --- |
| A minus sign in the subnet CIDR assignment | HCL assignment uses `=` |
| `ignore_changes = all` described as disabling refresh | Use the CLI `-refresh=false` option; lifecycle ignores affect update planning |
| Lock file described as locking modules | It records provider selections; pin modules separately |
| Lock file excluded in one Git example | Commit `.terraform.lock.hcl` |
| `apply` described as reusing the previous printed plan | Pass a saved plan explicitly or apply creates a new one |
| `terraform debug` described as a command | Enable `TF_LOG` and optionally `TF_LOG_PATH` |
| `terraform refresh` treated as the normal manual workflow | Prefer a reviewable refresh-only plan and apply |
| Amazon Linux SSH user given as `ec2-admin` | Commonly `ec2-user` |
| AWS described as retaining the private key | AWS stores the public key; the private key cannot be downloaded again |
| A VPC ID passed into EC2 `subnet_id` | Pass an actual subnet ID |
| Workspace states placed inside `.terraform/` | The default local layout uses `terraform.tfstate.d/` in the working directory |
| Native S3 locking described as unavailable | Modern Terraform supports `use_lockfile`; DynamoDB locking is deprecated |
| Secrets fetched from Vault described as memory-only | Ordinary reads and resource arguments can persist secrets in state |
| `create_before_destroy` described as guaranteeing zero downtime | It changes ordering; availability needs additional design |
| A list splat used indiscriminately with `for_each` | Use a map comprehension or convert map values to a list |
| Local interpolation written as `"{var.app_name}"` | Use `var.app_name` directly or interpolate with `${...}` |
| Generated import configuration described as automatically perfect | Review and adjust it before applying |

Use the linked HashiCorp and AWS references in each lesson when adapting these patterns to your installed versions and deployment environment.
