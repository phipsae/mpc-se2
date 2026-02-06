let se2DocsCache: string = "";

export async function getSE2Docs(): Promise<string> {
  if (se2DocsCache) return se2DocsCache;

  try {
    const response = await fetch("https://docs.scaffoldeth.io/llms-full.txt");
    if (response.ok) {
      se2DocsCache = await response.text();
      return se2DocsCache;
    }
  } catch {
    // Failed to fetch SE2 docs - will use empty string
  }
  return "";
}
