import type { SCurvePoint } from '@/lib/utils';

/* Plot area inside the 640×216 viewBox. */
const X0 = 44, X1 = 620, Y0 = 190, Y1 = 16;

interface SCurveChartProps {
  points: SCurvePoint[];
}

/** Cumulative plan vs actual vs forecast, drawn as an inline SVG so it scales with the card. */
export default function SCurveChart({ points }: SCurveChartProps) {
  if (points.length < 2) {
    return (
      <div className="curve-empty">
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
  const actPath = line(p => p.actual);
  const fcPath = line(p => p.forecast);

  const lastActualIdx = points.map(p => p.actual !== null).lastIndexOf(true);
  const lastActual = lastActualIdx >= 0 ? points[lastActualIdx] : null;

  const areaPath = actPath
    ? `${actPath} L${x(lastActualIdx).toFixed(1)},${Y0} L${X0},${Y0} Z`
    : '';

  // Label every month when there is room, otherwise thin them out.
  const labelEvery = points.length > 14 ? Math.ceil(points.length / 12) : 1;

  return (
    <div className="chart-wrap">
      <svg
        className="curve"
        viewBox="0 0 640 216"
        role="img"
        aria-label={
          lastActual
            ? `Kurva S. Realisasi ${lastActual.actual} persen terhadap rencana ${lastActual.plan} persen.`
            : 'Kurva S rencana proyek.'
        }
      >
        <defs>
          <linearGradient id="scurve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#007AFF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#007AFF" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map(pct => (
          <g key={pct}>
            <line className="grid-line" x1={X0} y1={y(pct)} x2={X1} y2={y(pct)} />
            <text className="axis-txt num" x={X0 - 8} y={y(pct) + 4} textAnchor="end">{pct}</text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill="url(#scurve-fill)" />}

        <path
          d={planPath}
          fill="none" stroke="#A1A1A6" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
        />
        {fcPath && (
          <path
            d={fcPath}
            fill="none" stroke="#5E5CE6" strokeWidth={2}
            strokeDasharray="5 4" strokeLinecap="round"
          />
        )}
        {actPath && (
          <path
            d={actPath}
            fill="none" stroke="#007AFF" strokeWidth={2.5}
            strokeLinejoin="round" strokeLinecap="round"
          />
        )}

        {/* Gap between plan and actual at the latest reported month */}
        {lastActual && lastActual.actual !== null && (
          <>
            <line
              x1={x(lastActualIdx)} y1={y(lastActual.plan)}
              x2={x(lastActualIdx)} y2={y(lastActual.actual)}
              stroke="#F5A623" strokeWidth={7} strokeLinecap="round" opacity={0.55}
            />
            <circle cx={x(lastActualIdx)} cy={y(lastActual.plan)} r={3.5} fill="#fff" stroke="#A1A1A6" strokeWidth={2} />
            <circle cx={x(lastActualIdx)} cy={y(lastActual.actual)} r={5.5} fill="#007AFF" stroke="#fff" strokeWidth={2.5} />
          </>
        )}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.date} className="axis-txt" x={x(i)} y={207} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
