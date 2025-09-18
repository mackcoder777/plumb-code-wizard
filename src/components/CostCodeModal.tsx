import React, { useState, useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { COST_CODES_DB } from '@/data/costCodes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Target } from 'lucide-react';

interface CostCodeModalProps {
  item: EstimateItem;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (item: EstimateItem, costCode: string) => void;
}

export const CostCodeModal: React.FC<CostCodeModalProps> = ({
  item,
  isOpen,
  onClose,
  onAssign
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const allCostCodes = useMemo(() => [
    ...COST_CODES_DB.fieldLabor.map(code => ({ ...code, type: 'Labor' as const })),
    ...COST_CODES_DB.material.map(code => ({ ...code, type: 'Material' as const }))
  ], []);

  const filteredCodes = useMemo(() => {
    if (!searchTerm) return allCostCodes;
    
    const term = searchTerm.toLowerCase();
    return allCostCodes.filter(code =>
      code.code.toLowerCase().includes(term) ||
      code.description.toLowerCase().includes(term) ||
      code.keywords.some(keyword => keyword.toLowerCase().includes(term))
    );
  }, [allCostCodes, searchTerm]);

  const handleAssign = (costCode: string) => {
    onAssign(item, costCode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Assign Cost Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Details */}
          <Card className="p-4 bg-muted/30">
            <h4 className="font-semibold mb-2">Item Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Material:</strong> {item.materialDesc}
              </div>
              <div>
                <strong>Item:</strong> {item.itemName}
              </div>
              <div>
                <strong>System:</strong> {item.system}
              </div>
              <div>
                <strong>Location:</strong> {item.floor} / {item.zone}
              </div>
              <div>
                <strong>Current Code:</strong> {item.costCode || 'Not assigned'}
              </div>
              <div>
                <strong>Size:</strong> {item.size}
              </div>
            </div>
          </Card>

          {/* Suggested Codes */}
          {item.suggestedCodes.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                AI Suggested Codes
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.suggestedCodes.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="flex-col items-start p-3 h-auto hover:bg-primary/10 border-primary/20"
                    onClick={() => handleAssign(suggestion.code)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Badge variant={suggestion.type === 'labor' ? 'default' : 'secondary'}>
                        {suggestion.code}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 text-left">
                      {suggestion.reason}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search All Codes */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search All Cost Codes
            </h4>
            <div className="space-y-3">
              <Input
                placeholder="Search by code, description, or keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
              
              <ScrollArea className="h-64 border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredCodes.map((code) => (
                    <Button
                      key={code.code}
                      variant="ghost"
                      className="w-full justify-start p-3 h-auto hover:bg-primary/10"
                      onClick={() => handleAssign(code.code)}
                    >
                      <div className="text-left w-full">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={code.type === 'Labor' ? 'default' : 'secondary'}>
                            {code.code}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {code.type}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">{code.description}</div>
                        <div className="text-xs text-muted-foreground">
                          Keywords: {code.keywords.join(', ')}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};