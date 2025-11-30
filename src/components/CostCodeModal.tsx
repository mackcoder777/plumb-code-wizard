import React, { useState, useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { COST_CODES_DB } from '@/data/costCodes';
import { CostCodeLibraryManager, CostCode } from '@/components/CostCodeLibraryManager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface CostCodeModalProps {
  item: EstimateItem;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (item: EstimateItem, costCode: string, type?: 'labor' | 'material') => void;
}

export const CostCodeModal: React.FC<CostCodeModalProps> = ({
  item,
  isOpen,
  onClose,
  onAssign
}) => {
  const handleCodeSelect = (code: CostCode, type: 'labor' | 'material' = 'labor') => {
    onAssign(item, code.costHead, type);
    onClose();
  };

  const handleAssign = (costCode: string, type: 'labor' | 'material' = 'labor') => {
    onAssign(item, costCode, type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Assign Cost Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Details */}
          <Card className="p-4 gradient-card border-primary/20">
            <h4 className="font-semibold mb-2">Item Details</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
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
                <strong>Labor Code:</strong> 
                <Badge variant="outline" className="ml-2">
                  {item.costCode || 'Not assigned'}
                </Badge>
              </div>
              <div>
                <strong>Material Code:</strong> 
                <Badge variant="outline" className="ml-2">
                  {item.materialCostCode || 'Not assigned'}
                </Badge>
              </div>
              <div>
                <strong>Size:</strong> {item.size}
              </div>
            </div>
          </Card>

          {/* Suggested Codes */}
          {item.suggestedCodes && item.suggestedCodes.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                AI Suggested Codes
              </h4>
              <div className="flex flex-wrap gap-2 mb-4">
                  {item.suggestedCodes.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="flex-col items-start p-3 h-auto hover:bg-primary/10 border-primary/20"
                      onClick={() => handleAssign(suggestion.code, suggestion.type)}
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

          {/* Enhanced Cost Code Library Manager */}
          <div>
            <h4 className="font-semibold mb-3">Search Complete Cost Code Library</h4>
            <CostCodeLibraryManager 
              showSelector={true}
              onCodeSelect={handleCodeSelect}
            />
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