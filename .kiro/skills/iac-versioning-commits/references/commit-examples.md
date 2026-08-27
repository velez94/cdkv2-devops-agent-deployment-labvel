# CDK Commit Examples

## Foundation Layer

### New S3 construct (MINOR)

```
feat(bucket): add SampleBucket construct with cdk-nag compliance

intent(bucket): provide reusable S3 construct with security defaults
decision(bucket): S3_MANAGED encryption over KMS for cost efficiency on non-sensitive data
decision(bucket): access logs bucket per construct for AwsSolutions-S1 compliance
constraint(bucket): all buckets must pass cdk-nag AwsSolutions checks
impact(bucket): foundation stack uses this — changes affect all environments
```

### Fix cdk-nag violation (PATCH)

```
security(bucket): add server access logging for AwsSolutions-S1

learned(cdk-nag): AwsSolutions-S1 requires a separate access logs bucket
```

## Platform Layer

### Add EKS stack (MINOR)

```
feat(eks): add EKS cluster stack with managed node groups

intent(eks): provide Kubernetes platform for containerized workloads
decision(eks): aws-cdk-lib/aws-eks L2 construct over custom CloudFormation
rejected(eks): Fargate-only — GPU workloads require EC2 node groups
constraint(eks): private endpoint only, no public API access
impact(eks): application stacks will reference cluster for deployments
```

## Application Layer

### Add Lambda construct (MINOR)

```
feat(lambda): add hello-world Lambda function with API Gateway

intent(lambda): demonstrate serverless pattern in scaffold
decision(lambda): NodejsFunction with esbuild bundling over manual packaging
```

## Cross-Cutting

### Add environment (MAJOR)

```
feat(infra): add staging environment to project config

intent(environments): staging needed for pre-production validation
impact(infra): all stacks now deploy to dev, qa, stg, prd
```

### Dependency update (PATCH)

```
chore(deps): bump aws-cdk-lib from 2.148.0 to 2.150.0
```

### cdk-nag suppression (PATCH)

```
security(alb): suppress AwsSolutions-ELB2 with justification

decision(alb): access logs stored in centralized logging account bucket
```

## Tag Examples

```bash
git tag -a v1.0.0 -m "feat(infra): initial CDK scaffold with foundation stack and cdk-nag"
git tag -a v1.1.0 -m "feat(platform): add EKS and RDS constructs"
git tag -a v1.1.1 -m "fix(bucket): correct removal policy for dev environment"
git tag -a v2.0.0 -m "feat(infra): add staging environment, update config loader interface"
```
