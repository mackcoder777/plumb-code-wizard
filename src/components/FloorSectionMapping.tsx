import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { toast } from '@/components/ui/use-toast';
import { Layers, Save, RotateCcw, Loader2, ChevronsUpDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
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

// Common section code suggestions
const COMMON_SECTION_CODES = [
  { value: '01', label: 'Section 1' },
  { value: '02', label: 'Section 2' },
  { value: '03', label: 'Section 3' },
  { value: '04', label: 'Section 4' },
  { value: '05', label: 'Section 5' },
  { value: 'BG', label: 'Below Grade' },
  { value: 'UG', label: 'Underground' },
  { value: 'RF', label: 'Roof' },
  { value: 'CL', label: 'Club Level' },
  { value: 'SB', label: 'Seating Bowl' },
  { value: 'LR', label: 'Low Roof' },
  { value: 'P1', label: 'Parking 1' },
  { value: 'P2', label: 'Parking 2' },
];

// Section code input component with custom entry support
interface SectionCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  customCodes: Array<{ value: string; label: string }>;
}

const SectionCodeInput: React.FC<SectionCodeInputProps> = ({ value, onChange, customCodes }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);
  
  // All available codes: common + custom
  const allCodes = useMemo(() => {
    const combined = [...COMMON_SECTION_CODES];
    customCodes.forEach(cc => {
      if (!combined.find(c => c.value === cc.value)) {
        combined.push(cc);
      }
    });
    return combined;
  }, [customCodes]);
  
  // Find display label for current value
  const displayLabel = useMemo(() => {
    const found = allCodes.find(c => c.value === value);
    return found ? `${found.value} - ${found.label}` : value || 'Select section...';
  }, [value, allCodes]);
  
  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setInputValue('');
  };
  
  const handleAddCustom = () => {
    if (customCode.trim().length >= 1 && customCode.trim().length <= 3) {
      const code = customCode.trim().toUpperCase();
      onChange(code);
      setCustomCode('');
      setCustomLabel('');
      setIsAddingCustom(false);
      setOpen(false);
    }
  };
  
  const filteredCodes = allCodes.filter(code => 
    code.value.toLowerCase().includes(inputValue.toLowerCase()) ||
    code.label.toLowerCase().includes(inputValue.toLowerCase())
  );
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between font-normal"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0 bg-popover" align="start">
        {isAddingCustom ? (
          <div className="p-3 space-y-3">
            <div className="text-sm font-medium">Add Custom Section Code</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Code (1-3 chars)</label>
                <Input
                  ref={codeInputRef}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="e.g., CL, UG, 01"
                  className="h-8 font-mono"
                  maxLength={3}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description (optional)</label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g., Club Level"
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setIsAddingCustom(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddCustom}
                disabled={!customCode.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput 
              placeholder="Search or type code..." 
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 text-center">
                  <p className="text-sm text-muted-foreground mb-2">No matching codes</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCustomCode(inputValue.toUpperCase());
                      setIsAddingCustom(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add "{inputValue.toUpperCase()}"
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup heading="Common Codes">
                {filteredCodes.map((code) => (
                  <CommandItem
                    key={code.value}
                    value={`${code.value} ${code.label}`}
                    onSelect={() => handleSelect(code.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === code.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono mr-2">{code.value}</span>
                    <span className="text-muted-foreground">- {code.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setIsAddingCustom(true)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add custom code...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

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

  // Extract custom codes from existing mappings (codes not in common list)
  const customCodes = useMemo(() => {
    const commonValues = new Set(COMMON_SECTION_CODES.map(c => c.value));
    const custom: Array<{ value: string; label: string }> = [];
    
    Object.values(localMappings).forEach(code => {
      if (code && !commonValues.has(code) && !custom.find(c => c.value === code)) {
        custom.push({ value: code, label: 'Custom' });
      }
    });
    
    return custom;
  }, [localMappings]);

  // Initialize local mappings from database

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
                    <SectionCodeInput
                      value={localMappings[floor] || ''}
                      onChange={(value) => handleSectionChange(floor, value)}
                      customCodes={customCodes}
                    />
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
