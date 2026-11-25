import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { SummaryMetrics } from '../types/compliance';

export type QuickSliceFilter =
  | 'all'
  | 'Green'
  | 'Yellow'
  | 'Red'
  | 'Pending review'
  | 'atRisk'
  | 'awaitingOver3Days'
  | 'expired'
  | 'due30'
  | 'due60'
  | 'due90'
  | 'unverified';

interface SummaryCardsProps {
  metrics: SummaryMetrics;
  onSelectSlice: (slice: QuickSliceFilter) => void;
  onOpenReviewQueue?: () => void;
}

export function SummaryCards({
  metrics,
  onSelectSlice,
  onOpenReviewQueue,
}: SummaryCardsProps) {
  const primaryCards: {
    key: QuickSliceFilter;
    label: string;
    value: number;
    subtext: string;
    icon?: 'green' | 'yellow' | 'pending' | 'red' | 'risk';
  }[] = [
    {
      key: 'all',
      label: 'Total Items',
      value: metrics.total,
      subtext: 'Active register items',
    },
    {
      key: 'Green',
      label: 'Compliant (Green)',
      value: metrics.green,
      subtext: 'Valid & verified',
      icon: 'green',
    },
    {
      key: 'Yellow',
      label: 'Action Required (Yellow)',
      value: metrics.yellow,
      subtext: 'Alert window or gap',
      icon: 'yellow',
    },
    {
      key: 'Pending review',
      label: 'Pending review',
      value: metrics.pendingReview,
      subtext: 'Awaiting officer check',
      icon: 'pending',
    },
    {
      key: 'Red',
      label: 'Non-Compliant (Red)',
      value: metrics.red,
      subtext: 'Confirmed non-compliant',
      icon: 'red',
    },
    {
      key: 'atRisk',
      label: 'At risk (Total)',
      value: metrics.atRisk,
      subtext: 'Red + Yellow + Pending',
      icon: 'risk',
    },
  ];

  const riskStrip: {
    key: QuickSliceFilter;
    label: string;
    value: number;
    tone: string;
    isQueueLink?: boolean;
  }[] = [
    {
      key: 'awaitingOver3Days',
      label: 'Awaiting decision > 3 days',
      value: metrics.awaitingOver3Days,
      tone: metrics.awaitingOver3Days > 0 ? 'text-tone-pending' : 'text-ink',
      isQueueLink: true,
    },
    {
      key: 'expired',
      label: 'Expired',
      value: metrics.expired,
      tone: metrics.expired > 0 ? 'text-tone-red' : 'text-ink',
    },
    {
      key: 'due30',
      label: 'Due within 30 days',
      value: metrics.dueWithin30,
      tone: metrics.dueWithin30 > 0 ? 'text-tone-yellow' : 'text-ink',
    },
    {
      key: 'due60',
      label: 'Due within 60 days',
      value: metrics.dueWithin60,
      tone: 'text-ink',
    },
    {
      key: 'due90',
      label: 'Due within 90 days',
      value: metrics.dueWithin90,
      tone: 'text-ink',
    },
    {
      key: 'unverified',
      label: 'Unverified (Required)',
      value: metrics.unverified,
      tone: metrics.unverified > 0 ? 'text-tone-yellow' : 'text-ink',
    },
  ];

  return (
    <section aria-label="Compliance Summary" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {primaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => {
              if (card.key === 'Pending review' && onOpenReviewQueue) {
                onOpenReviewQueue();
              } else {
                onSelectSlice(card.key);
              }
            }}
            className="group flex flex-col justify-between rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-line-strong hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-muted">{card.label}</span>
              {card.icon === 'green' && (
                <CheckCircle2 className="h-4 w-4 text-tone-green shrink-0" aria-hidden="true" />
              )}
              {card.icon === 'yellow' && (
                <AlertTriangle className="h-4 w-4 text-tone-yellow shrink-0" aria-hidden="true" />
              )}
              {card.icon === 'pending' && (
                <Clock className="h-4 w-4 text-tone-pending shrink-0" aria-hidden="true" />
              )}
              {card.icon === 'red' && (
                <XCircle className="h-4 w-4 text-tone-red shrink-0" aria-hidden="true" />
              )}
              {card.icon === 'risk' && (
                <ShieldAlert className="h-4 w-4 text-ink-accent shrink-0" aria-hidden="true" />
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="font-display text-2xl font-bold tracking-tight text-ink-accent tabular-nums sm:text-3xl">
                {card.value}
              </span>
              <span className="text-[11px] text-ink-muted group-hover:text-ink-accent text-right">
                {card.subtext}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {riskStrip.map((metric) => (
          <button
            key={metric.key}
            type="button"
            onClick={() => {
              if (metric.isQueueLink && onOpenReviewQueue) {
                onOpenReviewQueue();
              } else {
                onSelectSlice(metric.key);
              }
            }}
            className="flex items-center justify-between gap-2 bg-card px-3.5 py-3 text-left transition-colors hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus-ring"
          >
            <span className="text-xs font-medium text-ink-muted">{metric.label}</span>
            <span className={`font-mono text-base font-semibold tabular-nums ${metric.tone}`}>
              {metric.value}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
