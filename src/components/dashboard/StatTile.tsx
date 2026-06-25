interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'default' | 'accent' | 'good' | 'warn' | 'crit';
}

export default function StatTile({ label, value, sub, variant = 'default' }: StatTileProps) {
  const cls = variant === 'default' ? 'tile' : `tile tile-${variant}`;
  return (
    <div className={cls}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}
