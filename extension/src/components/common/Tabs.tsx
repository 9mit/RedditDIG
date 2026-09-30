import React from 'react';
import { BarChart3, Search, Users, Compass, MessageSquareText } from 'lucide-react';

export type TabType = 'OVERVIEW' | 'OPINIONS' | 'SEARCH' | 'PEOPLE' | 'EXPLORE';

interface TabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

const tabs = [
  { id: 'OVERVIEW' as TabType, label: 'Overview', icon: BarChart3 },
  { id: 'OPINIONS' as TabType, label: 'Opinions', icon: MessageSquareText },
  { id: 'SEARCH' as TabType, label: 'Search', icon: Search },
  { id: 'PEOPLE' as TabType, label: 'People', icon: Users },
  { id: 'EXPLORE' as TabType, label: 'Explore', icon: Compass },
];

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChange }) => {
  return (
    <nav className="rdg-tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="rdg-tab"
            data-active={activeTab === tab.id}
          >
            <Icon size={13} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
