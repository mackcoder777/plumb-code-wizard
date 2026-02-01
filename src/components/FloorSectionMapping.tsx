import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Layers, Save, RotateCcw, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useFloorSectionMappings,
  useBatchSaveFloorSectionMappings,
  FloorSectionMapping,
} from '@/hooks/useFloorSectionMappings';

interface FloorData {
  floor: string;
  itemCount: number;
}

interface FloorSectionMappingPanelProps {
  estimateData: Array<{ floor?: string }>;
  projectId: string | null;
  onMappingsChange?: (mappings: Record<string, string>) => void;
}

// Available section codes
const SECTION_CODES = [
  { value: '01', label: '01 - Section 1' },
  { value: '02', label: '02 - Section 2' },
  { value: '03', label: '03 - Section 3' },
  { value: '04', label: '04 - Section 4' },
  { value: '05', label: '05 - Section 5' },
  { value: '06', label: '06 - Section 6' },
  { value: '07', label: '07 - Section 7' },
  { value: '08', label: '08 - Section 8' },
  { value: '09', label: '09 - Section 9' },
  { value: '10', label: '10 - Section 10' },
  { value: 'BG', label: 'BG - Below Grade' },
  { value: 'RF', label: 'RF - Roof' },
  { value: 'P1', label: 'P1 - Parking 1' },
  { value: 'P2', label: 'P2 - Parking 2' },
  { value: 'P3', label: 'P3 - Parking 3' },
];

export const FloorSectionMappingPanel: React.FC<FloorSectionMappingPanelProps> = ({
  estimateData,
  projectId,
  onMappingsChange,
}) => {
  // Local state for unsaved changes
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Database hooks
  const { data: dbMappings = [], isLoading } = useFloorSectionMappings(projectId);
  const batchSave = useBatchSaveFloorSectionMappings();

  // Extract unique floors from estimate data with counts
  const floorData = useMemo<FloorData[]>(() => {
    const floorCounts = new Map<string, number>();
    
    estimateData.forEach(item => {
      const floor = (item.floor || '').trim();
      if (floor) {
        floorCounts.set(floor, (floorCounts.get(floor) || 0) + 1);
      }
    });
    
    return Array.from(floorCounts.entries())
      .map(([floor, itemCount]) => ({ floor, itemCount }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [estimateData]);

  // Initialize local mappings from database
  useEffect(() => {
    if (dbMappings.length > 0) {
      const mappingsFromDb: Record<string, string> = {};
      dbMappings.forEach(m => {
        mappingsFromDb[m.floor_pattern] = m.section_code;
      });
      setLocalMappings(mappingsFromDb);
      setHasChanges(false);
    }
  }, [dbMappings]);

  // Notify parent of mapping changes
  useEffect(() => {
    onMappingsChange?.(localMappings);
  }, [localMappings, onMappingsChange]);

  const handleSectionChange = useCallback((floor: string, sectionCode: string) => {
    setLocalMappings(prev => ({
      ...prev,
      [floor]: sectionCode,
    }));
    setHasChanges(true);
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!projectId) {
      toast({
        title: "No Project Selected",
        description: "Please select a project to save floor mappings.",
        variant: "destructive",
      });
      return;
    }

    const mappingsToSave = Object.entries(localMappings).map(([floorPattern, sectionCode]) => ({
      floorPattern,
      sectionCode,
    }));

    try {
      await batchSave.mutateAsync({
        projectId,
        mappings: mappingsToSave,
      });
      
      setHasChanges(false);
      toast({
        title: "Mappings Saved",
        description: `Saved ${mappingsToSave.length} floor-to-section mappings.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save floor mappings. Please try again.",
        variant: "destructive",
      });
    }
  }, [projectId, localMappings, batchSave]);

  const handleReset = useCallback(() => {
    const mappingsFromDb: Record<string, string> = {};
    dbMappings.forEach(m => {
      mappingsFromDb[m.floor_pattern] = m.section_code;
    });
    setLocalMappings(mappingsFromDb);
    setHasChanges(false);
  }, [dbMappings]);

  // Auto-suggest section based on floor name
  const suggestSection = (floor: string): string => {
    const lowerFloor = floor.toLowerCase();
    
    if (lowerFloor.includes('basement') || lowerFloor.includes('below') || lowerFloor === 'bg' || lowerFloor === 'ug') {
      return 'BG';
    }
    if (lowerFloor.includes('roof') || lowerFloor === 'rf') {
      return 'RF';
    }
    if (lowerFloor.includes('parking') || lowerFloor.startsWith('p')) {
      if (lowerFloor.includes('1') || lowerFloor === 'p1') return 'P1';
      if (lowerFloor.includes('2') || lowerFloor === 'p2') return 'P2';
      if (lowerFloor.includes('3') || lowerFloor === 'p3') return 'P3';
    }
    
    // Try to extract level number
    const levelMatch = lowerFloor.match(/(?:level|floor|l|f)\s*(\d+)/i);
    if (levelMatch) {
      const num = parseInt(levelMatch[1]);
      if (num >= 1 && num <= 10) {
        return num.toString().padStart(2, '0');
      }
    }
    
    // Default
    return '01';
  };

  const handleAutoSuggestAll = useCallback(() => {
    const newMappings: Record<string, string> = {};
    floorData.forEach(({ floor }) => {
      if (!localMappings[floor]) {
        newMappings[floor] = suggestSection(floor);
      } else {
        newMappings[floor] = localMappings[floor];
      }
    });
    setLocalMappings(newMappings);
    setHasChanges(true);
    
    toast({
      title: "Auto-Suggestions Applied",
      description: "Section codes have been suggested based on floor names. Review and save when ready.",
    });
  }, [floorData, localMappings]);

  if (floorData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Floor to Section Mapping
          </CardTitle>
          <CardDescription>
            No floor data found in the estimate. Upload an estimate with floor information to configure section mappings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Floor to Section Mapping
            </CardTitle>
            <CardDescription>
              Map floor values to labor code sections (e.g., Club Level → 02, Seating Bowl → 03)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoSuggestAll}
              disabled={isLoading}
            >
              Auto-Suggest
            </Button>
            {hasChanges && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={batchSave.isPending}
                >
                  {batchSave.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save All
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Floor Value</TableHead>
                <TableHead className="w-[30%]">Section Code</TableHead>
                <TableHead className="w-[30%] text-right">Item Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {floorData.map(({ floor, itemCount }) => (
                <TableRow key={floor}>
                  <TableCell className="font-medium">{floor}</TableCell>
                  <TableCell>
                    <Select
                      value={localMappings[floor] || '01'}
                      onValueChange={(value) => handleSectionChange(floor, value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTION_CODES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      {itemCount.toLocaleString()} items
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        
        {hasChanges && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            You have unsaved changes. Click "Save All" to persist floor-to-section mappings.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
