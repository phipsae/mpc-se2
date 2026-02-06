declare module "solc" {
  const solc: {
    compile(input: string, readCallback?: { import: (path: string) => { contents?: string; error?: string } }): string;
  };
  export default solc;
}
