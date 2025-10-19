import React, { useState, useMemo } from 'react';
import { EstimateItem, SystemMapping } from '@/types/estimate';
import { COST_CODES_DB } from '@/data/costCodes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Search, Check, X, AlertCircle } from 'lucide-react';

interface SystemMappingTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
}

export const SystemMappingTab: React.FC<SystemMappingTabProps> = ({ data, onDataUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mappings, setMappings] = useState<Record<string, { materialCode?: string; laborCode?: string }>>({});

  // Extract unique systems and count items
  const systemMappings = useMemo(() => {
    const systemMap = new Map<string, number>();
    
    data.forEach(item => {
      if (item.system) {
        systemMap.set(item.system, (systemMap.get(item.system) || 0) + 1);
      }
    });

    return Array.from(systemMap.entries())
      .map(([system, count]) => ({
        system,
        itemCount: count,
        materialCode: mappings[system]?.materialCode,
        laborCode: mappings[system]?.laborCode,
      }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [data, mappings]);

  // Filter systems by search term
  const filteredSystems = useMemo(() => {
    if (!searchTerm) return systemMappings;
    return systemMappings.filter(sm => 
      sm.system.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [systemMappings, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = systemMappings.length;
    const mapped = systemMappings.filter(sm => sm.materialCode && sm.laborCode).length;
    const partial = systemMappings.filter(sm => 
      (sm.materialCode || sm.laborCode) && !(sm.materialCode && sm.laborCode)
    ).length;
    const unmapped = total - mapped - partial;

    return { total, mapped, partial, unmapped };
  }, [systemMappings]);

  const handleMappingChange = (system: string, type: 'materialCode' | 'laborCode', value: string) => {
    setMappings(prev => ({
      ...prev,
      [system]: {
        ...prev[system],
        [type]: value === 'clear' ? undefined : value,
      }
    }));
  };

  const clearMapping = (system: string) => {
    setMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[system];
      return newMappings;
    });
    toast({
      title: "Mapping Cleared",
      description: `Removed mapping for ${system}`,
    });
  };

  const clearAllMappings = () => {
    setMappings({});
    toast({
      title: "All Mappings Cleared",
      description: "All system mappings have been removed",
    });
  };

  const applyMappings = () => {
    let appliedCount = 0;
    let itemsAffected = 0;

    const updatedData = data.map(item => {
      const mapping = mappings[item.system];
      if (mapping && (mapping.materialCode || mapping.laborCode)) {
        appliedCount++;
        itemsAffected++;
        // Prefer labor code, fallback to material code
        return {
          ...item,
          costCode: mapping.laborCode || mapping.materialCode || item.costCode,
        };
      }
      return item;
    });

    onDataUpdate(updatedData);
    
    toast({
      title: "Mappings Applied Successfully",
      description: `Applied ${Object.keys(mappings).length} system mappings to ${itemsAffected} items`,
    });
  };

  const getStatusBadge = (sm: SystemMapping) => {
    if (sm.materialCode && sm.laborCode) {
      return <Badge className="bg-success text-success-foreground"><Check className="w-3 h-3 mr-1" /> Mapped</Badge>;
    } else if (sm.materialCode || sm.laborCode) {
      return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Partial</Badge>;
    } else {
      return <Badge variant="outline">Unmapped</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Systems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fully Mapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{stats.mapped}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Partially Mapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{stats.partial}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unmapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">{stats.unmapped}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>System to Cost Code Mapping</CardTitle>
          <CardDescription>
            Map each system to material and labor cost codes. These mappings will be applied to all items in that system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search systems..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={applyMappings} disabled={Object.keys(mappings).length === 0}>
                Apply All Mappings
              </Button>
              <Button variant="outline" onClick={clearAllMappings} disabled={Object.keys(mappings).length === 0}>
                Clear All
              </Button>
            </div>
          </div>

          {/* Systems Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">System</th>
                    <th className="text-left p-3 font-medium">Material Code</th>
                    <th className="text-left p-3 font-medium">Labor Code</th>
                    <th className="text-right p-3 font-medium">Items</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSystems.map((sm) => (
                    <tr key={sm.system} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{sm.system}</td>
                      
                      {/* Material Code Select */}
                      <td className="p-3">
                        <Select
                          value={sm.materialCode || 'none'}
                          onValueChange={(value) => handleMappingChange(sm.system, 'materialCode', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select material code..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="none">
                              <span className="text-muted-foreground">None</span>
                            </SelectItem>
                            {COST_CODES_DB.material.map((code) => (
                              <SelectItem key={code.code} value={code.code}>
                                {code.code} - {code.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      
                      {/* Labor Code Select */}
                      <td className="p-3">
                        <Select
                          value={sm.laborCode || 'none'}
                          onValueChange={(value) => handleMappingChange(sm.system, 'laborCode', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select labor code..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="none">
                              <span className="text-muted-foreground">None</span>
                            </SelectItem>
                            {COST_CODES_DB.fieldLabor.map((code) => (
                              <SelectItem key={code.code} value={code.code}>
                                {code.code} - {code.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      
                      <td className="p-3 text-right tabular-nums font-medium">{sm.itemCount}</td>
                      
                      <td className="p-3 text-center">{getStatusBadge(sm)}</td>
                      
                      <td className="p-3 text-center">
                        {(sm.materialCode || sm.laborCode) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearMapping(sm.system)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredSystems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No systems found matching "{searchTerm}"
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};