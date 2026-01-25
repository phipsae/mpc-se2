import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { createRepoAndPushFiles, generateRepoName } from "@/lib/github";
import { assembleProject, getAllFiles, cleanupProject } from "@/lib/assembler";
import type { GeneratedCode, DeploymentInfo } from "@/lib/assembler";

export async function POST(request: NextRequest) {
  try {
    // Get the session to retrieve the GitHub access token
    const session = await auth();

    if (!session?.githubAccessToken) {
      return NextResponse.json(
        { success: false, error: "GitHub not connected. Please connect your GitHub account." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { generatedCode, contractAddress, networkId, contractName, abi } = body as {
      generatedCode: GeneratedCode;
      contractAddress?: string;
      networkId?: number;
      contractName?: string;
      abi?: unknown[];
    };

    if (!generatedCode) {
      return NextResponse.json(
        { success: false, error: "No generated code provided" },
        { status: 400 }
      );
    }

    // Generate a unique project ID
    const projectId = Math.random().toString(36).substring(2, 15);

    // Prepare deployment info if available
    let deploymentInfo: DeploymentInfo | undefined;
    if (contractAddress && networkId && contractName && abi) {
      deploymentInfo = {
        contractAddress,
        contractName,
        abi,
        networkId,
      };
    }

    // Assemble the project
    const projectPath = await assembleProject(projectId, generatedCode, deploymentInfo);

    // Get all files from the assembled project
    const files = await getAllFiles(projectPath);

    // Generate repository name from the first contract
    const repoBaseName = generatedCode.contracts[0]?.name.replace(".sol", "") || "my-dapp";
    const repoName = generateRepoName(repoBaseName);

    // Create the repository and push files
    const result = await createRepoAndPushFiles(
      session.githubAccessToken,
      repoName,
      `A dApp built with AI dApp Builder - Scaffold-ETH 2`,
      files.map((f) => ({ path: f.relativePath, content: f.content }))
    );

    // Clean up the temporary project
    await cleanupProject(projectPath);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repoUrl: result.repoUrl,
      repoName: result.repoName,
    });
  } catch (error) {
    console.error("GitHub API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create repository" },
      { status: 500 }
    );
  }
}
