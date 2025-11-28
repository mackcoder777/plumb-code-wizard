import React, { useState } from 'react';
import { useEstimateProjects, useCreateProject, useDeleteProject, EstimateProject } from '@/hooks/useEstimateProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Folder, Plus, Trash2, Clock, FileSpreadsheet } from 'lucide-react';

interface ProjectSelectorProps {
  currentProjectId: string | null;
  onSelectProject: (project: EstimateProject | null) => void;
  onNewProject: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  currentProjectId,
  onSelectProject,
  onNewProject,
}) => {
  const { data: projects = [], isLoading } = useEstimateProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [newProjectName, setNewProjectName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const project = await createProject.mutateAsync({ name: newProjectName.trim() });
      setNewProjectName('');
      setIsDialogOpen(false);
      onSelectProject(project);
      onNewProject();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project? All mappings will be lost.')) {
      try {
        await deleteProject.mutateAsync(projectId);
        if (currentProjectId === projectId) {
          onSelectProject(null);
        }
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const currentProject = projects.find(p => p.id === currentProjectId);

  return (
    <div className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Folder className="h-5 w-5" />
            <span className="font-medium">Project:</span>
          </div>
          
          {currentProject ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-600">{currentProject.name}</span>
              {currentProject.file_name && (
                <span className="text-sm text-gray-500">({currentProject.file_name})</span>
              )}
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                {currentProject.total_items} items
              </span>
            </div>
          ) : (
            <span className="text-gray-500 italic">No project selected</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Project List Dropdown */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {projects.length > 0 ? `${projects.length} Projects` : 'My Projects'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Your Estimate Projects</DialogTitle>
              </DialogHeader>
              
              {/* Create New Project */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="New project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <Button 
                  onClick={handleCreateProject} 
                  disabled={!newProjectName.trim() || createProject.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </div>

              {/* Project List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-4 text-gray-500">Loading projects...</div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No projects yet</p>
                    <p className="text-sm">Create a project to save your mapping work</p>
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => {
                        onSelectProject(project);
                        setIsDialogOpen(false);
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-400 ${
                        currentProjectId === project.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{project.name}</div>
                          {project.file_name && (
                            <div className="text-sm text-gray-500">{project.file_name}</div>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{project.total_items} items</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(project.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};
