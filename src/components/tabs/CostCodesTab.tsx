import React from 'react';
import { EstimateItem } from '@/types/estimate';
import { Card } from '@/components/ui/card';

interface CostCodesTabProps {
  data: EstimateItem[];
}

export const CostCodesTab: React.FC<CostCodesTabProps> = ({ data }) => {
  const systemSummary = React.useMemo(() => {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-primary">561</h3>
          <p className="text-muted-foreground">Field Labor Codes</p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-primary">258</h3>
          <p className="text-muted-foreground">Material Codes</p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-success">{data.filter(item => item.costCode).length}</h3>
          <p className="text-muted-foreground">Items Coded</p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-info">
            {data.length > 0 ? Math.round((data.filter(item => item.costCode).length / data.length) * 100) : 0}%
          </h3>
          <p className="text-muted-foreground">Completion</p>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Cost Code Summary by System</h3>
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
        </div>
      </Card>
    </div>
  );
};