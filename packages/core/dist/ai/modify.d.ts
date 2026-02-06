export interface ModifyResult {
    contracts?: {
        name: string;
        content: string;
    }[];
    pages?: {
        path: string;
        content: string;
    }[];
}
export declare function modifyCode(prompt: string, contracts?: {
    name: string;
    content: string;
}[], pages?: {
    path: string;
    content: string;
}[]): Promise<ModifyResult>;
//# sourceMappingURL=modify.d.ts.map