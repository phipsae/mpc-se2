import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export interface SavedProject {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  plan: ProjectPlan;
  generatedCode: GeneratedCode;
  deployment: DeploymentResult | null;
  githubRepo: { url: string; name: string } | null;
  vercelDeployment: { url: string; projectId: string } | null;
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

  // Saved projects
  savedProjects: SavedProject[];
  saveCurrentProject: () => string | null;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;

  // Reset
  reset: () => void;
}

const initialBuilderState = {
  step: "prompt" as BuilderStep,
  prompt: "",
  questions: [] as ClarificationQuestion[],
  answers: {} as Record<string, string | number | boolean>,
  plan: null as ProjectPlan | null,
  generatedCode: null as GeneratedCode | null,
  checkResult: null as CheckResult | null,
  selectedNetwork: 11155111, // Sepolia
  deployment: null as DeploymentResult | null,
  githubRepo: null as { url: string; name: string } | null,
  vercelDeployment: null as { url: string; projectId: string } | null,
  isLoading: false,
  loadingMessage: "",
};

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      ...initialBuilderState,
      savedProjects: [],

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

      saveCurrentProject: () => {
        const state = get();
        if (!state.plan || !state.generatedCode) return null;

        // Check if project already exists (by matching deployment address or github repo)
        const existingProject = state.savedProjects.find(
          (p) =>
            (state.deployment?.contractAddress &&
              p.deployment?.contractAddress === state.deployment.contractAddress) ||
            (state.githubRepo?.url && p.githubRepo?.url === state.githubRepo.url)
        );

        if (existingProject) {
          // Update existing project
          set({
            savedProjects: state.savedProjects.map((p) =>
              p.id === existingProject.id
                ? {
                    ...p,
                    deployment: state.deployment,
                    githubRepo: state.githubRepo,
                    vercelDeployment: state.vercelDeployment,
                  }
                : p
            ),
          });
          return existingProject.id;
        }

        // Create new project
        const newProject: SavedProject = {
          id: crypto.randomUUID(),
          name: state.plan.contractName,
          prompt: state.prompt,
          createdAt: new Date().toISOString(),
          plan: state.plan,
          generatedCode: state.generatedCode,
          deployment: state.deployment,
          githubRepo: state.githubRepo,
          vercelDeployment: state.vercelDeployment,
        };

        set({ savedProjects: [newProject, ...state.savedProjects] });
        return newProject.id;
      },

      loadProject: (id) => {
        const state = get();
        const project = state.savedProjects.find((p) => p.id === id);
        if (!project) return;

        set({
          prompt: project.prompt,
          plan: project.plan,
          generatedCode: project.generatedCode,
          deployment: project.deployment,
          githubRepo: project.githubRepo,
          vercelDeployment: project.vercelDeployment,
          step: "results",
          questions: [],
          answers: {},
          checkResult: null,
        });
      },

      deleteProject: (id) => {
        set((state) => ({
          savedProjects: state.savedProjects.filter((p) => p.id !== id),
        }));
      },

      reset: () => set(initialBuilderState),
    }),
    {
      name: "mpc-sre-projects",
      partialize: (state) => ({ savedProjects: state.savedProjects }),
    }
  )
);
