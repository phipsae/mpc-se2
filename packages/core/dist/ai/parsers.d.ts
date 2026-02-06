export declare function parseContracts(responseText: string): {
    name: string;
    content: string;
}[];
export declare function parsePages(responseText: string): {
    path: string;
    content: string;
}[];
export declare function parseTests(responseText: string): {
    name: string;
    content: string;
}[];
export declare function isHardhatTest(content: string): boolean;
export declare function extractTextContent(message: {
    content: Array<{
        type: string;
        text?: string;
    }>;
}): string;
export declare function parseJsonResponse(responseText: string): unknown;
//# sourceMappingURL=parsers.d.ts.map