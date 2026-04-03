import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight, Zap, BarChart3, Layers } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface CodeHealthDashboardProps {
  finalLaborSummary: Record<string, { code: string; hours: number; dollars: number; description?: string }> | null;
}

export const CodeHealthDashboard: React.FC<CodeHealthDashboardProps> = ({ finalLaborSummary }) => {
  const [smallThreshold, setSmallThreshold] = useState(40);
  const [jobWideThreshold, setJobWideThreshold] = useState(160);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const analysis = useMemo(() => {
    if (!finalLaborSummary || Object.keys(finalLaborSummary).length === 0) return null;

    const entries = Object.entries(finalLaborSummary).map(([key, val]) => {
      const parts = key.trim().split(/\s+/);
      const sec = parts[0] || '';
      const act = parts[1] || '0000';
      const head = parts.slice(2).join(' ') || '';
      return { key, sec, act, head, hours: val.hours ?? 0, description: val.description || head };
    });

    const totalCodes = entries.length;
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);

    // Codes under threshold
    const underThreshold = entries.filter(e => e.hours < smallThreshold && e.hours > 0);
    const underThresholdHours = underThreshold.reduce((s, e) => s + e.hours, 0);
    const underThresholdPct = totalCodes > 0 ? (underThreshold.length / totalCodes) * 100 : 0;
    const underThresholdHoursPct = totalHours > 0 ? (underThresholdHours / totalHours) * 100 : 0;

    // Cross-section heads
    const headMap = new Map<string, { sections: Set<string>; totalHours: number }>();
    entries.forEach(e => {
      if (!headMap.has(e.head)) headMap.set(e.head, { sections: new Set(), totalHours: 0 });
      const h = headMap.get(e.head)!;
      h.sections.add(`${e.sec} ${e.act}`);
      h.totalHours += e.hours;
    });
    const crossSectionHeads = Array.from(headMap.entries())
      .filter(([, v]) => v.sections.size >= 2 && v.totalHours < jobWideThreshold && v.totalHours > 0)
      .map(([head, v]) => ({ head, sections: v.sections.size, totalHours: v.totalHours }))
      .sort((a, b) => a.totalHours - b.totalHours);

    // Section size table
    const sectionMap = new Map<string, { codeCount: number; totalHours: number }>();
    entries.forEach(e => {
      const secAct = `${e.sec} ${e.act}`;
      if (!sectionMap.has(secAct)) sectionMap.set(secAct, { codeCount: 0, totalHours: 0 });
      const s = sectionMap.get(secAct)!;
      s.codeCount++;
      s.totalHours += e.hours;
    });
    const sections = Array.from(sectionMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalCodes,
      totalHours,
      underThreshold,
      underThresholdPct,
      underThresholdHours,
      underThresholdHoursPct,
      crossSectionHeads,
      sections,
    };
  }, [finalLaborSummary, smallThreshold, jobWideThreshold]);

  if (!analysis) return null;

  const codeCountColor = analysis.totalCodes < 100 ? 'text-green-500' : analysis.totalCodes <= 200 ? 'text-amber-500' : 'text-red-500';
  const codeCountBg = analysis.totalCodes < 100 ? 'bg-green-500/10' : analysis.totalCodes <= 200 ? 'bg-amber-500/10' : 'bg-red-500/10';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-5 h-5 text-amber-500" />
          Code Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Threshold config */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Small code threshold:</Label>
            <Input
              type="number"
              value={smallThreshold}
              onChange={e => setSmallThreshold(parseInt(e.target.value) || 40)}
              className="w-16 h-7 text-xs"
            />
            <span className="text-muted-foreground">hrs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Job-wide threshold:</Label>
            <Input
              type="number"
              value={jobWideThreshold}
              onChange={e => setJobWideThreshold(parseInt(e.target.value) || 160)}
              className="w-16 h-7 text-xs"
            />
            <span className="text-muted-foreground">hrs</span>
          </div>
        </div>

        {/* Overview */}
        <Collapsible open={openSections.has('overview')}>
          <CollapsibleTrigger
            onClick={() => toggleSection('overview')}
            className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
          >
            {openSections.has('overview') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <BarChart3 className="w-4 h-4" />
            Overview
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={cn('rounded-lg p-3', codeCountBg)}>
                <div className="text-xs text-muted-foreground">Total Codes</div>
                <div className={cn('text-2xl font-bold font-mono', codeCountColor)}>{analysis.totalCodes}</div>
              </div>
              <div className="rounded-lg p-3 bg-muted/50">
                <div className="text-xs text-muted-foreground">Total Hours</div>
                <div className="text-2xl font-bold font-mono">{analysis.totalHours.toLocaleString()}</div>
              </div>
              <div className="rounded-lg p-3 bg-muted/50">
                <div className="text-xs text-muted-foreground">Under {smallThreshold}h</div>
                <div className={cn('text-2xl font-bold font-mono', analysis.underThresholdPct > 30 ? 'text-red-500' : 'text-foreground')}>
                  {analysis.underThreshold.length}
                </div>
                <div className="text-xs text-muted-foreground">{analysis.underThresholdPct.toFixed(0)}% of codes</div>
              </div>
              <div className="rounded-lg p-3 bg-muted/50">
                <div className="text-xs text-muted-foreground">Small Code Hours</div>
                <div className="text-2xl font-bold font-mono">{analysis.underThresholdHours.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{analysis.underThresholdHoursPct.toFixed(1)}% of total</div>
              </div>
            </div>

            {analysis.underThresholdPct > 30 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>{analysis.underThreshold.length} codes ({analysis.underThresholdPct.toFixed(0)}%)</strong> are under {smallThreshold}h
                  — consider cross-section consolidation or activity code simplification.
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Cross-Section Small Heads */}
        {analysis.crossSectionHeads.length > 0 && (
          <Collapsible open={openSections.has('crossSection')}>
            <CollapsibleTrigger
              onClick={() => toggleSection('crossSection')}
              className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
            >
              {openSections.has('crossSection') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Layers className="w-4 h-4" />
              Cross-Section Consolidation Candidates
              <Badge variant="secondary" className="ml-auto text-xs">{analysis.crossSectionHeads.length}</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                These cost heads appear in 2+ sections and total under {jobWideThreshold}h job-wide.
                They may be candidates for job-wide consolidation.
              </p>
              <div className="space-y-1.5">
                {analysis.crossSectionHeads.map(h => (
                  <div key={h.head} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/50">
                    <span className="font-mono font-medium">{h.head}</span>
                    <span className="text-muted-foreground">
                      {h.totalHours.toLocaleString()}h across {h.sections} sections
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Section Size Table */}
        <Collapsible open={openSections.has('sections')}>
          <CollapsibleTrigger
            onClick={() => toggleSection('sections')}
            className="flex items-center gap-2 w-full text-left text-sm font-medium hover:text-primary transition-colors"
          >
            {openSections.has('sections') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Section Breakdown
            <Badge variant="secondary" className="ml-auto text-xs">{analysis.sections.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Section</TableHead>
                    <TableHead className="text-xs text-right">Codes</TableHead>
                    <TableHead className="text-xs text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.sections.map(s => (
                    <TableRow key={s.name} className={s.totalHours < 200 ? 'bg-amber-500/5' : undefined}>
                      <TableCell className="font-mono text-xs py-1.5">
                        {s.name}
                        {s.totalHours < 200 && <span className="ml-1 text-amber-500">⚠</span>}
                      </TableCell>
                      <TableCell className="text-xs text-right py-1.5">{s.codeCount}</TableCell>
                      <TableCell className="text-xs text-right font-mono py-1.5">{s.totalHours.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
