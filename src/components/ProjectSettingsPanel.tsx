import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectSettingsPanelProps {
  projectId: string | null;
  codeFormatMode: 'standard' | 'multitrade';
  tradePrefix: string;
  onSettingsChange: (mode: 'standard' | 'multitrade', prefix: string) => void;
}

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
  projectId,
  codeFormatMode,
  tradePrefix,
  onSettingsChange,
}) => {
  const [localMode, setLocalMode] = useState(codeFormatMode);
  const [localPrefix, setLocalPrefix] = useState(tradePrefix);

  useEffect(() => {
    setLocalMode(codeFormatMode);
    setLocalPrefix(tradePrefix);
  }, [codeFormatMode, tradePrefix]);

  const handleModeChange = async (isMultitrade: boolean) => {
    const newMode = isMultitrade ? 'multitrade' : 'standard';
    setLocalMode(newMode);
    onSettingsChange(newMode, localPrefix);

    if (projectId) {
      const { error } = await (supabase as any)
        .from('estimate_projects')
        .update({ code_format_mode: newMode })
        .eq('id', projectId);
      if (error) {
        toast({ title: 'Failed to save mode', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handlePrefixChange = async (prefix: string) => {
    const cleaned = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setLocalPrefix(cleaned);
    onSettingsChange(localMode, cleaned);

    if (projectId) {
      const { error } = await (supabase as any)
        .from('estimate_projects')
        .update({ trade_prefix: cleaned })
        .eq('id', projectId);
      if (error) {
        toast({ title: 'Failed to save prefix', description: error.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Code Format Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {localMode === 'standard' ? 'Standard' : 'Multitrade'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {localMode === 'standard'
                ? 'SEC = Building, ACT = Floor/Level'
                : 'SEC = Trade, ACT = Building'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Standard</span>
            <Switch
              checked={localMode === 'multitrade'}
              onCheckedChange={handleModeChange}
            />
            <span className="text-xs text-muted-foreground">Multitrade</span>
          </div>
        </div>

        {localMode === 'multitrade' && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Trade Prefix</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-48">
                      This becomes the SEC segment of every cost code.
                      Common: PL (Plumbing), SM (Sheet Metal), MP (Mech Piping)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={localPrefix}
                onChange={(e) => handlePrefixChange(e.target.value)}
                className="w-20 font-mono text-center uppercase"
                maxLength={4}
                placeholder="PL"
              />
              <div className="flex gap-1">
                {['PL', 'SM', 'MP'].map(p => (
                  <Badge
                    key={p}
                    variant={localPrefix === p ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => handlePrefixChange(p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Example code: <span className="font-mono">{localPrefix || 'PL'} BA00 WATR</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
