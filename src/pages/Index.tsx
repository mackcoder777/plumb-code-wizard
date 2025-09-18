import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';

// Cost Codes Database
const COST_CODES_DB = {
  fieldLabor: [
    { code: "2210", description: "ROUGH-IN PLUMBING", category: "L", keywords: ["rough", "rough-in", "roughing"] },
    { code: "2211", description: "UNDERGROUND PLUMBING", category: "L", keywords: ["underground", "below grade", "ug"] },
    { code: "2212", description: "ABOVE GROUND WASTE & VENT", category: "L", keywords: ["waste", "vent", "dwv", "drainage"] },
    { code: "2213", description: "WATER PIPING", category: "L", keywords: ["water", "domestic", "potable"] },
    { code: "2214", description: "STORM DRAINAGE", category: "L", keywords: ["storm", "rain", "drainage", "overflow"] },
    { code: "2215", description: "GAS PIPING", category: "L", keywords: ["gas", "natural gas", "fuel"] },
    { code: "2216", description: "FIXTURES INSTALLATION", category: "L", keywords: ["fixture", "toilet", "sink", "lavatory"] },
    { code: "2217", description: "EQUIPMENT INSTALLATION", category: "L", keywords: ["equipment", "heater", "pump", "tank"] },
    { code: "2218", description: "INSULATION", category: "L", keywords: ["insulation", "insulate", "wrap"] },
    { code: "2219", description: "TESTING", category: "L", keywords: ["test", "testing", "inspection"] },
    { code: "2220", description: "HANGERS & SUPPORTS", category: "L", keywords: ["hanger", "support", "brace", "seismic"] },
  ],
  material: [
    { code: "MAT-PIPE-CI", description: "CAST IRON PIPE", category: "M", keywords: ["cast iron", "ci", "no-hub"] },
    { code: "MAT-PIPE-CU", description: "COPPER PIPE", category: "M", keywords: ["copper", "cu", "type l", "type k"] },
    { code: "MAT-PIPE-PVC", description: "PVC PIPE", category: "M", keywords: ["pvc", "plastic", "schedule"] },
    { code: "MAT-FITT", description: "FITTINGS", category: "M", keywords: ["fitting", "elbow", "tee", "coupling", "bend"] },
    { code: "MAT-VALV", description: "VALVES", category: "M", keywords: ["valve", "gate", "ball", "check"] },
    { code: "MAT-FIXT", description: "FIXTURES", category: "M", keywords: ["fixture", "toilet", "sink", "faucet"] },
    { code: "MAT-HANG", description: "HANGERS & SUPPORTS", category: "M", keywords: ["hanger", "clamp", "strap", "support"] },
    { code: "MAT-INSL", description: "INSULATION", category: "M", keywords: ["insulation", "fiberglass", "foam"] },
    { code: "MAT-DRAIN", description: "DRAINS", category: "M", keywords: ["drain", "floor drain", "roof drain"] },
  ]
};

// Automation Rules
const AUTOMATION_RULES = [
  { 
    pattern: /storm|drain/i, 
    field: "system", 
    codes: { material: "MAT-PIPE-CI", labor: "2214" },
    description: "Storm drainage systems"
  },
  {
    pattern: /overflow/i,
    field: "system",
    codes: { material: "MAT-PIPE-CI", labor: "2214" },
    description: "Overflow drainage"
  },
  {
    pattern: /domestic|water/i,
    field: "system",
    codes: { material: "MAT-PIPE-CU", labor: "2213" },
    description: "Domestic water systems"
  },
  {
    pattern: /waste|vent|dwv/i,
    field: "system",
    codes: { material: "MAT-PIPE-CI", labor: "2212" },
    description: "Waste and vent systems"
  },
  {
    pattern: /cast iron|ci|no-hub/i,
    field: "materialDesc",
    codes: { material: "MAT-PIPE-CI" },
    description: "Cast iron materials"
  },
  {
    pattern: /fitting|elbow|tee|bend|coupling/i,
    field: "itemName",
    codes: { material: "MAT-FITT" },
    description: "Pipe fittings"
  },
  {
    pattern: /hanger|support|strap|clamp/i,
    field: "itemType",
    codes: { material: "MAT-HANG", labor: "2220" },
    description: "Hangers and supports"
  },
];

