import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BuilderStep =
  | "prompt"
  | "clarification"
  | "plan"
  | "generate"
  | "preview"
  | "checks"
  | "testing"
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
  tests: { name: string; content: string }[];
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

export interface TestResultItem {
  name: string;
  status: "passed" | "failed" | "pending";
  error?: string;
  gasUsed?: string;
}

export interface TestResult {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  output: string;
  tests: TestResultItem[];
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
  updatedAt: string;
  status: "draft" | "deployed";
  lastStep: BuilderStep;
  plan: ProjectPlan | null;
  generatedCode: GeneratedCode | null;
  questions: ClarificationQuestion[];
  answers: Record<string, string | number | boolean>;
  checkResult: CheckResult | null;
  testResult: TestResult | null;
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

  // Testing
  testResult: TestResult | null;
  setTestResult: (result: TestResult | null) => void;
  testOutput: string;
  setTestOutput: (output: string) => void;
  appendTestOutput: (output: string) => void;

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

  // Project management
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  isEditMode: boolean;
  setIsEditMode: (editMode: boolean) => void;

  // Saved projects
  savedProjects: SavedProject[];
  saveCurrentProject: () => string | null;
  saveDraft: () => string | null;
  loadProject: (id: string) => void;
  loadProjectForEdit: (id: string) => void;
  loadProjectAtStep: (id: string) => void;
  deleteProject: (id: string) => void;

  // Reset
  reset: () => void;
  clearCurrentSession: () => void;
}

