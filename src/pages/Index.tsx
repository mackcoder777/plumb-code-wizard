import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Complete Standard Cost Codes Database from your file
const STANDARD_COST_CODES = {
  'Field Labor': {
    'NONREIMBURSABLE': [
      { code: 'INJR', description: 'INJURY', units: 'HRS' },
      { code: 'PNCH', description: 'PUNCH LIST', units: 'HRS' }
    ],
    'CHANGE WORK': [
      { code: 'PLMB', description: 'MCE description, plumbing labor', units: 'HRS' },
      { code: 'PIPE', description: 'MCE description, wetside labor', units: 'HRS' },
      { code: 'DUCT', description: 'MCE description, dryside labor', units: 'HRS' },
      { code: 'UNGD', description: 'MCE description, underground labor', units: 'HRS' },
      { code: 'PROC', description: 'MCE description, process labor', units: 'HRS' }
    ],
    'PLUMBING': [
      { code: 'COND', description: 'CONDENSATE', units: 'HRS' },
      { code: 'DRNS', description: 'DRAINS', units: 'HRS' },
      { code: 'DWTR', description: 'DOMESTIC WATER', units: 'HRS' },
      { code: 'FNSH', description: 'FIXTURES', units: 'HRS' },
      { code: 'FUEL', description: 'FUEL OIL', units: 'HRS' },
      { code: 'GRWV', description: 'GREASE WASTE AND VENT', units: 'HRS' },
      { code: 'HNGS', description: 'HANGERS AND SUPPORTS', units: 'HRS' },
      { code: 'IWTR', description: 'INDUSTRIAL WATER', units: 'HRS' },
      { code: 'NGAS', description: 'NATURAL GAS', units: 'HRS' },
      { code: 'PIDV', description: 'PIPE ID AND VALVE TAGS', units: 'HRS' },
      { code: 'RCLM', description: 'RECLAIMED WATER', units: 'HRS' },
      { code: 'SEQP', description: 'EQUIPMENT SETTING', units: 'HRS' },
      { code: 'SNWV', description: 'SANITARY WASTE AND VENT', units: 'HRS' },
      { code: 'STRM', description: 'STORM DRAIN', units: 'HRS' },
      { code: 'SZMC', description: 'SEISMIC', units: 'HRS' },
      { code: 'TRAP', description: 'TRAP PRIMERS', units: 'HRS' },
      { code: 'GRAY', description: 'GRAY WATER', units: 'HRS' }
    ],
    'UNDERGROUND': [
      { code: '10FW', description: '10 INCH FIREWATER', units: 'HRS' },
      { code: '10RW', description: '10IN RECLAIM WATER', units: 'HRS' },
      { code: '10SW', description: '10IN SEWER WATER', units: 'HRS' },
      { code: '10SD', description: '10IN STORM DRAIN', units: 'HRS' },
      { code: '12FW', description: '12 INCH FIREWATER', units: 'HRS' },
      { code: '12RW', description: '12IN RECLAIM WATER', units: 'HRS' },
      { code: '12SW', description: '12IN SEWER WATER', units: 'HRS' },
      { code: '12SD', description: '12IN STORM DRAIN', units: 'HRS' }
    ]
  },
  'GC Labor': {
    'DETAILING': [
      { code: 'ANNO', description: 'ANNOTATION', units: 'HRS' },
      { code: 'ASBL', description: 'AS-BUILTS', units: 'HRS' },
      { code: 'BLBM', description: 'BLUEBEAM PROJECT SET-UP', units: 'HRS' },
      { code: 'COOR', description: 'COORDINATION & REVISIONS', units: 'HRS' }
    ],
    'MANAGEMENT': [
      { code: 'DEMR', description: 'DETAILING MANAGER', units: 'HRS' },
      { code: 'PRMG', description: 'PROJECT MANAGER', units: 'HRS' },
      { code: 'SUPT', description: 'SUPERINTENDENT', units: 'HRS' }
    ]
  },
  'Material': {
    'WARRANTY': [
      { code: 'WRNT', description: 'WARRANTY - OTHER COST', units: 'EA' },
      { code: 'WNTY', description: 'WARRANTY - LABOR', units: 'HRS' }
    ],
    'ALLOWANCES': [
      { code: 'ALOW', description: 'ALLOWANCE', units: 'EA' },
      { code: 'BCNT', description: 'BALANCE OF CONTRACT', units: 'EA' }
    ],
    'PERMITS': [
      { code: 'BOND', description: 'BONDS & PERMITS', units: 'EA' },
      { code: 'INSP', description: 'INSPECTIONS', units: 'EA' }
    ]
  }
};

