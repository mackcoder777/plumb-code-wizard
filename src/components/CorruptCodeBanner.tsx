import React, { useMemo } from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SystemMapping {
  id: string;
  system_name: string;
  cost_head: string;
  project_id: string;
}

interface CorruptCodeBannerProps {
  systemMappings: SystemMapping[];
  projectId: string | null;
}

function detectCorruption(mapping: SystemMapping): { corrupt: boolean; cleaned: string; issues: string[] } {
  const raw = mapping.cost_head || '';
  const issues: string[] = [];

  if (raw.includes('|')) {
    issues.push('pipe character');
  }
  if (raw !== raw.trim()) {
    issues.push('whitespace');
  }
  if (/[^A-Za-z0-9]/.test(raw.replace(/\|/g, '').trim())) {
    issues.push('special characters');
  }

  // Clean: take the part after the last pipe, trim whitespace, strip non-alphanumeric
  let cleaned = raw;
  if (raw.includes('|')) {
    const parts = raw.split('|');
    cleaned = parts[parts.length - 1] || parts[parts.length - 2] || '';
  }
  cleaned = cleaned.trim().replace(/[^A-Za-z0-9]/g, '');

  return { corrupt: issues.length > 0, cleaned, issues };
}

export const CorruptCodeBanner: React.FC<CorruptCodeBannerProps> = ({ systemMappings, projectId }) => {
  const queryClient = useQueryClient();

  const corruptMappings = useMemo(() => {
    return systemMappings
      .map(m => ({ ...m, ...detectCorruption(m) }))
      .filter(m => m.corrupt);
  }, [systemMappings]);

  if (corruptMappings.length === 0) return null;

  const handleFixAll = async () => {
    try {
      for (const m of corruptMappings) {
        await supabase
          .from('system_mappings')
          .update({ cost_head: m.cleaned })
          .eq('id', m.id);
      }
      queryClient.invalidateQueries({ queryKey: ['system-mappings'] });
      toast({
        title: 'Corrupt Codes Fixed',
        description: `Cleaned ${corruptMappings.length} system mapping(s). Please re-apply codes.`,
      });
    } catch {
      toast({
        title: 'Fix Failed',
        description: 'Could not update corrupt mappings. Try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          ⚠️ {corruptMappings.length} corrupt cost head{corruptMappings.length > 1 ? 's' : ''} detected
        </p>
        <p className="text-xs mt-1 text-destructive/80">
          These system mappings contain pipe characters or invalid data that will cause hours to be lost in export:
        </p>
        <ul className="text-xs mt-1 space-y-0.5">
          {corruptMappings.slice(0, 5).map(m => (
            <li key={m.id} className="font-mono">
              {m.system_name}: <span className="line-through">{m.cost_head}</span> → <span className="font-bold">{m.cleaned}</span>
              <span className="text-destructive/60 ml-1">({m.issues.join(', ')})</span>
            </li>
          ))}
          {corruptMappings.length > 5 && (
            <li className="text-destructive/60">…and {corruptMappings.length - 5} more</li>
          )}
        </ul>
      </div>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleFixAll}
        className="flex-shrink-0 gap-1"
      >
        <Wrench className="h-3.5 w-3.5" />
        Fix All
      </Button>
    </div>
  );
};

export default CorruptCodeBanner;
