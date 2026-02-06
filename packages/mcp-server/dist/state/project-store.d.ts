import type { ProjectState } from "@mpc-se2/core";
export declare class ProjectStore {
    private projects;
    getProject(projectId: string): ProjectState | undefined;
    getOrCreateProject(projectId: string): ProjectState;
    updateProject(projectId: string, updates: Partial<ProjectState>): ProjectState;
    deleteProject(projectId: string): boolean;
    listProjects(): ProjectState[];
}
//# sourceMappingURL=project-store.d.ts.map