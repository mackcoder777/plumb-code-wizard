import React, { useState, useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { 
  Package, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Play, 
  ArrowUpDown,
  Eye,
  Zap,
  GripVertical
} from 'lucide-react';
import { useMaterialCodeRules, useCreateMaterialCodeRule, useUpdateMaterialCodeRule, useDeleteMaterialCodeRule, MaterialCodeRule, applyRulesToItems } from '@/hooks/useMaterialCodeRules';
import { useMaterialCodes } from '@/hooks/useCostCodes';


interface MaterialMappingTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
  projectId?: string | null;
}

export const MaterialMappingTab: React.FC<MaterialMappingTabProps> = ({ 
  data, 
  onDataUpdate,
  projectId 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MaterialCodeRule | null>(null);
  const [previewResults, setPreviewResults] = useState<Record<string, string> | null>(null);

  // Form state for new/edit rule
  const [formData, setFormData] = useState({
    name: '',
    priority: 100,
    material_spec_contains: '',
    item_type_equals: '',
    item_type_contains: '',
    material_desc_contains: '',
    item_name_contains: '',
    material_cost_code: '',
  });

  // Load rules and material codes
  const { data: rules = [], isLoading: rulesLoading } = useMaterialCodeRules(projectId);
  const createRule = useCreateMaterialCodeRule();
  const updateRule = useUpdateMaterialCodeRule();
  const deleteRule = useDeleteMaterialCodeRule();
  const { data: dbMaterialCodes = [] } = useMaterialCodes();

  // Use only database material codes (no hardcoded fallback)
  const allMaterialCodes = useMemo(() => {
    return dbMaterialCodes.map(c => ({
      code: c.code,
      description: c.description,
    })).sort((a, b) => a.description.localeCompare(b.description));
  }, [dbMaterialCodes]);

  // Get unique item types and material specs from data for suggestions
  const uniqueItemTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(item => {
      if (item.itemType) types.add(item.itemType);
    });
    return Array.from(types).sort();
  }, [data]);

  const uniqueMaterialSpecs = useMemo(() => {
    const specs = new Set<string>();
    data.forEach(item => {
      if (item.materialSpec) specs.add(item.materialSpec);
    });
    return Array.from(specs).sort();
  }, [data]);

  // Stats
  const stats = useMemo(() => {
    const total = data.length;
    const coded = data.filter(i => i.materialCostCode).length;
    const uncoded = total - coded;
    const totalDollars = data.reduce((sum, i) => sum + (i.materialDollars || 0), 0);
    const codedDollars = data.filter(i => i.materialCostCode).reduce((sum, i) => sum + (i.materialDollars || 0), 0);
    
    return { total, coded, uncoded, totalDollars, codedDollars };
  }, [data]);

  const resetForm = () => {
    setFormData({
      name: '',
      priority: 100,
      material_spec_contains: '',
      item_type_equals: '',
      item_type_contains: '',
      material_desc_contains: '',
      item_name_contains: '',
      material_cost_code: '',
    });
    setEditingRule(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (rule: MaterialCodeRule) => {
    setFormData({
      name: rule.name,
      priority: rule.priority,
      material_spec_contains: rule.material_spec_contains || '',
      item_type_equals: rule.item_type_equals || '',
      item_type_contains: rule.item_type_contains || '',
      material_desc_contains: rule.material_desc_contains || '',
      item_name_contains: rule.item_name_contains || '',
      material_cost_code: rule.material_cost_code,
    });
    setEditingRule(rule);
    setIsAddDialogOpen(true);
  };

  const handleSaveRule = async () => {
    if (!formData.name || !formData.material_cost_code) {
      toast({ title: 'Error', description: 'Name and Material Code are required', variant: 'destructive' });
      return;
    }

    // Check that at least one condition is set
    const hasCondition = formData.material_spec_contains || formData.item_type_equals || 
                        formData.item_type_contains || formData.material_desc_contains || 
                        formData.item_name_contains;
    
    if (!hasCondition) {
      toast({ title: 'Error', description: 'At least one condition must be set', variant: 'destructive' });
      return;
    }

    try {
      const ruleData = {
        project_id: projectId || null,
        name: formData.name,
        priority: formData.priority,
        material_spec_contains: formData.material_spec_contains || null,
        item_type_equals: formData.item_type_equals || null,
        item_type_contains: formData.item_type_contains || null,
        material_desc_contains: formData.material_desc_contains || null,
        item_name_contains: formData.item_name_contains || null,
        material_cost_code: formData.material_cost_code,
      };

      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...ruleData });
        toast({ title: 'Rule Updated', description: `Updated rule "${formData.name}"` });
      } else {
        await createRule.mutateAsync(ruleData);
        toast({ title: 'Rule Created', description: `Created rule "${formData.name}"` });
      }

      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save rule', variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (rule: MaterialCodeRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    
    try {
      await deleteRule.mutateAsync(rule.id);
      toast({ title: 'Rule Deleted', description: `Deleted rule "${rule.name}"` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    }
  };

  const handlePreviewRules = () => {
    const mappings = applyRulesToItems(data, rules, false);
    setPreviewResults(mappings);
    toast({ 
      title: 'Preview Ready', 
      description: `${Object.keys(mappings).length} items would be assigned material codes` 
    });
  };

  const handleApplyRules = () => {
    const mappings = applyRulesToItems(data, rules, false);
    
    if (Object.keys(mappings).length === 0) {
      toast({ title: 'No Changes', description: 'No items matched the rules or all items already have codes' });
      return;
    }

    const updatedData = data.map(item => {
      if (mappings[String(item.id)]) {
        return { ...item, materialCostCode: mappings[String(item.id)] };
      }
      return item;
    });

    onDataUpdate(updatedData);
    setPreviewResults(null);
    toast({ 
      title: 'Rules Applied', 
      description: `Applied material codes to ${Object.keys(mappings).length} items` 
    });
  };

  const getCodeDescription = (code: string) => {
    const found = allMaterialCodes.find(c => c.code === code);
    return found?.description || code;
  };

  // Count how many items each rule would affect
  const getRuleMatchCount = (rule: MaterialCodeRule) => {
    return data.filter(item => {
      // Check each condition
      if (rule.material_spec_contains && !item.materialSpec?.toLowerCase().includes(rule.material_spec_contains.toLowerCase())) return false;
      if (rule.item_type_equals && item.itemType?.toLowerCase() !== rule.item_type_equals.toLowerCase()) return false;
      if (rule.item_type_contains && !item.itemType?.toLowerCase().includes(rule.item_type_contains.toLowerCase())) return false;
      if (rule.material_desc_contains && !item.materialDesc?.toLowerCase().includes(rule.material_desc_contains.toLowerCase())) return false;
      if (rule.item_name_contains && !item.itemName?.toLowerCase().includes(rule.item_name_contains.toLowerCase())) return false;
      return true;
    }).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Material Code Rules
              </CardTitle>
              <CardDescription>
                Create conditional rules to assign material codes by Item Type, Material Spec, etc.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handlePreviewRules} disabled={rules.length === 0}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleApplyRules} disabled={rules.length === 0} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-2" />
                Apply All Rules
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{stats.coded}</div>
              <div className="text-sm text-muted-foreground">Material Coded</div>
            </div>
            <div className="bg-orange-500/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600">{stats.uncoded}</div>
              <div className="text-sm text-muted-foreground">Needs Material Code</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{rules.length}</div>
              <div className="text-sm text-muted-foreground">Active Rules</div>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">How Material Code Rules Work</h4>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
              <li><strong>Rules are applied in priority order</strong> (lower number = higher priority)</li>
              <li><strong>First matching rule wins</strong> - once an item matches a rule, it gets that code</li>
              <li><strong>All conditions in a rule must match</strong> (AND logic)</li>
              <li><strong>Example:</strong> IF Material Spec CONTAINS "Copper" AND Item Type = "Fittings" → COPR</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Rules ({rules.length})</CardTitle>
            <Button onClick={handleOpenAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Rules Yet</h3>
              <p className="mb-4">Create your first rule to automatically assign material codes</p>
              <Button onClick={handleOpenAddDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => {
                const matchCount = getRuleMatchCount(rule);
                return (
                  <div 
                    key={rule.id} 
                    className={`border rounded-lg p-4 transition-colors ${
                      rule.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-full text-sm font-bold">
                          {rule.priority}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{rule.name}</span>
                            {!rule.is_active && <Badge variant="secondary">Disabled</Badge>}
                            <Badge variant="outline" className="ml-auto">
                              {matchCount} items match
                            </Badge>
                          </div>
                          
                          {/* Conditions */}
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className="text-muted-foreground">IF</span>
                            {rule.material_spec_contains && (
                              <Badge variant="secondary">Material Spec CONTAINS "{rule.material_spec_contains}"</Badge>
                            )}
                            {rule.item_type_equals && (
                              <Badge variant="secondary">Item Type = "{rule.item_type_equals}"</Badge>
                            )}
                            {rule.item_type_contains && (
                              <Badge variant="secondary">Item Type CONTAINS "{rule.item_type_contains}"</Badge>
                            )}
                            {rule.material_desc_contains && (
                              <Badge variant="secondary">Material Desc CONTAINS "{rule.material_desc_contains}"</Badge>
                            )}
                            {rule.item_name_contains && (
                              <Badge variant="secondary">Item Name CONTAINS "{rule.item_name_contains}"</Badge>
                            )}
                            <span className="text-muted-foreground">→</span>
                            <Badge className="bg-green-600">
                              {rule.material_cost_code} - {getCodeDescription(rule.material_cost_code)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(rule)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Results */}
      {previewResults && Object.keys(previewResults).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview: {Object.keys(previewResults).length} Items Would Be Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Material Spec</th>
                    <th className="text-left p-2">Item Type</th>
                    <th className="text-left p-2">Material Desc</th>
                    <th className="text-left p-2">Assigned Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(previewResults).slice(0, 50).map(([itemId, code]) => {
                    const item = data.find(i => String(i.id) === itemId);
                    if (!item) return null;
                    return (
                      <tr key={itemId} className="hover:bg-muted/50">
                        <td className="p-2 truncate max-w-32">{item.materialSpec || '-'}</td>
                        <td className="p-2">{item.itemType || '-'}</td>
                        <td className="p-2 truncate max-w-48">{item.materialDesc || '-'}</td>
                        <td className="p-2">
                          <Badge className="bg-green-600">{code}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(previewResults).length > 50 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  Showing 50 of {Object.keys(previewResults).length} items
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t">
              <Button onClick={() => setPreviewResults(null)} variant="outline" className="mr-2">
                Close Preview
              </Button>
              <Button onClick={handleApplyRules} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Apply to {Object.keys(previewResults).length} Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Rule Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Material Code Rule'}</DialogTitle>
            <DialogDescription>
              Define conditions to automatically assign material codes to items
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Rule Name & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rule Name *</Label>
                <Input 
                  placeholder="e.g., Copper Fittings to COPR"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority (lower = higher priority)</Label>
                <Input 
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Conditions (at least one required)</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Material Spec CONTAINS</Label>
                  <Input 
                    placeholder="e.g., Copper, SS, Cast Iron"
                    value={formData.material_spec_contains}
                    onChange={(e) => setFormData({ ...formData, material_spec_contains: e.target.value })}
                    list="material-specs"
                  />
                  <datalist id="material-specs">
                    {uniqueMaterialSpecs.map(spec => (
                      <option key={spec} value={spec} />
                    ))}
                  </datalist>
                </div>
                
                <div className="space-y-2">
                  <Label>Item Type EQUALS</Label>
                  <Select 
                    value={formData.item_type_equals} 
                    onValueChange={(v) => setFormData({ ...formData, item_type_equals: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Any --</SelectItem>
                      {uniqueItemTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Item Type CONTAINS</Label>
                  <Input 
                    placeholder="e.g., Fitting, Pipe, Valve"
                    value={formData.item_type_contains}
                    onChange={(e) => setFormData({ ...formData, item_type_contains: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Material Desc CONTAINS</Label>
                  <Input 
                    placeholder="e.g., Hanger, Support"
                    value={formData.material_desc_contains}
                    onChange={(e) => setFormData({ ...formData, material_desc_contains: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Item Name CONTAINS</Label>
                  <Input 
                    placeholder="e.g., Valve, Flange"
                    value={formData.item_name_contains}
                    onChange={(e) => setFormData({ ...formData, item_name_contains: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="space-y-2 pt-4 border-t">
              <Label>THEN Assign Material Code *</Label>
              <Select 
                value={formData.material_cost_code} 
                onValueChange={(v) => setFormData({ ...formData, material_cost_code: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select material code..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {allMaterialCodes.map(code => (
                    <SelectItem key={code.code} value={code.code}>
                      <span className="font-mono text-xs bg-green-100 dark:bg-green-900 px-1 rounded mr-2">{code.code}</span>
                      {code.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} className="bg-green-600 hover:bg-green-700">
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
