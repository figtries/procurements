'use client';

import type { SCurvePoint } from '@/lib/procurement';
import { useMediaQuery } from '@/hooks/use-mobile';

/**
 * Plot geometry inside the viewBox. The wide box is drawn for a card that has
 * real width; below `sm` the card is barely wider than a phone, and scaling
 * the wide box down would shrink the axis type to about five pixels — so a
 * narrower box is drawn instead, which scales *up* and keeps the type legible.
 */
const GEOMETRY = {
  full:    { w: 640, h: 216, X0: 44, X1: 620, Y0: 190, Y1: 16, tick: 207, labels: 12, minW: 'min-w-[520px]', gap: 7 },
  compact: { w: 320, h: 200, X0: 26, X1: 312, Y0: 170, Y1: 12, tick: 191, labels: 5,  minW: '',              gap: 5 },
} as const;

interface SCurveChartProps {
  points: SCurvePoint[];
}

/**
 * Cumulative plan vs actual vs forecast.
 * Drawn as inline SVG against theme tokens so it tracks light and dark.
 */
export default function SCurveChart({ points }: SCurveChartProps) {
  const compact = useMediaQuery('(max-width: 39.99rem)');
  const g = compact ? GEOMETRY.compact : GEOMETRY.full;

  if (points.length < 2) {
    return (
      <div className="rounded-lg bg-muted/50 px-4 py-12 text-center text-sm text-muted-foreground">
        Butuh minimal dua bulan data jadwal untuk menggambar kurva-S.
      </div>
    );
  }

  const step = (g.X1 - g.X0) / (points.length - 1);
  const x = (i: number) => g.X0 + i * step;
  const y = (pct: number) => g.Y0 - (pct / 100) * (g.Y0 - g.Y1);

  const line = (pick: (p: SCurvePoint) => number | null) =>
    points
      .map((p, i) => ({ v: pick(p), i }))
      .filter((d): d is { v: number; i: number } => d.v !== null)
      .map((d, n) => `${n === 0 ? 'M' : 'L'}${x(d.i).toFixed(1)},${y(d.v).toFixed(1)}`)
      .join(' ');

  const planPath = line(p => p.plan);
  const actPath  = line(p => p.actual);
  const fcPath   = line(p => p.forecast);

  const lastActualIdx = points.map(p => p.actual !== null).lastIndexOf(true);
  const lastActual = lastActualIdx >= 0 ? points[lastActualIdx] : null;

  const areaPath = actPath
    ? `${actPath} L${x(lastActualIdx).toFixed(1)},${g.Y0} L${g.X0},${g.Y0} Z`
    : '';

  // Label every month when there is room, otherwise thin them out.
  const labelEvery = points.length > g.labels + 2 ? Math.ceil(points.length / g.labels) : 1;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${g.w} ${g.h}`}
        className={`block h-auto w-full ${g.minW}`}
        role="img"
        aria-label={
          lastActual && lastActual.actual !== null
            ? `Kurva S. Realisasi ${lastActual.actual} persen terhadap rencana ${lastActual.plan} persen.`
            : 'Kurva S rencana proyek.'
        }
      >
        <defs>
          <linearGradient id="scurve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--st-onsite)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--st-onsite)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map(pct => (
          <g key={pct}>
            <line
              x1={g.X0} y1={y(pct)} x2={g.X1} y2={y(pct)}
              stroke="var(--border)" strokeWidth={1}
            />
            <text
              x={g.X0 - 6} y={y(pct) + 3.5} textAnchor="end"
              className="fill-muted-foreground text-[10px] font-semibold tabular"
            >
              {pct}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill="url(#scurve-fill)" />}

        <path
          d={planPath} fill="none"
          stroke="var(--st-late)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
        />
        {fcPath && (
          <path
            d={fcPath} fill="none"
            stroke="var(--st-ontrack)" strokeWidth={2}
            strokeDasharray="5 4" strokeLinecap="round"
          />
        )}
        {actPath && (
          <path
            d={actPath} fill="none"
            stroke="var(--st-onsite)" strokeWidth={2.5}
            strokeLinejoin="round" strokeLinecap="round"
          />
        )}

        {/* Gap between plan and actual at the latest reported month */}
        {lastActual && lastActual.actual !== null && (
          <>
            <line
              x1={x(lastActualIdx)} y1={y(lastActual.plan)}
              x2={x(lastActualIdx)} y2={y(lastActual.actual)}
              stroke="var(--st-atrisk)" strokeWidth={g.gap} strokeLinecap="round" opacity={0.5}
            />
            <circle
              cx={x(lastActualIdx)} cy={y(lastActual.plan)} r={3.5}
              fill="var(--background)" stroke="var(--st-late)" strokeWidth={2}
            />
            <circle
              cx={x(lastActualIdx)} cy={y(lastActual.actual)} r={5.5}
              fill="var(--st-onsite)" stroke="var(--card)" strokeWidth={2.5}
            />
          </>
        )}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={p.date} x={x(i)} y={g.tick} textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-semibold"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
