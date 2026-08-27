import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../lib/stacks/pipeline/pipeline-stack';

describe('CDK Pipelines Mode - Pipeline Stack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new PipelineStack(app, 'TestPipeline', {
      env: { account: '000000000000', region: 'us-east-1' },
      projectName: 'TestAgent',
      pipelineConfig: {
        connection_arn:
          'arn:aws:codeconnections:us-east-1:000000000000:connection/12345678-abcd-efgh-ijkl-123456789012',
        provider: 'github',
        repo: 'test-org/devops-agent',
        branch: 'main',
        self_mutating: true,
      },
      deployOrder: [
        { environment: 'dev', manual_approval: false },
        { environment: 'qa', manual_approval: true },
        { environment: 'prd', manual_approval: true },
      ],
      environments: {
        dev: { account: '111111111111', region: 'us-east-1' },
        qa: { account: '222222222222', region: 'us-east-1' },
        prd: { account: '333333333333', region: 'us-east-1' },
      },
      devopsAgentConfig: {
        space_name: 'TestAgent',
        space_description: 'Test agent space',
        monitored_accounts: [
          {
            account_id: '111111111111',
            role_arn: 'arn:aws:iam::111111111111:role/DevOpsAgentAccessRole',
            regions: ['us-east-1'],
          },
        ],
      },
    });
    template = Template.fromStack(stack);
  });

  test('Creates a CodePipeline', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'TestAgent-pipeline',
    });
  });

  test('Pipeline has Source stage with CodeConnections', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: 'Source',
        }),
      ]),
    });
  });

  test('Pipeline has cross-account KMS key for deployments', () => {
    template.hasResource('AWS::KMS::Key', {});
  });

  test('Pipeline name follows naming convention', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'TestAgent-pipeline',
    });
  });
});

describe('CDK Pipelines Mode - Without Agent Config', () => {
  test('Pipeline works without devopsAgentConfig', () => {
    const app = new cdk.App();
    const stack = new PipelineStack(app, 'PipelineNoAgent', {
      env: { account: '000000000000', region: 'us-east-1' },
      projectName: 'TestNoAgent',
      pipelineConfig: {
        connection_arn:
          'arn:aws:codeconnections:us-east-1:000000000000:connection/12345678-abcd-efgh-ijkl-123456789012',
        provider: 'github',
        repo: 'org/repo',
        branch: 'main',
        self_mutating: true,
      },
      deployOrder: [{ environment: 'dev', manual_approval: false }],
      environments: {
        dev: { account: '111111111111', region: 'us-east-1' },
      },
      // No devopsAgentConfig
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Name: 'TestNoAgent-pipeline',
    });
  });
});

describe('CDK Pipelines Mode - Validation', () => {
  test('Throws when deploy_order references undefined environment', () => {
    const app = new cdk.App();
    expect(() => {
      new PipelineStack(app, 'BadPipeline', {
        env: { account: '000000000000', region: 'us-east-1' },
        projectName: 'Test',
        pipelineConfig: {
          connection_arn: 'arn:aws:codeconnections:us-east-1:000000000000:connection/fake',
          provider: 'github',
          repo: 'org/repo',
          branch: 'main',
          self_mutating: true,
        },
        deployOrder: [{ environment: 'staging', manual_approval: false }],
        environments: {
          dev: { account: '111111111111', region: 'us-east-1' },
        },
      });
    }).toThrow(/deploy_order references environment "staging"/);
  });
});
