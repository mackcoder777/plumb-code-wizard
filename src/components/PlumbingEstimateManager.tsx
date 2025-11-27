import React, { useState, useCallback, useEffect } from 'react';
import { EstimateItem, ProjectStats } from '@/types/estimate';
import { FileUpload } from './FileUpload';
import { EstimateHeader } from './EstimateHeader';
import { NavigationTabs } from './NavigationTabs';
import { EstimatesTab } from './tabs/EstimatesTab';
import { CostCodesTab } from './tabs/CostCodesTab';
import { AutomationTab } from './tabs/AutomationTab';
import { DashboardTab } from './tabs/DashboardTab';
import { SystemMappingTab } from './tabs/SystemMappingTab';
import { toast } from '@/components/ui/use-toast';

export const PlumbingEstimateManager: React.FC = () => {
  const [estimateData, setEstimateData] = useState<EstimateItem[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('estimates');
  const [isLoading, setIsLoading] = useState(false);
  const [importedCostCodes, setImportedCostCodes] = useState<Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>>([]);

  // Load imported codes from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('importedCostCodes');
    if (stored) {
      try {
        const codes = JSON.parse(stored);
        setImportedCostCodes(codes);
      } catch (error) {
        console.error('Failed to load imported cost codes:', error);
      }
    }
  }, []);

  const handleFileUpload = useCallback((data: EstimateItem[], file: File) => {
    setEstimateData(data);
    setCurrentFile(file);
    toast({
      title: "File Uploaded Successfully",
      description: `Processed ${data.length} items from ${file.name}`,
    });
  }, []);

  const updateEstimateData = useCallback((updatedData: EstimateItem[]) => {
    setEstimateData(updatedData);
  }, []);

  const projectStats: ProjectStats = {
    totalItems: estimateData.length,
    totalMaterial: estimateData.reduce((sum, item) => sum + item.materialDollars, 0),
    totalHours: estimateData.reduce((sum, item) => sum + item.hours, 0),
    itemsCoded: estimateData.filter(item => item.costCode).length,
    codingCompletion: estimateData.length > 0 
      ? Math.round((estimateData.filter(item => item.costCode).length / estimateData.length) * 100)
      : 0
  };

  const handleNewFile = () => {
    setEstimateData([]);
    setCurrentFile(null);
    setActiveTab('estimates');
  };

  const handleCostCodeImport = useCallback((codes: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>) => {
    setImportedCostCodes(codes);
    
    // Store in localStorage for persistence
    localStorage.setItem('importedCostCodes', JSON.stringify(codes));
    
    toast({
      title: "Cost Codes Imported",
      description: `Successfully imported ${codes.length} cost codes. They are now available in System Mapping.`,
    });
  }, []);

  if (!currentFile) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="glass-effect rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="gradient-primary text-primary-foreground p-8 text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="p-3 bg-white/20 rounded-full">
                  <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 16.5c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5m0-2c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5M5.8 10A2 2 0 0 0 4 8.2c-.6.6-.6 1.5 0 2l1.8 1.8L4 13.8c-.6.5-.6 1.5 0 2 .3.3.6.4 1 .4s.7-.1 1-.4L7.8 14 9.6 15.8c.3.3.6.4 1 .4s.7-.1 1-.4c.6-.6.6-1.5 0-2L9.8 12l1.8-1.8c.6-.5.6-1.5 0-2-.6-.6-1.5-.6-2 0L7.8 10 6 8.2c-.3-.3-.6-.4-1-.4s-.8.1-1.2.4z"/>
                  </svg>
                </div>
                <h1 className="text-4xl font-bold">Plumbing Estimate Manager</h1>
              </div>
              <p className="text-xl text-white/90 max-w-2xl mx-auto">
                Advanced cost code automation and project management for plumbing contractors
              </p>
            </div>
            
            <div className="p-8">
              <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} setIsLoading={setIsLoading} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <EstimateHeader 
            projectName={currentFile.name.replace(/\.[^/.]+$/, "")}
            stats={projectStats}
            onNewFile={handleNewFile}
          />
          
          <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="p-6">
            {activeTab === 'estimates' && (
              <EstimatesTab 
                data={estimateData} 
                onDataUpdate={updateEstimateData}
              />
            )}
            {activeTab === 'mapping' && (
              <SystemMappingTab 
                data={estimateData} 
                onDataUpdate={updateEstimateData}
                importedCostCodes={importedCostCodes}
              />
            )}
            {activeTab === 'costcodes' && (
              <CostCodesTab 
                data={estimateData} 
                onImportCostCodes={handleCostCodeImport}
              />
            )}
            {activeTab === 'automation' && (
              <AutomationTab data={estimateData} onDataUpdate={updateEstimateData} />
            )}
            {activeTab === 'dashboard' && (
              <DashboardTab stats={projectStats} currentFile={currentFile} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};