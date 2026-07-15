import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  Text,
} from 'recharts';
import type { AgeingByStatus } from '../types/reports.types';

interface CaseAgeingBarChartProps {
  data: AgeingByStatus[];
  title: string;
  subtitle?: string;
  height?: number;
}

/** Same band set and colors as CaseAgeingPieChart - the two must never drift apart. */
const AGE_BANDS: Array<{ key: '0-7 days' | '8-15 days' | '16-30 days' | '30+ days'; color: string }> = [
  { key: '0-7 days', color: '#10b981' },
  { key: '8-15 days', color: '#f59e0b' },
  { key: '16-30 days', color: '#ef4444' },
  { key: '30+ days', color: '#991b1b' },
];

const formatStatusName = (status: string): string =>
  status.replace('STATUS_', '').replace(/_/gu, ' ').trim();

/** Exported for direct unit testing of the tick label text, independent of recharts' rendering/mocking. */
export const formatStatusTickLabel = (status: string, total: number): string =>
  `${status} (${total})`;

interface ChartRow {
  status: string;
  total: number;
  counts: Record<string, number>;
  '0-7 days': number;
  '8-15 days': number;
  '16-30 days': number;
  '30+ days': number;
  empty: number;
  emptyLabel: string;
}

const CaseAgeingBarChart: React.FC<CaseAgeingBarChartProps> = ({
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

  const chartData: ChartRow[] = data.map((item) => {
    const total = item.age0to7 + item.age8to15 + item.age16to30 + item.age30Plus;
    const pct = (value: number): number => (total > 0 ? (value / total) * 100 : 0);

    return {
      status: formatStatusName(item.status),
      total,
      counts: {
        '0-7 days': item.age0to7,
        '8-15 days': item.age8to15,
        '16-30 days': item.age16to30,
        '30+ days': item.age30Plus,
      },
      '0-7 days': pct(item.age0to7),
      '8-15 days': pct(item.age8to15),
      '16-30 days': pct(item.age16to30),
      '30+ days': pct(item.age30Plus),
      empty: total === 0 ? 100 : 0,
      emptyLabel: total === 0 ? 'no open cases' : '',
    };
  });

  // status -> total, so the single Y axis's tick label can show the count
  // ("Draft (6)") without a second axis. A second category YAxis (one for
  // "status", one for "total") previously desynced the Tooltip's hover-row
  // resolution from the hovered bar - see CaseAgeingBarChart bug writeup.
  const totalsByStatus = new Map(chartData.map((row) => [row.status, row.total]));
  const TICK_TEXT_WIDTH = 190;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts' tick prop type (x/y: number | string, payload.value: any) doesn't line up with a narrow status-label shape
  const renderStatusTick = (props: any): React.ReactElement => {
    const { x, y, payload } = props as { x: number | string; y: number | string; payload: { value: string } };
    const total = totalsByStatus.get(payload.value) ?? 0;
    return (
      <Text
        x={x}
        y={y}
        width={TICK_TEXT_WIDTH}
        textAnchor="end"
        verticalAnchor="middle"
        fontSize={12}
        fill="#374151"
      >
        {formatStatusTickLabel(payload.value, total)}
      </Text>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 36, bottom: 5, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="status"
            width={230}
            tick={renderStatusTick}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={false}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts' Formatter generics don't line up with a per-row payload shape
            formatter={(_value: any, name: any, props: any) => {
              const row = props.payload as ChartRow;
              const count = row.counts[String(name)] ?? 0;
              return [`${count} case${count === 1 ? '' : 's'}`, name];
            }}
          />
          <Legend />
          {AGE_BANDS.map((band) => (
            <Bar
              key={band.key}
              dataKey={band.key}
              stackId="ageing"
              fill={band.color}
              barSize={18}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
          <Bar
            dataKey="empty"
            stackId="ageing"
            fill="#e5e7eb"
            barSize={18}
            legendType="none"
            isAnimationActive={false}
          >
            <LabelList dataKey="emptyLabel" position="center" fill="#9ca3af" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CaseAgeingBarChart;
