import React, { useState } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { 
  exportBudgetPacket, 
  exportAuditReport, 
  ExportEstimateItem, 
  ProjectInfo 
} from '@/utils/budgetExportSystem';
import { toast } from '@/components/ui/use-toast';
import { BudgetAdjustments } from './BudgetAdjustmentsPanel';

interface ExportDropdownProps {
  items: ExportEstimateItem[];
  projectInfo: ProjectInfo;
  laborRate?: number;
  disabled?: boolean;
  budgetAdjustments?: BudgetAdjustments | null;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ 
  items, 
  projectInfo, 
  laborRate = 0,
  disabled = false,
  budgetAdjustments = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleExportBudgetPacket = () => {
    try {
      const result = exportBudgetPacket(items, projectInfo, laborRate, budgetAdjustments);
      toast({
        title: "Budget Packet Exported",
        description: `Exported ${result.laborCodes} labor codes and ${result.materialCodes} material codes. Grand Total: $${result.grandTotal.toLocaleString()}`,
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
      const result = exportAuditReport(items, projectInfo);
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
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Export Options</p>
            </div>

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
                    Aggregated by cost code for accounting submission
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
                {items.length} total items • {projectInfo.jobNumber}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportDropdown;
