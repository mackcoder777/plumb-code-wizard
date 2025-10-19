import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Download, Upload, Zap } from 'lucide-react';

interface QuickActionsProps {
  hasMappings: boolean;
  mappedCount: number;
  totalCount: number;
  onAutoSuggest: () => void;
  onApplyAll: () => void;
  onExport?: () => void;
  isAutoSuggestLoading?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  hasMappings,
  mappedCount,
  totalCount,
  onAutoSuggest,
  onApplyAll,
  onExport,
  isAutoSuggestLoading,
}) => {
  const unmappedCount = totalCount - mappedCount;
  const completionPercentage = totalCount > 0 ? Math.round((mappedCount / totalCount) * 100) : 0;

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>
          Fast shortcuts to speed up your workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Auto-Suggest Action */}
        <div className="space-y-2">
          <Button
            className="w-full justify-start"
            variant={unmappedCount > 0 ? "default" : "outline"}
            onClick={onAutoSuggest}
            disabled={isAutoSuggestLoading || totalCount === 0}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isAutoSuggestLoading ? 'Analyzing...' : 'Auto-Suggest Mappings'}
          </Button>
          <p className="text-xs text-muted-foreground px-1">
            {unmappedCount > 0 
              ? `Automatically suggest codes for ${unmappedCount} unmapped system${unmappedCount !== 1 ? 's' : ''}`
              : 'All systems have mappings'
            }
          </p>
        </div>

        {/* Apply All Action */}
        <div className="space-y-2">
          <Button
            className="w-full justify-start"
            variant={hasMappings ? "default" : "outline"}
            onClick={onApplyAll}
            disabled={!hasMappings}
          >
            <Download className="w-4 h-4 mr-2" />
            Apply All Mappings
          </Button>
          <p className="text-xs text-muted-foreground px-1">
            {hasMappings
              ? `Apply mappings to all items in ${mappedCount} system${mappedCount !== 1 ? 's' : ''}`
              : 'Create mappings first to enable this'
            }
          </p>
        </div>

        {/* Export Action */}
        {onExport && (
          <div className="space-y-2">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={onExport}
              disabled={!hasMappings}
            >
              <Upload className="w-4 h-4 mr-2" />
              Apply & Export
            </Button>
            <p className="text-xs text-muted-foreground px-1">
              Apply mappings and export to Excel in one step
            </p>
          </div>
        )}

        {/* Progress Summary */}
        {totalCount > 0 && (
          <div className="pt-3 mt-3 border-t">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{completionPercentage}%</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{mappedCount} mapped</span>
                <span>{unmappedCount} remaining</span>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {completionPercentage === 100 && (
          <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm font-medium text-success text-center">
              🎉 All systems mapped!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
