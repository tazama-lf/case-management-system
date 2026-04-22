import React from 'react';
import type { TimeRange, TimeSliderConfig } from './types';

interface TimeSliderProps {
  config: TimeSliderConfig;
  onChange: (config: TimeSliderConfig) => void;
}

const TimeSlider: React.FC<TimeSliderProps> = ({ config, onChange }) => {
  const [sliderValue, setSliderValue] = React.useState(50);

  const timeRanges: Array<{ value: TimeRange; label: string }> = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' },
  ];

  const handleRangeChange = (range: TimeRange) => {
    const now = new Date();
    const startDate = new Date();

    switch (range) {
      case 'minutes':
        startDate.setMinutes(now.getMinutes() - 60);
        break;
      case 'hours':
        startDate.setHours(now.getHours() - 24);
        break;
      case 'days':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'weeks':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'months':
        startDate.setMonth(now.getMonth() - 12);
        break;
    }

    onChange({
      range,
      startDate,
      endDate: now,
    });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setSliderValue(value);

    const now = new Date();
    const totalDuration = now.getTime() - config.startDate.getTime();
    const newStartTime = now.getTime() - (totalDuration * value) / 100;

    onChange({
      ...config,
      startDate: new Date(newStartTime),
      endDate: now,
    });
  };

  const formatDateRange = () => {
    const start = config.startDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const end = config.endDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${start} - ${end}`;
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Time Range</h4>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => { handleRangeChange(range.value); }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                config.range === range.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{formatDateRange()}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          aria-label="Adjust time window"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Start</span>
          <span>{sliderValue}%</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );
};

export default TimeSlider;
