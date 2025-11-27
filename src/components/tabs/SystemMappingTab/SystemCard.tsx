import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COST_CODES_DB } from '@/data/costCodes';
import { CheckCircle, AlertCircle, XCircle, X, Sparkles } from 'lucide-react';

interface SystemCardProps {
  system: string;
  itemCount: number;
  materialCode?: string;
  laborCode?: string;
  suggestedMaterialCode?: string;
  suggestedLaborCode?: string;
  onMaterialCodeChange: (value: string) => void;
  onLaborCodeChange: (value: string) => void;
  onClear: () => void;
  onApplySuggestions?: () => void;
  importedCostCodes?: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>;
}

export const SystemCard: React.FC<SystemCardProps> = ({
  system,
  itemCount,
  materialCode,
  laborCode,
  suggestedMaterialCode,
  suggestedLaborCode,
  onMaterialCodeChange,
  onLaborCodeChange,
  onClear,
  onApplySuggestions,
  importedCostCodes = [],
}) => {
  const isMapped = materialCode && laborCode;
  const isPartial = (materialCode || laborCode) && !(materialCode && laborCode);
  const hasSuggestions = suggestedMaterialCode || suggestedLaborCode;

  // Merge imported codes with hardcoded codes
  const allMaterialCodes = useMemo(() => {
    const imported = importedCostCodes
      .filter(c => c.category === 'M')
      .map(c => ({
        code: c.code,
        description: c.description,
        category: 'M' as const,
        keywords: [],
      }));
    
    // Combine and deduplicate by code
    const combined = [...COST_CODES_DB.material, ...imported];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [importedCostCodes]);

  const allLaborCodes = useMemo(() => {
    const imported = importedCostCodes
      .filter(c => c.category === 'L')
      .map(c => ({
        code: c.code,
        description: c.description,
        category: 'L' as const,
        keywords: [],
      }));
    
    // Combine and deduplicate by code
    const combined = [...COST_CODES_DB.fieldLabor, ...imported];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [importedCostCodes]);

  const getStatusIcon = () => {
    if (isMapped) return <CheckCircle className="w-5 h-5 text-success" />;
    if (isPartial) return <AlertCircle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    if (isMapped) {
      return <Badge className="bg-success text-success-foreground">Fully Mapped</Badge>;
    } else if (isPartial) {
      return <Badge variant="secondary" className="bg-warning text-warning-foreground">Partial</Badge>;
    }
    return <Badge variant="outline">Unmapped</Badge>;
  };

  return (
    <Card className={`
      transition-all hover:shadow-lg
      ${isMapped ? 'border-success/50 bg-success/5' : ''}
      ${isPartial ? 'border-warning/50 bg-warning/5' : ''}
    `}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{system}</h3>
              <p className="text-sm text-muted-foreground">{itemCount} items</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {(materialCode || laborCode) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggestions Banner */}
        {hasSuggestions && !(materialCode && laborCode) && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">Smart suggestions available</span>
            <Button
              size="sm"
              variant="default"
              onClick={onApplySuggestions}
            >
              Apply Suggestions
            </Button>
          </div>
        )}

        {/* Material Code Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Material Code {suggestedMaterialCode && !materialCode && (
              <Badge variant="outline" className="ml-2 text-xs">
                Suggested
              </Badge>
            )}
          </label>
          <Select
            value={materialCode || suggestedMaterialCode || 'none'}
            onValueChange={onMaterialCodeChange}
          >
            <SelectTrigger className={suggestedMaterialCode && !materialCode ? 'border-primary/50' : ''}>
              <SelectValue placeholder="Select material code..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="none">
                <span className="text-muted-foreground">None</span>
              </SelectItem>
              {allMaterialCodes.map((code) => (
                <SelectItem key={code.code} value={code.code}>
                  {code.code} - {code.description}
                  {code.code === suggestedMaterialCode && !materialCode && (
                    <Badge variant="default" className="ml-2 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggested
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Labor Code Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Labor Code {suggestedLaborCode && !laborCode && (
              <Badge variant="outline" className="ml-2 text-xs">
                Suggested
              </Badge>
            )}
          </label>
          <Select
            value={laborCode || suggestedLaborCode || 'none'}
            onValueChange={onLaborCodeChange}
          >
            <SelectTrigger className={suggestedLaborCode && !laborCode ? 'border-primary/50' : ''}>
              <SelectValue placeholder="Select labor code..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="none">
                <span className="text-muted-foreground">None</span>
              </SelectItem>
              {allLaborCodes.map((code) => (
                <SelectItem key={code.code} value={code.code}>
                  {code.code} - {code.description}
                  {code.code === suggestedLaborCode && !laborCode && (
                    <Badge variant="default" className="ml-2 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggested
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
