// ============================================================================
// Shared parsing utilities for Claude's code-fenced responses
// ============================================================================
export function parseContracts(responseText) {
    const contracts = [];
    const contractMatches = responseText.matchAll(/---CONTRACT:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
    for (const match of contractMatches) {
        contracts.push({ name: match[1].trim(), content: match[2].trim() });
    }
    // Fallback: any solidity code blocks
    if (contracts.length === 0) {
        const solidityBlocks = responseText.matchAll(/```solidity\s*([\s\S]*?)```/gi);
        let i = 0;
        for (const match of solidityBlocks) {
            // Skip if it looks like a test file
            if (match[1].includes("forge-std/Test.sol"))
                continue;
            contracts.push({
                name: `Contract${i > 0 ? i + 1 : ""}.sol`,
                content: match[1].trim(),
            });
            i++;
        }
    }
    return contracts;
}
export function parsePages(responseText) {
    const pages = [];
    const pageMatches = responseText.matchAll(/---PAGE:\s*([^\n-]+)---\s*```(?:tsx?|jsx?)?\s*([\s\S]*?)```/gi);
    for (const match of pageMatches) {
        pages.push({ path: match[1].trim(), content: match[2].trim() });
    }
    // Fallback: any tsx/jsx code blocks
    if (pages.length === 0) {
        const tsxBlocks = responseText.matchAll(/```(?:tsx?|jsx?)\s*([\s\S]*?)```/gi);
        let i = 0;
        for (const match of tsxBlocks) {
            pages.push({
                path: `app/dapp${i > 0 ? i + 1 : ""}/page.tsx`,
                content: match[1].trim(),
            });
            i++;
        }
    }
    return pages;
}
export function parseTests(responseText) {
    const tests = [];
    const testMatches = responseText.matchAll(/---TEST:\s*([^\n-]+)---\s*```(?:solidity)?\s*([\s\S]*?)```/gi);
    for (const match of testMatches) {
        const testContent = match[2].trim();
        // Reject JavaScript/Hardhat tests
        if (isHardhatTest(testContent)) {
            continue;
        }
        let testName = match[1].trim();
        if (!testName.endsWith(".t.sol")) {
            testName = testName.replace(/\.(sol|ts|test\.ts)$/, "") + ".t.sol";
        }
        tests.push({ name: testName, content: testContent });
    }
    // Fallback: find Foundry tests in solidity blocks
    if (tests.length === 0) {
        const solBlocks = responseText.matchAll(/```(?:solidity)\s*([\s\S]*?)```/gi);
        for (const match of solBlocks) {
            const content = match[1].trim();
            if (isHardhatTest(content))
                continue;
            if (content.includes("forge-std/Test.sol") || content.includes("is Test")) {
                tests.push({
                    name: "Test.t.sol",
                    content,
                });
                break;
            }
        }
    }
    return tests;
}
export function isHardhatTest(content) {
    return (content.includes("describe(") ||
        content.includes("it(") ||
        content.includes('require("chai")') ||
        content.includes("require('chai')") ||
        content.includes('from "hardhat"') ||
        content.includes("ethers.getSigners"));
}
export function extractTextContent(message) {
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text" || !textContent.text) {
        throw new Error("No text response from Claude");
    }
    return textContent.text;
}
export function parseJsonResponse(responseText) {
    const trimmed = responseText.trim();
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Could not parse response as JSON");
    }
}
//# sourceMappingURL=parsers.js.map