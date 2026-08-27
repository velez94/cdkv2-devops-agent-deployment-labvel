import * as devopsagent from 'aws-cdk-lib/aws-devopsagent';
import { Construct } from 'constructs';

export interface DevOpsAgentMcpServiceProps {
  /** Agent Space ID to associate with */
  agentSpaceId: string;
  /** Service type for the MCP server */
  serviceType: 'mcpserver' | 'mcpserversplunk' | 'mcpservernewrelic' | 'mcpservergrafana' | 'mcpserversigv4';
  /** Display name */
  name: string;
  /** Target URL for the MCP server */
  targetUrl: string;
  /** Private connection name (for VPC-based MCP servers) */
  privateConnectionName?: string;
  /** API key header name (for API key auth) */
  apiKeyHeader?: string;
  /** API key name */
  apiKeyName?: string;
  /** API key value (prefer using Secrets Manager references) */
  apiKeyValue?: string;
}

/**
 * L2-like construct that registers an MCP server as a Service
 * and associates it with an Agent Space.
 *
 * Use this to connect custom MCP servers (runbooks, proprietary tools,
 * internal observability) to AWS DevOps Agent.
 *
 * Note: OAuth-based services (GitHub, Slack, Datadog) must be registered
 * through the AWS Console — they cannot be provisioned via CloudFormation.
 */
export class DevOpsAgentMcpService extends Construct {
  public readonly serviceId: string;
  public readonly associationId: string;

  constructor(scope: Construct, id: string, props: DevOpsAgentMcpServiceProps) {
    super(scope, id);

    // Build authorization config
    const authorizationConfig = this.buildAuthConfig(props);

    // Register the MCP server as a service
    const service = new devopsagent.CfnService(this, 'Service', {
      serviceType: props.serviceType,
      serviceDetails: {
        mcpServer: {
          name: props.name,
          endpoint: props.targetUrl,
          authorizationConfig,
        },
      },
    });

    this.serviceId = service.attrServiceId;

    // Associate the service with the Agent Space
    const association = new devopsagent.CfnAssociation(this, 'Association', {
      agentSpaceId: props.agentSpaceId,
      serviceId: service.attrServiceId,
      configuration: {
        mcpServer: {
          name: props.name,
          endpoint: props.targetUrl,
          tools: [], // Will be auto-discovered from the MCP server
        },
      },
    });

    association.addResourceDependency(service);

    this.associationId = association.attrAssociationId;
  }

  private buildAuthConfig(props: DevOpsAgentMcpServiceProps): devopsagent.CfnService.MCPServerAuthorizationConfigProperty {
    if (props.apiKeyHeader && props.apiKeyName && props.apiKeyValue) {
      return {
        apiKey: {
          apiKeyHeader: props.apiKeyHeader,
          apiKeyName: props.apiKeyName,
          apiKeyValue: props.apiKeyValue,
        },
      };
    }

    // Default: no auth (for private connection / VPC-based servers)
    return {};
  }
}
