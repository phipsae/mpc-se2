// ============================================================================
// Solidity compiler with OpenZeppelin import resolution
// Extracted from app/api/compile/route.ts and test-runner/server.js
// ============================================================================
const OZ_VERSION = "5.0.0";
const importCache = {};
function resolveRelativePath(fromPath, relativePath) {
    if (relativePath.startsWith("@"))
        return relativePath;
    const fromDir = fromPath.substring(0, fromPath.lastIndexOf("/"));
    const fromParts = fromDir.split("/").filter(Boolean);
    const relativeParts = relativePath.split("/");
    const resultParts = [...fromParts];
    for (const part of relativeParts) {
        if (part === "..") {
            resultParts.pop();
        }
        else if (part !== ".") {
            resultParts.push(part);
        }
    }
    return ("@openzeppelin/contracts/" +
        resultParts.slice(resultParts.indexOf("contracts") + 1).join("/"));
}
export async function fetchOpenZeppelinContract(importPath) {
    const normalizedPath = importPath.startsWith("@openzeppelin/contracts/")
        ? importPath
        : `@openzeppelin/contracts/${importPath}`;
    if (importCache[normalizedPath])
        return importCache[normalizedPath];
    const filePath = normalizedPath.replace("@openzeppelin/contracts/", "");
    const url = `https://unpkg.com/@openzeppelin/contracts@${OZ_VERSION}/${filePath}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const content = await response.text();
            importCache[normalizedPath] = content;
            return content;
        }
    }
    catch (error) {
        console.error(`Failed to fetch ${importPath}:`, error);
    }
    return null;
}
export async function resolveImports(sources, resolved = new Set()) {
    const importRegex = /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["'];/g;
    const toFetch = [];
    for (const [fileName, source] of Object.entries(sources)) {
        if (resolved.has(fileName))
            continue;
        resolved.add(fileName);
        const matches = [...source.content.matchAll(importRegex)];
        for (const match of matches) {
            const rawImportPath = match[1];
            let absolutePath;
            if (rawImportPath.startsWith("@openzeppelin/")) {
                absolutePath = rawImportPath;
            }
            else if (rawImportPath.startsWith("./") ||
                rawImportPath.startsWith("../")) {
                if (fileName.startsWith("@openzeppelin/")) {
                    absolutePath = resolveRelativePath(fileName, rawImportPath);
                }
                else {
                    continue;
                }
            }
            else {
                continue;
            }
            if (sources[absolutePath])
                continue;
            toFetch.push({ absolutePath });
        }
    }
    const results = await Promise.all(toFetch.map(async ({ absolutePath }) => {
        const content = await fetchOpenZeppelinContract(absolutePath);
        return { absolutePath, content };
    }));
    for (const { absolutePath, content } of results) {
        if (content && !sources[absolutePath]) {
            sources[absolutePath] = { content };
        }
    }
    const newImports = Object.keys(sources).filter((k) => !resolved.has(k));
    if (newImports.length > 0) {
        await resolveImports(sources, resolved);
    }
}
export async function compileContracts(contracts) {
    // Dynamic import of solc
    const solc = await import("solc");
    const sources = {};
    for (const contract of contracts) {
        sources[contract.name] = { content: contract.content };
    }
    await resolveImports(sources);
    const input = {
        language: "Solidity",
        sources,
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
                },
            },
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    };
    function findImports(importPath) {
        if (sources[importPath]) {
            return { contents: sources[importPath].content };
        }
        const ozPath = importPath.startsWith("@openzeppelin/")
            ? importPath
            : `@openzeppelin/contracts/${importPath}`;
        if (sources[ozPath]) {
            return { contents: sources[ozPath].content };
        }
        return { error: `File not found: ${importPath}` };
    }
    const output = JSON.parse(solc.default.compile(JSON.stringify(input), { import: findImports }));
    const errors = [];
    const warnings = [];
    if (output.errors) {
        for (const error of output.errors) {
            if (error.severity === "error") {
                errors.push(error.formattedMessage || error.message);
            }
            else {
                warnings.push(error.formattedMessage || error.message);
            }
        }
    }
    if (errors.length > 0) {
        return { success: false, errors, warnings };
    }
    // Extract ABI and bytecode from the first user contract
    let abi;
    let bytecode;
    let deployedBytecode;
    if (output.contracts) {
        for (const contract of contracts) {
            const fileOutput = output.contracts[contract.name];
            if (fileOutput) {
                const contractName = contract.name.replace(".sol", "");
                const contractOutput = fileOutput[contractName] || Object.values(fileOutput)[0];
                if (contractOutput) {
                    abi = contractOutput.abi;
                    bytecode = contractOutput.evm?.bytecode?.object;
                    deployedBytecode = contractOutput.evm?.deployedBytecode?.object;
                    break;
                }
            }
        }
        // Fallback: any contract output
        if (!bytecode) {
            for (const fileName of Object.keys(output.contracts)) {
                if (fileName.endsWith(".sol")) {
                    const fileContracts = output.contracts[fileName];
                    for (const name of Object.keys(fileContracts)) {
                        const c = fileContracts[name];
                        if (c.evm?.bytecode?.object) {
                            abi = c.abi;
                            bytecode = c.evm.bytecode.object;
                            deployedBytecode = c.evm.deployedBytecode?.object;
                            break;
                        }
                    }
                    if (bytecode)
                        break;
                }
            }
        }
    }
    return { success: true, errors: [], warnings, abi, bytecode, deployedBytecode };
}
//# sourceMappingURL=solc-compiler.js.map