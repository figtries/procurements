interface ProgBarProps {
  value: number;
  color?: string;
}

export default function ProgBar({ value, color }: ProgBarProps) {
  return (
    <div className="prog-bar">
      <div className="prog-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}
