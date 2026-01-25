import { create } from "zustand";

export type BuilderStep =
  | "prompt"
  | "clarification"
  | "plan"
  | "generate"
  | "preview"
  | "checks"
  | "deploy"
  | "github"
  | "vercel"
  | "results";

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: "text" | "number" | "select" | "boolean";
  options?: string[];
  required?: boolean;
}

export interface ProjectPlan {
  contractName: string;
  description: string;
  features: string[];
  pages: { path: string; description: string }[];
}

export interface GeneratedCode {
  contracts: { name: string; content: string }[];
  pages: { path: string; content: string }[];
}

export interface CheckResult {
  compilation: {
    success: boolean;
    errors: string[];
    warnings: string[];
  };
  security: {
    warnings: { severity: "warning" | "error"; message: string; line?: number }[];
  };
  gas: {
    estimated: string;
    costEth: string;
    costUsd: string;
  };
  size: {
    bytes: number;
    kb: string;
    withinLimit: boolean;
  };
}

export interface DeploymentResult {
  contractAddress: string;
  transactionHash: string;
  networkId: number;
  networkName: string;
  explorerUrl: string;
}

export interface BuilderState {
  // Current step
  step: BuilderStep;
  setStep: (step: BuilderStep) => void;

  // User prompt
  prompt: string;
  setPrompt: (prompt: string) => void;

  // Clarification
  questions: ClarificationQuestion[];
  setQuestions: (questions: ClarificationQuestion[]) => void;
  answers: Record<string, string | number | boolean>;
  setAnswer: (id: string, value: string | number | boolean) => void;

  // Plan
  plan: ProjectPlan | null;
  setPlan: (plan: ProjectPlan | null) => void;

  // Generated code
  generatedCode: GeneratedCode | null;
  setGeneratedCode: (code: GeneratedCode | null) => void;

  // Checks
  checkResult: CheckResult | null;
  setCheckResult: (result: CheckResult | null) => void;

  // Deployment
  selectedNetwork: number;
  setSelectedNetwork: (networkId: number) => void;
  deployment: DeploymentResult | null;
  setDeployment: (deployment: DeploymentResult | null) => void;

  // GitHub
  githubRepo: { url: string; name: string } | null;
  setGithubRepo: (repo: { url: string; name: string } | null) => void;

  // Vercel
  vercelDeployment: { url: string; projectId: string } | null;
  setVercelDeployment: (deployment: { url: string; projectId: string } | null) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  step: "prompt" as BuilderStep,
  prompt: "",
  questions: [],
  answers: {},
  plan: null,
  generatedCode: null,
  checkResult: null,
  selectedNetwork: 11155111, // Sepolia
  deployment: null,
  githubRepo: null,
  vercelDeployment: null,
  isLoading: false,
  loadingMessage: "",
};

export const useBuilderStore = create<BuilderState>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),
  setPrompt: (prompt) => set({ prompt }),
  setQuestions: (questions) => set({ questions }),
  setAnswer: (id, value) =>
    set((state) => ({ answers: { ...state.answers, [id]: value } })),
  setPlan: (plan) => set({ plan }),
  setGeneratedCode: (generatedCode) => set({ generatedCode }),
  setCheckResult: (checkResult) => set({ checkResult }),
  setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
  setDeployment: (deployment) => set({ deployment }),
  setGithubRepo: (githubRepo) => set({ githubRepo }),
  setVercelDeployment: (vercelDeployment) => set({ vercelDeployment }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setLoadingMessage: (loadingMessage) => set({ loadingMessage }),
  reset: () => set(initialState),
}));
