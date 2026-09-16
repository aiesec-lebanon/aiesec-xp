"use client";

import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { SURFACE, TEXT } from "@/lib/design/tokens";

import { axis, grid, line, SERIES_LABEL, SERIES_ORDER, STAGE_RAMP } from "./chart-theme";

export type FunnelTrendPoint = {
  /** Bucket label as it should read on the axis. */
  label: string;
} & Partial<Record<keyof typeof SERIES_LABEL, number>>;

export type FunnelTrendChartProps = {
  data: readonly FunnelTrendPoint[];
  /** Names what is plotted; a chart with a legend still needs a title. */
  title: string;
  height?: number;
};

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey as string} className="flex items-center gap-2 text-ink-secondary">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: entry.color }}
          />
          {SERIES_LABEL[entry.dataKey as keyof typeof SERIES_LABEL]}
          <span className="tabular ml-auto text-ink">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// Every value is reachable without reading the plot: the table below is the
// accessible equivalent of the line chart, not an optional extra, and it is what
// makes the chart usable by keyboard and screen reader (Architecture.md 9).
export function FunnelTrendChart({ data, title, height = 260 }: FunnelTrendChartProps) {
  const reduceMotion = useReduceMotion();
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const ramp = STAGE_RAMP;

  return (
    <figure className="flex flex-col gap-3 rounded-xl bg-surface-raised p-4">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-ink">{title}</span>
        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink-secondary"
        >
          {showTable ? "Hide values" : "Show values"}
        </button>
      </figcaption>

      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data as FunnelTrendPoint[]} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="label" {...axis} />
            <YAxis allowDecimals={false} width={44} {...axis} />
            <Tooltip
              content={ChartTooltip}
              cursor={{ stroke: SURFACE.line, strokeWidth: 1 }}
              isAnimationActive={!reduceMotion}
            />
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, color: TEXT.secondary, paddingTop: 8 }}
              formatter={(value) => (
                <span style={{ color: TEXT.secondary }}>
                  {SERIES_LABEL[value as keyof typeof SERIES_LABEL] ?? value}
                </span>
              )}
            />
            {SERIES_ORDER.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={ramp[key]}
                isAnimationActive={!reduceMotion}
                {...line}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table id={tableId} className={showTable ? "w-full text-left text-xs" : "sr-only"}>
        <caption className="sr-only">{title}, as values</caption>
        <thead className="text-ink-muted">
          <tr>
            <th scope="col" className="py-1 font-normal">
              Period
            </th>
            {SERIES_ORDER.map((key) => (
              <th scope="col" key={key} className="py-1 text-right font-normal">
                {SERIES_LABEL[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink-secondary">
          {data.map((point) => (
            <tr key={point.label} className="border-t border-line">
              <th scope="row" className="py-1 font-normal">
                {point.label}
              </th>
              {SERIES_ORDER.map((key) => (
                <td key={key} className="tabular py-1 text-right">
                  {point[key] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
