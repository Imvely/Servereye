import React, { useState } from 'react';
import { TIME_RANGES } from '../../utils/constants';
import DateRangePicker from '../ui/DateRangePicker';

interface TimeRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onCustomRange?: (from: Date, to: Date) => void;
  className?: string;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  onCustomRange,
  className = '',
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  const handlePresetClick = (rangeValue: string) => {
    setShowCustom(false);
    onChange(rangeValue);
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    onChange('custom');
  };

  const handleCustomDateChange = (dates: {
    start: Date | null;
    end: Date | null;
  }) => {
    setCustomStart(dates.start);
    setCustomEnd(dates.end);
    if (dates.start && dates.end && onCustomRange) {
      onCustomRange(dates.start, dates.end);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          type="button"
          onClick={() => handlePresetClick(range.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            value === range.value && !showCustom
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {range.label}
        </button>
      ))}
      {onCustomRange && (
        <>
          <button
            type="button"
            onClick={handleCustomToggle}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showCustom
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            custom
          </button>
          {showCustom && (
            <DateRangePicker
              startDate={customStart}
              endDate={customEnd}
              onChange={handleCustomDateChange}
              className="ml-2"
            />
          )}
        </>
      )}
    </div>
  );
};

export default TimeRangeSelector;
