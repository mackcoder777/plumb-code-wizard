import React, { useMemo, useState } from 'react';
import { EstimateItem } from '@/types/estimate';
import { CategoryKeywordRule } from '@/hooks/useCategoryKeywordRules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Layers, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { CostCode } from '@/hooks/useCostCodes';
import { UseMutationResult } from '@tanstack/react-query';

interface KeywordRulesSectionProps {
  category: string;
  data: EstimateItem[];
  laborCodes: CostCode[];
  keywordRules: CategoryKeywordRule[];
  saveRule: UseMutationResult<void, Error, { category_name: string; keyword: string; labor_code: string; priority: number }>;
  deleteRule: UseMutationResult<void, Error, string>;
}

export const KeywordRulesSection: React.FC<KeywordRulesSectionProps> = ({
  category,
  data,
  laborCodes,
  keywordRules,
  saveRule,
  deleteRule,
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [newCode, setNewCode] = useState('');
  const [previewKeyword, setPreviewKeyword] = useState('');

  const categoryRules = useMemo(
    () => keywordRules.filter(r => r.category_name === category).sort((a, b) => a.priority - b.priority),
    [keywordRules, category]
  );

  const categoryItems = useMemo(
    () => data.filter(item => item.reportCat === category),
    [data, category]
  );

  const ruleMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryRules.forEach(rule => {
      counts[rule.id] = categoryItems.filter(
        item => item.itemName?.toLowerCase().includes(rule.keyword.toLowerCase())
      ).length;
    });
    return counts;
  }, [categoryRules, categoryItems]);

  const previewMatches = useMemo(() => {
    const kw = previewKeyword.trim();
    if (!kw) return [];
    return categoryItems.filter(
      item => item.itemName?.toLowerCase().includes(kw.toLowerCase())
    );
  }, [previewKeyword, categoryItems]);

  const handleAddRule = async () => {
    const kw = newKeyword.trim();
    if (!kw || !newCode) return;
    await saveRule.mutateAsync({
      category_name: category,
      keyword: kw,
      labor_code: newCode,
      priority: categoryRules.length,
    });
    setNewKeyword('');
    setNewCode('');
    setPreviewKeyword('');
    toast({ title: 'Rule Added', description: `"${kw}" → ${newCode}` });
  };

  const handleDeleteRule = async (rule: CategoryKeywordRule) => {
    await deleteRule.mutateAsync(rule.id);
    toast({ title: 'Rule Deleted', description: `Removed keyword rule "${rule.keyword}"` });
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Keyword Rules
        </span>
        {categoryRules.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {categoryRules.length} active
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          — route items to a specific code when their name contains a keyword
        </span>
      </div>

      {/* Existing rules */}
      {categoryRules.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {categoryRules.map((rule, idx) => (
            <div
              key={rule.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2 bg-primary/5 border border-primary/20"
            >
              <span className="text-xs text-muted-foreground font-mono w-5 text-center shrink-0">
                {idx + 1}
              </span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">name contains</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {rule.keyword}
                </Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
                  {rule.labor_code}
                </Badge>
                <span className="text-xs text-muted-foreground ml-1">
                  ({ruleMatchCounts[rule.id] ?? 0} items)
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteRule(rule)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new rule */}
      <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">If name contains</span>
        <Input
          value={newKeyword}
          onChange={(e) => {
            setNewKeyword(e.target.value);
            setPreviewKeyword(e.target.value);
          }}
          placeholder="e.g. Pipe ID"
          className="h-7 text-xs flex-1 min-w-0"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Select value={newCode} onValueChange={setNewCode}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue placeholder="Select code…" />
          </SelectTrigger>
          <SelectContent>
            {laborCodes.map(c => (
              <SelectItem key={c.id} value={c.code}>
                <span className="font-mono">{c.code}</span>
                <span className="ml-2 text-muted-foreground">- {c.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-7 text-xs px-3"
          disabled={!newKeyword.trim() || !newCode || saveRule.isPending}
          onClick={handleAddRule}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {/* Live preview */}
      {previewKeyword.trim() && (
        <div className="mt-2 rounded-lg bg-accent/50 px-3 py-2">
          <span className="text-xs font-medium text-accent-foreground">
            Preview: {previewMatches.length} items match "{previewKeyword.trim()}"
          </span>
          {previewMatches.length > 0 && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              e.g. {[...new Set(previewMatches.slice(0, 4).map(m => m.itemName))].join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
