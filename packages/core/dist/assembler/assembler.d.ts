import type { GeneratedCode, DeploymentInfo } from "../types.js";
export declare function assembleProject(projectId: string, generatedCode: GeneratedCode, deployment?: DeploymentInfo): Promise<string>;
export declare function updateDeployedContracts(projectPath: string, deployment: DeploymentInfo): Promise<void>;
export declare function createDeployScript(projectPath: string, contractFileName: string): Promise<void>;
export declare function getAllFiles(dirPath: string, basePath?: string): Promise<{
    relativePath: string;
    content: string;
}[]>;
export declare function cleanupProject(projectPath: string): Promise<void>;
//# sourceMappingURL=assembler.d.ts.map