// Default pattern-based mappings
const DEFAULT_COST_HEAD_MAPPING = {
  'SNWV': {
    patterns: [/^sanitary/i, /waste.*vent/i, /^dwv$/i, /soil/i, /^vent$/i],
    description: 'SANITARY WASTE AND VENT'
  },
  'STRM': {
    patterns: [/storm/i, /overflow.*dr/i, /roof.*drain/i, /rain/i],
    description: 'STORM DRAIN'
  },
  'GRWV': {
    patterns: [/grease/i, /interceptor/i, /grey.*waste/i],
    description: 'GREASE WASTE AND VENT'
  },
  'DWTR': {
    patterns: [/domestic.*water/i, /potable/i, /cold.*water/i, /hot.*water/i, /^water$/i],
    description: 'DOMESTIC WATER'
  },
  'RCLM': {
    patterns: [/reclaim/i, /recycled.*water/i],
    description: 'RECLAIMED WATER'
  },
  'COND': {
    patterns: [/condensate/i, /ac.*drain/i],
    description: 'CONDENSATE'
  },
  'NGAS': {
    patterns: [/natural.*gas/i, /fuel.*gas/i, /^gas$/i],
    description: 'NATURAL GAS'
  },
  'FNSH': {
    patterns: [/fixture/i, /toilet/i, /urinal/i, /lavatory/i, /sink/i, /faucet/i],
    description: 'FIXTURES'
  },
  'HNGS': {
    patterns: [/hanger/i, /support/i, /brace/i, /seismic/i, /strap/i],
    description: 'HANGERS AND SUPPORTS'
  }
};

const FLOOR_MAPPING = {
  '01': [/level.*0?1$/i, /^l1$/i, /floor.*1$/i, /first.*floor/i],
  '02': [/level.*0?2$/i, /^l2$/i, /floor.*2$/i, /second.*floor/i],
  '03': [/level.*0?3$/i, /^l3$/i, /floor.*3$/i, /third.*floor/i],
  'P1': [/level.*p1$/i, /^p1$/i, /parking.*1/i, /basement.*1/i],
  'P2': [/level.*p2$/i, /^p2$/i, /parking.*2/i, /basement.*2/i],
  'P3': [/level.*p3$/i, /^p3$/i, /parking.*3/i, /basement.*3/i]
};

