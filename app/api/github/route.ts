import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { createRepoAndPushFiles, updateRepoFiles, generateRepoName } from "@/lib/github";
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
    const { generatedCode, contractAddress, networkId, contractName, abi, projectName, existingRepo } = body as {
      generatedCode: GeneratedCode;
      contractAddress?: string;
      networkId?: number;
      contractName?: string;
      abi?: unknown[];
      projectName?: string; // User-chosen project name
      existingRepo?: { url: string; name: string }; // Existing repo to update instead of creating new
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
    const filesToCommit = files.map((f) => ({ path: f.relativePath, content: f.content }));

    let result;

    // If existingRepo is provided, update it instead of creating a new one
    if (existingRepo?.url) {
      console.log(`Updating existing repository: ${existingRepo.url}`);
      result = await updateRepoFiles(
        session.githubAccessToken,
        existingRepo.url,
        filesToCommit,
        "Update from AI dApp Builder"
      );
    } else {
      // Use user-provided project name, or generate one from the contract
      let repoName: string;
      if (projectName && projectName.trim()) {
        // Sanitize the user-provided name
        repoName = projectName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/--+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 100); // GitHub repo names have a max length
      } else {
        // Fall back to generated name
        const repoBaseName = generatedCode.contracts[0]?.name.replace(".sol", "") || "my-dapp";
        repoName = generateRepoName(repoBaseName);
      }

      // Create the repository and push files
      console.log(`Creating new repository: ${repoName}`);
      result = await createRepoAndPushFiles(
        session.githubAccessToken,
        repoName,
        `A dApp built with AI dApp Builder - Scaffold-ETH 2 with Foundry`,
        filesToCommit
      );
    }

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
