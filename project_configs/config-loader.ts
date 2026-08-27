import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// --- Environment Types ---

export interface EnvironmentConfig {
  account: string;
  region: string;
}

// --- Pipeline Types ---

export type PipelineMode = 'cdk-pipelines' | 'github-actions' | 'azure-devops' | 'none';
export type VcsProvider = 'github' | 'github-enterprise' | 'bitbucket' | 'gitlab';

export interface CdkPipelinesConfig {
  /** AWS CodeConnections ARN (must be in AVAILABLE status) */
  connection_arn: string;
  /** VCS provider type */
  provider: VcsProvider;
  /** Repository in "owner/repo" format */
  repo: string;
  /** Branch to track */
  branch: string;
  /** Enable pipeline self-mutation on changes */
  self_mutating: boolean;
}

export interface DeployStage {
  environment: string;
  manual_approval: boolean;
}

export interface PipelineConfig {
  mode: PipelineMode;
  cdk_pipelines?: CdkPipelinesConfig;
  pipeline_account?: string;
  pipeline_region?: string;
  deploy_order?: DeployStage[];
}

// --- DevOps Agent Types ---

export interface DevOpsAgentYamlConfig {
  space_name: string;
  space_description?: string;
  monitored_accounts?: {
    account_id: string;
    role_arn: string;
    regions?: string[];
  }[];
  mcp_servers?: {
    service_type: 'mcpserver' | 'mcpserversplunk' | 'mcpservernewrelic' | 'mcpservergrafana' | 'mcpserversigv4';
    name: string;
    target_url: string;
    private_connection_name?: string;
  }[];
  private_connection?: {
    name: string;
    host_address: string;
    vpc_id: string;
    subnet_ids: string[];
    security_group_ids: string[];
  };
  use_identity_center?: boolean;
  identity_center_instance_arn?: string;
}

// --- Project Config ---

export interface ProjectConfig {
  project_name: string;
  pipeline: PipelineConfig;
  environments: Record<string, EnvironmentConfig>;
  tags: Record<string, string>;
  agent_tags?: Record<string, string>;
  devops_agent?: DevOpsAgentYamlConfig;
}

// --- Loader ---

export function loadConfig(): ProjectConfig {
  const configPath = path.join(__dirname, 'environment_options.yaml');
  const raw = yaml.load(fs.readFileSync(configPath, 'utf8')) as ProjectConfig;

  // Validate pipeline config when mode requires it
  if (raw.pipeline?.mode === 'cdk-pipelines') {
    if (!raw.pipeline.cdk_pipelines?.connection_arn) {
      throw new Error(
        'pipeline.cdk_pipelines.connection_arn is required when pipeline.mode = "cdk-pipelines". ' +
          'Create a connection in AWS Console: Developer Tools > Settings > Connections.',
      );
    }
    if (!raw.pipeline.cdk_pipelines?.repo) {
      throw new Error('pipeline.cdk_pipelines.repo is required (format: "owner/repo").');
    }
    if (!raw.pipeline.pipeline_account) {
      throw new Error(
        'pipeline.pipeline_account is required — the AWS account where the pipeline stack will be deployed.',
      );
    }
  }

  // Default pipeline mode to 'none' if not specified
  if (!raw.pipeline) {
    raw.pipeline = { mode: 'none' };
  }

  return raw;
}
