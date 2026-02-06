// ============================================================================
// In-memory project state management for MCP server
// ============================================================================

import type { ProjectState } from "@mpc-se2/core";

export class ProjectStore {
  private projects = new Map<string, ProjectState>();

  getProject(projectId: string): ProjectState | undefined {
    return this.projects.get(projectId);
  }

  getOrCreateProject(projectId: string): ProjectState {
    let project = this.projects.get(projectId);
    if (!project) {
      project = {
        id: projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.projects.set(projectId, project);
    }
    return project;
  }

  updateProject(
    projectId: string,
    updates: Partial<ProjectState>
  ): ProjectState {
    const project = this.getOrCreateProject(projectId);
    Object.assign(project, updates, { updatedAt: new Date().toISOString() });
    this.projects.set(projectId, project);
    return project;
  }

  deleteProject(projectId: string): boolean {
    return this.projects.delete(projectId);
  }

  listProjects(): ProjectState[] {
    return [...this.projects.values()];
  }
}
