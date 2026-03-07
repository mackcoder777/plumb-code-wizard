import React, { useState, useMemo } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Check, X, Settings2, AlertTriangle } from 'lucide-react';
import { 
  exportBudgetPacket, 
  exportAuditReport, 
  ExportEstimateItem, 
  ProjectInfo,
  FloorSectionMap,
  CategoryLaborMap
} from '@/utils/budgetExportSystem';
import { BuildingSectionMapping } from '@/hooks/useBuildingSectionMappings';
import { FloorSectionMapping } from '@/hooks/useFloorSectionMappings';
import { toast } from '@/components/ui/use-toast';
import { BudgetAdjustments } from './BudgetAdjustmentsPanel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ExportDropdownProps {
  items: ExportEstimateItem[];
  projectInfo: ProjectInfo;
  laborRate?: number;
  disabled?: boolean;
  budgetAdjustments?: BudgetAdjustments | null;
  floorMappings?: FloorSectionMap;
  categoryMappings?: CategoryLaborMap;
  buildingMappings?: BuildingSectionMapping[];
  dbFloorMappings?: FloorSectionMapping[];
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ 
  items, 
  projectInfo, 
  laborRate = 0,
  disabled = false,
  budgetAdjustments = null,
  floorMappings = {},
  categoryMappings = {},
  buildingMappings = [],
  dbFloorMappings = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [includeAdjustments, setIncludeAdjustments] = useState(true);

  // Calculate uncoded items stats
  const uncodedStats = useMemo(() => {
    let uncodedItems = 0;
    let uncodedHours = 0;
    items.forEach(item => {
      const costHead = item.laborCostHead || item.costCode || '';
      const hours = parseFloat(String(item.hours)) || 0;
      if (!costHead && hours > 0) {
        uncodedItems++;
        uncodedHours += hours;
      }
    });
    return { uncodedItems, uncodedHours };
  }, [items]);

  // Check if there are any adjustments available
  const hasAdjustments = budgetAdjustments && (
    budgetAdjustments.totalMaterialTax > 0 ||
    budgetAdjustments.foremanBonusHours > 0 ||
    (budgetAdjustments.fabricationSummary && budgetAdjustments.fabricationSummary.length > 0)
  );

  const foremanBonusDollars = (budgetAdjustments?.foremanBonusHours || 0) * laborRate;
  const fabTotalHours = budgetAdjustments?.fabricationSummary?.reduce((sum, strip) => sum + strip.strippedHours, 0) || 0;
  const fabTotalDollars = fabTotalHours * laborRate;

  const handleExportBudgetPacket = () => {
    try {
      const adjustmentsToUse = includeAdjustments && hasAdjustments ? budgetAdjustments : null;
      const result = exportBudgetPacket(items, projectInfo, laborRate, adjustmentsToUse, floorMappings, categoryMappings, buildingMappings, dbFloorMappings);
      toast({
        title: "Budget Packet Exported",
        description: includeAdjustments && hasAdjustments
          ? `Exported with adjustments. Grand Total: $${result.grandTotal.toLocaleString()}`
          : `Exported ${result.laborCodes} labor codes and ${result.materialCodes} material codes. Grand Total: $${result.grandTotal.toLocaleString()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Budget Packet. Please try again.",
        variant: "destructive"
      });
    }
    setIsOpen(false);
  };

  const handleExportAuditReport = () => {
    try {
      const result = exportAuditReport(items, projectInfo, floorMappings, buildingMappings, dbFloorMappings);
      toast({
        title: "Audit Report Exported",
        description: `Exported ${result.laborItems} labor items and ${result.materialItems} material items across 3 tabs.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Audit Report. Please try again.",
        variant: "destructive"
      });
    }
    setIsOpen(false);
  };

  // Count items with codes assigned
  const laborCodedCount = items.filter(i => i.laborCostHead || i.costCode || i.suggestedCode?.costHead).length;
  const materialCodedCount = items.filter(i => i.materialCode || i.materialCostCode).length;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
          ${disabled 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
          }
        `}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Export Options</p>
            </div>

            {/* Adjustments Toggle Section */}
            {hasAdjustments && (
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="include-adjustments" className="text-sm font-medium text-blue-900">
                      Include Budget Adjustments
                    </Label>
                  </div>
                  <Switch
                    id="include-adjustments"
                    checked={includeAdjustments}
                    onCheckedChange={setIncludeAdjustments}
                  />
                </div>
                
                {/* Adjustment Summary */}
                <div className="space-y-1 text-xs">
                  {budgetAdjustments?.totalMaterialTax > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      {includeAdjustments ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <X className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={includeAdjustments ? '' : 'line-through opacity-50'}>
                        Sales Tax ({budgetAdjustments.taxRate}%): ${budgetAdjustments.totalMaterialTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  
                  {budgetAdjustments?.foremanBonusHours > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      {includeAdjustments ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <X className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={includeAdjustments ? '' : 'line-through opacity-50'}>
                        Foreman Bonus: {budgetAdjustments.foremanBonusHours.toFixed(1)} hrs (${foremanBonusDollars.toLocaleString()})
                      </span>
                    </div>
                  )}
                  
                  {budgetAdjustments?.fabricationSummary && budgetAdjustments.fabricationSummary.length > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      {includeAdjustments ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <X className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={includeAdjustments ? '' : 'line-through opacity-50'}>
                        Fab Strips ({budgetAdjustments.fabricationSummary.length}): {fabTotalHours.toFixed(1)} hrs (${fabTotalDollars.toLocaleString()})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No Adjustments Indicator */}
            {!hasAdjustments && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <Settings2 className="h-3 w-3" />
                  No adjustments configured in Budget Builder
                </div>
              </div>
            )}

            {/* Uncoded Items Warning */}
            {uncodedStats.uncodedItems > 0 && (
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {uncodedStats.uncodedItems} items ({uncodedStats.uncodedHours.toFixed(1)} hrs) have no labor code — will export as UNCD
                  </span>
                </div>
              </div>
            )}

            <div className="p-2">
              {/* Budget Packet Option */}
              <button
                onClick={handleExportBudgetPacket}
                className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-green-50 rounded-lg transition-colors group"
              >
                <div className="mt-0.5 p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Budget Packet</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {includeAdjustments && hasAdjustments 
                      ? 'Aggregated with tax, foreman bonus & fab strips'
                      : 'Aggregated by cost code for accounting submission'
                    }
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {laborCodedCount} labor items
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      {materialCodedCount} material items
                    </span>
                  </div>
                </div>
              </button>

              {/* Divider */}
              <div className="my-1 border-t border-gray-100" />

              {/* Audit Report Option */}
              <button
                onClick={handleExportAuditReport}
                className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-blue-50 rounded-lg transition-colors group"
              >
                <div className="mt-0.5 p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Audit Report</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Detailed line items for internal backup & review
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Includes Labor Report + Material Report + Summary tabs
                  </div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {items.length} total items • {projectInfo.jobNumber} • Rate: ${laborRate}/hr
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportDropdown;
