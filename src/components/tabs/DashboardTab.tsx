import React from 'react';
import { ProjectStats } from '@/types/estimate';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, FileText, Clock } from 'lucide-react';

interface DashboardTabProps {
  stats: ProjectStats;
  currentFile: File;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ stats, currentFile }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Activity className="w-8 h-8 text-success" />
            <div>
              <h3 className="text-lg font-semibold">Project Status</h3>
              <Badge variant="default" className="bg-success text-success-foreground">Active</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Current File</h3>
              <p className="text-muted-foreground text-sm">{currentFile.name}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Clock className="w-8 h-8 text-info" />
            <div>
              <h3 className="text-lg font-semibold">Last Updated</h3>
              <p className="text-muted-foreground text-sm">{new Date().toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Project Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Progress Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Cost Code Assignment</span>
                <span>{stats.codingCompletion}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full">
                <div 
                  className="h-full bg-success rounded-full transition-all" 
                  style={{ width: `${stats.codingCompletion}%` }}
                />
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3">Key Metrics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Items per Hour:</span>
                <span className="font-mono">
                  {stats.totalHours > 0 ? (stats.totalItems / stats.totalHours).toFixed(1) : '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Material Cost:</span>
                <span className="font-mono">
                  ${stats.totalItems > 0 ? (stats.totalMaterial / stats.totalItems).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};