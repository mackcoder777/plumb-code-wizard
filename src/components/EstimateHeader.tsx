import React from 'react';
import { ProjectStats } from '@/types/estimate';
import { Button } from '@/components/ui/button';
import { FileText, DollarSign, Clock, Package, ShoppingCart } from 'lucide-react';

interface EstimateHeaderProps {
  projectName: string;
  stats: ProjectStats;
  onNewFile: () => void;
}

export const EstimateHeader: React.FC<EstimateHeaderProps> = ({
  projectName,
  stats,
  onNewFile
}) => {
  return (
    <header className="gradient-primary text-primary-foreground p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 16.5c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5m0-2c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5M5.8 10A2 2 0 0 0 4 8.2c-.6.6-.6 1.5 0 2l1.8 1.8L4 13.8c-.6.5-.6 1.5 0 2 .3.3.6.4 1 .4s.7-.1 1-.4L7.8 14 9.6 15.8c.3.3.6.4 1 .4s.7-.1 1-.4c.6-.6.6-1.5 0-2L9.8 12l1.8-1.8c.6-.5.6-1.5 0-2-.6-.6-1.5-.6-2 0L7.8 10 6 8.2c-.3-.3-.6-.4-1-.4s-.8.1-1.2.4z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Plumbing Estimate Manager</h1>
            <p className="text-white/80 mt-1">Project: <span className="font-semibold">{projectName}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={onNewFile}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <FileText className="w-4 h-4 mr-2" />
            New File
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-2 ${stats.buyoutTotal !== undefined ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mt-8`}>
        <StatCard
          icon={<Package className="w-6 h-6" />}
          label="Total Items"
          value={stats.totalItems.toLocaleString()}
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Material Cost"
          value={`$${stats.totalMaterial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Labor Hours"
          value={stats.totalHours.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        />
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Coding Progress"
          value={`${stats.codingCompletion}%`}
        />
        {stats.buyoutTotal !== undefined && (
          <StatCard
            icon={<ShoppingCart className="w-6 h-6" />}
            label="Buyout Value"
            value={`$${stats.buyoutTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
        )}
      </div>
    </header>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => (
  <div className="glass-effect rounded-xl p-4 backdrop-blur-sm">
    <div className="flex items-center gap-3">
      <div className="text-white/80">{icon}</div>
      <div>
        <div className="text-sm text-white/70 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  </div>
);