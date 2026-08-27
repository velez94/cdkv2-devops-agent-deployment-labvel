import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FoundationStack } from '../lib/stacks/foundation/foundation-stack';

test('Foundation Stack instantiates without errors', () => {
  const app = new cdk.App();
  const stack = new FoundationStack(app, 'TestFoundation', {
    projectName: 'Test',
    environment: 'dev',
  });
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toBeDefined();
});
