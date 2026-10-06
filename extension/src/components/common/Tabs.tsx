import React, { useRef } from 'react';
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

export const tabId = (id: TabType) => `rdg-tab-${id.toLowerCase()}`;
export const panelId = (id: TabType) => `rdg-panel-${id.toLowerCase()}`;

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChange }) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // WAI-ARIA tabs pattern: arrow keys move between tabs, Home/End jump to the ends.
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <nav className="rdg-tabs" role="tablist" aria-label="Thread insights">
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[tab.id] = el; }}
            id={tabId(tab.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className="rdg-tab"
            data-active={selected}
          >
            <Icon size={13} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
