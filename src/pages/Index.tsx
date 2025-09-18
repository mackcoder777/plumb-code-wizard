import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Cost Head Mapping Database
const COST_HEAD_MAPPING = {
  'SNWV': {
    patterns: [/sanitary/i, /waste.*vent/i, /dwv/i, /soil/i, /^vent$/i],
    description: 'SANITARY WASTE AND VENT'
  },
  'GRWV': {
    patterns: [/grease/i, /interceptor/i],
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
  'GRAY': {
    patterns: [/gray.*water/i, /grey.*water/i],
    description: 'GRAY WATER'
  },
  'STRM': {
    patterns: [/storm/i, /rain/i, /overflow.*drain/i, /roof.*drain/i],
    description: 'STORM DRAIN'
  },
  'DRNS': {
    patterns: [/^drain/i, /floor.*drain/i, /area.*drain/i],
    description: 'DRAINS'
  },
  'COND': {
    patterns: [/condensate/i, /ac.*drain/i],
    description: 'CONDENSATE'
  },
  'NGAS': {
    patterns: [/natural.*gas/i, /fuel.*gas/i, /^gas$/i],
    description: 'NATURAL GAS'
  },
  'FUEL': {
    patterns: [/fuel.*oil/i, /diesel/i],
    description: 'FUEL OIL'
  },
  'FNSH': {
    patterns: [/fixture/i, /toilet/i, /urinal/i, /lavatory/i, /sink/i, /faucet/i],
    description: 'FIXTURES'
  },
  'SEQP': {
    patterns: [/equipment/i, /pump/i, /heater/i, /boiler/i, /tank/i],
    description: 'EQUIPMENT SETTING'
  },
  'HNGS': {
    patterns: [/hanger/i, /support/i, /brace/i, /seismic/i, /strap/i],
    description: 'HANGERS AND SUPPORTS'
  },
  'IWTR': {
    patterns: [/industrial.*water/i, /process.*water/i],
    description: 'INDUSTRIAL WATER'
  },
  'PIDV': {
    patterns: [/pipe.*id/i, /valve.*tag/i, /identification/i],
    description: 'PIPE ID AND VALVE TAGS'
  },
  'SZMC': {
    patterns: [/seismic/i, /earthquake/i],
    description: 'SEISMIC'
  },
  'TRAP': {
    patterns: [/trap.*primer/i, /^trap$/i],
    description: 'TRAP PRIMERS'
  }
};

const FLOOR_MAPPING = {
  '01': [/level.*0?1/i, /^l1$/i, /floor.*1/i, /first.*floor/i, /1st.*floor/i],
  '02': [/level.*0?2/i, /^l2$/i, /floor.*2/i, /second.*floor/i, /2nd.*floor/i],
  '03': [/level.*0?3/i, /^l3$/i, /floor.*3/i, /third.*floor/i, /3rd.*floor/i],
  '04': [/level.*0?4/i, /^l4$/i, /floor.*4/i, /fourth.*floor/i, /4th.*floor/i],
  '05': [/level.*0?5/i, /^l5$/i, /floor.*5/i, /fifth.*floor/i, /5th.*floor/i],
  'P1': [/level.*p1/i, /^p1$/i, /parking.*1/i, /garage.*1/i, /basement.*1/i, /^b1$/i],
  'P2': [/level.*p2/i, /^p2$/i, /parking.*2/i, /garage.*2/i, /basement.*2/i, /^b2$/i],
  'P3': [/level.*p3/i, /^p3$/i, /parking.*3/i, /garage.*3/i, /basement.*3/i, /^b3$/i],
  'RF': [/roof/i, /penthouse/i, /^ph$/i, /^r$/i],
  'GR': [/ground/i, /grade/i, /^g$/i, /plaza/i],
  'MZ': [/mezzanine/i, /^mz$/i, /^m$/i]
};

export default function Index() {
  const [estimateData, setEstimateData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    floor: 'all',
    system: 'all',
    costCode: 'all',
    search: ''
  });
  const fileInputRef = useRef(null);

  // Generate cost code based on SEC-ACT-COST HEAD structure
  const generateCostCode = useCallback((item) => {
    // Determine Section (SEC) from floor
    let section = '01'; // Default
    const floorText = (item.floor || '').toLowerCase();
    
    for (const [code, patterns] of Object.entries(FLOOR_MAPPING)) {
      if (patterns.some(pattern => pattern.test(floorText))) {
        section = code;
        break;
      }
    }
    
    // Activity is always 0000
    const activity = '0000';
    
    // Determine Cost Head from system
    let costHead = 'SNWV'; // Default to sanitary waste and vent
    let confidence = 0.5;
    const systemText = (item.system || '').toLowerCase();
    
    for (const [code, config] of Object.entries(COST_HEAD_MAPPING)) {
      if (config.patterns.some(pattern => pattern.test(systemText))) {
        costHead = code;
        confidence = 0.9;
        break;
      }
    }
    
    // Check material description for additional hints
    const materialText = (item.materialDesc || '').toLowerCase();
    for (const [code, config] of Object.entries(COST_HEAD_MAPPING)) {
      if (config.patterns.some(pattern => pattern.test(materialText))) {
        if (confidence < 0.9) {
          costHead = code;
          confidence = 0.8;
        }
        break;
      }
    }
    
    return {
      code: `${section} ${activity} ${costHead}`,
      section: section,
      activity: activity,
      costHead: costHead,
      confidence: confidence,
      description: COST_HEAD_MAPPING[costHead]?.description || 'Unknown'
    };
  }, []);

  // Process uploaded file
  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    
    setLoading(true);
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('raw') || 
          name.toLowerCase().includes('data')
        ) || workbook.SheetNames[0];
        
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const processedData = jsonData.map((row: any, index: number) => {
          const item = {
            id: index,
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
            suggestedCode: null as any
          };
          
          // Generate suggested cost code
          item.suggestedCode = generateCostCode(item);
          
          return item;
        });
        
        setEstimateData(processedData);
        setFilteredData(processedData);
        setActiveTab('estimates');
        showNotification(`Successfully loaded ${processedData.length} items`, 'success');
      } catch (error: any) {
        showNotification('Error processing file: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, [generateCostCode]);

  // Show notification
  const showNotification = (message: string, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...estimateData];
    
    if (filters.floor !== 'all') {
      filtered = filtered.filter((item: any) => item.floor === filters.floor);
    }
    if (filters.system !== 'all') {
      filtered = filtered.filter((item: any) => item.system === filters.system);
    }
    if (filters.costCode === 'unassigned') {
      filtered = filtered.filter((item: any) => !item.costCode);
    } else if (filters.costCode !== 'all') {
      filtered = filtered.filter((item: any) => item.costCode === filters.costCode);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter((item: any) => 
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
    const updated = estimateData.map((item: any) => {
      if (!item.costCode && item.suggestedCode && item.suggestedCode.confidence >= 0.8) {
        assigned++;
        return { ...item, costCode: item.suggestedCode.code };
      }
      return item;
    });
    
    setEstimateData(updated);
    showNotification(`Auto-assigned ${assigned} cost codes with high confidence`, 'success');
  };

  // Assign single code
  const assignCode = (itemId: number) => {
    const updated = estimateData.map((item: any) => {
      if (item.id === itemId && item.suggestedCode) {
        return { ...item, costCode: item.suggestedCode.code };
      }
      return item;
    });
    
    setEstimateData(updated);
    showNotification('Cost code assigned', 'success');
  };

  // Export with cost codes
  const exportWithCostCodes = () => {
    const exportData = filteredData.map((item: any) => ({
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
      'Confidence': item.suggestedCode ? Math.round(item.suggestedCode.confidence * 100) + '%' : ''
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
    codedItems: filteredData.filter((item: any) => item.costCode).length,
    totalHours: filteredData.reduce((sum: number, item: any) => sum + item.hours, 0),
    autoMatched: filteredData.filter((item: any) => item.suggestedCode && item.suggestedCode.confidence >= 0.8).length,
    codingPercentage: filteredData.length > 0 
      ? Math.round((filteredData.filter((item: any) => item.costCode).length / filteredData.length) * 100) 
      : 0
  };

  // Get unique filter values
  const getUniqueValues = (field: string) => {
    return [...new Set(estimateData.map((item: any) => item[field]))].filter(Boolean).sort();
  };

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
          {['upload', 'estimates', 'automation', 'mapping'].map((tab) => (
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
              {tab === 'automation' && '🤖 Rules'}
              {tab === 'mapping' && '🔗 Mapping'}
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
                  <div className="text-3xl font-bold text-purple-900">{stats.totalHours.toFixed(1)}</div>
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
                    {filteredData.slice(0, 100).map((item: any) => (
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
                              onClick={() => assignCode(item.id)}
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
                              onClick={() => assignCode(item.id)}
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

          {/* Automation Tab */}
          {activeTab === 'automation' && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">📘 SEC-ACT-COST HEAD Structure</h3>
                <p className="text-blue-800">
                  Cost codes follow the pattern: <strong>[SEC] [ACT] [COST HEAD]</strong>
                </p>
                <ul className="mt-2 space-y-1 text-blue-700">
                  <li>• <strong>SEC</strong>: Section based on floor (01 for Level 01, 02 for Level 02, etc.)</li>
                  <li>• <strong>ACT</strong>: Activity code (typically 0000)</li>
                  <li>• <strong>COST HEAD</strong>: System-specific code (SNWV, STRM, DWTR, etc.)</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold mb-4">System to Cost Head Mapping</h3>
              <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">System Pattern</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cost Head</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Example</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(COST_HEAD_MAPPING).map(([code, config]) => (
                      <tr key={code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {config.patterns.map(p => p.source).join(', ')}
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
            </div>
          )}

          {/* Mapping Tab */}
          {activeTab === 'mapping' && estimateData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Current Code Assignments</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(
                  estimateData.reduce((acc: any, item: any) => {
                    if (item.costCode) {
                      if (!acc[item.costCode]) {
                        acc[item.costCode] = { count: 0, hours: 0, items: [] };
                      }
                      acc[item.costCode].count++;
                      acc[item.costCode].hours += item.hours;
                      acc[item.costCode].items.push(item);
                    }
                    return acc;
                  }, {})
                ).map(([code, data]: any) => (
                  <div key={code} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded font-mono font-semibold">
                        {code}
                      </span>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">{data.count} items</div>
                        <div className="text-sm font-semibold">{data.hours.toFixed(2)} hrs</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {COST_HEAD_MAPPING[code.split(' ')[2]]?.description || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4">Processing file...</p>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            (notification as any).type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white animate-slide-in`}>
            {(notification as any).message}
          </div>
        )}
      </div>
    </div>
  );
}