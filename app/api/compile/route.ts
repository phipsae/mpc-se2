import { NextRequest, NextResponse } from "next/server";

// Cache for fetched OpenZeppelin contracts
const importCache: Record<string, string> = {};

// OpenZeppelin version to use
const OZ_VERSION = "5.0.0";

// Resolve a relative path to an absolute @openzeppelin/ path
function resolveRelativePath(fromPath: string, relativePath: string): string {
  // If it's already an absolute path, return it
  if (relativePath.startsWith("@")) {
    return relativePath;
  }

  // Get the directory of the importing file
  const fromDir = fromPath.substring(0, fromPath.lastIndexOf("/"));
  
  // Split the paths
  const fromParts = fromDir.split("/").filter(Boolean);
  const relativeParts = relativePath.split("/");
  
  // Process the relative path
  const resultParts = [...fromParts];
  for (const part of relativeParts) {
    if (part === "..") {
      resultParts.pop();
    } else if (part !== ".") {
      resultParts.push(part);
    }
  }
  
  return "@openzeppelin/contracts/" + resultParts.slice(resultParts.indexOf("contracts") + 1).join("/");
}

// Fetch OpenZeppelin contract from unpkg CDN
async function fetchOpenZeppelinContract(importPath: string): Promise<string | null> {
  // Normalize the path
  const normalizedPath = importPath.startsWith("@openzeppelin/contracts/")
    ? importPath
    : `@openzeppelin/contracts/${importPath}`;

  // Check cache first
  if (importCache[normalizedPath]) {
    return importCache[normalizedPath];
  }

  const filePath = normalizedPath.replace("@openzeppelin/contracts/", "");
  const url = `https://unpkg.com/@openzeppelin/contracts@${OZ_VERSION}/${filePath}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const content = await response.text();
      importCache[normalizedPath] = content;
      return content;
    } else {
      console.error(`Failed to fetch ${url}: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to fetch ${importPath}:`, error);
  }

  return null;
}

// Recursively resolve all imports
async function resolveImports(
  sources: Record<string, { content: string }>,
  resolved: Set<string> = new Set()
): Promise<void> {
  // Match both named and default imports
  const importRegex = /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+)?["']([^"']+)["'];/g;

  const toFetch: { fromFile: string; importPath: string; absolutePath: string }[] = [];

  for (const [fileName, source] of Object.entries(sources)) {
    if (resolved.has(fileName)) continue;
    resolved.add(fileName);

    const matches = [...source.content.matchAll(importRegex)];
    
    for (const match of matches) {
      const rawImportPath = match[1];
      
      // Resolve the absolute path
      let absolutePath: string;
      if (rawImportPath.startsWith("@openzeppelin/")) {
        absolutePath = rawImportPath;
      } else if (rawImportPath.startsWith("./") || rawImportPath.startsWith("../")) {
        // Relative import - resolve it based on the importing file
        if (fileName.startsWith("@openzeppelin/")) {
          absolutePath = resolveRelativePath(fileName, rawImportPath);
        } else {
          // Skip relative imports from user contracts (they reference OZ via @openzeppelin/)
          continue;
        }
      } else {
        // Unknown import type, skip
        continue;
      }
      
      // Skip if already in sources
      if (sources[absolutePath]) continue;
      
      toFetch.push({ fromFile: fileName, importPath: rawImportPath, absolutePath });
    }
  }

  // Fetch all imports in parallel
  const results = await Promise.all(
    toFetch.map(async ({ absolutePath }) => {
      const content = await fetchOpenZeppelinContract(absolutePath);
      return { absolutePath, content };
    })
  );

  // Add successful fetches to sources
  for (const { absolutePath, content } of results) {
    if (content && !sources[absolutePath]) {
      sources[absolutePath] = { content };
    }
  }

  // Check if we need another pass (nested imports)
  const newImports = Object.keys(sources).filter(k => !resolved.has(k));
  if (newImports.length > 0) {
    await resolveImports(sources, resolved);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts } = body;

    if (!contracts || !contracts.length) {
      return NextResponse.json(
        { error: "No contracts provided" },
        { status: 400 }
      );
    }

    // Dynamic import of solc
    const solc = await import("solc");

    const sources: Record<string, { content: string }> = {};
    
    // Add user contracts
    for (const contract of contracts) {
      sources[contract.name] = { content: contract.content };
    }

    // Resolve all OpenZeppelin imports
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

    // Import callback to handle any remaining imports
    function findImports(importPath: string) {
      // Direct match
      if (sources[importPath]) {
        return { contents: sources[importPath].content };
      }
      
      // Try with @openzeppelin/contracts/ prefix
      const ozPath = importPath.startsWith("@openzeppelin/")
        ? importPath
        : `@openzeppelin/contracts/${importPath}`;
      if (sources[ozPath]) {
        return { contents: sources[ozPath].content };
      }
      
      return { error: `File not found: ${importPath}` };
    }

    const output = JSON.parse(
      solc.default.compile(JSON.stringify(input), { import: findImports })
    );

    // Check for errors
    const errors: string[] = [];
    const warnings: string[] = [];

    if (output.errors) {
      for (const error of output.errors) {
        if (error.severity === "error") {
          errors.push(error.formattedMessage || error.message);
        } else {
          warnings.push(error.formattedMessage || error.message);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors,
        warnings,
      });
    }

    // Get the first contract's output
    const contractName = contracts[0].name.replace(".sol", "");
    const contractOutput = output.contracts?.[contracts[0].name]?.[contractName];

    if (!contractOutput) {
      // Try to find any contract in the output
      const firstFile = Object.keys(output.contracts || {})[0];
      const firstContract = firstFile
        ? Object.keys(output.contracts[firstFile])[0]
        : null;
      
      if (firstContract && firstFile) {
        const fallbackOutput = output.contracts[firstFile][firstContract];
        return NextResponse.json({
          success: true,
          abi: fallbackOutput.abi,
          bytecode: fallbackOutput.evm.bytecode.object,
          deployedBytecode: fallbackOutput.evm.deployedBytecode.object,
          warnings,
        });
      }

      return NextResponse.json({
        success: false,
        errors: ["No contract output found"],
        warnings,
      });
    }

    return NextResponse.json({
      success: true,
      abi: contractOutput.abi,
      bytecode: contractOutput.evm.bytecode.object,
      deployedBytecode: contractOutput.evm.deployedBytecode.object,
      warnings,
    });
  } catch (error) {
    console.error("Compile error:", error);
    return NextResponse.json(
      {
        success: false,
        errors: [error instanceof Error ? error.message : "Compilation failed"],
      },
      { status: 500 }
    );
  }
}
