import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings2, RotateCcw } from 'lucide-react';
import { ColumnConfig } from '@/hooks/useColumnConfig';

interface ColumnConfigPanelProps {
  columns: ColumnConfig[];
  onToggleColumn: (key: string) => void;
  onReset: () => void;
}

export const ColumnConfigPanel: React.FC<ColumnConfigPanelProps> = ({
  columns,
  onToggleColumn,
  onReset,
}) => {
  const visibleCount = columns.filter(c => c.visible).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="w-4 h-4 mr-2" />
          Columns ({visibleCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 bg-popover border border-border z-50" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Visible Columns</h4>
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${col.key}`}
                  checked={col.visible}
                  onCheckedChange={() => onToggleColumn(col.key)}
                />
                <Label 
                  htmlFor={`col-${col.key}`}
                  className="text-sm cursor-pointer flex-1"
                >
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
