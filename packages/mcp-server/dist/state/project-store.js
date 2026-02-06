// ============================================================================
// In-memory project state management for MCP server
// ============================================================================
export class ProjectStore {
    projects = new Map();
    getProject(projectId) {
        return this.projects.get(projectId);
    }
    getOrCreateProject(projectId) {
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
    updateProject(projectId, updates) {
        const project = this.getOrCreateProject(projectId);
        Object.assign(project, updates, { updatedAt: new Date().toISOString() });
        this.projects.set(projectId, project);
        return project;
    }
    deleteProject(projectId) {
        return this.projects.delete(projectId);
    }
    listProjects() {
        return [...this.projects.values()];
    }
}
//# sourceMappingURL=project-store.js.map