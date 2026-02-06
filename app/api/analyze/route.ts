import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Fetch SE2 documentation for context
async function getSE2Docs(): Promise<string> {
  try {
    const response = await fetch("https://docs.scaffoldeth.io/llms-full.txt");
    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.error("Failed to fetch SE2 docs:", error);
  }
  return "";
}

const ANALYZE_SYSTEM_PROMPT = `You are an expert Ethereum dApp architect. Your job is to analyze user requests for building dApps and either:
1. Ask clarifying questions if the request is ambiguous
2. Return a structured plan if the request is clear enough

RULES:
- For NFT projects, you MUST know: collection name, max supply, mint price, who can mint, owner withdraw capability
- For token projects, you MUST know: token name, symbol, total supply, any special features (burning, minting, transfer fees)
- For DeFi projects, you MUST know: the core mechanism, token types involved, fee structures
- If ANY critical detail is missing, ask clarifying questions

RESPONSE FORMAT (JSON):
If clarification needed:
{
  "status": "needs_clarification",
  "questions": [
    {
      "id": "unique_id",
      "question": "Human readable question",
      "type": "text" | "number" | "select" | "boolean",
      "options": ["option1", "option2"], // only for select type
      "required": true | false
    }
  ]
}

If ready to proceed:
{
  "status": "ready",
  "plan": {
    "contractName": "ContractName",
    "description": "Brief description of what the contract does",
    "features": ["Feature 1", "Feature 2"],
    "pages": [
      { "path": "/pagename", "description": "What this page does" }
    ],
    "suggestedProjectName": "short-descriptive-name"
  }
}

PROJECT NAME RULES:
- suggestedProjectName should be a short, descriptive name for the project (3-5 words max)
- Use lowercase letters, numbers, and hyphens only (GitHub-compatible)
- Make it memorable and descriptive of what the project does
- Examples: "nft-marketplace", "staking-rewards-dapp", "crypto-lottery", "token-swap"

ONLY return valid JSON, no other text.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured. Please add it to your .env file." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { prompt, answers, isFollowUp } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    let userMessage = prompt;
    
    if (isFollowUp && answers) {
      userMessage = `Original request: ${prompt}\n\nUser's answers to clarification questions:\n${JSON.stringify(answers, null, 2)}\n\nNow create a plan based on this information.`;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      system: ANALYZE_SYSTEM_PROMPT,
    });

    // Extract text content
    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response
    const responseText = textContent.text.trim();

    // Try to extract JSON from the response
    let jsonResponse;
    try {
      // First try direct parse
      jsonResponse = JSON.parse(responseText);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse response as JSON");
      }
    }

    // Validate the response has the expected structure
    if (!jsonResponse.status) {
      console.error("Invalid response structure:", jsonResponse);
      throw new Error("AI returned an invalid response format. Please try again.");
    }

    if (jsonResponse.status === "needs_clarification" && !jsonResponse.questions) {
      throw new Error("AI response missing clarification questions.");
    }

    if (jsonResponse.status === "ready" && !jsonResponse.plan) {
      throw new Error("AI response missing project plan.");
    }

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
