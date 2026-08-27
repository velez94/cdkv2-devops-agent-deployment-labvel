import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FoundationStack } from '../lib/stacks/foundation/foundation-stack';

describe('Snapshot tests', () => {
  test('Foundation stack matches snapshot', () => {
    const app = new cdk.App();
    const stack = new FoundationStack(app, 'SnapshotTest', {
      projectName: 'Snapshot',
      environment: 'dev',
    });
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
