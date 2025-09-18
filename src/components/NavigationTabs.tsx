import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  DollarSign, 
  Bot, 
  ShoppingCart, 
  TrendingUp, 
  LayoutDashboard 
} from 'lucide-react';

interface NavigationTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'estimates', label: 'Estimates', icon: BarChart3 },
  { id: 'costcodes', label: 'Cost Codes', icon: DollarSign },
  { id: 'automation', label: 'Auto-Assignment', icon: Bot },
  { id: 'buyout', label: 'Buyout Reports', icon: ShoppingCart },
  { id: 'comparison', label: 'Estimate vs Actual', icon: TrendingUp },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <div className="border-b bg-muted/30">
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className={`rounded-none border-b-2 transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-transparent hover:border-primary/50 hover:bg-primary/5'
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};