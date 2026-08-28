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

// --- DevOps Agent Types (Hub Model) ---

export interface MonitoredAccountYamlConfig {
  /** Environment name (maps to environments section) */
  environment: string;
  /** AWS account ID to monitor */
  account_id: string;
  /** Regions to monitor in this account */
  regions?: string[];
  /**
   * Optional tag key-value pairs to scope the topology crawl to a specific
   * workload in this account. Only resources carrying these tags are discovered.
   * Example:
   *   scope_tags:
   *     "aws:cloudformation:stack-name": "Athleon-production"
   */
  scope_tags?: Record<string, string>;
}

export interface AgentSpaceYamlConfig {
  /** Agent Space name */
  name: string;
  /** Description */
  description?: string;
  /** Tier: nonprod | prod (used for resource naming and retention policies) */
  tier: 'nonprod' | 'prod';
  /**
   * Locale (BCP-47) that determines the language used in agent responses.
   * Examples: "en", "es", "es-ES", "pt-BR", "ja". Optional — defaults to
   * the service default (English) when omitted. Can be changed later without
   * replacing the Agent Space (no-interruption update).
   */
  locale?: string;
  /** Accounts this space monitors (cross-account associations) */
  monitored_accounts: MonitoredAccountYamlConfig[];
}

export interface McpServerYamlConfig {
  service_type: 'mcpserver' | 'mcpserversplunk' | 'mcpservernewrelic' | 'mcpservergrafana' | 'mcpserversigv4';
  name: string;
  target_url: string;
  private_connection_name?: string;
}

export interface PrivateConnectionYamlConfig {
  name: string;
  host_address: string;
  vpc_id: string;
  subnet_ids: string[];
  security_group_ids: string[];
}

// --- Legacy single-space config (backward compat) ---
export interface DevOpsAgentYamlConfig {
  space_name: string;
  space_description?: string;
  monitored_accounts?: {
    account_id: string;
    role_arn: string;
    regions?: string[];
  }[];
  mcp_servers?: McpServerYamlConfig[];
  private_connection?: PrivateConnectionYamlConfig;
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
  /** Hub model: multiple Agent Spaces in the pipeline account */
  agent_spaces?: AgentSpaceYamlConfig[];
  /** Legacy: single space deployed per environment (deprecated) */
  devops_agent?: DevOpsAgentYamlConfig;
  /** Shared MCP server integrations (applied to all spaces) */
  mcp_servers?: McpServerYamlConfig[];
  /** Shared private connection config */
  private_connection?: PrivateConnectionYamlConfig;
  /** Identity Center config (applied to all spaces) */
  use_identity_center?: boolean;
  identity_center_instance_arn?: string;
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

  // Validate agent_spaces config
  if (raw.agent_spaces) {
    for (const space of raw.agent_spaces) {
      if (!space.name) {
        throw new Error('Each agent_spaces entry must have a "name" field.');
      }
      if (!space.monitored_accounts || space.monitored_accounts.length === 0) {
        throw new Error(
          `Agent space "${space.name}" must have at least one monitored_account.`,
        );
      }
      // Validate locale format (BCP-47) if provided
      if (space.locale && !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(space.locale)) {
        throw new Error(
          `Agent space "${space.name}" has an invalid locale "${space.locale}". ` +
            `Use a BCP-47 language tag such as "en", "es", "es-ES", "pt-BR", or "ja".`,
        );
      }
      // Validate that monitored environments exist
      for (const ma of space.monitored_accounts) {
        if (!raw.environments[ma.environment]) {
          throw new Error(
            `Agent space "${space.name}" references environment "${ma.environment}" ` +
              `but it is not defined in the environments section.`,
          );
        }
      }
    }
  }

  // Default pipeline mode to 'none' if not specified
  if (!raw.pipeline) {
    raw.pipeline = { mode: 'none' };
  }

  return raw;
}
