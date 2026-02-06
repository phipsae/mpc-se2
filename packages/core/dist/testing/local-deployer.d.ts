export interface LocalDeployResult {
    success: boolean;
    contractAddress?: string;
    output: string;
    error?: string;
}
export declare function deployToAnvil(projectPath: string, rpcUrl: string, privateKey: string): Promise<LocalDeployResult>;
//# sourceMappingURL=local-deployer.d.ts.map