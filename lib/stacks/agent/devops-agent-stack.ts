import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DevOpsAgentSpace } from '../../constructs/devops-agent-space';
import { DevOpsAgentAwsAssociation, DevOpsAgentSourceAwsAssociation } from '../../constructs/devops-agent-aws-association';
import { DevOpsAgentMcpService } from '../../constructs/devops-agent-mcp-service';
import { DevOpsAgentPrivateConnection } from '../../constructs/devops-agent-private-connection';

export interface DevOpsAgentStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  /** Custom tag policy (overrides defaults if provided) */
  agentTags?: Record<string, string>;
  /**
   * DevOps Agent configuration
   */
  agentConfig: DevOpsAgentConfig;
}

export interface DevOpsAgentConfig {
  /** Name for the Agent Space */
  spaceName: string;
  /** Description of the Agent Space */
  spaceDescription?: string;
  /** Locale (BCP-47) determining the language of agent responses (e.g. "es", "pt-BR") */
  locale?: string;
  /** AWS accounts to associate (multi-account monitoring) */
  monitoredAccounts?: MonitoredAccountConfig[];
  /**
   * Whether to also monitor the hub (operations) account where the Agent Space
   * lives. Defaults to false (Model B — the hub is an operations account with
   * no workloads, so it should not be a monitored target). Set to true only if
   * the hub account itself hosts workloads worth investigating.
   */
  monitorHostAccount?: boolean;
  /** MCP server integrations */
  mcpServers?: McpServerConfig[];
  /** Private connection for MCP servers in VPC */
  privateConnection?: PrivateConnectionConfig;
  /** Enable Identity Center auth for the operator web app */
  useIdentityCenter?: boolean;
  /** Identity Center instance ARN (required if useIdentityCenter is true) */
  identityCenterInstanceArn?: string;
}

export interface MonitoredAccountConfig {
  /** AWS account ID to monitor */
  accountId: string;
  /** IAM role ARN the agent assumes in the target account */
  roleArn: string;
  /** Regions to monitor in this account */
  regions?: string[];
}

export interface McpServerConfig {
  /** Service type */
  serviceType: 'mcpserver' | 'mcpserversplunk' | 'mcpservernewrelic' | 'mcpservergrafana' | 'mcpserversigv4';
  /** Display name for the service */
  name: string;
  /** MCP server target URL */
  targetUrl: string;
  /** Use private connection (name reference) */
  privateConnectionName?: string;
}

export interface PrivateConnectionConfig {
  /** Name for the private connection */
  name: string;
  /** Host address (IP or DNS) of the MCP server target */
  hostAddress: string;
  /** VPC ID for the connection */
  vpcId: string;
  /** Subnet IDs for the connection */
  subnetIds: string[];
  /** Security group IDs */
  securityGroupIds: string[];
}

/**
 * Agent layer: AWS DevOps Agent infrastructure.
 *
 * Provisions Agent Spaces, service registrations, associations,
 * and private connections for DevOps Agent.
 *
 * Aligns with official CDK onboarding guide:
 * https://docs.aws.amazon.com/devopsagent/latest/userguide/
 * getting-started-with-aws-devops-agent-getting-started-with-aws-devops-agent-using-aws-cdk.html
 */
export class DevOpsAgentStack extends cdk.Stack {
  public readonly agentSpace: DevOpsAgentSpace;

  constructor(scope: Construct, id: string, props: DevOpsAgentStackProps) {
    super(scope, id, props);

    const { agentConfig, environment } = props;

    // 1. Create the Agent Space (includes Agent Access Role + Operator Role)
    this.agentSpace = new DevOpsAgentSpace(this, 'AgentSpace', {
      spaceName: agentConfig.spaceName,
      description: agentConfig.spaceDescription ?? `DevOps Agent Space for ${props.projectName} (${environment})`,
      locale: agentConfig.locale,
      environment,
      projectName: props.projectName,
      tags: props.agentTags,
      useIdentityCenter: agentConfig.useIdentityCenter,
      identityCenterInstanceArn: agentConfig.identityCenterInstanceArn,
    });

    // 2. Host account association — only if explicitly enabled (Model B default: off)
    // The hub/operations account typically has no workloads worth monitoring.
    // When enabled, it uses the "Aws"/monitor type (required for the local account).
    if (agentConfig.monitorHostAccount) {
      new DevOpsAgentSourceAwsAssociation(this, 'SourceAwsAssociation', {
        agentSpaceId: this.agentSpace.agentSpaceId,
        accountId: this.account,
        roleArn: this.agentSpace.agentAccessRole.roleArn,
      });
    }

    // 3. Private Connection (if needed for MCP servers in VPC)
    let privateConnection: DevOpsAgentPrivateConnection | undefined;
    if (agentConfig.privateConnection) {
      privateConnection = new DevOpsAgentPrivateConnection(this, 'PrivateConnection', {
        name: agentConfig.privateConnection.name,
        hostAddress: agentConfig.privateConnection.hostAddress,
        vpcId: agentConfig.privateConnection.vpcId,
        subnetIds: agentConfig.privateConnection.subnetIds,
        securityGroupIds: agentConfig.privateConnection.securityGroupIds,
      });
    }

    // 4. AWS Account Associations (multi-account observability)
    // These are "Aws" type associations for REMOTE monitored accounts
    if (agentConfig.monitoredAccounts) {
      agentConfig.monitoredAccounts.forEach((account, index) => {
        new DevOpsAgentAwsAssociation(this, `AwsAssociation${index}`, {
          agentSpaceId: this.agentSpace.agentSpaceId,
          accountId: account.accountId,
          roleArn: account.roleArn,
          regions: account.regions,
        });
      });
    }

    // 5. MCP Server Services & Associations
    if (agentConfig.mcpServers) {
      agentConfig.mcpServers.forEach((mcp, index) => {
        new DevOpsAgentMcpService(this, `McpService${index}`, {
          agentSpaceId: this.agentSpace.agentSpaceId,
          serviceType: mcp.serviceType,
          name: mcp.name,
          targetUrl: mcp.targetUrl,
          privateConnectionName: mcp.privateConnectionName,
        });
      });
    }

    // Stack outputs (aligned with official sample)
    new cdk.CfnOutput(this, 'AgentSpaceArn', {
      value: this.agentSpace.agentSpaceArn,
      description: 'Agent Space ARN',
    });
    new cdk.CfnOutput(this, 'AgentSpaceRoleArn', {
      value: this.agentSpace.agentAccessRole.roleArn,
      description: 'Agent Access Role ARN',
    });
    new cdk.CfnOutput(this, 'OperatorRoleArn', {
      value: this.agentSpace.operatorRole.roleArn,
      description: 'Operator App Role ARN',
    });
  }
}
