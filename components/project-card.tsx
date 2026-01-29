"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, Github, Globe, Trash2, ArrowRight } from "lucide-react";
import { SavedProject, useBuilderStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProjectCardProps {
  project: SavedProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { loadProject, deleteProject } = useBuilderStore();

  const handleLoad = () => {
    loadProject(project.id);
    router.push("/builder");
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteProject(project.id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="group hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="text-xs">
              {formatDate(project.createdAt)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {project.deployment && (
              <Badge variant="default" className="bg-green-600 text-xs">
                Deployed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {project.prompt}
        </p>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-2">
          {project.deployment && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(project.deployment!.explorerUrl, "_blank");
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {project.deployment.networkName}
            </Button>
          )}
          {project.githubRepo && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(project.githubRepo!.url, "_blank");
              }}
            >
              <Github className="h-3 w-3 mr-1" />
              GitHub
            </Button>
          )}
          {project.vercelDeployment && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(project.vercelDeployment!.url, "_blank");
              }}
            >
              <Globe className="h-3 w-3 mr-1" />
              Live Site
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleLoad}>
            View Details
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
