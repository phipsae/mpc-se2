import { NextRequest, NextResponse } from "next/server";
import { createVercelDeployment, generateProjectName } from "@/lib/vercel";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { githubRepoUrl, repoName, vercelToken } = body as {
      githubRepoUrl: string;
      repoName: string;
      vercelToken: string;
    };

    if (!vercelToken) {
      return NextResponse.json(
        { success: false, error: "Vercel token is required. Please add your token in the connection settings." },
        { status: 401 }
      );
    }

    if (!githubRepoUrl) {
      return NextResponse.json(
        { success: false, error: "GitHub repository URL is required" },
        { status: 400 }
      );
    }

    // Generate a Vercel-compatible project name
    const projectName = generateProjectName(repoName || "my-dapp");

    // Create the Vercel deployment
    const result = await createVercelDeployment(
      vercelToken,
      githubRepoUrl,
      projectName
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deploymentUrl: result.deploymentUrl,
      projectId: result.projectId,
    });
  } catch (error) {
    console.error("Vercel API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to deploy to Vercel" },
      { status: 500 }
    );
  }
}
