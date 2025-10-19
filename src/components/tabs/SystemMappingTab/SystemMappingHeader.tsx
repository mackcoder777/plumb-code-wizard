import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Upload, MapPin, Download } from 'lucide-react';

interface SystemMappingHeaderProps {
  stats: {
    total: number;
    mapped: number;
    partial: number;
    unmapped: number;
  };
  totalItems: number;
}

export const SystemMappingHeader: React.FC<SystemMappingHeaderProps> = ({ stats, totalItems }) => {
  const completionPercentage = stats.total > 0 
    ? Math.round(((stats.mapped + stats.partial * 0.5) / stats.total) * 100) 
    : 0;

  const steps = [
    { 
      label: 'Upload Data', 
      icon: Upload, 
      status: 'completed' as const,
      description: `${totalItems} items loaded`
    },
    { 
      label: 'Map Systems', 
      icon: MapPin, 
      status: completionPercentage === 100 ? 'completed' as const : 'current' as const,
      description: `${stats.mapped} of ${stats.total} mapped`
    },
    { 
      label: 'Apply & Export', 
      icon: Download, 
      status: completionPercentage === 100 ? 'current' as const : 'pending' as const,
      description: 'Ready to apply'
    },
  ];

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">System Mapping Progress</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.mapped} of {stats.total} systems fully mapped ({completionPercentage}% complete)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{completionPercentage}%</div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={completionPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.mapped} fully mapped</span>
              <span>{stats.partial} partially mapped</span>
              <span>{stats.unmapped} unmapped</span>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = step.status === 'completed';
              const isCurrent = step.status === 'current';
              
              return (
                <div
                  key={step.label}
                  className={`
                    relative flex items-start gap-3 p-4 rounded-lg border-2 transition-all
                    ${isCompleted ? 'bg-success/10 border-success/30' : ''}
                    ${isCurrent ? 'bg-primary/10 border-primary animate-pulse' : ''}
                    ${step.status === 'pending' ? 'bg-muted/30 border-muted opacity-60' : ''}
                  `}
                >
                  {/* Step Number/Icon */}
                  <div
                    className={`
                      flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                      ${isCompleted ? 'bg-success text-success-foreground' : ''}
                      ${isCurrent ? 'bg-primary text-primary-foreground' : ''}
                      ${step.status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Step {index + 1}
                      </span>
                      {isCompleted && (
                        <CheckCircle className="w-3 h-3 text-success" />
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground">{step.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
