import React from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

interface TabItem {
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultIndex?: number;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  items,
  defaultIndex = 0,
  selectedIndex,
  onChange,
  className = '',
}) => {
  return (
    <TabGroup
      defaultIndex={defaultIndex}
      selectedIndex={selectedIndex}
      onChange={onChange}
    >
      <TabList
        className={`flex gap-1 border-b border-gray-200 dark:border-gray-700 ${className}`}
      >
        {items.map((item, idx) => (
          <Tab
            key={idx}
            className={({ selected }) =>
              `inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none ${
                selected
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`
            }
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {item.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-5">
        {items.map((item, idx) => (
          <TabPanel key={idx}>{item.content}</TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
};

export default Tabs;
