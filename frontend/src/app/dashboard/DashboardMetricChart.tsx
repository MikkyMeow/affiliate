'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardMetricKey,
  DashboardSeriesPoint,
} from '@/lib/dashboard';

type DashboardMetricChartProps = {
  title: string;
  description: string;
  metricKey: DashboardMetricKey;
  data: DashboardSeriesPoint[];
  stroke: string;
  fill: string;
  formatValue: (value: number) => string;
};

export function DashboardMetricChart({
  title,
  description,
  metricKey,
  data,
  stroke,
  fill,
  formatValue,
}: DashboardMetricChartProps) {
  const hasNonZeroData = data.some((entry) => Number(entry[metricKey] ?? 0) > 0);

  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>

      {hasNonZeroData ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`${metricKey}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={fill} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={fill} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(113, 113, 122, 0.15)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={16}
                tick={{ fill: '#71717a', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={72}
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickFormatter={(value) => formatValue(Number(value ?? 0))}
              />
              <Tooltip
                formatter={(value) => formatValue(Number(value ?? 0))}
                labelFormatter={(label) => `Час: ${label}`}
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid rgba(113, 113, 122, 0.2)',
                  boxShadow: '0 10px 30px rgba(24, 24, 27, 0.08)',
                }}
              />
              <Area
                type="monotone"
                dataKey={metricKey}
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${metricKey}-fill)`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          За выбранный день данных нет.
        </div>
      )}
    </article>
  );
}
