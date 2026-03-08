import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Wrench, 
  Award,
  Calculator,
  Info,
  DollarSign
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Function to get tax rate by ZIP code using ranges
const getTaxRateByZip = (zipCode: string): { rate: number; jurisdiction: string } => {
  const zip = parseInt(zipCode);
  if (isNaN(zip)) return { rate: 7.25, jurisdiction: 'California State Minimum' };

  // LOS ANGELES COUNTY (varies by city)
  
  // Long Beach: 10.25%
  if ((zip >= 90801 && zip <= 90815) || 
      zip === 90822 || 
      (zip >= 90831 && zip <= 90848)) {
    return { rate: 10.25, jurisdiction: 'Long Beach' };
  }
  
  // Los Angeles City: 9.5%
  if ((zip >= 90001 && zip <= 90089) ||
      (zip >= 90091 && zip <= 90099) ||
      (zip >= 90101 && zip <= 90189) ||
      (zip >= 90291 && zip <= 90296) ||
      (zip >= 91040 && zip <= 91043) ||
      (zip >= 91303 && zip <= 91308) ||
      (zip >= 91311 && zip <= 91316) ||
      (zip >= 91324 && zip <= 91328) ||
      (zip >= 91330 && zip <= 91335) ||
      (zip >= 91340 && zip <= 91349) ||
      (zip >= 91352 && zip <= 91357) ||
      (zip >= 91364 && zip <= 91367) ||
      (zip >= 91401 && zip <= 91499) ||
      (zip >= 91601 && zip <= 91618)) {
    return { rate: 9.5, jurisdiction: 'Los Angeles' };
  }
  
  // Pasadena: 10.25%
  if (zip >= 91101 && zip <= 91199) {
    return { rate: 10.25, jurisdiction: 'Pasadena' };
  }
  
  // Glendale: 10.25%
  if (zip >= 91201 && zip <= 91226) {
    return { rate: 10.25, jurisdiction: 'Glendale' };
  }
  
  // Burbank: 10.25%
  if (zip >= 91501 && zip <= 91526) {
    return { rate: 10.25, jurisdiction: 'Burbank' };
  }
  
  // Santa Monica: 10.25%
  if (zip >= 90401 && zip <= 90411) {
    return { rate: 10.25, jurisdiction: 'Santa Monica' };
  }
  
  // Culver City: 10.25%
  if (zip >= 90230 && zip <= 90233) {
    return { rate: 10.25, jurisdiction: 'Culver City' };
  }
  
  // Inglewood: 10.25%
  if (zip >= 90301 && zip <= 90312) {
    return { rate: 10.25, jurisdiction: 'Inglewood' };
  }
  
  // Torrance: 10.25%
  if (zip >= 90501 && zip <= 90510) {
    return { rate: 10.25, jurisdiction: 'Torrance' };
  }
  
  // Carson: 10.25%
  if (zip >= 90745 && zip <= 90749) {
    return { rate: 10.25, jurisdiction: 'Carson' };
  }
  
  // Compton: 10.25%
  if (zip >= 90220 && zip <= 90224) {
    return { rate: 10.25, jurisdiction: 'Compton' };
  }
  
  // Downey: 10.25%
  if (zip >= 90239 && zip <= 90242) {
    return { rate: 10.25, jurisdiction: 'Downey' };
  }
  
  // Pomona: 10.25%
  if (zip >= 91766 && zip <= 91769) {
    return { rate: 10.25, jurisdiction: 'Pomona' };
  }
  
  // El Monte: 10.25%
  if (zip >= 91731 && zip <= 91735) {
    return { rate: 10.25, jurisdiction: 'El Monte' };
  }
  
  // West Covina: 10.25%
  if (zip >= 91790 && zip <= 91793) {
    return { rate: 10.25, jurisdiction: 'West Covina' };
  }
  
  // Other LA County (unincorporated): 9.5%
  if (zip >= 90000 && zip <= 91999) {
    return { rate: 9.5, jurisdiction: 'Los Angeles County' };
  }
  
  // ORANGE COUNTY
  
  // Santa Ana: 9.25%
  if (zip >= 92701 && zip <= 92799) {
    return { rate: 9.25, jurisdiction: 'Santa Ana' };
  }
  
  // Anaheim: 7.75%
  if (zip >= 92801 && zip <= 92899) {
    return { rate: 7.75, jurisdiction: 'Anaheim' };
  }
  
  // Irvine: 7.75%
  if (zip >= 92602 && zip <= 92699) {
    return { rate: 7.75, jurisdiction: 'Irvine' };
  }
  
  // Other Orange County: 7.75%
  if (zip >= 92600 && zip <= 92899) {
    return { rate: 7.75, jurisdiction: 'Orange County' };
  }
  
  // SAN DIEGO COUNTY: 7.75%
  if (zip >= 92101 && zip <= 92199) {
    return { rate: 7.75, jurisdiction: 'San Diego' };
  }
  if ((zip >= 91901 && zip <= 92199) || (zip >= 92020 && zip <= 92099)) {
    return { rate: 7.75, jurisdiction: 'San Diego County' };
  }
  
  // RIVERSIDE COUNTY: 7.75%
  if (zip >= 92201 && zip <= 92599) {
    return { rate: 7.75, jurisdiction: 'Riverside County' };
  }
  
  // SAN BERNARDINO COUNTY: 7.75%
  if ((zip >= 91701 && zip <= 91799) || (zip >= 92301 && zip <= 92427)) {
    return { rate: 7.75, jurisdiction: 'San Bernardino County' };
  }
  
  // VENTURA COUNTY: 7.25%
  if (zip >= 93001 && zip <= 93099) {
    return { rate: 7.25, jurisdiction: 'Ventura County' };
  }
  
  // KERN COUNTY (Bakersfield): 8.25%
  if (zip >= 93201 && zip <= 93399) {
    return { rate: 8.25, jurisdiction: 'Kern County' };
  }
  
  // FRESNO COUNTY: 7.975%
  if (zip >= 93601 && zip <= 93799) {
    return { rate: 7.975, jurisdiction: 'Fresno County' };
  }
  
  // SACRAMENTO COUNTY: 8.75%
  if (zip >= 94203 && zip <= 95899) {
    return { rate: 8.75, jurisdiction: 'Sacramento County' };
  }
  
  // ALAMEDA COUNTY (Oakland, Berkeley): 10.25%
  if (zip >= 94501 && zip <= 94699) {
    return { rate: 10.25, jurisdiction: 'Alameda County' };
  }
  
  // SAN FRANCISCO: 8.625%
  if (zip >= 94101 && zip <= 94188) {
    return { rate: 8.625, jurisdiction: 'San Francisco' };
  }
  
  // SANTA CLARA COUNTY (San Jose): 9.125%
  if (zip >= 94301 && zip <= 95199) {
    return { rate: 9.125, jurisdiction: 'Santa Clara County' };
  }
  
  // CONTRA COSTA COUNTY: 8.75%
  if (zip >= 94506 && zip <= 94599) {
    return { rate: 8.75, jurisdiction: 'Contra Costa County' };
  }
  
  // Default California State Minimum
  return { rate: 7.25, jurisdiction: 'California State Minimum' };
};

// Material codes that are typically TAXABLE
const TAXABLE_MATERIAL_CODES = [
  '9510', '9512', '9514', '9515', '9520', '9521', '9522', '9523', '9524', '9525'
];

