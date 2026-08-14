import type { SCurvePoint } from '@/lib/procurement';

/* Plot area inside the 640×216 viewBox. */
const X0 = 44, X1 = 620, Y0 = 190, Y1 = 16;

interface SCurveChartProps {
  points: SCurvePoint[];
}

/**
 * Cumulative plan vs actual vs forecast.
 * Drawn as inline SVG against theme tokens so it tracks light and dark.
 */
export default function SCurveChart({ points }: SCurveChartProps) {
  if (points.length < 2) {
    return (
      <div className="rounded-lg bg-muted/50 px-4 py-12 text-center text-sm text-muted-foreground">
        Butuh minimal dua bulan data jadwal untuk menggambar kurva-S.
      </div>
    );
  }

  const step = (X1 - X0) / (points.length - 1);
  const x = (i: number) => X0 + i * step;
  const y = (pct: number) => Y0 - (pct / 100) * (Y0 - Y1);

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
    ? `${actPath} L${x(lastActualIdx).toFixed(1)},${Y0} L${X0},${Y0} Z`
    : '';

  // Label every month when there is room, otherwise thin them out.
  const labelEvery = points.length > 14 ? Math.ceil(points.length / 12) : 1;

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox="0 0 640 216"
        className="block h-auto w-full min-w-[520px]"
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
              x1={X0} y1={y(pct)} x2={X1} y2={y(pct)}
              stroke="var(--border)" strokeWidth={1}
            />
            <text
              x={X0 - 8} y={y(pct) + 4} textAnchor="end"
              className="fill-muted-foreground text-[10px] font-semibold tabular"
            >
              {pct}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill="url(#scurve-fill)" />}

        <path
          d={planPath} fill="none"
          stroke="var(--muted-foreground)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
        />
        {fcPath && (
          <path
            d={fcPath} fill="none"
            stroke="var(--ms-rts)" strokeWidth={2}
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
              stroke="var(--st-atrisk)" strokeWidth={7} strokeLinecap="round" opacity={0.5}
            />
            <circle
              cx={x(lastActualIdx)} cy={y(lastActual.plan)} r={3.5}
              fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={2}
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
              key={p.date} x={x(i)} y={207} textAnchor="middle"
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
