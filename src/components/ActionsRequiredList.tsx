import { ArrowRight, Clock } from 'lucide-react';
import { formatDisplayDate, getActionsRequired } from '../lib/complianceEngine';
import { EvaluatedComplianceItem } from '../types/compliance';
import { CompanyScopeLabel, StatusBadge } from './StatusBadge';

interface ActionsRequiredListProps {
  items: EvaluatedComplianceItem[];
  onSelectItem: (item: EvaluatedComplianceItem) => void;
  limit?: number;
  onViewAll?: () => void;
}

export function ActionsRequiredList({
  items,
  onSelectItem,
  limit,
  onViewAll,
}: ActionsRequiredListProps) {
  const actions = getActionsRequired(items);
  const visibleActions = limit ? actions.slice(0, limit) : actions;

  return (
    <section
      aria-label="Actions Required Queue"
      className="rounded-lg border border-line bg-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink-accent">
            Actions Required ({actions.length})
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Sorted by urgency: overdue and non-compliant items first, followed by alert-window and evidence gaps.
          </p>
        </div>
        {onViewAll && actions.length > (limit ?? 0) && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-accent hover:text-ink-link whitespace-nowrap shrink-0"
          >
            <span>View all {actions.length}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {visibleActions.length === 0 ? (
        <div className="rounded-md border border-status-green-border bg-status-green-bg p-6 text-center text-status-green-text">
          <p className="text-sm font-medium">
            No outstanding compliance actions for this division.
          </p>
          <p className="mt-1 text-xs opacity-90">
            All items are valid, verified, and outside their renewal alert windows.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line rounded-md border border-line">
          {visibleActions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item)}
              className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-hover-surface sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} label={item.statusLabel} compact />
                  <span className="font-medium text-sm text-ink-accent">{item.itemName}</span>
                  <CompanyScopeLabel company={item.company} />
                  {(item.isPendingReview || item.humanDecision) && (
                    <span className="text-xs text-ink-muted">
                      · Auto: {item.automaticStatusLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary">{item.actionSummary}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                  <span>
                    Owner: <strong className="text-ink-secondary">{item.owner || 'Missing'}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Backup:{' '}
                    {item.backupOwner ? (
                      <strong className="text-ink-secondary">{item.backupOwner}</strong>
                    ) : (
                      <strong className="text-tone-yellow">Unassigned</strong>
                    )}
                  </span>
                  {item.isPendingReview && item.daysWaiting !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={item.isAwaitingOver3Days ? 'font-semibold text-tone-pending' : ''}>
                        Waiting {item.daysWaiting}d
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0 sm:text-right">
                <div>
                  <div className="text-ink-muted">Alert Date</div>
                  <div className="font-medium text-ink-secondary">
                    {formatDisplayDate(item.alertDate)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-muted">Expiry</div>
                  <div
                    className={`font-semibold ${
                      item.isExpired
                        ? 'text-tone-red'
                        : item.isDueWithin30
                          ? 'text-tone-yellow'
                          : 'text-ink'
                    }`}
                  >
                    {item.expiryDate ? formatDisplayDate(item.expiryDate) : 'No date'}
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-1 text-ink-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {item.daysUntilExpiry === null
                      ? '—'
                      : item.daysUntilExpiry < 0
                        ? `${Math.abs(item.daysUntilExpiry)}d overdue`
                        : `${item.daysUntilExpiry}d left`}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
