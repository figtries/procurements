import type { ItemStatus } from '@/types';
import { STATUS_LABELS } from '@/lib/utils';

interface BadgeProps {
  status: ItemStatus;
}

export default function Badge({ status }: BadgeProps) {
  return (
    <span className={`badge b-${status}`}>
      <span className="bdot" /> {STATUS_LABELS[status]}
    </span>
  );
}
