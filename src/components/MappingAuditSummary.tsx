import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layers,
  Tags,
  Grid3X3,
  BarChart3
} from 'lucide-react';
import { EstimateItem } from '@/types/estimate';

interface MappingAuditSummaryProps {
  estimateData: EstimateItem[];
  systemMappings?: Record<string, string>;
  categoryMappings?: Array<{ category_name: string; labor_code: string }>;
  floorMappings?: Record<string, string>;
}

export const MappingAuditSummary: React.FC<MappingAuditSummaryProps> = ({
  estimateData,
  systemMappings = {},
  categoryMappings = [],
  floorMappings = {},
}) => {
  const auditData = useMemo(() => {
    const total = estimateData.length;
    
    // Items with labor codes assigned
    const withLaborCode = estimateData.filter(item => item.costCode && item.costCode.trim());
    const laborCodedCount = withLaborCode.length;
    
    // Items with material codes assigned  
    const withMaterialCode = estimateData.filter(item => item.materialCostCode && item.materialCostCode.trim());
    const materialCodedCount = withMaterialCode.length;
    
    // Unique systems and their mapping status
    const systemsMap = new Map<string, { items: number; mapped: boolean }>();
    estimateData.forEach(item => {
      const system = item.system || 'Unknown';
      if (!systemsMap.has(system)) {
        systemsMap.set(system, { items: 0, mapped: !!systemMappings[system] });
      }
      systemsMap.get(system)!.items++;
    });
    const uniqueSystems = systemsMap.size;
    const mappedSystems = Array.from(systemsMap.values()).filter(s => s.mapped).length;
    
    // Unique categories and their mapping status
    const categoriesMap = new Map<string, { items: number; mapped: boolean }>();
    estimateData.forEach(item => {
      const category = item.reportCat || 'Unknown';
      if (!categoriesMap.has(category)) {
        const isMapped = categoryMappings.some(m => 
          m.category_name.toLowerCase() === category.toLowerCase()
        );
        categoriesMap.set(category, { items: 0, mapped: isMapped });
      }
      categoriesMap.get(category)!.items++;
    });
    const uniqueCategories = categoriesMap.size;
    const mappedCategories = Array.from(categoriesMap.values()).filter(c => c.mapped).length;
    
    // Unique floors and their mapping status
    const floorsMap = new Map<string, { items: number; mapped: boolean }>();
    estimateData.forEach(item => {
      const floor = (item.floor || '').trim();
      if (floor && !floorsMap.has(floor)) {
        floorsMap.set(floor, { items: 0, mapped: !!floorMappings[floor] });
      }
      if (floor) {
        floorsMap.get(floor)!.items++;
      }
    });
    const uniqueFloors = floorsMap.size;
    const mappedFloors = Array.from(floorsMap.values()).filter(f => f.mapped).length;
    const itemsWithFloor = Array.from(floorsMap.values()).reduce((sum, f) => sum + f.items, 0);
    
    return {
      total,
      laborCodedCount,
      laborCodedPercent: total > 0 ? Math.round((laborCodedCount / total) * 100) : 0,
      materialCodedCount,
      materialCodedPercent: total > 0 ? Math.round((materialCodedCount / total) * 100) : 0,
      uniqueSystems,
      mappedSystems,
      systemsPercent: uniqueSystems > 0 ? Math.round((mappedSystems / uniqueSystems) * 100) : 0,
      uniqueCategories,
      mappedCategories,
      categoriesPercent: uniqueCategories > 0 ? Math.round((mappedCategories / uniqueCategories) * 100) : 0,
      uniqueFloors,
      mappedFloors,
      floorsPercent: uniqueFloors > 0 ? Math.round((mappedFloors / uniqueFloors) * 100) : 0,
      itemsWithFloor,
      systemsMap,
      categoriesMap,
      floorsMap,
    };
  }, [estimateData, systemMappings, categoryMappings, floorMappings]);

  const getStatusIcon = (percent: number) => {
    if (percent === 100) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (percent > 50) return <Clock className="h-4 w-4 text-amber-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Mapping Audit Summary
        </CardTitle>
        <CardDescription>
          Overview of labor code assignments across {auditData.total.toLocaleString()} estimate items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Labor Code Coverage</span>
            <span className="text-muted-foreground">
              {auditData.laborCodedCount.toLocaleString()} / {auditData.total.toLocaleString()} items ({auditData.laborCodedPercent}%)
            </span>
          </div>
          <Progress value={auditData.laborCodedPercent} className="h-2" />
        </div>

        {/* Mapping Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* System Mappings */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">System Mappings</span>
              {getStatusIcon(auditData.systemsPercent)}
            </div>
            <div className="text-2xl font-bold">
              {auditData.mappedSystems} / {auditData.uniqueSystems}
            </div>
            <div className="text-xs text-muted-foreground">
              systems have labor codes assigned
            </div>
            <Progress value={auditData.systemsPercent} className="h-1.5" />
          </div>

          {/* Category Mappings */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-purple-500" />
              <span className="font-medium text-sm">Category Overrides</span>
              {getStatusIcon(auditData.categoriesPercent)}
            </div>
            <div className="text-2xl font-bold">
              {auditData.mappedCategories} / {auditData.uniqueCategories}
            </div>
            <div className="text-xs text-muted-foreground">
              report categories have overrides
            </div>
            <Progress value={auditData.categoriesPercent} className="h-1.5" />
          </div>

          {/* Floor Mappings */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-sm">Floor → Section</span>
              {getStatusIcon(auditData.floorsPercent)}
            </div>
            <div className="text-2xl font-bold">
              {auditData.mappedFloors} / {auditData.uniqueFloors}
            </div>
            <div className="text-xs text-muted-foreground">
              floor values have section codes ({auditData.itemsWithFloor} items)
            </div>
            <Progress value={auditData.floorsPercent} className="h-1.5" />
          </div>
        </div>

        {/* Item Status Breakdown */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Item Status Breakdown</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded">
              <Badge variant="default" className="bg-green-500 text-xs">
                {auditData.laborCodedCount}
              </Badge>
              <span className="text-muted-foreground">Have Labor Code</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded">
              <Badge variant="destructive" className="text-xs">
                {auditData.total - auditData.laborCodedCount}
              </Badge>
              <span className="text-muted-foreground">No Labor Code</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
              <Badge variant="secondary" className="bg-blue-500 text-white text-xs">
                {auditData.materialCodedCount}
              </Badge>
              <span className="text-muted-foreground">Have Material Code</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
              <Badge variant="outline" className="text-xs">
                {auditData.itemsWithFloor}
              </Badge>
              <span className="text-muted-foreground">Have Floor Value</span>
            </div>
          </div>
        </div>

        {/* Guidance */}
        {auditData.laborCodedPercent < 100 && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium mb-1">💡 To complete coding:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              {auditData.systemsPercent < 100 && (
                <li>Assign labor codes to remaining {auditData.uniqueSystems - auditData.mappedSystems} systems in System Mapping</li>
              )}
              {auditData.floorsPercent < 100 && (
                <li>Configure section codes for remaining {auditData.uniqueFloors - auditData.mappedFloors} floors</li>
              )}
              <li>Apply mappings to update all {auditData.total - auditData.laborCodedCount} uncoded items</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
