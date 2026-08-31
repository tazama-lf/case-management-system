import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ResolutionTrend } from '../types/reports.types';

interface ResolutionTimeTrendChartProps {
  data: ResolutionTrend[];
  title: string;
  height?: number;
}

const formatMonthLabel = (bucket: string): string => {
  const [year, month] = bucket.split('-').map(Number);
  if (!year || !month) return bucket;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
};

interface ChartRow {
  month: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  n: number;
  bandBase: number | null;
  bandHeight: number | null;
}

interface TooltipPayloadEntry {
  payload: ChartRow;
}

const ResolutionTimeTrendChart: React.FC<ResolutionTimeTrendChartProps> = ({
  data,
  title,
  height = 350,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  const chartData: ChartRow[] = data.map((item) => ({
    month: formatMonthLabel(item.month),
    median: item.median,
    p25: item.p25,
    p75: item.p75,
    n: item.n,
    bandBase: item.p25,
    bandHeight: item.p25 !== null && item.p75 !== null ? item.p75 - item.p25 : null,
  }));

  const maxN = Math.max(1, ...chartData.map((row) => row.n));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts' Tooltip content prop type doesn't line up with a per-row payload shape
  const renderTooltip = (props: any): React.ReactElement | null => {
    const { active, payload } = props as {
      active?: boolean;
      payload?: TooltipPayloadEntry[];
    };
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0].payload;

    return (
      <div className="bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2 text-sm">
        <p className="font-medium text-gray-700">{row.month}</p>
        {row.median === null ? (
          <p className="text-gray-500">No cases closed</p>
        ) : (
          <>
            <p className="text-gray-700">Median: {row.median} days</p>
            <p className="text-gray-500">
              P25-P75: {row.p25}-{row.p75} days
            </p>
            <p className="text-gray-500">Sample size: n={row.n}</p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="days"
            domain={[0, 'dataMax + 2']}
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
            label={{ value: 'Days to close', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
          />
          <YAxis
            yAxisId="n"
            orientation="right"
            domain={[0, maxN * 4]}
            hide
          />
          <Tooltip content={renderTooltip} />
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts' Legend payload type requires internal-only fields we don't have
            <Legend
              {...({
                payload: [
                  { value: 'median', type: 'line', color: '#3b82f6' },
                  { value: 'P25-P75 band', type: 'square', color: '#c4b5fd' },
                  { value: 'sample size (n)', type: 'square', color: '#d1d5db' },
                ],
              } as any)}
            />
          }
          <Bar yAxisId="n" dataKey="n" fill="#d1d5db" barSize={18} name="sample size (n)" legendType="none" />
          <Area
            yAxisId="days"
            dataKey="bandBase"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            legendType="none"
          />
          <Area
            yAxisId="days"
            dataKey="bandHeight"
            stackId="band"
            stroke="none"
            fill="#8b5cf6"
            fillOpacity={0.15}
            isAnimationActive={false}
            name="P25-P75 band"
            legendType="none"
          />
          <Line
            yAxisId="days"
            type="monotone"
            dataKey="median"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#3b82f6' }}
            connectNulls={false}
            name="median"
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResolutionTimeTrendChart;
