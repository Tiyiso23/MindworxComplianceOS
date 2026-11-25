import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { CompanyScope, TrafficLightStatus } from '../types/compliance';

interface StatusBadgeProps {
  status: TrafficLightStatus;
  label?: string;
  compact?: boolean;
}

export function StatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const sizeClass = compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (status === 'Pending review') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-status-pending-border bg-status-pending-bg font-medium text-status-pending-text whitespace-nowrap shrink-0 ${sizeClass}`}
      >
        <Clock className="h-3.5 w-3.5 text-status-pending-icon shrink-0" aria-hidden="true" />
        <span>{label ?? 'Pending review'}</span>
      </span>
    );
  }

  if (status === 'Red') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-status-red-border bg-status-red-bg font-medium text-status-red-text whitespace-nowrap shrink-0 ${sizeClass}`}
      >
        <XCircle className="h-3.5 w-3.5 text-status-red-icon shrink-0" aria-hidden="true" />
        <span>{label ?? 'Non-Compliant'}</span>
      </span>
    );
  }

  if (status === 'Yellow') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-status-yellow-border bg-status-yellow-bg font-medium text-status-yellow-text whitespace-nowrap shrink-0 ${sizeClass}`}
      >
        <AlertTriangle className="h-3.5 w-3.5 text-status-yellow-icon shrink-0" aria-hidden="true" />
        <span>{label ?? 'Action Required'}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-status-green-border bg-status-green-bg font-medium text-status-green-text whitespace-nowrap shrink-0 ${sizeClass}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-status-green-icon shrink-0" aria-hidden="true" />
      <span>{label ?? 'Compliant'}</span>
    </span>
  );
}

export function CompanyScopeLabel({ company }: { company: CompanyScope }) {
  if (company === 'Both') {
    return (
      <span className="inline-flex items-center rounded border border-accent-soft-border bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-ink-accent whitespace-nowrap shrink-0">
        Both
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-ink-muted whitespace-nowrap shrink-0">
      {company}
    </span>
  );
}
