import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DevOpsAgentStack } from '../lib/stacks/agent/devops-agent-stack';

describe('DevOpsAgent Stack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new DevOpsAgentStack(app, 'TestAgent', {
      projectName: 'Test',
      environment: 'dev',
      agentConfig: {
        spaceName: 'test-agent-space',
        spaceDescription: 'Test Agent Space',
        locale: 'es',
        monitoredAccounts: [
          {
            accountId: '111111111111',
            roleArn: 'arn:aws:iam::111111111111:role/DevOpsAgentAccessRole',
            regions: ['us-east-1'],
            scopeTags: { 'aws:cloudformation:stack-name': 'Athleon-production' },
          },
        ],
      },
    });
    template = Template.fromStack(stack);
  });

  test('Creates Agent Space with KMS encryption', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Name: 'test-agent-space',
      Description: 'Test Agent Space',
      KmsKeyArn: Match.anyValue(),
    });
  });

  test('Agent Space uses the configured locale', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Locale: 'es',
    });
  });

  test('Operator role trust policy allows sts:TagSession (required for Chat)', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: Match.stringLikeRegexp('DevOpsAgentRole-WebappAdmin-.*'),
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:TagSession',
            Principal: { Service: 'aidevops.amazonaws.com' },
          }),
        ]),
      }),
    });
  });

  test('Creates KMS key with rotation enabled', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });
  });

  test('Creates cross-account association (SourceAws/source)', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::Association', {
      ServiceId: 'aws',
      Configuration: Match.objectLike({
        SourceAws: Match.objectLike({
          AccountId: '111111111111',
          AccountType: 'source',
          AssumableRoleArn: 'arn:aws:iam::111111111111:role/DevOpsAgentAccessRole',
        }),
      }),
    });
  });

  test('Association scopes topology crawl by workload tags', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::Association', {
      Configuration: Match.objectLike({
        SourceAws: Match.objectLike({
          Tags: Match.arrayWith([
            Match.objectLike({
              Key: 'aws:cloudformation:stack-name',
              Value: 'Athleon-production',
            }),
          ]),
        }),
      }),
    });
  });

  test('Agent Space has mandatory tags', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Environment', Value: 'dev' }),
        Match.objectLike({ Key: 'ManagedBy', Value: 'CDK' }),
      ]),
    });
  });
});

describe('DevOpsAgent Stack with MCP Servers', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new DevOpsAgentStack(app, 'TestAgentMcp', {
      projectName: 'Test',
      environment: 'dev',
      agentConfig: {
        spaceName: 'test-mcp-space',
        mcpServers: [
          {
            serviceType: 'mcpserver',
            name: 'custom-runbooks',
            targetUrl: 'https://mcp.internal.example.com',
          },
          {
            serviceType: 'mcpserversplunk',
            name: 'splunk-observability',
            targetUrl: 'https://splunk.internal.example.com:8089',
          },
        ],
      },
    });
    template = Template.fromStack(stack);
  });

  test('Registers MCP server services', () => {
    template.resourceCountIs('AWS::DevOpsAgent::Service', 2);
  });

  test('Creates associations for each MCP server', () => {
    // 2 MCP associations (Model B: no host self-association by default)
    template.resourceCountIs('AWS::DevOpsAgent::Association', 2);
  });

  test('MCP service has correct type', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::Service', {
      ServiceType: 'mcpserver',
    });
    template.hasResourceProperties('AWS::DevOpsAgent::Service', {
      ServiceType: 'mcpserversplunk',
    });
  });
});

describe('DevOpsAgent Stack with Private Connection', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new DevOpsAgentStack(app, 'TestAgentVpc', {
      projectName: 'Test',
      environment: 'dev',
      agentConfig: {
        spaceName: 'test-vpc-space',
        privateConnection: {
          name: 'internalmcp',
          hostAddress: '10.0.1.50',
          vpcId: 'vpc-0123456789abcdef0',
          subnetIds: ['subnet-aaa', 'subnet-bbb'],
          securityGroupIds: ['sg-111'],
        },
        mcpServers: [
          {
            serviceType: 'mcpserver',
            name: 'vpc-mcp-server',
            targetUrl: 'https://10.0.1.50:8080',
            privateConnectionName: 'internalmcp',
          },
        ],
      },
    });
    template = Template.fromStack(stack);
  });

  test('Creates private connection with VPC config', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::PrivateConnection', {
      Name: 'internalmcp',
      ConnectionConfiguration: {
        ServiceManaged: {
          HostAddress: '10.0.1.50',
          VpcId: 'vpc-0123456789abcdef0',
          SubnetIds: ['subnet-aaa', 'subnet-bbb'],
          SecurityGroupIds: ['sg-111'],
          PortRanges: ['443'],
        },
      },
    });
  });

  test('MCP service registered for VPC server', () => {
    template.hasResourceProperties('AWS::DevOpsAgent::Service', {
      ServiceType: 'mcpserver',
    });
  });
});

describe('DevOpsAgent Stack with Identity Center', () => {
  test('Configures Identity Center for operator app', () => {
    const app = new cdk.App();
    const stack = new DevOpsAgentStack(app, 'TestAgentIdc', {
      projectName: 'Test',
      environment: 'prd',
      agentConfig: {
        spaceName: 'prod-agent-space',
        useIdentityCenter: true,
        identityCenterInstanceArn: 'arn:aws:sso:::instance/ssoins-1234567890abcdef',
      },
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DevOpsAgent::AgentSpace', {
      OperatorApp: {
        Idc: Match.objectLike({
          IdcInstanceArn: 'arn:aws:sso:::instance/ssoins-1234567890abcdef',
        }),
      },
    });
  });

  test('KMS key has RETAIN policy in prd', () => {
    const app = new cdk.App();
    const stack = new DevOpsAgentStack(app, 'TestAgentPrd', {
      projectName: 'Test',
      environment: 'prd',
      agentConfig: {
        spaceName: 'prd-space',
      },
    });
    const template = Template.fromStack(stack);

    template.hasResource('AWS::KMS::Key', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });
});
