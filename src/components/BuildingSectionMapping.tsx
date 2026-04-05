import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, Wand2, Trash2, Plus, AlertTriangle, Save } from 'lucide-react';
import {
  BuildingSectionMapping as BSM,
  DetectedBuilding,
  useBuildingSectionMappings,
  detectBuildingsFromDrawings,
} from '@/hooks/useBuildingSectionMappings';

interface Props {
  projectId: string;
  estimateItems: Array<{ drawing?: string }>;
  onMappingsChange?: () => void;
  suggestedMappings?: Array<{ building_identifier: string; section_code: string }>;
}

export const BuildingSectionMappingPanel: React.FC<Props> = ({
  projectId,
  estimateItems,
  onMappingsChange,
  suggestedMappings = [],
}) => {
  const { mappings, loading, upsertMapping, deleteMapping, autoPopulate, updateZonePattern } =
    useBuildingSectionMappings(projectId);

  const [detected, setDetected] = useState<DetectedBuilding[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newBuildingId, setNewBuildingId] = useState('');
  const [newSectionCode, setNewSectionCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newZonePattern, setNewZonePattern] = useState('');

  // Suggested mappings state — pre-filled from auto-detection, not yet in DB
  const [isSuggested, setIsSuggested] = useState(false);
  const [suggestedRows, setSuggestedRows] = useState<Record<string, string>>({});

  useEffect(() => {
    if (estimateItems.length === 0) return;
    setDetected(detectBuildingsFromDrawings(estimateItems));
  }, [estimateItems]);

  // Pre-populate from suggestedMappings when no DB mappings exist
  useEffect(() => {
    if (mappings.length > 0) {
      setIsSuggested(false);
      setSuggestedRows({});
    } else if (suggestedMappings.length > 0) {
      const suggested: Record<string, string> = {};
      suggestedMappings.forEach(s => {
        suggested[s.building_identifier] = s.section_code;
      });
      setSuggestedRows(suggested);
      setIsSuggested(true);
    }
  }, [mappings.length, suggestedMappings]);

  const handleAutoPopulate = async () => {
    await autoPopulate(detected);
    onMappingsChange?.();
  };

  const handleSave = async (buildingId: string) => {
    const sectionCode = editValues[buildingId];
    if (!sectionCode?.trim()) return;
    await upsertMapping(buildingId, sectionCode.trim());
    setEditValues(prev => {
      const next = { ...prev };
      delete next[buildingId];
      return next;
    });
    onMappingsChange?.();
  };

  const handleDelete = async (m: BSM) => {
    await deleteMapping(m.id);
    onMappingsChange?.();
  };

  const handleSaveAllSuggested = async () => {
    const entries = Object.entries(suggestedRows);
    if (entries.length === 0) return;
    for (const [buildingId, sectionCode] of entries) {
      await upsertMapping(buildingId, sectionCode, `Building ${buildingId}`);
    }
    setIsSuggested(false);
    setSuggestedRows({});
    onMappingsChange?.();
  };

  const handleAddNew = async () => {
    if (!newBuildingId.trim() || !newSectionCode.trim()) return;
    await upsertMapping(
      newBuildingId.trim().toUpperCase(),
      newSectionCode.trim().toUpperCase(),
      newDescription.trim()
    );
    setNewBuildingId('');
    setNewSectionCode('');
    setNewDescription('');
    setNewZonePattern('');
    onMappingsChange?.();
  };

  const unmappedBuildings = detected.filter(
    d => !mappings.find(m => m.building_identifier === d.building_identifier)
      && !suggestedRows[d.building_identifier]
  );

  const suggestedEntries = Object.entries(suggestedRows);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Building → Section Code
              <Badge variant="secondary" className="ml-2">
                {mappings.length} mapped
                {isSuggested && suggestedEntries.length > 0 && ` · ${suggestedEntries.length} suggested`}
              </Badge>
            </CardTitle>
            <CardDescription>
              When floor values like "Roof" or "Crawl Space" don't contain a building
              identifier, the system falls back to the drawing name to determine the
              section code.
            </CardDescription>
          </div>
          {unmappedBuildings.length > 0 && !isSuggested && (
            <Button variant="outline" size="sm" onClick={handleAutoPopulate}>
              <Wand2 className="h-4 w-4 mr-1" />
              Auto-detect ({unmappedBuildings.length} new)
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested mappings banner */}
        {isSuggested && suggestedEntries.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {suggestedEntries.length} building(s) auto-detected from drawing names
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Review the section codes below and click Save All to apply them — cost codes will use 0000 until saved.
              </p>
            </div>
            <Button size="sm" onClick={handleSaveAllSuggested}>
              <Save className="h-4 w-4 mr-1" />
              Save All
            </Button>
          </div>
        )}

        {/* Auto-detected but unmapped (only show when NOT in suggested mode) */}
        {!isSuggested && unmappedBuildings.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground mb-2">
              {unmappedBuildings.length} building(s) detected from drawing names — not yet mapped:
            </p>
            <div className="flex flex-wrap gap-2">
              {unmappedBuildings.map(d => (
                <div key={d.building_identifier} className="flex items-center gap-1 text-sm">
                  <Badge variant="outline">{d.building_identifier}</Badge>
                  <span className="text-muted-foreground">→ suggested:</span>
                  <span className="font-mono font-medium">{d.suggested_section}</span>
                  <span className="text-muted-foreground text-xs">({d.item_count} items)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested rows table (editable, not yet saved) */}
        {isSuggested && suggestedEntries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Building</TableHead>
                <TableHead>Section Code</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestedEntries.map(([buildingId, sectionCode]) => {
                const det = detected.find(d => d.building_identifier === buildingId);
                return (
                  <TableRow key={buildingId} className="bg-amber-50/50 dark:bg-amber-950/10">
                    <TableCell className="font-mono font-medium">{buildingId}</TableCell>
                    <TableCell>
                      <Input
                        value={sectionCode}
                        className="w-20 h-8 font-mono"
                        onChange={e =>
                          setSuggestedRows(prev => ({
                            ...prev,
                            [buildingId]: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>{det ? `${det.item_count}` : '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSuggestedRows(prev => {
                            const next = { ...prev };
                            delete next[buildingId];
                            if (Object.keys(next).length === 0) setIsSuggested(false);
                            return next;
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Existing DB mappings */}
        {mappings.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Building</TableHead>
                <TableHead>Section Code</TableHead>
                <TableHead>Zone Pattern</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map(m => {
                const det = detected.find(d => d.building_identifier === m.building_identifier);
                const isEditing = editValues[m.building_identifier] !== undefined;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">{m.building_identifier}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues[m.building_identifier] || ''}
                          className="w-20 h-8 font-mono"
                          onChange={e =>
                            setEditValues(prev => ({
                              ...prev,
                              [m.building_identifier]: e.target.value.toUpperCase(),
                            }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave(m.building_identifier);
                            if (e.key === 'Escape')
                              setEditValues(prev => {
                                const next = { ...prev };
                                delete next[m.building_identifier];
                                return next;
                              });
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="font-mono cursor-pointer hover:text-primary"
                          onClick={() =>
                            setEditValues(prev => ({
                              ...prev,
                              [m.building_identifier]: m.section_code,
                            }))
                          }
                        >
                          {m.section_code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="e.g. MODULAR"
                        defaultValue={m.zone_pattern || ''}
                        className="w-32 h-8 text-xs font-mono"
                        title="Items on standalone floors whose zone contains this keyword resolve to this building section"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (m.zone_pattern || '')) {
                            updateZonePattern(m.id, val);
                            onMappingsChange?.();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.description}</TableCell>
                    <TableCell>{det ? `${det.item_count}` : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isEditing && (
                          <Button size="sm" variant="outline" onClick={() => handleSave(m.building_identifier)}>
                            Save
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Add new row */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Building ID"
            value={newBuildingId}
            className="w-24 font-mono"
            onChange={e => setNewBuildingId(e.target.value.toUpperCase())}
          />
          <span className="text-muted-foreground">→</span>
          <Input
            placeholder="Section"
            value={newSectionCode}
            className="w-20 font-mono"
            onChange={e => setNewSectionCode(e.target.value.toUpperCase())}
          />
          <Input
            placeholder="Zone pattern"
            value={newZonePattern}
            className="w-32 font-mono text-xs"
            onChange={e => setNewZonePattern(e.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={newDescription}
            className="flex-1"
            onChange={e => setNewDescription(e.target.value)}
          />
          <Button size="sm" onClick={async () => {
            if (!newBuildingId.trim() || !newSectionCode.trim()) return;
            await upsertMapping(
              newBuildingId.trim().toUpperCase(),
              newSectionCode.trim().toUpperCase(),
              newDescription.trim()
            );
            if (newZonePattern.trim()) {
              const newMapping = mappings.find(m => m.building_identifier === newBuildingId.trim().toUpperCase());
            }
            setNewBuildingId('');
            setNewSectionCode('');
            setNewDescription('');
            setNewZonePattern('');
            onMappingsChange?.();
          }} disabled={!newBuildingId.trim() || !newSectionCode.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