const initialBuilderState = {
  step: "prompt" as BuilderStep,
  prompt: "",
  questions: [] as ClarificationQuestion[],
  answers: {} as Record<string, string | number | boolean>,
  plan: null as ProjectPlan | null,
  generatedCode: null as GeneratedCode | null,
  checkResult: null as CheckResult | null,
  testResult: null as TestResult | null,
  testOutput: "",
  selectedNetwork: 11155111, // Sepolia
  deployment: null as DeploymentResult | null,
  githubRepo: null as { url: string; name: string } | null,
  vercelDeployment: null as { url: string; projectId: string } | null,
  isLoading: false,
  loadingMessage: "",
  currentProjectId: null as string | null,
  isEditMode: false,
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
      setTestResult: (testResult) => set({ testResult }),
      setTestOutput: (testOutput) => set({ testOutput }),
      appendTestOutput: (output) => set((state) => ({ testOutput: state.testOutput + output })),
      setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
      setDeployment: (deployment) => set({ deployment }),
      setGithubRepo: (githubRepo) => set({ githubRepo }),
      setVercelDeployment: (vercelDeployment) => set({ vercelDeployment }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setLoadingMessage: (loadingMessage) => set({ loadingMessage }),
      setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
      setIsEditMode: (isEditMode) => set({ isEditMode }),

      // Save as draft (for in-progress projects)
      saveDraft: () => {
        const state = get();
        if (!state.prompt) return null;

        const now = new Date().toISOString();
        const projectName = state.plan?.contractName || "Untitled Project";

        // Check if we're updating an existing project
        if (state.currentProjectId) {
          const existingProject = state.savedProjects.find(
            (p) => p.id === state.currentProjectId
          );
          if (existingProject) {
            set({
              savedProjects: state.savedProjects.map((p) =>
                p.id === state.currentProjectId
                  ? {
                      ...p,
                      name: projectName,
                      prompt: state.prompt,
                      updatedAt: now,
                      lastStep: state.step,
                      plan: state.plan,
                      generatedCode: state.generatedCode,
                      questions: state.questions,
                      answers: state.answers,
                      checkResult: state.checkResult,
                      testResult: state.testResult,
                      deployment: state.deployment,
                      githubRepo: state.githubRepo,
                      vercelDeployment: state.vercelDeployment,
                      // Keep status as draft unless deployed
                      status: state.deployment ? "deployed" : "draft",
                    }
                  : p
              ),
            });
            return state.currentProjectId;
          }
        }

        // Create new draft project
        const newProject: SavedProject = {
          id: crypto.randomUUID(),
          name: projectName,
          prompt: state.prompt,
          createdAt: now,
          updatedAt: now,
          status: "draft",
          lastStep: state.step,
          plan: state.plan,
          generatedCode: state.generatedCode,
          questions: state.questions,
          answers: state.answers,
          checkResult: state.checkResult,
          testResult: state.testResult,
          deployment: null,
          githubRepo: null,
          vercelDeployment: null,
        };

        set({
          savedProjects: [newProject, ...state.savedProjects],
          currentProjectId: newProject.id,
        });
        return newProject.id;
      },

      // Save completed project (marks as deployed)
      saveCurrentProject: () => {
        const state = get();
        if (!state.plan || !state.generatedCode) return null;

        const now = new Date().toISOString();

        // Check if we're updating an existing project by currentProjectId
        if (state.currentProjectId) {
          set({
            savedProjects: state.savedProjects.map((p) =>
              p.id === state.currentProjectId
                ? {
                    ...p,
                    name: state.plan!.contractName,
                    prompt: state.prompt,
                    updatedAt: now,
                    status: "deployed" as const,
                    lastStep: "results" as BuilderStep,
                    plan: state.plan,
                    generatedCode: state.generatedCode,
                    questions: state.questions,
                    answers: state.answers,
                    checkResult: state.checkResult,
                    testResult: state.testResult,
                    deployment: state.deployment,
                    githubRepo: state.githubRepo,
                    vercelDeployment: state.vercelDeployment,
                  }
                : p
            ),
          });
          return state.currentProjectId;
        }

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
                    name: state.plan!.contractName,
                    prompt: state.prompt,
                    updatedAt: now,
                    status: "deployed" as const,
                    lastStep: "results" as BuilderStep,
                    plan: state.plan,
                    generatedCode: state.generatedCode,
                    questions: state.questions,
                    answers: state.answers,
                    checkResult: state.checkResult,
                    testResult: state.testResult,
                    deployment: state.deployment,
                    githubRepo: state.githubRepo,
                    vercelDeployment: state.vercelDeployment,
                  }
                : p
            ),
            currentProjectId: existingProject.id,
          });
          return existingProject.id;
        }

        // Create new completed project
        const newProject: SavedProject = {
          id: crypto.randomUUID(),
          name: state.plan.contractName,
          prompt: state.prompt,
          createdAt: now,
          updatedAt: now,
          status: "deployed",
          lastStep: "results",
          plan: state.plan,
          generatedCode: state.generatedCode,
          questions: state.questions,
          answers: state.answers,
          checkResult: state.checkResult,
          testResult: state.testResult,
          deployment: state.deployment,
          githubRepo: state.githubRepo,
          vercelDeployment: state.vercelDeployment,
        };

        set({
          savedProjects: [newProject, ...state.savedProjects],
          currentProjectId: newProject.id,
        });
        return newProject.id;
      },

      // Load project and go to results (for viewing deployed projects)
      loadProject: (id) => {
        const state = get();
        const project = state.savedProjects.find((p) => p.id === id);
        if (!project) return;

        set({
          currentProjectId: project.id,
          prompt: project.prompt,
          plan: project.plan,
          generatedCode: project.generatedCode,
          deployment: project.deployment,
          githubRepo: project.githubRepo,
          vercelDeployment: project.vercelDeployment,
          questions: project.questions || [],
          answers: project.answers || {},
          checkResult: project.checkResult || null,
          testResult: project.testResult || null,
          testOutput: "",
          step: "results",
          isEditMode: false,
        });
      },

      // Load project at the step where user left off (for drafts)
      loadProjectAtStep: (id) => {
        const state = get();
        const project = state.savedProjects.find((p) => p.id === id);
        if (!project) return;

        set({
          currentProjectId: project.id,
          prompt: project.prompt,
          plan: project.plan,
          generatedCode: project.generatedCode,
          deployment: project.deployment,
          githubRepo: project.githubRepo,
          vercelDeployment: project.vercelDeployment,
          questions: project.questions || [],
          answers: project.answers || {},
          checkResult: project.checkResult || null,
          testResult: project.testResult || null,
          testOutput: "",
          step: project.lastStep || "prompt",
          isEditMode: false,
        });
      },

      // Load deployed project for editing (goes to preview step)
      loadProjectForEdit: (id) => {
        const state = get();
        const project = state.savedProjects.find((p) => p.id === id);
        if (!project || !project.generatedCode) return;

        set({
          currentProjectId: project.id,
          prompt: project.prompt,
          plan: project.plan,
          generatedCode: project.generatedCode,
          deployment: project.deployment,
          githubRepo: project.githubRepo,
          vercelDeployment: project.vercelDeployment,
          questions: project.questions || [],
          answers: project.answers || {},
          checkResult: null, // Clear checks for re-verification
          testResult: null,
          testOutput: "",
          step: "preview",
          isEditMode: true,
        });
      },

      deleteProject: (id) => {
        const state = get();
        set({
          savedProjects: state.savedProjects.filter((p) => p.id !== id),
          // Clear currentProjectId if deleting current project
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
        });
      },

      reset: () =>
        set({
          ...initialBuilderState,
          currentProjectId: null,
          isEditMode: false,
        }),

      clearCurrentSession: () =>
        set({
          ...initialBuilderState,
          // Keep currentProjectId to maintain reference
        }),
    }),
    {
      name: "mpc-sre-projects",
      partialize: (state) => ({
        savedProjects: state.savedProjects,
        // Persist current session for resume capability
        currentProjectId: state.currentProjectId,
        prompt: state.prompt,
        plan: state.plan,
        generatedCode: state.generatedCode,
        step: state.step,
        questions: state.questions,
        answers: state.answers,
        checkResult: state.checkResult,
        testResult: state.testResult,
        deployment: state.deployment,
        githubRepo: state.githubRepo,
        vercelDeployment: state.vercelDeployment,
        isEditMode: state.isEditMode,
      }),
    }
  )
);