export default function EnhancedCostCodeManager() {
  const [estimateData, setEstimateData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    floor: 'all',
    system: 'all',
    costCode: 'all',
    search: ''
  });
  const [customMappings, setCustomMappings] = useState({});
  const [mappingHistory, setMappingHistory] = useState({});
  const [selectedCostCodeCategory, setSelectedCostCodeCategory] = useState('Field Labor');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [showCostCodeBrowser, setShowCostCodeBrowser] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const fileInputRef = useRef(null);

  // Generate cost code with audit trail
  const generateCostCode = useCallback((item) => {
    let section = '01';
    const floorText = (item.floor || '').toLowerCase().trim();
    
    for (const [code, patterns] of Object.entries(FLOOR_MAPPING)) {
      if (patterns.some(pattern => pattern.test(floorText))) {
        section = code;
        break;
      }
    }
    
    const activity = '0000';
    const systemLower = (item.system || '').toLowerCase().trim();
    
    // Check custom mappings first
    let costHead = customMappings[systemLower] || null;
    let confidence = costHead ? 1.0 : 0;
    let source = costHead ? 'custom' : '';
    
    // If no custom mapping, use pattern matching
    if (!costHead) {
      for (const [code, config] of Object.entries(DEFAULT_COST_HEAD_MAPPING)) {
        if (config.patterns.some(pattern => pattern.test(systemLower))) {
          costHead = code;
          confidence = 0.9;
          source = 'auto-pattern';
          break;
        }
      }
    }
    
    // Default fallback
    if (!costHead) {
      costHead = 'SNWV';
      confidence = 0.5;
      source = 'default';
    }
    
    return {
      code: `${section} ${activity} ${costHead}`,
      section: section,
      activity: activity,
      costHead: costHead,
      confidence: confidence,
      source: source,
      description: DEFAULT_COST_HEAD_MAPPING[costHead]?.description || 
                   Object.values(STANDARD_COST_CODES).flatMap(cat => 
                     Object.values(cat).flat()
                   ).find(c => c.code === costHead)?.description || 'Unknown'
    };
  }, [customMappings]);

  // Enhanced file upload with real progress tracking
  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Reading file...');
    setFileName(file.name);
    
    const startTime = Date.now();
    const fileSize = file.size;
    const estimatedProcessingTime = Math.max(3, fileSize / 100000); // seconds
    setEstimatedTime(`~${Math.ceil(estimatedProcessingTime)}s remaining`);
    
    const reader = new FileReader();
    
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentLoaded = Math.round((event.loaded / event.total) * 30);
        setLoadingProgress(percentLoaded);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = event.loaded / elapsed;
        const remaining = (event.total - event.loaded) / rate;
        setEstimatedTime(`~${Math.ceil(remaining)}s remaining`);
      }
    };
    
    reader.onload = (e) => {
      setLoadingProgress(30);
      setLoadingMessage('Parsing Excel data...');
      
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target.result as ArrayBuffer);
          setLoadingProgress(40);
          setLoadingMessage('Reading worksheets...');
          
          const workbook = XLSX.read(data, { type: 'array' });
          setLoadingProgress(50);
          
          const sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('raw') || 
            name.toLowerCase().includes('data')
          ) || workbook.SheetNames[0];
          
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          
          setLoadingProgress(60);
          setLoadingMessage(`Processing ${jsonData.length} items...`);
          
          // Process in chunks to show progress
          const chunkSize = 100;
          const chunks = [];
          for (let i = 0; i < jsonData.length; i += chunkSize) {
            chunks.push(jsonData.slice(i, i + chunkSize));
          }
          
          let processedData = [];
          let currentChunk = 0;
          
          const processChunk = () => {
            if (currentChunk < chunks.length) {
              const chunk = chunks[currentChunk];
              const chunkData = chunk.map((row, index) => {
                const globalIndex = currentChunk * chunkSize + index;
                const item = {
                  id: globalIndex,
                  drawing: row['D'] || row['Drawing'] || '',
                  system: row['D_1'] || row['System'] || '',
                  floor: row['D_2'] || row['Floor'] || '',
                  zone: row['D_3'] || row['Zone'] || '',
                  materialDesc: row['A'] || row['Material Description'] || '',
                  itemName: row['A_1'] || row['Item Name'] || '',
                  size: row['A_2'] || row['Size'] || '',
                  quantity: parseFloat(row['T'] || row['Quantity'] || 0),
                  materialDollars: parseFloat(row['T_1'] || row['Material Dollars'] || 0),
                  hours: parseFloat(row['T_3'] || row['Hours'] || 0),
                  laborDollars: parseFloat(row['T_4'] || row['Labor Dollars'] || 0),
                  costCode: '',
                  suggestedCode: null
                };
                
                item.suggestedCode = generateCostCode(item);
                return item;
              });
              
              processedData = [...processedData, ...chunkData];
              currentChunk++;
              
              const progress = 60 + Math.round((currentChunk / chunks.length) * 30);
              setLoadingProgress(progress);
              setLoadingMessage(`Processing items ${currentChunk * chunkSize} of ${jsonData.length}...`);
              
              // Process next chunk
              setTimeout(processChunk, 10);
            } else {
              // All chunks processed
              setLoadingProgress(95);
              setLoadingMessage('Finalizing...');
              
              // Initialize mappings and history
              const uniqueSystems = [...new Set(processedData.map(item => item.system.toLowerCase().trim()))].filter(Boolean);
              const initialMappings = {};
              const initialHistory = {};
              
              uniqueSystems.forEach(system => {
                // Auto-detect initial mapping
                const testItem = { system };
                const suggested = generateCostCode(testItem);
                
                // Pre-populate obvious mappings
                if (system.includes('storm') || system.includes('overflow')) {
                  initialMappings[system] = 'STRM';
                  initialHistory[system] = [{
                    timestamp: new Date().toISOString(),
                    user: 'system',
                    from: suggested.costHead,
                    to: 'STRM',
                    reason: 'Auto-detected storm/overflow drain'
                  }];
                } else if (suggested.source === 'auto-pattern' && suggested.confidence >= 0.9) {
                  // Keep high-confidence auto-detections
                  initialHistory[system] = [{
                    timestamp: new Date().toISOString(),
                    user: 'system',
                    from: null,
                    to: suggested.costHead,
                    reason: 'Auto-detected pattern match'
                  }];
                }
              });
              
              setCustomMappings(initialMappings);
              setMappingHistory(initialHistory);
              setEstimateData(processedData);
              setFilteredData(processedData);
              
              setLoadingProgress(100);
              setLoadingMessage('Complete!');
              
              setTimeout(() => {
                setLoading(false);
                setActiveTab('estimates');
                showNotification(`Successfully loaded ${processedData.length} items`, 'success');
              }, 500);
            }
          };
          
          // Start processing chunks
          processChunk();
          
        } catch (error) {
          showNotification('Error processing file: ' + error.message, 'error');
          setLoading(false);
        }
      }, 100);
    };
    
    reader.readAsArrayBuffer(file);
  }, [generateCostCode]);

  // Update all items when mappings change
  useEffect(() => {
    if (estimateData.length > 0) {
      const updated = estimateData.map(item => ({
        ...item,
        suggestedCode: generateCostCode(item)
      }));
      setEstimateData(updated);
      setFilteredData(updated);
    }
  }, [customMappings, generateCostCode]);

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...estimateData];
    
    if (filters.floor !== 'all') {
      filtered = filtered.filter(item => item.floor === filters.floor);
    }
    if (filters.system !== 'all') {
      filtered = filtered.filter(item => item.system === filters.system);
    }
    if (filters.costCode === 'unassigned') {
      filtered = filtered.filter(item => !item.costCode);
    } else if (filters.costCode !== 'all') {
      filtered = filtered.filter(item => item.costCode === filters.costCode);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.materialDesc.toLowerCase().includes(search) ||
        item.itemName.toLowerCase().includes(search) ||
        item.drawing.toLowerCase().includes(search)
      );
    }
    
    setFilteredData(filtered);
  }, [estimateData, filters]);

  // Auto-assign cost codes
  const autoAssignCostCodes = () => {
    let assigned = 0;
    const updated = estimateData.map(item => {
      if (!item.costCode && item.suggestedCode && item.suggestedCode.confidence >= 0.8) {
        assigned++;
        return { ...item, costCode: item.suggestedCode.code };
      }
      return item;
    });
    
    setEstimateData(updated);
    showNotification(`Auto-assigned ${assigned} cost codes with high confidence`, 'success');
  };

  // Update custom mapping with audit trail
  const updateMapping = (system, costHead, userName = 'user') => {
    const systemLower = system.toLowerCase().trim();
    const history = mappingHistory[systemLower] || [];
    const currentMapping = customMappings[systemLower];
    const autoSuggestion = generateCostCode({ system }).costHead;
    
    const newMappings = { ...customMappings };
    const newHistory = { ...mappingHistory };
    
    if (costHead && costHead !== 'none') {
      newMappings[systemLower] = costHead;
      newHistory[systemLower] = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          from: currentMapping || autoSuggestion,
          to: costHead,
          reason: currentMapping ? 'Manual change' : 'Initial assignment'
        }
      ];
    } else {
      delete newMappings[systemLower];
      newHistory[systemLower] = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          from: currentMapping || autoSuggestion,
          to: autoSuggestion,
          reason: 'Reset to auto-detection'
        }
      ];
    }
    
    setCustomMappings(newMappings);
    setMappingHistory(newHistory);
    showNotification(`Updated mapping: ${system} → ${costHead === 'none' ? autoSuggestion : costHead}`, 'success');
  };

  // Export with cost codes
  const exportWithCostCodes = () => {
    const exportData = filteredData.map(item => ({
      'SEC': item.suggestedCode?.section || '',
      'ACT': item.suggestedCode?.activity || '',
      'COST HEAD': item.suggestedCode?.costHead || '',
      'DESCRIPTION': item.suggestedCode?.description || '',
      'Drawing': item.drawing,
      'System': item.system,
      'Floor': item.floor,
      'Material Description': item.materialDesc,
      'Item Name': item.itemName,
      'Size': item.size,
      'Quantity': item.quantity,
      'Hours': item.hours,
      'Material $': item.materialDollars,
      'Assigned Code': item.costCode || '',
      'Suggested Code': item.suggestedCode?.code || '',
      'Confidence': item.suggestedCode ? Math.round(item.suggestedCode.confidence * 100) + '%' : '',
      'Source': item.suggestedCode?.source || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Labor Report');
    
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `labor_report_${date}.xlsx`);
    
    showNotification('Export completed successfully', 'success');
  };

  // Calculate stats
  const stats = {
    totalItems: filteredData.length,
    codedItems: filteredData.filter(item => item.costCode).length,
    totalHours: filteredData.reduce((sum, item) => sum + (item.hours || 0), 0),
    autoMatched: filteredData.filter(item => item.suggestedCode && item.suggestedCode.confidence >= 0.8).length,
    codingPercentage: filteredData.length > 0 
      ? Math.round((filteredData.filter(item => item.costCode).length / filteredData.length) * 100) 
      : 0
  };

  // Get unique filter values
  const getUniqueValues = (field) => {
    return [...new Set(estimateData.map(item => item[field]))].filter(Boolean).sort();
  };

  const uniqueSystems = [...new Set(estimateData.map(item => item.system))].filter(Boolean).sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🔧 Plumbing Estimate Cost Code Manager
          </h1>
          <p className="mt-2 opacity-90">SEC-ACT-COST HEAD Automation System</p>
          {fileName && (
            <div className="mt-4 bg-white/20 px-4 py-2 rounded-lg inline-block">
              <span className="text-sm opacity-90">Project: </span>
              <span className="font-semibold">{fileName.replace(/\.[^/.]+$/, '')}</span>
              <span className="ml-6 text-sm opacity-90">Items: </span>
              <span className="font-semibold">{estimateData.length}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {['upload', 'estimates', 'mapping', 'rules'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-medium transition-all ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'upload' && '📁 Upload'}
              {tab === 'estimates' && '📊 Estimates'}
              {tab === 'mapping' && '🔗 Mapping'}
              {tab === 'rules' && '🤖 Rules'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div
              className="border-3 border-dashed border-blue-400 rounded-xl p-16 text-center cursor-pointer hover:bg-blue-50 transition-all bg-gradient-to-br from-blue-50 to-indigo-50"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
            >
              <div className="text-6xl mb-4">📁</div>
              <h2 className="text-2xl font-semibold mb-2 text-blue-900">Upload Your Estimate File</h2>
              <p className="text-gray-600">
                Drag & drop your Excel file here or click to browse<br/>
                <small className="text-gray-500">Supports .xlsx, .xlsm, and .xls files</small>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
            </div>
          )}

          {/* Estimates Tab */}
          {activeTab === 'estimates' && estimateData.length > 0 && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                  <h3 className="text-sm text-blue-600 font-medium uppercase">Total Items</h3>
                  <div className="text-3xl font-bold text-blue-900">{stats.totalItems}</div>
                  <p className="text-xs text-blue-600 mt-1">Estimate line items</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                  <h3 className="text-sm text-green-600 font-medium uppercase">Coded Items</h3>
                  <div className="text-3xl font-bold text-green-900">{stats.codedItems}</div>
                  <p className="text-xs text-green-600 mt-1">{stats.codingPercentage}% complete</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                  <h3 className="text-sm text-purple-600 font-medium uppercase">Total Hours</h3>
                  <div className="text-3xl font-bold text-purple-900">
                    {isNaN(stats.totalHours) ? '0' : stats.totalHours.toFixed(1)}
                  </div>
                  <p className="text-xs text-purple-600 mt-1">Labor hours</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg">
                  <h3 className="text-sm text-amber-600 font-medium uppercase">Auto-Matched</h3>
                  <div className="text-3xl font-bold text-amber-900">{stats.autoMatched}</div>
                  <p className="text-xs text-amber-600 mt-1">Ready to assign</p>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filters.floor}
                  onChange={(e) => setFilters({...filters, floor: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Floors</option>
                  {getUniqueValues('floor').map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <select
                  value={filters.system}
                  onChange={(e) => setFilters({...filters, system: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Systems</option>
                  {getUniqueValues('system').map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <select
                  value={filters.costCode}
                  onChange={(e) => setFilters({...filters, costCode: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Codes</option>
                  <option value="unassigned">⚠️ Unassigned Only</option>
                </select>
                <input
                  type="text"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6 flex-wrap">
                <button
                  onClick={autoAssignCostCodes}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 font-medium"
                >
                  🤖 Auto-Assign All Codes
                </button>
                <button
                  onClick={exportWithCostCodes}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 font-medium"
                >
                  💾 Export with Codes
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2 font-medium"
                >
                  📁 New File
                </button>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Drawing</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">System</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Floor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Hours</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cost Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, 100).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{item.drawing}</td>
                        <td className="px-4 py-3 text-sm">{item.system}</td>
                        <td className="px-4 py-3 text-sm">{item.floor}</td>
                        <td className="px-4 py-3 text-sm" title={item.materialDesc}>
                          {item.materialDesc.substring(0, 40)}{item.materialDesc.length > 40 ? '...' : ''}
                        </td>
                        <td className="px-4 py-3 text-sm">{item.itemName}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{item.hours.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm">
                          {item.costCode ? (
                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 font-mono font-semibold">
                              {item.costCode}
                            </span>
                          ) : item.suggestedCode ? (
                            <span 
                              className={`px-2 py-1 text-xs rounded font-mono cursor-pointer transition-all hover:scale-105 ${
                                item.suggestedCode.confidence >= 0.8 
                                  ? 'bg-green-100 text-green-800'
                                  : item.suggestedCode.confidence >= 0.6
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                              onClick={() => {
                                const updated = estimateData.map(e => 
                                  e.id === item.id ? {...e, costCode: item.suggestedCode.code} : e
                                );
                                setEstimateData(updated);
                              }}
                            >
                              {item.suggestedCode.code}
                              <span className="ml-1 text-xs opacity-75">
                                ({Math.round(item.suggestedCode.confidence * 100)}%)
                              </span>
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs">No match</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {!item.costCode && item.suggestedCode && (
                            <button
                              onClick={() => {
                                const updated = estimateData.map(e => 
                                  e.id === item.id ? {...e, costCode: item.suggestedCode.code} : e
                                );
                                setEstimateData(updated);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-all"
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length > 100 && (
                  <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
                    Showing first 100 of {filteredData.length} items
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mapping Tab */}
          {activeTab === 'mapping' && estimateData.length > 0 && (
            <div>
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">🔧 Custom System Mapping</h3>
                <p className="text-blue-700 text-sm">
                  Map systems from your data to specific cost heads. These mappings will override the automatic pattern matching.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">System in Data</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Current Mapping</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cost Head</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uniqueSystems.map(system => {
                      const systemLower = system.toLowerCase().trim();
                      const currentMapping = customMappings[systemLower];
                      const itemCount = estimateData.filter(item => item.system === system).length;
                      const suggestedCode = generateCostCode({ system });
                      const mappedCostHead = currentMapping || suggestedCode.costHead;
                      const history = mappingHistory[systemLower] || [];
                      const autoSuggestion = suggestedCode.source === 'default' ? suggestedCode.costHead : 
                                             suggestedCode.source === 'auto-pattern' ? suggestedCode.costHead : null;
                      
                      return (
                        <tr key={system} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{system}</td>
                          <td className="px-4 py-3 text-sm">
                            <div>
                              <span className={`px-2 py-1 text-xs rounded font-mono ${
                                currentMapping ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {mappedCostHead}
                              </span>
                              {autoSuggestion && autoSuggestion !== mappedCostHead && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Auto-suggested: {autoSuggestion}
                                </div>
                              )}
                              {history.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Last changed by: {history[history.length - 1].user}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {editingSystem === system ? (
                              <div className="flex gap-2 items-center">
                                <button
                                  onClick={() => setShowCostCodeBrowser(true)}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Browse All Codes
                                </button>
                                <select
                                  value={currentMapping || mappedCostHead}
                                  onChange={(e) => {
                                    updateMapping(system, e.target.value);
                                    setEditingSystem(null);
                                  }}
                                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="none">Auto-detect</option>
                                  {Object.entries(DEFAULT_COST_HEAD_MAPPING).map(([code, config]) => (
                                    <option key={code} value={code}>{code}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingSystem(system)}
                                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                              >
                                Change
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {DEFAULT_COST_HEAD_MAPPING[mappedCostHead]?.description || 
                             Object.values(STANDARD_COST_CODES).flatMap(cat => 
                               Object.values(cat).flat()
                             ).find(c => c.code === mappedCostHead)?.description || ''}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">{itemCount}</td>
                          <td className="px-4 py-3 text-sm">
                            {currentMapping && (
                              <button
                                onClick={() => updateMapping(system, 'none')}
                                className="text-red-600 hover:text-red-800 text-xs"
                                title={`Reset to auto-detection (${autoSuggestion || 'SNWV'})`}
                              >
                                Reset to {autoSuggestion || 'Auto'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> Changes to mappings will automatically update all suggested cost codes. 
                  Click "Auto-Assign All Codes" on the Estimates tab to apply the updated suggestions.
                </p>
              </div>
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">📘 Default Pattern Rules (Read-Only)</h3>
                <p className="text-amber-800 text-sm">
                  These are the built-in pattern matching rules used for auto-detection. 
                  To customize mappings for your project, use the <strong>Mapping</strong> tab.
                </p>
              </div>

              <h3 className="text-lg font-semibold mb-4">System Pattern to Cost Head Rules</h3>
              <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">System Pattern</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cost Head</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Example Code</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(DEFAULT_COST_HEAD_MAPPING).map(([code, config]) => (
                      <tr key={code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {config.patterns.map(p => p.source.replace(/[\^$\/i]/g, '')).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold">{code}</td>
                        <td className="px-4 py-3 text-sm">{config.description}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-mono text-xs">
                            01 0000 {code}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>💡 Tip:</strong> These patterns automatically detect common plumbing systems. 
                  For project-specific customizations or to override these defaults, go to the Mapping tab 
                  where you can set custom mappings that take precedence over these rules.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cost Code Browser Modal */}
        {showCostCodeBrowser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">📋 Standard Cost Code Library</h3>
                  <button
                    onClick={() => setShowCostCodeBrowser(false)}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                  >
                    Close
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">Browse and select from the complete standard cost code database</p>
              </div>

              <div className="flex h-96">
                {/* Category Selection */}
                <div className="w-1/3 border-r bg-gray-50">
                  <div className="p-4">
                    <h4 className="font-medium mb-3">Categories</h4>
                    {Object.keys(STANDARD_COST_CODES).map(category => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCostCodeCategory(category);
                          setSelectedSubCategory('');
                        }}
                        className={`block w-full text-left px-3 py-2 rounded mb-1 text-sm ${
                          selectedCostCodeCategory === category 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'hover:bg-gray-200'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subcategory Selection */}
                <div className="w-1/3 border-r bg-gray-25">
                  <div className="p-4">
                    <h4 className="font-medium mb-3">Subcategories</h4>
                    {Object.keys(STANDARD_COST_CODES[selectedCostCodeCategory] || {}).map(subcat => (
                      <button
                        key={subcat}
                        onClick={() => setSelectedSubCategory(subcat)}
                        className={`block w-full text-left px-3 py-2 rounded mb-1 text-sm ${
                          selectedSubCategory === subcat 
                            ? 'bg-green-100 text-green-800' 
                            : 'hover:bg-gray-200'
                        }`}
                      >
                        {subcat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Selection */}
                <div className="w-1/3 bg-white">
                  <div className="p-4">
                    <h4 className="font-medium mb-3">Cost Codes</h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {selectedSubCategory && 
                       STANDARD_COST_CODES[selectedCostCodeCategory]?.[selectedSubCategory]?.map(codeItem => (
                        <div key={codeItem.code} className="border rounded p-2 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono font-bold text-sm">{codeItem.code}</span>
                              <div className="text-xs text-gray-600">{codeItem.description}</div>
                              <div className="text-xs text-gray-500">{codeItem.units}</div>
                            </div>
                            <button
                              onClick={() => {
                                if (editingSystem) {
                                  updateMapping(editingSystem, codeItem.code);
                                  setEditingSystem(null);
                                }
                                setShowCostCodeBrowser(false);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay with Progress */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg min-w-96">
              <div className="text-center mb-4">
                <div className="text-lg font-semibold mb-2">{loadingMessage}</div>
                <div className="text-sm text-gray-600">{estimatedTime}</div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                {loadingProgress}% Complete
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white animate-slide-in`}>
            {notification.message}
          </div>
        )}
      </div>
    </div>
  );
}
