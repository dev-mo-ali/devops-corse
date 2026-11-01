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

Its main fields are:

| Field | Purpose |
| --- | --- |
| `version` | The selected provider version |
| `constraints` | The version constraints considered when selecting it |
| `hashes` | Accepted checksums for provider packages |

Commit this file to Git. Do not commit the downloaded `.terraform/` directory. The lock file coordinates provider selections across machines; checksums help detect unexpected package changes. They do not guarantee that a provider is safe or that entire environments are identical.

**The lock file tracks providers, not remote module versions.** Pin registry module versions separately and use stable Git references.

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

### Skip refresh deliberately

```shell
terraform plan -refresh=false
```

This skips the normal refresh of managed resources and relies on recorded information. It can miss changes made outside Terraform and produce an incomplete or misleading plan. It does not guarantee that no API calls occur.

`lifecycle { ignore_changes = all }` is not a refresh control. It changes how Terraform plans updates to resource attributes.

### Target an exceptional operation

```shell
terraform plan -target=aws_instance.app_server
```

Targeting includes the selected resource and dependencies required for it; it is not guaranteed to affect only one object. Reserve it for recovery or exceptional situations. After a targeted apply, run a full plan to identify remaining changes. See the [planning options](https://developer.hashicorp.com/terraform/cli/commands/plan).

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
| Git repository | `git::https://github.com/example/terraform-aws-ec2.git?ref=v1.2.0` |
| HTTPS archive | `https://modules.example.com/ec2-module.zip` |
| S3 archive | `s3::https://s3.amazonaws.com/example-modules/vpc.zip` |

Example domains and repositories are placeholders. The `version` argument applies to registry module sources. For Git, use `?ref=` with a reviewed commit or release tag; a branch name remains mutable.

Run `terraform init` after changing dependencies. Review upgrades deliberately. The provider lock file does not lock module versions, so module source constraints are essential for reproducibility.

## 20 CLI workspaces

CLI workspaces maintain separate states for the same configuration. They can support similar temporary or test deployments.

```shell
terraform workspace show
terraform workspace list
terraform workspace new dev
terraform workspace new staging
terraform workspace select dev
```

Every configuration starts with a `default` workspace. With the local backend, non-default workspace states are normally stored under `terraform.tfstate.d/WORKSPACE_NAME/terraform.tfstate` in the working directory, not under `.terraform/`. Remote backends use backend-specific storage layouts.

Read the current name with `terraform.workspace`:

```hcl
locals {
  instance_type = terraform.workspace == "prod" ? "t3.large" : "t3.micro"
  name_prefix   = "application-${terraform.workspace}"
}
```

Workspaces separate state; they do not provide strong credential or access isolation. Separate root configurations and AWS accounts can reuse the same modules while enforcing different access boundaries.

To delete an unused workspace, first select another one:

```shell
terraform workspace select default
terraform workspace delete staging
```

Normal deletion refuses a workspace with managed resources. A CLI workspace is also a different concept from an HCP Terraform workspace. See [CLI workspaces](https://developer.hashicorp.com/terraform/cli/workspaces).

## 21 Team collaboration and Git

A common team workflow is:

1. Change configuration on a branch.
2. Run formatting, validation, and appropriate checks.
3. Generate a plan in the intended account and workspace.
4. Review the code and plan together.
5. Apply through the team's approved execution process.
6. Keep state shared, protected, and locked during supported operations.

GitHub Actions, GitLab CI, and HCP Terraform can automate parts of this process. Automatic apply after merge is a configuration choice, not a universal behavior. VCS integration alone does not supply state locking; the execution and backend design must provide it.

### Example gitignore

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

# Local CLI credentials or configuration
.terraformrc
terraform.rc
credentials.tfrc.json
```

Commit `.terraform.lock.hcl`, configuration, documentation, and non-secret examples. Some teams intentionally commit reviewed, non-secret variable files; adapt the patterns to that policy. `.gitignore` does not remove a secret that was already committed.

## 22 Backends and state locking

Backends define state storage. Locking capabilities depend on the backend and its settings; not every backend supports them.

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

The source uses DynamoDB locking. It is a legacy method now marked deprecated in the [S3 backend documentation](https://developer.hashicorp.com/terraform/language/backend/s3). Check compatibility when migrating older installations.

### Migrate an existing state

Back up the state, coordinate with other operators, configure the destination backend, then run:

```shell
terraform init -migrate-state
```

Review the migration prompts and verify the destination. `-reconfigure` is different: it reinitializes backend settings without performing the same state migration.

### Lock handling

Locking prevents competing operations from writing the same state simultaneously. It cannot coordinate two unrelated state files that both manage the same real object.

```shell
terraform plan -lock-timeout=5m
```

If a previous process crashed and left a lock, first confirm that no operation is still using it. Only then consider:

```shell
terraform force-unlock LOCK_ID
```

Do not routinely bypass locking with `-lock=false`.

## 23 State management commands

| Command | Effect |
| --- | --- |
| `terraform state list` | List managed addresses |
| `terraform state show ADDRESS` | Inspect recorded attributes |
| `terraform state mv OLD NEW` | Change an object's state address |
| `terraform state rm ADDRESS` | Stop tracking an object without deleting it |
| `terraform state pull` | Print a snapshot of the current state |

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

Example removal from management:

```shell
terraform state rm aws_instance.legacy_server
```

The instance remains in AWS. If its resource block remains in configuration, the next plan may propose creating another instance. Adjust the configuration and ownership deliberately.

Back up state before manual state operations, prevent concurrent changes, and review a full plan afterward. State snapshots may contain secrets.

## 24 Sharing remote state outputs

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

## 25 HCP Terraform and Terraform Enterprise

The source calls the hosted service “Terraform Cloud.” Its current name is **HCP Terraform**. Terraform Enterprise is the self-managed offering. Their purpose is to centralize execution, state, collaboration, and governance; availability of specific features depends on the offering and configuration.

An HCP Terraform workspace holds configuration-related settings, variables, state, and run history. Execution can be remote, local, or agent-based, depending on the workspace setup.

For a modern configuration:

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

### Sensitive does not mean absent from state

```hcl
variable "database_password" {
  type      = string
  sensitive = true
}
```

`sensitive = true` redacts many user-interface displays. It does not, by itself, keep the value out of state or saved plans.

### Vault integration

Vault can provide centrally managed secrets and, with suitable secrets engines, dynamic credentials. A conceptual KV v2 read looks like this:

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

A KV read is not automatically a dynamically generated credential. Ordinary data sources can persist their retrieved secrets in state, and consuming resources may persist them too. Secret rotation in Vault also does not automatically update every downstream service.

Newer Terraform and provider versions support ephemeral values and write-only arguments in specific contexts. Use those only where the whole data path supports them; otherwise treat state as sensitive. See [managing sensitive data](https://docs.hashicorp.com/terraform/language/manage-sensitive-data).

For databases, also plan backups, deletion protection, and final snapshots. A tutorial's shortened database block is not a complete production database configuration.

## 28 Dependency graphs and module downloads

### Terraform graph

```shell
terraform graph
```

This emits DOT text representing dependencies. With Graphviz installed, produce an SVG:

```shell
terraform graph | dot -Tsvg -o graph.svg
```

Dependency edges point from a dependent toward the object it depends on. Graphs help explain relationships and investigate cycles, but they are not network traffic diagrams or guarantees of application readiness.

For the opening example:

```text
EC2 instance → Subnet → VPC
      depends on       depends on
```

Creation respects those dependencies; deletion normally reverses the dependency requirements.

### Terraform get

```shell
terraform get
terraform get -update
```

`get` installs child modules. `get -update` checks already installed modules for updates permitted by their sources and constraints. It does not configure the backend or install providers in the way full initialization does.

`terraform init` normally handles module installation along with other initialization work. Downloaded modules are stored under `.terraform/modules/`; local module sources remain references to local directories. Keep your authored modules in Git and exclude the downloaded cache.

## 29 Publishing modules and private registries

### Publish a public module

The public registry's GitHub publishing workflow uses a public repository named `terraform-PROVIDER-NAME`, such as `terraform-aws-training-network`.

1. Organize a reusable root module and include a README, input and output descriptions, and examples.
2. Remove secrets, state, and local caches.
3. Create a semantic-version Git tag, such as `v1.0.0`.
4. Sign in to the registry through GitHub and select the repository for module publication.
5. Publish later versions as reviewed releases.

Tags use semantic versions; the `v` prefix is optional. Check the [public module publishing requirements](https://developer.hashicorp.com/terraform/registry/modules/publish) before publishing.

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

For new configurations, built-in `terraform_data` can handle similar lifecycle needs without an external provider:

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

Lifecycle settings change how Terraform plans resource operations. These fragments belong inside a resource block.

### Prevent destruction

```hcl
lifecycle {
  prevent_destroy = true
}
```

Terraform rejects plans that would destroy the resource while this setting remains in configuration. Removing the entire resource block also removes this protection. Use service-level deletion controls and backups where needed.

### Ignore selected updates

```hcl
lifecycle {
  ignore_changes = [tags["Owner"]]
}
```

This can let an external process manage an attribute after creation. It does not disable refresh. Ignoring `all` broadly gives up Terraform's normal update management for that resource.

### Create before destroy

```hcl
lifecycle {
  create_before_destroy = true
}
```

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

Validation blocks express requirements for input values and provide useful error messages.

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

A naming check:

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
