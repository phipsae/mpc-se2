// Types
export * from "./types.js";

// AI modules
export { analyzePrompt } from "./ai/analyze.js";
export type { AnalyzeResult } from "./ai/analyze.js";
export { generateContracts } from "./ai/generate-contracts.js";
export type { GenerateContractsResult } from "./ai/generate-contracts.js";
export { generateFrontend } from "./ai/generate-frontend.js";
export { generateTests } from "./ai/generate-tests.js";
export { fixCompilation, fixSecurity, fixTestFailures } from "./ai/fix.js";
export { modifyCode } from "./ai/modify.js";
export type { ModifyResult } from "./ai/modify.js";

// Compiler
export { compileContracts, resolveImports, fetchOpenZeppelinContract } from "./compiler/solc-compiler.js";
export type { CompileResult } from "./compiler/solc-compiler.js";

// Security
export { analyzeSecurityPatterns, estimateGas, checkSize } from "./security/analyzer.js";

// Assembler
export { assembleProject, getAllFiles, cleanupProject, createDeployScript, updateDeployedContracts } from "./assembler/assembler.js";

// Testing
export { AnvilManager } from "./testing/anvil-manager.js";
export { runForgeTests, parseForgeOutput } from "./testing/forge-runner.js";
export { deployToAnvil } from "./testing/local-deployer.js";
export type { LocalDeployResult } from "./testing/local-deployer.js";

// Orchestrator
export { buildDApp } from "./orchestrator/build-pipeline.js";
export type { BuildOptions } from "./orchestrator/build-pipeline.js";

// Deployment
export { createRepoAndPushFiles, updateRepoFiles, generateRepoName } from "./deployment/github.js";
export { createVercelDeployment, generateProjectName } from "./deployment/vercel.js";
