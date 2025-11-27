import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EstimateItem } from "@/types/estimate";
import { CostCodeLibraryManager } from "@/components/CostCodeLibraryManager";
import { CostCodeImport } from "@/components/CostCodeImport";
import { Library, Upload } from "lucide-react";

interface CostCodesTabProps {
  data: EstimateItem[];
  onImportCostCodes?: (codes: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>) => void;
}

export const CostCodesTab: React.FC<CostCodesTabProps> = ({ data, onImportCostCodes }) => {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const systemSummary = useMemo(() => {
    const systems = data.reduce((acc, item) => {
      const system = item.system || 'Unspecified';
      if (!acc[system]) {
        acc[system] = { total: 0, coded: 0, material: 0, hours: 0 };
      }
      acc[system].total++;
      if (item.costCode) acc[system].coded++;
      acc[system].material += item.materialDollars;
      acc[system].hours += item.hours;
      return acc;
    }, {} as Record<string, any>);
    
    return Object.entries(systems);
  }, [data]);

  const stats = useMemo(() => {
    const laborCodes = 561; // From analysis
    const materialCodes = 258; // From analysis
    const totalCoded = data.filter(item => item.costCode).length;
    const completionPercentage = data.length > 0 ? Math.round((totalCoded / data.length) * 100) : 0;
    
    return { laborCodes, materialCodes, totalCoded, completionPercentage };
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Library Access */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cost Code Analysis</h2>
          <p className="text-muted-foreground">Summary of cost code assignments and coverage</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showImport} onOpenChange={setShowImport}>
            <DialogTrigger asChild>
              <Button variant="default" className="gap-2">
                <Upload className="h-4 w-4" />
                Import Codes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Import Cost Code Library</DialogTitle>
              </DialogHeader>
              <CostCodeImport 
                onImport={(codes) => {
                  if (onImportCostCodes) {
                    onImportCostCodes(codes);
                  }
                }}
                onClose={() => setShowImport(false)}
              />
            </DialogContent>
          </Dialog>
          
          <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Library className="h-4 w-4" />
                Browse Library
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cost Code Library Manager</DialogTitle>
              </DialogHeader>
              <CostCodeLibraryManager showSelector={false} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Field Labor Codes</p>
                <p className="text-2xl font-bold">{stats.laborCodes}</p>
              </div>
              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-semibold text-sm">L</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Material Codes</p>
                <p className="text-2xl font-bold">{stats.materialCodes}</p>
              </div>
              <div className="h-8 w-8 bg-success/10 rounded-full flex items-center justify-center">
                <span className="text-success font-semibold text-sm">M</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items Coded</p>
                <p className="text-2xl font-bold">{stats.totalCoded}</p>
                <p className="text-xs text-muted-foreground">of {data.length} items</p>
              </div>
              <div className="h-8 w-8 bg-info/10 rounded-full flex items-center justify-center">
                <span className="text-info font-semibold text-sm">C</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completion</p>
                <p className="text-2xl font-bold">{stats.completionPercentage}%</p>
                <Progress value={stats.completionPercentage} className="mt-2 h-2" />
              </div>
              <div className="h-8 w-8 bg-warning/10 rounded-full flex items-center justify-center">
                <span className="text-warning font-semibold text-sm">%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Code Summary by System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">System</th>
                  <th className="text-left p-3">Total Items</th>
                  <th className="text-left p-3">Items Coded</th>
                  <th className="text-left p-3">% Complete</th>
                  <th className="text-left p-3">Material $</th>
                  <th className="text-left p-3">Labor Hours</th>
                </tr>
              </thead>
              <tbody>
                {systemSummary.map(([system, stats]) => (
                  <tr key={system} className="border-b">
                    <td className="p-3 font-medium">{system}</td>
                    <td className="p-3">{stats.total}</td>
                    <td className="p-3">{stats.coded}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full">
                          <div 
                            className="h-full bg-success rounded-full" 
                            style={{ width: `${(stats.coded / stats.total) * 100}%` }}
                          />
                        </div>
                        {Math.round((stats.coded / stats.total) * 100)}%
                      </div>
                    </td>
                    <td className="p-3 font-mono">${stats.material.toFixed(2)}</td>
                    <td className="p-3 font-mono">{stats.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};