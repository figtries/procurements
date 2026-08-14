import type { ItemStatus } from '@/types';
import { STATUS_CLASSES, STATUS_LABELS } from '@/lib/procurement';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

/** Schedule state as a tinted pill — colour and dot, so it reads at a glance. */
export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1.5 border-transparent font-medium', STATUS_CLASSES[status].chip, className)}
    >
      <span className={cn('size-1.5 rounded-full', STATUS_CLASSES[status].dot)} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
