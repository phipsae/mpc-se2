export interface ClarificationQuestion {
    id: string;
    question: string;
    type: "text" | "number" | "select" | "boolean";
    options?: string[];
    required?: boolean;
}
export interface ProjectPlan {
    contractName: string;
    description: string;
    features: string[];
    pages: {
        path: string;
        description: string;
    }[];
    suggestedProjectName?: string;
}
export interface GeneratedCode {
    contracts: {
        name: string;
        content: string;
    }[];
    pages: {
        path: string;
        content: string;
    }[];
    tests: {
        name: string;
        content: string;
    }[];
}
export interface CheckResult {
    compilation: {
        success: boolean;
        errors: string[];
        warnings: string[];
    };
    security: {
        warnings: SecurityWarning[];
    };
    gas: {
        estimated: string;
        costEth: string;
        costUsd: string;
    };
    size: {
        bytes: number;
        kb: string;
        withinLimit: boolean;
    };
}
export interface SecurityWarning {
    severity: "warning" | "error";
    message: string;
    contract?: string;
    line?: number;
}
export interface TestResultItem {
    name: string;
    status: "passed" | "failed" | "pending";
    error?: string;
    gasUsed?: string;
}
export interface TestResult {
    success: boolean;
    totalTests: number;
    passed: number;
    failed: number;
    output: string;
    tests: TestResultItem[];
}
export interface DeploymentResult {
    contractAddress: string;
    transactionHash: string;
    networkId: number;
    networkName: string;
    explorerUrl: string;
}
export interface DeploymentInfo {
    contractAddress: string;
    contractName: string;
    abi: unknown[];
    networkId: number;
}
export type BuildProgressStatus = "idle" | "generating" | "validating" | "compiling" | "fixing_compilation" | "checking_security" | "fixing_security" | "testing" | "fixing_tests" | "done" | "failed";
export interface BuildProgress {
    status: BuildProgressStatus;
    iteration: number;
    maxIterations: number;
    message: string;
    logs: string[];
}
export interface BuildResult {
    success: boolean;
    code?: GeneratedCode;
    testResult?: TestResult;
    securityWarnings?: SecurityWarning[];
    logs: string[];
    iterations: number;
    elapsedMs?: number;
    error?: string;
    compileErrors?: string[];
}
export interface ProjectState {
    id: string;
    anvilRpcUrl?: string;
    anvilPort?: number;
    projectPath?: string;
    createdAt: string;
    updatedAt: string;
}
export interface GitHubRepoResult {
    success: boolean;
    repoUrl?: string;
    repoName?: string;
    error?: string;
    errorCode?: string;
}
export interface FileToCommit {
    path: string;
    content: string;
}
export interface VercelDeploymentResult {
    success: boolean;
    deploymentUrl?: string;
    projectId?: string;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map