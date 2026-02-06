import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (dates: { start: Date | null; end: Date | null }) => void;
  className?: string;
}

interface QuickSelectOption {
  label: string;
  days: number;
}

const quickSelects: QuickSelectOption[] = [
  { label: '오늘', days: 0 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '최근 90일', days: 90 },
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - days);
    }
    onChange({ start, end });
    setIsOpen(false);
  };

  const handleStartChange = (date: Date | null) => {
    onChange({ start: date, end: endDate });
  };

  const handleEndChange = (date: Date | null) => {
    onChange({ start: startDate, end: date });
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0"
      >
        <Calendar size={16} className="text-gray-400" />
        <span>
          {startDate && endDate
            ? `${startDate.toLocaleDateString('ko-KR')} - ${endDate.toLocaleDateString('ko-KR')}`
            : '기간 선택'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[340px]">
          {/* Quick select buttons */}
          <div className="flex gap-2 mb-4">
            {quickSelects.map((qs) => (
              <button
                key={qs.label}
                type="button"
                onClick={() => handleQuickSelect(qs.days)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
              >
                {qs.label}
              </button>
            ))}
          </div>

          {/* Date pickers */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                시작일
              </label>
              <DatePicker
                selected={startDate}
                onChange={handleStartChange}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                maxDate={endDate || new Date()}
                dateFormat="yyyy-MM-dd"
                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholderText="YYYY-MM-DD"
              />
            </div>
            <span className="text-gray-400 mt-5">~</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                종료일
              </label>
              <DatePicker
                selected={endDate}
                onChange={handleEndChange}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate ?? undefined}
                maxDate={new Date()}
                dateFormat="yyyy-MM-dd"
                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholderText="YYYY-MM-DD"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                onChange({ start: null, end: null });
                setIsOpen(false);
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
