import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface FoundationStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

/**
 * Foundation layer: core resources for the DevOps Agent infrastructure.
 *
 * Add resources here that the Agent stack depends on:
 * - KMS keys for encryption
 * - S3 buckets for agent artifacts/runbooks
 * - IAM baseline policies
 */
export class FoundationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props);

    // TODO: Add foundation resources for the DevOps Agent
    // Examples:
    // - KMS key for agent data encryption
    // - S3 bucket for runbook storage
    // - IAM baseline roles
  }
}
