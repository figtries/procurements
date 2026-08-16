'use client';

import type { SCurvePoint } from '@/lib/procurement';
import { useMediaQuery } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Plot geometry inside the viewBox. The wide box is drawn for a card that has
 * real width; below `sm` the card is barely wider than a phone, and scaling
 * the wide box down would shrink the axis type to about five pixels — so a
 * narrower box is drawn instead, which scales *up* and keeps the type legible.
 */
const GEOMETRY = {
  full:    { w: 640, h: 216, X0: 38, X1: 638, Y0: 190, Y1: 18, tick: 207, labels: 12, minW: 'min-w-[520px]', gap: 7 },
  compact: { w: 320, h: 200, X0: 36, X1: 318, Y0: 170, Y1: 16, tick: 191, labels: 5,  minW: '',              gap: 5 },
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

  // Label every month when there is room, otherwise thin them out. The final
  // month is pinned to the right edge, so a label that would sit under it is
  // dropped rather than printed on top of it.
  const labelEvery = points.length > g.labels + 2 ? Math.ceil(points.length / g.labels) : 1;
  const lastIdx = points.length - 1;
  const tickIdx = points
    .map((_, i) => i)
    .filter(i => i % labelEvery === 0 || i === lastIdx)
    .filter(i => i === lastIdx || x(i) < g.X1 - 56);

  // Near the right edge the read-out has no room to its right, so it flips.
  const labelLeft = lastActualIdx >= 0 && x(lastActualIdx) > (g.X0 + g.X1) / 2;

  // The two pills are placed over the SVG in viewBox fractions, which hold as
  // the chart scales because the SVG fills its wrapper exactly. When plan and
  // actual nearly meet, they part company so the pills never sit on top of
  // each other.
  const pctX = (v: number) => `${(v / g.w) * 100}%`;
  const pctY = (v: number) => `${(v / g.h) * 100}%`;
  const crowded =
    lastActual && lastActual.actual !== null
      ? Math.abs(y(lastActual.plan) - y(lastActual.actual)) < 26
      : false;

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className={cn('relative', g.minW)}>
      <svg
        viewBox={`0 0 ${g.w} ${g.h}`}
        className="block h-auto w-full"
        role="img"
        aria-label={
          lastActual && lastActual.actual !== null
            ? `Kurva S. Realisasi ${lastActual.actual} persen terhadap rencana ${lastActual.plan} persen.`
            : 'Kurva S rencana proyek.'
        }
      >
        <defs>
          <linearGradient id="scurve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--info)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--info)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map(pct => (
          <g key={pct}>
            <line
              x1={g.X0} y1={y(pct)} x2={g.X1} y2={y(pct)}
              stroke="var(--border)" strokeWidth={1}
            />
            <text
              x={g.X0 - 8} y={y(pct) + 3.5} textAnchor="end"
              className="fill-muted-foreground text-[10px] font-medium tabular"
            >
              {pct}%
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
            stroke="var(--ok)" strokeWidth={2}
            strokeDasharray="5 4" strokeLinecap="round"
          />
        )}
        {actPath && (
          <path
            d={actPath} fill="none"
            stroke="var(--info)" strokeWidth={2.5}
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
              fill="var(--info)" stroke="var(--card)" strokeWidth={2.5}
            />
          </>
        )}

        {/* The final month sits on the right edge, so it anchors to its own
            side instead of centring half a label off the viewBox. */}
        {tickIdx.map(i => (
          <text
            key={points[i].date}
            x={i === lastIdx ? g.X1 : x(i)}
            y={g.tick}
            textAnchor={i === lastIdx ? 'end' : 'middle'}
            className="fill-muted-foreground text-[10px] font-medium"
          >
            {points[i].label}
          </text>
        ))}
      </svg>

      {/* The read-out at the latest reported month, as the same tinted pill
          the rest of the app uses for status. The tint carries which line the
          number belongs to, so the pill holds the figure and nothing else. */}
      {lastActual && lastActual.actual !== null && (
        <>
          <Readout
            tone="late" value={lastActual.plan}
            left={pctX(x(lastActualIdx))}
            top={pctY(y(lastActual.plan) - (crowded ? 13 : 0))}
            side={labelLeft ? 'left' : 'right'}
          />
          <Readout
            tone="info" value={lastActual.actual}
            left={pctX(x(lastActualIdx))}
            top={pctY(y(lastActual.actual) + (crowded ? 13 : 0))}
            side={labelLeft ? 'left' : 'right'}
          />
        </>
      )}
      </div>
    </div>
  );
}

const TONE = {
  late: 'bg-late-bg text-late-fg',
  info: 'bg-info-bg text-info-fg',
} as const;

interface ReadoutProps {
  tone: keyof typeof TONE;
  value: number;
  left: string;
  top: string;
  side: 'left' | 'right';
}

/** One pill pinned to a point on the curve, centred on it and shifted clear. */
function Readout({ tone, value, left, top, side }: ReadoutProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'pointer-events-none absolute gap-1 border-transparent px-2 font-medium shadow-xs',
        TONE[tone],
        side === 'left'
          ? '-translate-x-[calc(100%+10px)] -translate-y-1/2'
          : 'translate-x-[10px] -translate-y-1/2',
      )}
      style={{ left, top }}
    >
      <span className="font-semibold tabular">{Math.round(value)}%</span>
    </Badge>
  );
}
