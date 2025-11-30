import React, { useState, useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Bot, 
  Download, 
  FileText, 
  RotateCcw, 
  Search,
  ArrowUpDown,
  Edit,
  Plus
} from 'lucide-react';
import { CostCodeModal } from '../CostCodeModal';
import { ColumnConfigPanel } from '../ColumnConfigPanel';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import { toast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';

interface EstimatesTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
}

export const EstimatesTab: React.FC<EstimatesTabProps> = ({
  data,
  onDataUpdate
}) => {
  const [filters, setFilters] = useState({
    system: '',
    floor: '',
    zone: '',
    itemType: '',
    costCode: '',
    search: ''
  });
  const [sortField, setSortField] = useState<string>('');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedItem, setSelectedItem] = useState<EstimateItem | null>(null);
  const [showCostCodeModal, setShowCostCodeModal] = useState(false);
  
  // Column configuration
  const { columns, visibleColumns, toggleColumn, resetToDefaults } = useColumnConfig();

  // Filter options
  const filterOptions = useMemo(() => ({
    systems: [...new Set(data.map(item => item.system))].filter(item => item && item.trim()).sort(),
    floors: [...new Set(data.map(item => item.floor))].filter(item => item && item.trim()).sort(),
    zones: [...new Set(data.map(item => item.zone))].filter(item => item && item.trim()).sort(),
    itemTypes: [...new Set(data.map(item => item.itemType))].filter(item => item && item.trim()).sort(),
  }), [data]);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      const matchesSystem = !filters.system || item.system === filters.system;
      const matchesFloor = !filters.floor || item.floor === filters.floor;
      const matchesZone = !filters.zone || item.zone === filters.zone;
      const matchesItemType = !filters.itemType || item.itemType === filters.itemType;
      const matchesCostCode = !filters.costCode || 
        (filters.costCode === 'unassigned' ? !item.costCode : item.costCode === filters.costCode);
      const matchesSearch = !filters.search || 
        item.materialDesc.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.itemName.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.drawing.toLowerCase().includes(filters.search.toLowerCase());
      
      return matchesSystem && matchesFloor && matchesZone && 
             matchesItemType && matchesCostCode && matchesSearch;
    });

    if (sortField) {
      result.sort((a, b) => {
        let aVal = (a as any)[sortField];
        let bVal = (b as any)[sortField];
        
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        const comparison = aVal > bVal ? 1 : -1;
        return sortAsc ? comparison : -comparison;
      });
    }

    return result;
  }, [data, filters, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const clearFilters = () => {
    setFilters({
      system: '',
      floor: '',
      zone: '',
      itemType: '',
      costCode: '',
      search: ''
    });
  };

  const applyAutoCostCodes = () => {
    let assigned = 0;
    const updatedData = data.map(item => {
      if (!item.costCode && item.suggestedCodes.length > 0) {
        const bestSuggestion = item.suggestedCodes[0];
        if (bestSuggestion.confidence >= 0.8) {
          assigned++;
          return { ...item, costCode: bestSuggestion.code };
        }
      }
      return item;
    });
    
    onDataUpdate(updatedData);
    toast({
      title: "Auto-Assignment Complete",
      description: `Assigned ${assigned} cost codes with high confidence`,
    });
  };

  const exportWithCostCodes = () => {
    const exportData = filteredData.map(item => ({
      'Drawing': item.drawing,
      'System': item.system,
      'Floor': item.floor,
      'Zone': item.zone,
      'Symbol': item.symbol,
      'Estimator': item.estimator,
      'Material Spec': item.materialSpec,
      'Item Type': item.itemType,
      'Report Cat': item.reportCat,
      'Trade': item.trade,
      'Material Description': item.materialDesc,
      'Item Name': item.itemName,
      'Size': item.size,
      'Quantity': item.quantity,
      'List Price': item.listPrice,
      'Material $': item.materialDollars,
      'Weight': item.weight,
      'Labor Hours': item.hours,
      'Labor $': item.laborDollars,
      'Cost Code': item.costCode || '',
      'Suggested Code': item.suggestedCodes[0]?.code || '',
      'Confidence': item.suggestedCodes[0] ? Math.round(item.suggestedCodes[0].confidence * 100) + '%' : ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimate with Cost Codes');
    
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `estimate_cost_codes_${date}.xlsx`);
    
    toast({
      title: "Export Complete",
      description: "File downloaded successfully",
    });
  };

  const handleCostCodeAssign = (item: EstimateItem, costCode: string) => {
    const updatedData = data.map(dataItem => 
      dataItem.id === item.id 
        ? { ...dataItem, costCode }
        : dataItem
    );
    onDataUpdate(updatedData);
    setShowCostCodeModal(false);
    toast({
      title: "Cost Code Assigned",
      description: `Assigned ${costCode} to ${item.itemName}`,
    });
  };

  const openCostCodeModal = (item: EstimateItem) => {
    setSelectedItem(item);
    setShowCostCodeModal(true);
  };

  // Helper to render cell content based on column key
  const renderCellContent = (item: EstimateItem, key: string) => {
    switch (key) {
      case 'system':
        return <Badge variant="secondary">{item.system}</Badge>;
      case 'materialDesc':
        return (
          <div className="truncate max-w-xs" title={item.materialDesc}>
            {item.materialDesc}
          </div>
        );
      case 'quantity':
      case 'hours':
        return <span className="font-mono">{(item[key] as number).toFixed(2)}</span>;
      case 'materialDollars':
      case 'laborDollars':
      case 'listPrice':
        return <span className="font-mono">${(item[key] as number).toFixed(2)}</span>;
      case 'weight':
        return <span className="font-mono">{(item[key] as number).toFixed(2)}</span>;
      case 'costCode':
        if (item.costCode) {
          return (
            <Badge variant="default" className="bg-success text-success-foreground">
              {item.costCode}
            </Badge>
          );
        } else if (item.suggestedCodes.length > 0) {
          return (
            <Button
              variant="outline" 
              size="sm"
              className="text-xs"
              onClick={() => openCostCodeModal(item)}
            >
              {item.suggestedCodes[0].code}
              <span className="ml-1 text-muted-foreground">
                ({Math.round(item.suggestedCodes[0].confidence * 100)}%)
              </span>
            </Button>
          );
        } else {
          return <span className="text-warning">None</span>;
        }
      default:
        return (item as any)[key] || '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5" />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Select value={filters.system} onValueChange={(value) => setFilters(prev => ({ ...prev, system: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Systems" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Systems</SelectItem>
              {filterOptions.systems.map((system, index) => (
                <SelectItem key={`system-${index}-${system}`} value={system}>{system}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.floor} onValueChange={(value) => setFilters(prev => ({ ...prev, floor: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Floors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Floors</SelectItem>
              {filterOptions.floors.map((floor, index) => (
                <SelectItem key={`floor-${index}-${floor}`} value={floor}>{floor}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.zone} onValueChange={(value) => setFilters(prev => ({ ...prev, zone: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Zones</SelectItem>
              {filterOptions.zones.map((zone, index) => (
                <SelectItem key={`zone-${index}-${zone}`} value={zone}>{zone}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.itemType} onValueChange={(value) => setFilters(prev => ({ ...prev, itemType: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {filterOptions.itemTypes.map((type, index) => (
                <SelectItem key={`type-${index}-${type}`} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.costCode} onValueChange={(value) => setFilters(prev => ({ ...prev, costCode: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Cost Codes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Cost Codes</SelectItem>
              <SelectItem value="unassigned">⚠️ Unassigned Only</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search items..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <Button onClick={applyAutoCostCodes} className="shadow-primary">
            <Bot className="w-4 h-4 mr-2" />
            Auto-Assign Cost Codes
          </Button>
          <Button variant="secondary" onClick={exportWithCostCodes}>
            <Download className="w-4 h-4 mr-2" />
            Export with Cost Codes
          </Button>
          <Button variant="outline" onClick={clearFilters}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </div>
        <ColumnConfigPanel
          columns={columns}
          onToggleColumn={toggleColumn}
          onReset={resetToDefaults}
        />
      </div>

      {/* Data Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {visibleColumns.map(col => (
                  <th 
                    key={col.key}
                    className="text-left p-4 font-semibold cursor-pointer hover:bg-muted/70 transition-colors whitespace-nowrap"
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {col.sortable && <ArrowUpDown className="w-3 h-3" />}
                    </div>
                  </th>
                ))}
                <th className="text-left p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                  {visibleColumns.map(col => (
                    <td key={col.key} className="p-4">
                      {renderCellContent(item, col.key)}
                    </td>
                  ))}
                  <td className="p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCostCodeModal(item)}
                    >
                      {item.costCode ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {data.length} items
      </div>

      {selectedItem && (
        <CostCodeModal
          item={selectedItem}
          isOpen={showCostCodeModal}
          onClose={() => setShowCostCodeModal(false)}
          onAssign={handleCostCodeAssign}
        />
      )}
    </div>
  );
};