export default function Index() {
  const [estimateData, setEstimateData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [activeTab, setActiveTab] = useState('estimates');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    system: '',
    floor: '',
    zone: '',
    itemType: '',
    costCode: '',
    search: ''
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const fileInputRef = useRef(null);

  // Get suggested cost codes for an item
  const getSuggestedCostCodes = useCallback((item) => {
    const suggestions = [];
    
    AUTOMATION_RULES.forEach(rule => {
      const fieldValue = item[rule.field] || '';
      if (rule.pattern.test(fieldValue)) {
        if (rule.codes.material) {
          suggestions.push({
            code: rule.codes.material,
            type: 'material',
            confidence: 0.9,
            reason: rule.description
          });
        }
        if (rule.codes.labor) {
          suggestions.push({
            code: rule.codes.labor,
            type: 'labor',
            confidence: 0.9,
            reason: rule.description
          });
        }
      }
    });
    
    // Check keyword matches
    const allCodes = [...COST_CODES_DB.fieldLabor, ...COST_CODES_DB.material];
    allCodes.forEach(codeEntry => {
      const itemText = `${item.system} ${item.materialDesc} ${item.itemName}`.toLowerCase();
      const matchCount = codeEntry.keywords.filter(keyword => 
        itemText.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        const existing = suggestions.find(s => s.code === codeEntry.code);
        if (!existing) {
          suggestions.push({
            code: codeEntry.code,
            type: codeEntry.category === 'L' ? 'labor' : 'material',
            confidence: Math.min(0.6 + (matchCount * 0.2), 1),
            reason: `Matches: ${codeEntry.keywords.filter(k => itemText.includes(k.toLowerCase())).join(', ')}`
          });
        }
      }
    });
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
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
        
        const processedData = jsonData.map((row, index) => ({
          id: index,
          drawing: row['D'] || row['Drawing'] || '',
          system: row['D_1'] || row['System'] || '',
          floor: row['D_2'] || row['Floor'] || '',
          zone: row['D_3'] || row['Zone'] || '',
          symbol: row['D_4'] || row['Symbol'] || '',
          materialSpec: row['D_6'] || row['Material Spec'] || '',
          itemType: row['D_7'] || row['Item Type'] || '',
          materialDesc: row['A'] || row['Material Description'] || '',
          itemName: row['A_1'] || row['Item Name'] || '',
          size: row['A_2'] || row['Size'] || '',
          quantity: parseFloat(row['T'] || row['Quantity'] || 0),
          materialDollars: parseFloat(row['T_1'] || row['Material Dollars'] || 0),
          hours: parseFloat(row['T_3'] || row['Hours'] || 0),
          laborDollars: parseFloat(row['T_4'] || row['Labor Dollars'] || 0),
          costCode: '',
          suggestedCodes: []
        }));
        
        // Add suggestions
        processedData.forEach(item => {
          item.suggestedCodes = getSuggestedCostCodes(item);
        });
        
        setEstimateData(processedData);
        setFilteredData(processedData);
        showNotification(`Successfully loaded ${processedData.length} items`, 'success');
      } catch (error) {
        showNotification('Error processing file: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, [getSuggestedCostCodes]);

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...estimateData];
    
    if (filters.system) {
      filtered = filtered.filter(item => item.system === filters.system);
    }
    if (filters.floor) {
      filtered = filtered.filter(item => item.floor === filters.floor);
    }
    if (filters.zone) {
      filtered = filtered.filter(item => item.zone === filters.zone);
    }
    if (filters.itemType) {
      filtered = filtered.filter(item => item.itemType === filters.itemType);
    }
    if (filters.costCode === 'unassigned') {
      filtered = filtered.filter(item => !item.costCode);
    } else if (filters.costCode) {
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
      if (!item.costCode && item.suggestedCodes.length > 0) {
        const best = item.suggestedCodes[0];
        if (best.confidence >= 0.8) {
          assigned++;
          return { ...item, costCode: best.code };
        }
      }
      return item;
    });
    
    setEstimateData(updated);
    setFilteredData(updated);
    showNotification(`Auto-assigned ${assigned} cost codes`, 'success');
  };

  // Export with cost codes
  const exportWithCostCodes = () => {
    const exportData = filteredData.map(item => ({
      'Drawing': item.drawing,
      'System': item.system,
      'Floor': item.floor,
      'Zone': item.zone,
      'Material Description': item.materialDesc,
      'Item Name': item.itemName,
      'Size': item.size,
      'Quantity': item.quantity,
      'Material $': item.materialDollars,
      'Labor Hours': item.hours,
      'Cost Code': item.costCode || '',
      'Suggested Code': item.suggestedCodes[0]?.code || '',
      'Confidence': item.suggestedCodes[0] ? Math.round(item.suggestedCodes[0].confidence * 100) + '%' : ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimate with Cost Codes');
    
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `estimate_cost_codes_${date}.xlsx`);
    
    showNotification('Export completed successfully', 'success');
  };

  // Calculate stats
  const stats = {
    totalItems: filteredData.length,
    totalMaterial: filteredData.reduce((sum, item) => sum + item.materialDollars, 0),
    totalHours: filteredData.reduce((sum, item) => sum + item.hours, 0),
    itemsCoded: filteredData.filter(item => item.costCode).length,
    codingPercentage: filteredData.length > 0 
      ? Math.round((filteredData.filter(item => item.costCode).length / filteredData.length) * 100) 
      : 0
  };

  // Get unique filter values
  const getUniqueValues = (field) => {
    return [...new Set(estimateData.map(item => item[field]))].filter(Boolean).sort();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 16.5c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5m0-2c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5M5.8 10A2 2 0 0 0 4 8.2c-.6.6-.6 1.5 0 2l1.8 1.8L4 13.8c-.6.5-.6 1.5 0 2 .3.3.6.4 1 .4s.7-.1 1-.4L7.8 14 9.6 15.8c.3.3.6.4 1 .4s.7-.1 1-.4c.6-.6.6-1.5 0-2L9.8 12l1.8-1.8c.6-.5.6-1.5 0-2-.6-.6-1.5-.6-2 0L7.8 10 6 8.2c-.3-.3-.6-.4-1-.4s-.8.1-1.2.4z"/>
              </svg>
              Plumbing Estimate Manager
            </h1>
            {fileName && (
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <span className="text-sm">Project: </span>
                <span className="font-semibold">{fileName.replace(/\.[^/.]+$/, '')}</span>
              </div>
            )}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-sm opacity-90">Total Items</div>
                <div className="text-2xl font-bold">{stats.totalItems.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-90">Material Cost</div>
                <div className="text-2xl font-bold">
                  ${stats.totalMaterial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-90">Labor Hours</div>
                <div className="text-2xl font-bold">
                  {stats.totalHours.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {estimateData.length === 0 && (
          <div className="p-8 bg-gray-50">
            <div
              className="border-3 border-dashed border-blue-400 rounded-xl p-16 text-center cursor-pointer hover:bg-blue-50 transition"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
            >
              <svg className="w-16 h-16 mx-auto mb-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <h2 className="text-2xl font-semibold mb-2">Upload Your Project Estimate File</h2>
              <p className="text-gray-600">
                Drag & drop your Excel file here or click to browse<br/>
                <small>Supports .xlsx, .xlsm, and .xls files</small>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        {estimateData.length > 0 && (
          <>
            {/* Tabs */}
            <div className="flex border-b bg-gray-50">
              {['estimates', 'costcodes', 'automation'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-medium transition ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'estimates' && '📊 Estimates'}
                  {tab === 'costcodes' && '💰 Cost Codes'}
                  {tab === 'automation' && '🤖 Automation'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'estimates' && (
                <>
                  {/* Filters */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <select
                      value={filters.system}
                      onChange={(e) => setFilters({...filters, system: e.target.value})}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="">All Systems</option>
                      {getUniqueValues('system').map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                    <select
                      value={filters.floor}
                      onChange={(e) => setFilters({...filters, floor: e.target.value})}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="">All Floors</option>
                      {getUniqueValues('floor').map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                    <select
                      value={filters.zone}
                      onChange={(e) => setFilters({...filters, zone: e.target.value})}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="">All Zones</option>
                      {getUniqueValues('zone').map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                    <select
                      value={filters.costCode}
                      onChange={(e) => setFilters({...filters, costCode: e.target.value})}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="">All Cost Codes</option>
                      <option value="unassigned">⚠️ Unassigned Only</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <button
                      onClick={applyFilters}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Apply Filters
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mb-6 flex-wrap">
                    <button
                      onClick={autoAssignCostCodes}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      🤖 Auto-Assign Cost Codes
                    </button>
                    <button
                      onClick={exportWithCostCodes}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      💾 Export with Cost Codes
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                    >
                      📁 New File
                    </button>
                  </div>

                  {/* Data Table */}
                  <div className="overflow-x-auto rounded-lg shadow">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Drawing</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">System</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Floor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Material</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Material $</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Hours</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cost Code</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredData.slice(0, 100).map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">{item.drawing}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                {item.system}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">{item.floor}</td>
                            <td className="px-4 py-3 text-sm" title={item.materialDesc}>
                              {item.materialDesc.substring(0, 30)}{item.materialDesc.length > 30 ? '...' : ''}
                            </td>
                            <td className="px-4 py-3 text-sm">{item.itemName}</td>
                            <td className="px-4 py-3 text-sm font-mono">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm font-mono">${item.materialDollars.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-mono">{item.hours.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm">
                              {item.costCode ? (
                                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 font-semibold">
                                  {item.costCode}
                                </span>
                              ) : item.suggestedCodes.length > 0 ? (
                                <button
                                  onClick={() => {
                                    const updated = estimateData.map(e => 
                                      e.id === item.id ? {...e, costCode: item.suggestedCodes[0].code} : e
                                    );
                                    setEstimateData(updated);
                                    setFilteredData(updated);
                                  }}
                                  className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                                >
                                  {item.suggestedCodes[0].code} ({Math.round(item.suggestedCodes[0].confidence * 100)}%)
                                </button>
                              ) : (
                                <span className="text-amber-600">None</span>
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

              {activeTab === 'costcodes' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                      <h3 className="text-sm text-blue-600 font-medium">Field Labor Codes</h3>
                      <div className="text-3xl font-bold text-blue-900">{COST_CODES_DB.fieldLabor.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                      <h3 className="text-sm text-green-600 font-medium">Material Codes</h3>
                      <div className="text-3xl font-bold text-green-900">{COST_CODES_DB.material.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                      <h3 className="text-sm text-purple-600 font-medium">Items Coded</h3>
                      <div className="text-3xl font-bold text-purple-900">{stats.itemsCoded}</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg">
                      <h3 className="text-sm text-amber-600 font-medium">Completion</h3>
                      <div className="text-3xl font-bold text-amber-900">{stats.codingPercentage}%</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Available Cost Codes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Labor Codes</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {COST_CODES_DB.fieldLabor.map(code => (
                            <div key={code.code} className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="font-mono text-sm">{code.code}</span>
                              <span className="text-sm text-gray-600">{code.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3">Material Codes</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {COST_CODES_DB.material.map(code => (
                            <div key={code.code} className="flex justify-between p-2 bg-gray-50 rounded">
                              <span className="font-mono text-sm">{code.code}</span>
                              <span className="text-sm text-gray-600">{code.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'automation' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg">
                      <h3 className="text-sm text-indigo-600 font-medium">Automation Rules</h3>
                      <div className="text-3xl font-bold text-indigo-900">{AUTOMATION_RULES.length}</div>
                    </div>
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-lg">
                      <h3 className="text-sm text-teal-600 font-medium">Items with Suggestions</h3>
                      <div className="text-3xl font-bold text-teal-900">
                        {estimateData.filter(item => item.suggestedCodes.length > 0).length}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-lg">
                      <h3 className="text-sm text-pink-600 font-medium">Avg Confidence</h3>
                      <div className="text-3xl font-bold text-pink-900">
                        {estimateData.filter(item => item.suggestedCodes.length > 0).length > 0
                          ? Math.round(
                              estimateData
                                .filter(item => item.suggestedCodes.length > 0)
                                .reduce((sum, item) => sum + item.suggestedCodes[0].confidence, 0) /
                              estimateData.filter(item => item.suggestedCodes.length > 0).length * 100
                            )
                          : 0}%
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <h3 className="text-lg font-semibold p-4 bg-gray-50">Automation Rules</h3>
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Pattern</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Field</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Assigns</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Matches</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {AUTOMATION_RULES.map((rule, index) => {
                          const matchCount = estimateData.filter(item => {
                            const fieldValue = item[rule.field] || '';
                            return rule.pattern.test(fieldValue);
                          }).length;
                          
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-mono">{rule.pattern.source}</td>
                              <td className="px-4 py-3 text-sm">{rule.field}</td>
                              <td className="px-4 py-3 text-sm">
                                {rule.codes.material && <span className="mr-2">{rule.codes.material}</span>}
                                {rule.codes.labor && <span>{rule.codes.labor}</span>}
                              </td>
                              <td className="px-4 py-3 text-sm">{rule.description}</td>
                              <td className="px-4 py-3 text-sm font-semibold">{matchCount}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

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
            notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
            {notification.message}
          </div>
        )}
      </div>
    </div>
  );
}
