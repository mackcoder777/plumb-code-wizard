import React from 'react';
import { EstimateItem } from '@/types/estimate';
import { AUTOMATION_RULES } from '@/data/costCodes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Settings, TestTube, Rocket } from 'lucide-react';
import { useCostCodes } from '@/hooks/useCostCodes';
import { getCodeDescription, getCodeDescriptionShort } from '@/utils/codeDescriptions';

interface AutomationTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
}

export const AutomationTab: React.FC<AutomationTabProps> = ({ data, onDataUpdate }) => {
  const matchedItems = data.filter(item => item.suggestedCodes.length > 0).length;
  const accuracy = data.length > 0 ? Math.round((matchedItems / data.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-primary">{AUTOMATION_RULES.length}</h3>
          <p className="text-muted-foreground">Active Rules</p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-info">{matchedItems}</h3>
          <p className="text-muted-foreground">Pattern Matches</p>
        </Card>
        <Card className="p-6 text-center">
          <h3 className="text-2xl font-bold text-success">{accuracy}%</h3>
          <p className="text-muted-foreground">Accuracy Rate</p>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button><Settings className="w-4 h-4 mr-2" />Configure Rules</Button>
        <Button variant="secondary"><TestTube className="w-4 h-4 mr-2" />Test Automation</Button>
        <Button variant="outline"><Rocket className="w-4 h-4 mr-2" />Apply to All</Button>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Automation Rules</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Pattern</th>
                  <th className="text-left p-3">Field</th>
                  <th className="text-left p-3">Assigns Code</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Items Matched</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {AUTOMATION_RULES.map((rule, index) => {
                  const matchCount = data.filter(item => {
                    const fieldValue = (item as any)[rule.field] || '';
                    return rule.pattern.test(fieldValue);
                  }).length;

                  return (
                    <tr key={index} className="border-b">
                      <td className="p-3 font-mono text-sm">{rule.pattern.source}</td>
                      <td className="p-3">{rule.field}</td>
                      <td className="p-3">
                        {rule.codes.material && <Badge variant="secondary" className="mr-1">{rule.codes.material}</Badge>}
                        {rule.codes.labor && <Badge variant="default">{rule.codes.labor}</Badge>}
                      </td>
                      <td className="p-3">{rule.description}</td>
                      <td className="p-3">{matchCount}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-success">Active</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};