interface LaborCodeSummary {
  code: string;
  description: string;
  fieldHours: number;
  rate: number;
}

interface MaterialCodeSummary {
  code: string;
  description: string;
  amount: number;
}

interface FabricationConfig {
  enabled: boolean;
  percentage: number;
}

export interface BidRate {
  hours: number;
  rate: string; // String to support editing decimal values
}

export interface BidRates {
  straightTime: BidRate;
  shiftTime: BidRate;
  overtime: BidRate;
  doubleTime: BidRate;
  shop: BidRate;
}

export interface BudgetAdjustments {
  jobsiteZipCode: string;
  taxRate: number;
  taxJurisdiction: string;
  foremanBonusEnabled: boolean;
  foremanBonusPercent: number;
  foremanBonusHours: number;
  foremanBonusDollars: number;
  fabricationConfigs: Record<string, FabricationConfig>;
  fabricationSummary: Array<{
    code: string;
    description: string;
    fabCode: string;
    strippedHours: number;
    remainingFieldHours: number;
  }>;
  materialTaxOverrides: Record<string, boolean>;
  materialTaxSummary: Array<{
    code: string;
    description: string;
    amount: number;
    taxable: boolean;
    taxAmount: number;
  }>;
  totalMaterialTax: number;
  adjustedLaborSummary: Record<string, {
    code: string;
    description: string;
    hours: number;
    rate: number;
    dollars: number;
    type: 'field' | 'fab' | 'foreman';
  }>;
  totalFieldHours: number;
  totalFabHours: number;
  totalLaborDollars: number;
  totalMaterialWithTax: number;
  totalMaterialPreTax: number;
  // LRCN (Labor Rate Contingency)
  laborRateContingencyEnabled: boolean;
  bidRates: BidRates;
  budgetRate: number;
  bidTotal: number;
  budgetTotal: number;
  lrcnAmount: number;
  // Fab LRCN
  fabRates: Record<string, { bidRate: number; budgetRate: number }>;
  fabLrcnAmount: number;
  fabLrcnEnabled: boolean;
  // Computed rates
  computedBidLaborRate: number;
  shopRate: number;
}

interface BudgetAdjustmentsPanelProps {
  laborSummary: Record<string, LaborCodeSummary>;
  materialSummary: Record<string, MaterialCodeSummary>;
  bidLaborRate: number;
  projectId?: string;
  onAdjustmentsChange: (adjustments: BudgetAdjustments) => void;
}

const FAB_SECTION = 'FP';
const FAB_ACTIVITY = '0000';

// Maps field labor cost heads → fabrication material cost head
const DEFAULT_FAB_CODE_MAP: Record<string, string> = {
  // Cast Iron → CSTF
  SNWV: 'CSTF',
  STRM: 'CSTF',
  BGWV: 'CSTF',
  OVFL: 'CSTF',
  GRWV: 'CSTF',
  CSTI: 'CSTF',
  // Copper → COPR
  DWTR: 'COPR',
  HWTR: 'COPR',
  RCLM: 'COPR',
  COPR: 'COPR',
  // Carbon Steel / Threaded → CRBN
  NGAS: 'CRBN',
  MGAS: 'CRBN',
  FIRE: 'CRBN',
  STEL: 'CRBN',
  COND: 'CRBN',
  // Hangers → HFBS (Hanger Fab Sheets)
  HNGS: 'HFBS',
  SUPP: 'HFBS',
  // Stainless → SSTL
  SSTL: 'SSTL',
  ACID: 'SSTL',
  // Plastic / CPVC → PLST
  PLST: 'PLST',
  CPVC: 'PLST',
};

const FAB_COST_HEAD_DESCRIPTIONS: Record<string, string> = {
  COPR: 'FABRICATION - COPPER',
  CSTF: 'FABRICATION - CAST IRON',
  CRBN: 'FABRICATION - CARBON STEEL',
  SSTL: 'FABRICATION - STAINLESS STEEL',
  SS10: 'FABRICATION - STAINLESS 10GA',
  PLST: 'FABRICATION - PLASTIC / CPVC',
  BRAZ: 'FABRICATION - BRAZED',
  HFBS: 'FABRICATION - HANGER FAB SHEETS',
};

