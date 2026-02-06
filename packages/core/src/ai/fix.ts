import { getAnthropicClient, MODEL } from "./client.js";
import {
  FIX_COMPILATION_PROMPT,
  FIX_SECURITY_PROMPT,
  FIX_TESTS_PROMPT,
} from "./prompts.js";
import { extractTextContent, parseContracts, parseTests } from "./parsers.js";
import type { SecurityWarning } from "../types.js";

export async function fixCompilation(
  contracts: { name: string; content: string }[],
  errors: string[]
): Promise<{ name: string; content: string }[]> {
  const client = getAnthropicClient();

  const contractsText = contracts
    .map((c) => `--- ${c.name} ---\n${c.content}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Fix these compilation errors:\n\n${errors.join("\n\n")}\n\nContracts:\n${contractsText}`,
      },
    ],
    system: FIX_COMPILATION_PROMPT,
  });

  const responseText = extractTextContent(message);
  const fixedContracts = parseContracts(responseText);
  return fixedContracts.length > 0 ? fixedContracts : contracts;
}

export async function fixSecurity(
  contracts: { name: string; content: string }[],
  warnings: SecurityWarning[]
): Promise<{ name: string; content: string }[]> {
  const client = getAnthropicClient();

  const contractsText = contracts
    .map((c) => `--- ${c.name} ---\n${c.content}`)
    .join("\n\n");

  const issuesText = warnings
    .map((w) => `[${w.severity}] ${w.contract || "unknown"} line ${w.line || "?"}: ${w.message}`)
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Fix these security issues:\n\n${issuesText}\n\nContracts:\n${contractsText}`,
      },
    ],
    system: FIX_SECURITY_PROMPT,
  });

  const responseText = extractTextContent(message);
  const fixedContracts = parseContracts(responseText);
  return fixedContracts.length > 0 ? fixedContracts : contracts;
}

export async function fixTestFailures(
  contracts: { name: string; content: string }[],
  tests: { name: string; content: string }[],
  testOutput: string
): Promise<{
  contracts: { name: string; content: string }[];
  tests: { name: string; content: string }[];
}> {
  const client = getAnthropicClient();

  const contractsText = contracts
    .map((c) => `--- ${c.name} ---\n${c.content}`)
    .join("\n\n");

  const testsText = tests
    .map((t) => `--- ${t.name} ---\n${t.content}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Test output:\n${testOutput}\n\nContracts:\n${contractsText}\n\nTests:\n${testsText}`,
      },
    ],
    system: FIX_TESTS_PROMPT,
  });

  const responseText = extractTextContent(message);
  const fixedContracts = parseContracts(responseText);
  const fixedTests = parseTests(responseText);

  return {
    contracts: fixedContracts.length > 0 ? fixedContracts : contracts,
    tests: fixedTests.length > 0 ? fixedTests : tests,
  };
}