const BudgetAdjustmentsPanel: React.FC<BudgetAdjustmentsPanelProps> = ({
  laborSummary,
  materialSummary,
  bidLaborRate,
  projectId = 'default',
  onAdjustmentsChange,
}) => {
  // Load persisted settings from localStorage
  const [jobsiteZipCode, setJobsiteZipCode] = useState(() => {
    const saved = localStorage.getItem(`budget_zip_${projectId}`);
    return saved || '';
  });
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(() => {
    const saved = localStorage.getItem(`budget_taxrate_${projectId}`);
    return saved ? parseFloat(saved) : null;
  });
  const [foremanBonusEnabled, setForemanBonusEnabled] = useState(() => {
    const saved = localStorage.getItem(`budget_foreman_enabled_${projectId}`);
    return saved === null ? true : saved === 'true';
  });
  const [foremanBonusPercent, setForemanBonusPercent] = useState(() => {
    const saved = localStorage.getItem(`budget_foreman_pct_${projectId}`);
    return saved ? parseFloat(saved) : 1;
  });
  const [fabricationConfigs, setFabricationConfigs] = useState<Record<string, FabricationConfig>>(() => {
    const saved = localStorage.getItem(`budget_fab_configs_${projectId}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [materialTaxOverrides, setMaterialTaxOverrides] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`budget_tax_overrides_${projectId}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Per-fab-code bid/budget rates
  const [fabRates, setFabRates] = useState<Record<string, { bidRate: string; budgetRate: string }>>(() => {
    try {
      const stored = localStorage.getItem(`budget_fab_rates_${projectId}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  // Fab code routing map: field cost head → fab material cost head
  const [fabCodeMap, setFabCodeMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`budget_fab_code_map_${projectId}`);
      return saved ? { ...DEFAULT_FAB_CODE_MAP, ...JSON.parse(saved) } : { ...DEFAULT_FAB_CODE_MAP };
    } catch {
      return { ...DEFAULT_FAB_CODE_MAP };
    }
  });

  // LRCN (Labor Rate Contingency) state
  const [lrcnEnabled, setLrcnEnabled] = useState(() => {
    const saved = localStorage.getItem(`budget_lrcn_enabled_${projectId}`);
    return saved === 'true';
  });

  // Fab LRCN state
  const [fabLrcnEnabled, setFabLrcnEnabled] = useState(() => {
    const saved = localStorage.getItem(`budget_fab_lrcn_enabled_${projectId}`);
    return saved === null ? true : saved === 'true';
  });
  
  const [bidRates, setBidRates] = useState<BidRates>(() => {
    const saved = localStorage.getItem(`budget_bid_rates_${projectId}`);
    return saved ? JSON.parse(saved) : {
      straightTime: { hours: 0, rate: '92.03' },
      shiftTime: { hours: 0, rate: '95.70' },
      overtime: { hours: 0, rate: '121.57' },
      doubleTime: { hours: 0, rate: '145.38' },
      shop: { hours: 0, rate: '0' }
    };
  });
  
  const [budgetRate, setBudgetRate] = useState(() => {
    const saved = localStorage.getItem(`budget_rate_${projectId}`);
    return saved ? parseFloat(saved) : 85;
  });

  const [customFabCodes, setCustomFabCodes] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(`budget_custom_fab_codes_${projectId}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(`budget_custom_fab_codes_${projectId}`, JSON.stringify(customFabCodes));
  }, [customFabCodes, projectId]);

  const [customFabEntry, setCustomFabEntry] = useState<{ costHead: string; code: string; desc: string } | null>(null);

  // Track previous projectId to detect changes
  const [prevProjectId, setPrevProjectId] = useState(projectId);

  // Re-load all settings when projectId changes (e.g., from 'default' to actual project ID)
  useEffect(() => {
    if (projectId !== prevProjectId && projectId !== 'default') {
      console.log('[BudgetAdjustments] ProjectId changed from', prevProjectId, 'to', projectId, '- reloading settings');
      
      // Reload ZIP code
      const savedZip = localStorage.getItem(`budget_zip_${projectId}`);
      if (savedZip) setJobsiteZipCode(savedZip);
      
      // Reload custom tax rate
      const savedTaxRate = localStorage.getItem(`budget_taxrate_${projectId}`);
      setCustomTaxRate(savedTaxRate ? parseFloat(savedTaxRate) : null);
      
      // Reload foreman bonus settings
      const savedForemanEnabled = localStorage.getItem(`budget_foreman_enabled_${projectId}`);
      setForemanBonusEnabled(savedForemanEnabled === null ? true : savedForemanEnabled === 'true');
      
      const savedForemanPct = localStorage.getItem(`budget_foreman_pct_${projectId}`);
      setForemanBonusPercent(savedForemanPct ? parseFloat(savedForemanPct) : 1);
      
      // Reload fabrication configs
      const savedFabConfigs = localStorage.getItem(`budget_fab_configs_${projectId}`);
      setFabricationConfigs(savedFabConfigs ? JSON.parse(savedFabConfigs) : {});
      
      // Reload material tax overrides
      const savedTaxOverrides = localStorage.getItem(`budget_tax_overrides_${projectId}`);
      setMaterialTaxOverrides(savedTaxOverrides ? JSON.parse(savedTaxOverrides) : {});
      
      // Reload LRCN settings
      const savedLrcnEnabled = localStorage.getItem(`budget_lrcn_enabled_${projectId}`);
      setLrcnEnabled(savedLrcnEnabled === 'true');

      // Reload Fab LRCN
      const savedFabLrcnEnabled = localStorage.getItem(`budget_fab_lrcn_enabled_${projectId}`);
      setFabLrcnEnabled(savedFabLrcnEnabled === null ? true : savedFabLrcnEnabled === 'true');
      
      const savedBidRates = localStorage.getItem(`budget_bid_rates_${projectId}`);
      setBidRates(savedBidRates ? JSON.parse(savedBidRates) : {
        straightTime: { hours: 0, rate: '92.03' },
        shiftTime: { hours: 0, rate: '95.70' },
        overtime: { hours: 0, rate: '121.57' },
        doubleTime: { hours: 0, rate: '145.38' },
        shop: { hours: 0, rate: '0' }
      });
      
      const savedBudgetRate = localStorage.getItem(`budget_rate_${projectId}`);
      setBudgetRate(savedBudgetRate ? parseFloat(savedBudgetRate) : 85);

      // Reload fab code map
      const savedFabCodeMap = localStorage.getItem(`budget_fab_code_map_${projectId}`);
      setFabCodeMap(savedFabCodeMap ? { ...DEFAULT_FAB_CODE_MAP, ...JSON.parse(savedFabCodeMap) } : { ...DEFAULT_FAB_CODE_MAP });

      // Reload fab rates
      const savedFabRates = localStorage.getItem(`budget_fab_rates_${projectId}`);
      setFabRates(savedFabRates ? JSON.parse(savedFabRates) : {});

      // Reload custom fab codes
      const savedCustomFabCodes = localStorage.getItem(`budget_custom_fab_codes_${projectId}`);
      setCustomFabCodes(savedCustomFabCodes ? JSON.parse(savedCustomFabCodes) : {});
      
      setPrevProjectId(projectId);
    }
  }, [projectId, prevProjectId]);

  // Persist settings to localStorage - only save if projectId is not 'default'
  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_zip_${projectId}`, jobsiteZipCode);
    }
  }, [jobsiteZipCode, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      if (customTaxRate !== null) {
        localStorage.setItem(`budget_taxrate_${projectId}`, customTaxRate.toString());
      } else {
        localStorage.removeItem(`budget_taxrate_${projectId}`);
      }
    }
  }, [customTaxRate, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_foreman_enabled_${projectId}`, foremanBonusEnabled.toString());
    }
  }, [foremanBonusEnabled, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_foreman_pct_${projectId}`, foremanBonusPercent.toString());
    }
  }, [foremanBonusPercent, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_fab_configs_${projectId}`, JSON.stringify(fabricationConfigs));
    }
  }, [fabricationConfigs, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_tax_overrides_${projectId}`, JSON.stringify(materialTaxOverrides));
    }
  }, [materialTaxOverrides, projectId]);

  // LRCN persistence
  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_lrcn_enabled_${projectId}`, lrcnEnabled.toString());
    }
  }, [lrcnEnabled, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_bid_rates_${projectId}`, JSON.stringify(bidRates));
    }
  }, [bidRates, projectId]);

  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_rate_${projectId}`, budgetRate.toString());
    }
  }, [budgetRate, projectId]);

  // Persist fabCodeMap
  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_fab_code_map_${projectId}`, JSON.stringify(fabCodeMap));
    }
  }, [fabCodeMap, projectId]);

  // Persist fabRates
  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_fab_rates_${projectId}`, JSON.stringify(fabRates));
    }
  }, [fabRates, projectId]);

  // Persist fabLrcnEnabled
  useEffect(() => {
    if (projectId !== 'default') {
      localStorage.setItem(`budget_fab_lrcn_enabled_${projectId}`, fabLrcnEnabled.toString());
    }
  }, [fabLrcnEnabled, projectId]);

  // One-time migration: convert full-code keys (e.g. "BA 0000 DWTR") to cost-head-only keys ("DWTR")
  useEffect(() => {
    const migrateStorageKey = (storageKey: string) => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const needsMigration = Object.keys(parsed).some(k => k.includes(' '));
        if (!needsMigration) return;
        const migrated: Record<string, unknown> = {};
        Object.entries(parsed).forEach(([key, value]) => {
          const parts = key.trim().split(/\s+/);
          const costHead = parts[parts.length - 1];
          migrated[costHead] = value;
        });
        localStorage.setItem(storageKey, JSON.stringify(migrated));
        // Also update in-memory state
        if (storageKey === `budget_fab_configs_${projectId}`) {
          setFabricationConfigs(migrated as Record<string, FabricationConfig>);
        }
      } catch {
        // Silent
      }
    };
    migrateStorageKey(`budget_fab_configs_${projectId}`);
    migrateStorageKey(`budget_tax_overrides_${projectId}`);
  }, [projectId]);

  // Aggregate laborSummary by cost head (last segment of full code)
  const groupedByCostHead = useMemo(() => {
    const grouped: Record<string, {
      costHead: string;
      description: string;
      totalHours: number;
      totalDollars: number;
      fullCodes: string[];
    }> = {};

    Object.entries(laborSummary).forEach(([fullCode, data]) => {
      const parts = fullCode.trim().split(/\s+/);
      const costHead = parts[parts.length - 1];

      if (!grouped[costHead]) {
        grouped[costHead] = {
          costHead,
          description: data.description || costHead,
          totalHours: 0,
          totalDollars: 0,
          fullCodes: [],
        };
      }
      grouped[costHead].totalHours += data.fieldHours || 0;
      grouped[costHead].totalDollars += (data.fieldHours || 0) * (data.rate || 0);
      grouped[costHead].fullCodes.push(fullCode);
    });

    return grouped;
  }, [laborSummary]);

  const taxInfo = useMemo(() => {
    if (customTaxRate !== null) {
      return { rate: customTaxRate, jurisdiction: 'Custom Rate' };
    }
    if (jobsiteZipCode && jobsiteZipCode.length === 5) {
      return getTaxRateByZip(jobsiteZipCode);
    }
    return { rate: 7.25, jurisdiction: 'Enter ZIP Code' };
  }, [jobsiteZipCode, customTaxRate]);

  // LRCN calculations
  const lrcnCalculations = useMemo(() => {
    const parseRate = (rate: string) => parseFloat(rate) || 0;
    
    const straightTotal = bidRates.straightTime.hours * parseRate(bidRates.straightTime.rate);
    const shiftTotal = bidRates.shiftTime.hours * parseRate(bidRates.shiftTime.rate);
    const overtimeTotal = bidRates.overtime.hours * parseRate(bidRates.overtime.rate);
    const doubleTimeTotal = bidRates.doubleTime.hours * parseRate(bidRates.doubleTime.rate);
    const shopTotal = bidRates.shop.hours * parseRate(bidRates.shop.rate);
    
    const bidTotal = straightTotal + shiftTotal + overtimeTotal + doubleTimeTotal + shopTotal;
    const fieldHours = bidRates.straightTime.hours + bidRates.shiftTime.hours +
                       bidRates.overtime.hours + bidRates.doubleTime.hours;
    const shopHours = bidRates.shop.hours;
    const shopRate = parseRate(bidRates.shop.rate);
    const totalHours = fieldHours + shopHours;
    const budgetTotal = (fieldHours * budgetRate) + (shopHours * shopRate);
    const lrcnAmount = bidTotal - budgetTotal;
    
    return {
      bidTotal,
      budgetTotal,
      lrcnAmount,
      totalHours,
      fieldHours,
      shopHours,
      shopRate,
      straightTotal,
      shiftTotal,
      overtimeTotal,
      doubleTimeTotal,
      shopTotal
    };
  }, [bidRates, budgetRate]);

  // computedBidLaborRate — field hours only, no shop
  const computedBidLaborRate = useMemo(() => {
    const fieldHours =
      (parseFloat(String(bidRates.straightTime.hours)) || 0) +
      (parseFloat(String(bidRates.shiftTime.hours)) || 0) +
      (parseFloat(String(bidRates.overtime.hours)) || 0) +
      (parseFloat(String(bidRates.doubleTime.hours)) || 0);

    if (!lrcnEnabled || fieldHours <= 0) return bidLaborRate; // fallback

    const fieldDollars =
      lrcnCalculations.straightTotal +
      lrcnCalculations.shiftTotal +
      lrcnCalculations.overtimeTotal +
      lrcnCalculations.doubleTimeTotal;

    return fieldDollars / fieldHours;
  }, [bidRates, lrcnCalculations, lrcnEnabled, bidLaborRate]);

  // shopRate — for fab codes only
  const shopRate = useMemo(() => {
    return parseFloat(String(bidRates.shop?.rate)) || bidLaborRate;
  }, [bidRates.shop?.rate, bidLaborRate]);

  const calculations = useMemo(() => {
    const originalTotalHours = Object.values(laborSummary)
      .reduce((sum, item) => sum + (item.fieldHours || 0), 0);

    const foremanBonusHours = foremanBonusEnabled 
      ? originalTotalHours * (foremanBonusPercent / 100) 
      : 0;
    const foremanBonusDollars = foremanBonusHours * computedBidLaborRate;

    const hoursAfterForemanStrip = originalTotalHours - foremanBonusHours;
    const foremanStripRatio = originalTotalHours > 0 ? hoursAfterForemanStrip / originalTotalHours : 1;

    const fabricationSummary: BudgetAdjustments['fabricationSummary'] = [];
    const adjustedLaborSummary: BudgetAdjustments['adjustedLaborSummary'] = {};

    let totalFieldHours = 0;
    let totalFabHours = 0;

    // Accumulate fab hours by material cost head before assembling codes
    const fabAccumulator: Record<string, { hours: number }> = {};

    Object.entries(laborSummary).forEach(([code, data]) => {
      const hoursAfterForeman = (data.fieldHours || 0) * foremanStripRatio;
      // Look up fab config by cost head (last segment)
      const parts = code.trim().split(/\s+/);
      const costHead = parts[parts.length - 1];
      const fabConfig = fabricationConfigs[costHead];
      const fabEnabled = fabConfig?.enabled || false;
      const fabPercent = fabConfig?.percentage || 0;

      if (fabEnabled && fabPercent > 0) {
        const fabHours = hoursAfterForeman * (fabPercent / 100);
        const fieldHours = hoursAfterForeman - fabHours;

        adjustedLaborSummary[code] = {
          code,
          description: data.description,
          hours: fieldHours,
          rate: data.rate || computedBidLaborRate,
          dollars: fieldHours * (data.rate || computedBidLaborRate),
          type: 'field'
        };

        // Accumulate into material fab bucket using the routing map
        const fabCostHead = fabCodeMap[costHead];
        if (fabCostHead) {
          fabAccumulator[fabCostHead] = {
            hours: (fabAccumulator[fabCostHead]?.hours || 0) + fabHours,
          };
        } else {
          console.warn(`No fab material mapping defined for cost head: ${costHead}`);
        }

        fabricationSummary.push({
          code,
          description: data.description,
          fabCode: fabCostHead ? `${FAB_SECTION} ${FAB_ACTIVITY} ${fabCostHead}` : `FP ???? ${costHead}`,
          strippedHours: fabHours,
          remainingFieldHours: fieldHours
        });

        totalFieldHours += fieldHours;
        totalFabHours += fabHours;
      } else {
        adjustedLaborSummary[code] = {
          code,
          description: data.description,
          hours: hoursAfterForeman,
          rate: data.rate || computedBidLaborRate,
          dollars: hoursAfterForeman * (data.rate || computedBidLaborRate),
          type: 'field'
        };
        totalFieldHours += hoursAfterForeman;
      }
    });

    // Insert one properly assembled fab code per material type
    // e.g. "FP 0000 COPR", "FP 0000 CSTF", "FP 0000 HFBS"
    const generatedFabCodes: Record<string, number> = {};
    Object.entries(fabAccumulator).forEach(([fabCostHead, { hours }]) => {
      const assembledCode = `${FAB_SECTION} ${FAB_ACTIVITY} ${fabCostHead}`;
      const fabBudgetRate = parseFloat(fabRates[fabCostHead]?.budgetRate) || shopRate;
      adjustedLaborSummary[assembledCode] = {
        code: assembledCode,
        description: FAB_COST_HEAD_DESCRIPTIONS[fabCostHead] || customFabCodes[fabCostHead] || `FABRICATION - ${fabCostHead}`,
        hours,
        rate: fabBudgetRate,
        dollars: hours * fabBudgetRate,
        type: 'fab',
      };
      generatedFabCodes[fabCostHead] = hours;
    });

    // Note: FCNT (Foreman Contingency) is now a MATERIAL line item, not labor
    // It appears in the Material Breakdown section of the export

    const totalLaborDollars = Object.values(adjustedLaborSummary)
      .reduce((sum, item) => sum + item.dollars, 0);

    const materialTaxSummary: BudgetAdjustments['materialTaxSummary'] = [];
    let totalMaterialTax = 0;
    let totalMaterialPreTax = 0;

    Object.entries(materialSummary).forEach(([code, data]) => {
      const amount = data.amount || 0;
      const isTaxable = materialTaxOverrides[code] !== undefined
        ? materialTaxOverrides[code]
        : TAXABLE_MATERIAL_CODES.includes(code);
      const taxAmount = isTaxable ? amount * (taxInfo.rate / 100) : 0;

      materialTaxSummary.push({
        code,
        description: data.description,
        amount,
        taxable: isTaxable,
        taxAmount
      });

      totalMaterialPreTax += amount;
      totalMaterialTax += taxAmount;
    });

    const totalMaterialWithTax = totalMaterialPreTax + totalMaterialTax;

    return {
      foremanBonusHours,
      foremanBonusDollars,
      fabricationSummary,
      adjustedLaborSummary,
      totalFieldHours,
      totalFabHours,
      totalLaborDollars,
      materialTaxSummary,
      totalMaterialTax,
      totalMaterialWithTax,
      totalMaterialPreTax,
      generatedFabCodes
    };
  }, [laborSummary, materialSummary, foremanBonusEnabled, foremanBonusPercent, fabricationConfigs, materialTaxOverrides, taxInfo, computedBidLaborRate, shopRate, fabCodeMap, fabRates]);

  // Fab LRCN calculations
  const fabLrcnCalculations = useMemo(() => {
    let fabLrcnAmount = 0;
    const breakdown: Array<{ code: string; hours: number; bidRate: number; budgetRate: number; diff: number }> = [];
    Object.entries(calculations.generatedFabCodes || {}).forEach(([fabCostHead, hours]) => {
      const bidRate = parseFloat(fabRates[fabCostHead]?.bidRate) || shopRate;
      const budgetRate = parseFloat(fabRates[fabCostHead]?.budgetRate) || bidRate;
      const diff = (hours * bidRate) - (hours * budgetRate);
      fabLrcnAmount += diff;
      breakdown.push({ code: fabCostHead, hours, bidRate, budgetRate, diff });
    });
    return { fabLrcnAmount, breakdown };
  }, [calculations.generatedFabCodes, fabRates, shopRate]);

  useEffect(() => {
    onAdjustmentsChange({
      jobsiteZipCode,
      taxRate: taxInfo.rate,
      taxJurisdiction: taxInfo.jurisdiction,
      foremanBonusEnabled,
      foremanBonusPercent,
      foremanBonusHours: calculations.foremanBonusHours,
      foremanBonusDollars: calculations.foremanBonusDollars,
      fabricationConfigs,
      fabricationSummary: calculations.fabricationSummary,
      materialTaxOverrides,
      materialTaxSummary: calculations.materialTaxSummary,
      totalMaterialTax: calculations.totalMaterialTax,
      adjustedLaborSummary: calculations.adjustedLaborSummary,
      totalFieldHours: calculations.totalFieldHours,
      totalFabHours: calculations.totalFabHours,
      totalLaborDollars: calculations.totalLaborDollars,
      totalMaterialWithTax: calculations.totalMaterialWithTax,
      totalMaterialPreTax: calculations.totalMaterialPreTax,
      // LRCN fields
      laborRateContingencyEnabled: lrcnEnabled,
      bidRates,
      budgetRate,
      bidTotal: lrcnCalculations.bidTotal,
      budgetTotal: lrcnCalculations.budgetTotal,
      lrcnAmount: lrcnCalculations.lrcnAmount,
      // Fab LRCN fields
      fabRates: Object.fromEntries(Object.entries(fabRates).map(([k, v]) => [k, { bidRate: parseFloat(v.bidRate) || shopRate, budgetRate: parseFloat(v.budgetRate) || shopRate }])),
      fabLrcnAmount: fabLrcnCalculations.fabLrcnAmount,
      fabLrcnEnabled,
      // Computed rates
      computedBidLaborRate,
      shopRate,
    });
  }, [calculations, lrcnCalculations, fabLrcnCalculations, jobsiteZipCode, taxInfo, foremanBonusEnabled, foremanBonusPercent, fabricationConfigs, materialTaxOverrides, lrcnEnabled, bidRates, budgetRate, computedBidLaborRate, shopRate, fabRates, fabLrcnEnabled, onAdjustmentsChange]);

  const toggleFabForCode = (code: string, enabled: boolean) => {
    setFabricationConfigs(prev => ({
      ...prev,
      [code]: { enabled, percentage: prev[code]?.percentage || 15 }
    }));
  };

  const setFabPercentForCode = (code: string, percentage: number) => {
    setFabricationConfigs(prev => ({
      ...prev,
      [code]: { enabled: prev[code]?.enabled || false, percentage }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Project Location & Sales Tax */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-blue-500" />
            Project Location & Sales Tax
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="zipcode">Jobsite ZIP Code</Label>
              <Input
                id="zipcode"
                placeholder="e.g., 90802"
                value={jobsiteZipCode}
                onChange={(e) => setJobsiteZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Tax Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="15"
                  value={customTaxRate ?? taxInfo.rate}
                  onChange={(e) => setCustomTaxRate(parseFloat(e.target.value) || null)}
                  className="font-mono"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label>Jurisdiction</Label>
              <div className="h-10 flex items-center px-3 bg-muted rounded-md border text-sm">
                {taxInfo.jurisdiction}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <span className="text-blue-800 dark:text-blue-200 font-medium">Total Material (Pre-Tax)</span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100">
                ${calculations.totalMaterialPreTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-blue-700 dark:text-blue-300">Sales Tax ({taxInfo.rate}%)</span>
              <span className="font-mono text-blue-800 dark:text-blue-200">
                +${calculations.totalMaterialTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="text-blue-900 dark:text-blue-100 font-bold">Total Material (With Tax)</span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100 text-lg">
                ${calculations.totalMaterialWithTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foreman Field Bonus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-amber-500" />
            Foreman Field Bonus Strip
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Strips a percentage of total field hours to fund foreman incentive bonus.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={foremanBonusEnabled} onCheckedChange={setForemanBonusEnabled} />
              <span className={foremanBonusEnabled ? 'text-foreground' : 'text-muted-foreground'}>
                Enable Foreman Bonus Strip
              </span>
            </div>

            {foremanBonusEnabled && (
              <div className="flex items-center gap-3">
                <Label>Strip Percentage:</Label>
                <div className="flex items-center gap-2 w-32">
                  <Slider
                    value={[foremanBonusPercent]}
                    onValueChange={([val]) => setForemanBonusPercent(val)}
                    min={0.5}
                    max={3}
                    step={0.25}
                    className="w-20"
                  />
                  <span className="font-mono font-bold text-amber-600 w-12">{foremanBonusPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {foremanBonusEnabled && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Hours Stripped</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    {calculations.foremanBonusHours?.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Rate</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    ${bidLaborRate.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Foreman Bonus Value</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    ${calculations.foremanBonusDollars?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Labor Rate Contingency (LRCN) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-teal-500" />
            Labor Rate Contingency (LRCN)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Calculate the difference between bid labor rates and budget rate. The contingency is added to material code LRCN.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={lrcnEnabled} onCheckedChange={setLrcnEnabled} />
            <span className={lrcnEnabled ? 'text-foreground' : 'text-muted-foreground'}>
              Enable Labor Rate Contingency
            </span>
          </div>

          {lrcnEnabled && (
            <>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Bid Labor Breakdown</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Labor Type</TableHead>
                      <TableHead className="text-right w-28">Hours</TableHead>
                      <TableHead className="text-right w-32">Rate ($/hr)</TableHead>
                      <TableHead className="text-right w-32">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Straight Time</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={bidRates.straightTime.hours || ''}
                          onChange={(e) => setBidRates(prev => ({
                            ...prev,
                            straightTime: { ...prev.straightTime, hours: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-24 text-right font-mono"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          inputMode="decimal"
                          value={bidRates.straightTime.rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setBidRates(prev => ({
                                ...prev,
                                straightTime: { ...prev.straightTime, rate: val }
                              }));
                            }
                          }}
                          className="w-28 text-right font-mono"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${lrcnCalculations.straightTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Shift Time</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={bidRates.shiftTime.hours || ''}
                          onChange={(e) => setBidRates(prev => ({
                            ...prev,
                            shiftTime: { ...prev.shiftTime, hours: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-24 text-right font-mono"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          inputMode="decimal"
                          value={bidRates.shiftTime.rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setBidRates(prev => ({
                                ...prev,
                                shiftTime: { ...prev.shiftTime, rate: val }
                              }));
                            }
                          }}
                          className="w-28 text-right font-mono"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${lrcnCalculations.shiftTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overtime</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={bidRates.overtime.hours || ''}
                          onChange={(e) => setBidRates(prev => ({
                            ...prev,
                            overtime: { ...prev.overtime, hours: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-24 text-right font-mono"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          inputMode="decimal"
                          value={bidRates.overtime.rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setBidRates(prev => ({
                                ...prev,
                                overtime: { ...prev.overtime, rate: val }
                              }));
                            }
                          }}
                          className="w-28 text-right font-mono"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${lrcnCalculations.overtimeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Double Time</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={bidRates.doubleTime.hours || ''}
                          onChange={(e) => setBidRates(prev => ({
                            ...prev,
                            doubleTime: { ...prev.doubleTime, hours: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-24 text-right font-mono"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          inputMode="decimal"
                          value={bidRates.doubleTime.rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setBidRates(prev => ({
                                ...prev,
                                doubleTime: { ...prev.doubleTime, rate: val }
                              }));
                            }
                          }}
                          className="w-28 text-right font-mono"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${lrcnCalculations.doubleTimeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Shop</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={bidRates.shop.hours || ''}
                          onChange={(e) => setBidRates(prev => ({
                            ...prev,
                            shop: { ...prev.shop, hours: parseFloat(e.target.value) || 0 }
                          }))}
                          className="w-24 text-right font-mono"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          inputMode="decimal"
                          value={bidRates.shop.rate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setBidRates(prev => ({
                                ...prev,
                                shop: { ...prev.shop, rate: val }
                              }));
                            }
                          }}
                          className="w-28 text-right font-mono"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        ${lrcnCalculations.shopTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 font-bold bg-muted/50">
                      <TableCell>BID TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{lrcnCalculations.totalHours.toLocaleString()}</TableCell>
                      <TableCell className="text-right"></TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        ${lrcnCalculations.bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="budgetRate">Budget Rate ($/hr)</Label>
                  <Input
                    id="budgetRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetRate}
                    onChange={(e) => setBudgetRate(parseFloat(e.target.value) || 0)}
                    className="font-mono text-lg"
                  />
                  <p className="text-xs text-muted-foreground">Single blended rate for budgeting</p>
                </div>
                <div className="space-y-2">
                  <Label>Budget Total</Label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md border font-mono text-lg">
                    ${lrcnCalculations.budgetTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">Field: {lrcnCalculations.fieldHours.toLocaleString()} hrs × ${budgetRate.toFixed(2)} + Shop: {lrcnCalculations.shopHours.toLocaleString()} hrs × ${lrcnCalculations.shopRate.toFixed(2)}</p>
                </div>
              </div>

              {/* LRCN Audit Breakdown Table */}
              {(() => {
                const parseRate = (rate: string) => parseFloat(rate) || 0;
                const auditRows = [
                  { label: 'Straight Time', hours: bidRates.straightTime.hours, bidRate: parseRate(bidRates.straightTime.rate), budgetRateVal: budgetRate },
                  { label: 'Shift Time', hours: bidRates.shiftTime.hours, bidRate: parseRate(bidRates.shiftTime.rate), budgetRateVal: budgetRate },
                  { label: 'Overtime', hours: bidRates.overtime.hours, bidRate: parseRate(bidRates.overtime.rate), budgetRateVal: budgetRate },
                  { label: 'Double Time', hours: bidRates.doubleTime.hours, bidRate: parseRate(bidRates.doubleTime.rate), budgetRateVal: budgetRate },
                  { label: 'Shop', hours: bidRates.shop.hours, bidRate: parseRate(bidRates.shop.rate), budgetRateVal: lrcnCalculations.shopRate },
                ];
                const totalBid = auditRows.reduce((s, r) => s + r.hours * r.bidRate, 0);
                const totalBudget = auditRows.reduce((s, r) => s + r.hours * r.budgetRateVal, 0);
                const totalDelta = totalBid - totalBudget;
                const totalHours = auditRows.reduce((s, r) => s + r.hours, 0);
                const deltaColor = (d: number) => d > 0.005 ? 'text-emerald-600 dark:text-emerald-400' : d < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
                const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                return (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">LRCN Audit Breakdown</div>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">Labor Type</TableHead>
                            <TableHead className="text-xs text-right">Hours</TableHead>
                            <TableHead className="text-xs text-right">Bid Rate</TableHead>
                            <TableHead className="text-xs text-right">Bid $</TableHead>
                            <TableHead className="text-xs text-right bg-primary/5">Budget Rate</TableHead>
                            <TableHead className="text-xs text-right bg-primary/5">Budget $</TableHead>
                            <TableHead className="text-xs text-right">Delta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditRows.map((row) => {
                            const bidDollars = row.hours * row.bidRate;
                            const budgetDollars = row.hours * row.budgetRateVal;
                            const delta = bidDollars - budgetDollars;
                            return (
                              <TableRow key={row.label}>
                                <TableCell className="text-xs font-medium py-2">{row.label}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2">{row.hours.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2">${row.bidRate.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2">{fmt(bidDollars)}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2 bg-primary/5">${row.budgetRateVal.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2 bg-primary/5">{fmt(budgetDollars)}</TableCell>
                                <TableCell className={`text-xs text-right font-mono font-semibold py-2 ${deltaColor(delta)}`}>{fmt(delta)}</TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="border-t-2 font-bold bg-muted/50">
                            <TableCell className="text-xs font-bold py-2">TOTALS</TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold py-2">{totalHours.toLocaleString()}</TableCell>
                            <TableCell className="py-2"></TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold py-2">{fmt(totalBid)}</TableCell>
                            <TableCell className="py-2 bg-primary/5"></TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold py-2 bg-primary/5">{fmt(totalBudget)}</TableCell>
                            <TableCell className={`text-xs text-right font-mono font-bold py-2 ${deltaColor(totalDelta)}`}>{fmt(totalDelta)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}

              <div className={`rounded-lg p-4 border ${lrcnCalculations.lrcnAmount >= 0 ? 'bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm ${lrcnCalculations.lrcnAmount >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-300'}`}>
                      Labor Rate Contingency (LRCN)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Bid Total - Budget Total = LRCN
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-bold text-2xl ${lrcnCalculations.lrcnAmount >= 0 ? 'text-teal-700 dark:text-teal-200' : 'text-red-700 dark:text-red-200'}`}>
                      ${lrcnCalculations.lrcnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    {lrcnCalculations.lrcnAmount >= 0 && (
                      <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                        → Material Code LRCN
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Fabrication Hours Strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-purple-500" />
            Fabrication Hours Strip
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>For jobs with shop fabrication, strip a percentage of field hours to create separate fabrication budget codes.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">FAB</TableHead>
                  <TableHead>Cost Head</TableHead>
                  <TableHead className="text-right">Original Hours</TableHead>
                  {foremanBonusEnabled && (
                    <>
                      <TableHead className="text-center bg-amber-50 dark:bg-amber-950">Foreman Strip %</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950">Foreman Hrs</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950">After Foreman</TableHead>
                    </>
                  )}
                  <TableHead className="text-center bg-purple-50 dark:bg-purple-950 w-24">Fab Strip %</TableHead>
                  <TableHead className="text-right bg-purple-50 dark:bg-purple-950">Fab Hours</TableHead>
                  <TableHead className="text-right font-bold">Final Field Hrs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedByCostHead)
                  .sort((a, b) => b[1].totalHours - a[1].totalHours)
                  .map(([costHead, group]) => {
                    const fabConfig = fabricationConfigs[costHead];
                    const isEnabled = fabConfig?.enabled || false;
                    const fabPercent = fabConfig?.percentage || 15;

                    const originalHours = group.totalHours;
                    const foremanStripHours = foremanBonusEnabled ? originalHours * (foremanBonusPercent / 100) : 0;
                    const hoursAfterForeman = originalHours - foremanStripHours;
                    const fabHours = isEnabled ? hoursAfterForeman * (fabPercent / 100) : 0;
                    const finalFieldHours = hoursAfterForeman - fabHours;

                    return (
                      <TableRow key={costHead} className={isEnabled ? 'bg-purple-50/30 dark:bg-purple-950/30' : ''}>
                        <TableCell>
                          <Switch checked={isEnabled} onCheckedChange={(checked) => toggleFabForCode(costHead, checked)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm font-semibold">{costHead}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {group.description}
                            <span className="ml-1 opacity-50">({group.fullCodes.length} code{group.fullCodes.length > 1 ? 's' : ''})</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{originalHours.toFixed(1)}</TableCell>
                        {foremanBonusEnabled && (
                          <>
                            <TableCell className="text-center font-mono text-amber-600 bg-amber-50/50 dark:bg-amber-950/50">
                              {foremanBonusPercent}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-amber-600 bg-amber-50/50 dark:bg-amber-950/50">
                              -{foremanStripHours.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono bg-amber-50/50 dark:bg-amber-950/50">
                              {hoursAfterForeman.toFixed(1)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="bg-purple-50/50 dark:bg-purple-950/50">
                          {isEnabled ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                max="50"
                                value={fabPercent}
                                onChange={(e) => setFabPercentForCode(costHead, parseInt(e.target.value) || 15)}
                                className="w-14 h-7 text-center font-mono text-sm"
                              />
                              <span className="text-muted-foreground text-xs">%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-center block">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-purple-600 bg-purple-50/50 dark:bg-purple-950/50">
                          {isEnabled ? `-${fabHours.toFixed(1)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">
                          {finalFieldHours.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {/* Fab Material Routing Table */}
          {Object.keys(groupedByCostHead).some(h => fabricationConfigs[h]?.enabled) && (
            <details className="mt-4">
              <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground select-none">
                ⚙ Fab Material Routing
                <span className="ml-2 text-xs text-orange-500">
                  ({Object.keys(
                    Object.entries(groupedByCostHead)
                      .filter(([costHead]) => fabricationConfigs[costHead]?.enabled)
                      .reduce((acc, [costHead]) => {
                        const fabCostHead = fabCodeMap[costHead];
                        if (fabCostHead) acc[fabCostHead] = true;
                        return acc;
                      }, {} as Record<string, boolean>)
                  ).length} fab codes will be generated)
                </span>
              </summary>

              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Cost Head</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Fab Hrs Stripped</TableHead>
                      <TableHead>Routes To</TableHead>
                      <TableHead className="text-right">Bid Rate ($/hr)</TableHead>
                      <TableHead className="text-right">Budget Rate ($/hr)</TableHead>
                      <TableHead className="text-center w-16">Reset</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupedByCostHead)
                      .filter(([costHead]) => fabricationConfigs[costHead]?.enabled)
                      .sort((a, b) => b[1].totalHours - a[1].totalHours)
                      .map(([costHead, group]) => {
                        const config = fabricationConfigs[costHead] || { percentage: 15 };
                        const originalHours = group.totalHours;
                        const foremanStripHours = foremanBonusEnabled ? originalHours * (foremanBonusPercent / 100) : 0;
                        const hoursAfterForeman = originalHours - foremanStripHours;
                        const fabHours = hoursAfterForeman * ((config.percentage || 15) / 100);
                        const currentFabCostHead = fabCodeMap[costHead] || '';
                        const assembledCode = currentFabCostHead
                          ? `${FAB_SECTION} ${FAB_ACTIVITY} ${currentFabCostHead}`
                          : '—';

                        return (
                          <TableRow key={costHead}>
                            <TableCell className="font-mono font-semibold text-blue-500">
                              {costHead}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {group.description}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono text-orange-500">{fabHours.toFixed(1)} hrs</span>
                              <div className="text-xs text-muted-foreground">→ {assembledCode}</div>
                            </TableCell>
                            <TableCell>
                              <select
                                value={currentFabCostHead}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomFabEntry({ costHead, code: '', desc: '' });
                                  } else {
                                    setFabCodeMap(prev => ({ ...prev, [costHead]: e.target.value }));
                                  }
                                }}
                                className="bg-background border border-border rounded px-2 py-1 text-sm font-mono w-full"
                              >
                                <option value="">-- No Fab Code --</option>
                                <option value="COPR">FP 0000 COPR — Copper</option>
                                <option value="CSTF">FP 0000 CSTF — Cast Iron</option>
                                <option value="CRBN">FP 0000 CRBN — Carbon Steel</option>
                                <option value="SSTL">FP 0000 SSTL — Stainless Steel</option>
                                <option value="SS10">FP 0000 SS10 — Stainless 10GA</option>
                                <option value="PLST">FP 0000 PLST — Plastic / CPVC</option>
                                <option value="BRAZ">FP 0000 BRAZ — Brazed</option>
                                <option value="HFBS">FP 0000 HFBS — Hanger Fab Sheets</option>
                                {Object.entries(customFabCodes).map(([code, desc]) => (
                                  <option key={code} value={code}>FP 0000 {code} — {desc}</option>
                                ))}
                                <option value="__custom__">+ Add Custom Code...</option>
                              </select>
                              {customFabEntry?.costHead === costHead && (
                                <div className="flex gap-2 mt-2 items-center">
                                  <Input placeholder="Code (4 chars)" maxLength={4}
                                    value={customFabEntry?.code || ''}
                                    onChange={e => setCustomFabEntry(prev => prev ? { ...prev, code: e.target.value.toUpperCase() } : null)}
                                    className="w-[90px] h-8 font-mono text-sm" />
                                  <Input placeholder="Description"
                                    value={customFabEntry?.desc || ''}
                                    onChange={e => setCustomFabEntry(prev => prev ? { ...prev, desc: e.target.value } : null)}
                                    className="w-[200px] h-8 text-sm" />
                                  <Button size="sm" onClick={() => {
                                    if (customFabEntry?.code?.length === 4 && customFabEntry.desc) {
                                      setCustomFabCodes(prev => ({ ...prev, [customFabEntry.code]: customFabEntry.desc.toUpperCase() }));
                                      setFabCodeMap(prev => ({ ...prev, [customFabEntry.costHead]: customFabEntry.code }));
                                      setCustomFabEntry(null);
                                    }
                                  }}>Add</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setCustomFabEntry(null)}>Cancel</Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 text-right font-mono text-sm h-8 ml-auto"
                                value={fabRates[currentFabCostHead]?.bidRate ?? shopRate.toFixed(2)}
                                onChange={(e) =>
                                  setFabRates(prev => ({
                                    ...prev,
                                    [currentFabCostHead]: {
                                      ...prev[currentFabCostHead],
                                      bidRate: e.target.value,
                                      budgetRate: prev[currentFabCostHead]?.budgetRate ?? e.target.value,
                                    },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 text-right font-mono text-sm h-8 ml-auto"
                                value={fabRates[currentFabCostHead]?.budgetRate ?? fabRates[currentFabCostHead]?.bidRate ?? shopRate.toFixed(2)}
                                onChange={(e) =>
                                  setFabRates(prev => ({
                                    ...prev,
                                    [currentFabCostHead]: {
                                      ...prev[currentFabCostHead],
                                      bidRate: prev[currentFabCostHead]?.bidRate ?? shopRate.toFixed(2),
                                      budgetRate: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() =>
                                  setFabCodeMap(prev => ({
                                    ...prev,
                                    [costHead]: DEFAULT_FAB_CODE_MAP[costHead] || '',
                                  }))
                                }
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                              >
                                Reset
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Generated Fab Code Summary */}
              <div className="mt-3 bg-purple-50 dark:bg-purple-950 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">Generated Fabrication Labor Codes:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    Object.entries(groupedByCostHead)
                      .filter(([costHead]) => fabricationConfigs[costHead]?.enabled)
                      .reduce((acc, [costHead, group]) => {
                        const fabCostHead = fabCodeMap[costHead];
                        if (fabCostHead) {
                          const config = fabricationConfigs[costHead] || { percentage: 15 };
                          const originalHours = group.totalHours;
                          const foremanStripHours = foremanBonusEnabled ? originalHours * (foremanBonusPercent / 100) : 0;
                          const hoursAfterForeman = originalHours - foremanStripHours;
                          const fabHrs = hoursAfterForeman * ((config.percentage || 15) / 100);
                          acc[fabCostHead] = (acc[fabCostHead] || 0) + fabHrs;
                        }
                        return acc;
                      }, {} as Record<string, number>)
                  ).map(([fabCostHead, hours]) => (
                    <div key={fabCostHead} className="bg-background border border-border rounded px-3 py-1.5 text-sm">
                      <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                        {FAB_SECTION} {FAB_ACTIVITY} {fabCostHead}
                      </span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {(hours).toFixed(1)} hrs @ ${(parseFloat(fabRates[fabCostHead]?.budgetRate) || shopRate).toFixed(2)}/hr
                      </span>
                      <span className="ml-1 text-muted-foreground text-xs">
                        — {FAB_COST_HEAD_DESCRIPTIONS[fabCostHead] || customFabCodes[fabCostHead] || fabCostHead}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fab LRCN Toggle & Summary */}
              {fabLrcnCalculations.breakdown.length > 0 && (
                <div className="mt-3 bg-orange-50 dark:bg-orange-950 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      Fab Labor Rate Contingency (MA 0FAB LRCN)
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-muted-foreground">{fabLrcnEnabled ? 'Enabled' : 'Disabled'}</span>
                      <input
                        type="checkbox"
                        checked={fabLrcnEnabled}
                        onChange={(e) => setFabLrcnEnabled(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                  </div>
                  {fabLrcnEnabled && (
                    <>
                      <div className="space-y-1">
                        {fabLrcnCalculations.breakdown.filter(b => b.hours > 0).map(b => (
                          <div key={b.code} className="flex justify-between text-xs font-mono">
                            <span className="text-muted-foreground">
                              {b.code}: {b.hours.toFixed(1)} hrs × (${b.bidRate.toFixed(2)} - ${b.budgetRate.toFixed(2)})
                            </span>
                            <span className={b.diff > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                              ${b.diff.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-orange-200 dark:border-orange-700 text-sm font-semibold">
                        <span className="text-orange-700 dark:text-orange-300">Fab LRCN Total</span>
                        <span className={fabLrcnCalculations.fabLrcnAmount > 0 ? 'text-green-600 font-mono' : 'text-muted-foreground font-mono'}>
                          ${fabLrcnCalculations.fabLrcnAmount.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </details>
          )}

          {calculations.totalFabHours > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-purple-800 dark:text-purple-200 font-medium">Total Field Hours</span>
                <span className="font-mono font-bold text-green-700">{calculations.totalFieldHours?.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-purple-800 dark:text-purple-200 font-medium">Total Fabrication Hours</span>
                <span className="font-mono font-bold text-purple-700">{calculations.totalFabHours?.toFixed(1)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material Tax Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-green-500" />
            Material Tax Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">TAX</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Tax ({taxInfo.rate}%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.materialTaxSummary?.map((item) => (
                <TableRow key={item.code} className={item.taxable ? '' : 'bg-muted/50'}>
                  <TableCell>
                    <Switch
                      checked={item.taxable}
                      onCheckedChange={(checked) => {
                        setMaterialTaxOverrides(prev => ({ ...prev, [item.code]: checked }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600">
                    {item.taxable ? `$${item.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ${(item.amount + item.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Final Budget Summary */}
      <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-800 dark:text-green-200">
            <Calculator className="h-5 w-5" />
            Adjusted Budget Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Labor</h4>
              <div className="flex justify-between text-sm">
                <span>Field Hours</span>
                <span className="font-mono">{calculations.totalFieldHours?.toFixed(1)}</span>
              </div>
              {calculations.totalFabHours > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Fabrication Hours</span>
                  <span className="font-mono">{calculations.totalFabHours?.toFixed(1)}</span>
                </div>
              )}
              {foremanBonusEnabled && (
                <div className="flex justify-between text-sm">
                  <span>Foreman Bonus Hours</span>
                  <span className="font-mono">{calculations.foremanBonusHours?.toFixed(1)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Labor</span>
                <span className="font-mono">
                  ${calculations.totalLaborDollars?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Material</h4>
              <div className="flex justify-between text-sm">
                <span>Material (Pre-Tax)</span>
                <span className="font-mono">
                  ${calculations.totalMaterialPreTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sales Tax ({taxInfo.rate}%)</span>
                <span className="font-mono">
                  ${calculations.totalMaterialTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Material</span>
                <span className="font-mono">
                  ${calculations.totalMaterialWithTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between items-center text-xl">
            <span className="font-bold text-green-900 dark:text-green-100">GRAND TOTAL</span>
            <span className="font-mono font-bold text-green-900 dark:text-green-100">
              ${((calculations.totalLaborDollars || 0) + (calculations.totalMaterialWithTax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetAdjustmentsPanel;
