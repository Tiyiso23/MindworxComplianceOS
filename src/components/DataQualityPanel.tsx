import { AlertCircle, CheckCircle2, Pencil } from 'lucide-react';
import { EvaluatedComplianceItem } from '../types/compliance';
import { CompanyScopeLabel } from './StatusBadge';

interface DataQualityPanelProps {
  items: EvaluatedComplianceItem[];
  onEditItem: (item: EvaluatedComplianceItem) => void;
  onSelectItem: (item: EvaluatedComplianceItem) => void;
}

export function DataQualityPanel({ items, onEditItem, onSelectItem }: DataQualityPanelProps) {
  const flaggedItems = items.filter((item) => item.dataQualityIssues.length > 0);

  const countByCode = (code: string) =>
    items.filter((i) => i.dataQualityIssues.some((dq) => dq.code === code)).length;

  const issueDateAfterExpiryCount = countByCode('ISSUE_AFTER_EXPIRY');
  const missingOwnershipCount = items.filter((i) =>
    i.dataQualityIssues.some((dq) => dq.code === 'MISSING_OWNER' || dq.code === 'MISSING_BACKUP')
  ).length;
  const missingLeadTimeCount = countByCode('MISSING_LEAD_TIME');
  const missingVerificationCount = countByCode('MISSING_VERIFICATION');
  const clearedNoReasonCount = countByCode('CLEARED_NO_REASON');

  return (
    <section
      aria-label="Data Quality Audit Panel"
      className="rounded-lg border border-line bg-card p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink-accent">
            Data Quality & Audit Readiness Check
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Identifies inconsistent dates, missing ownership/backups, missing lead times, unverified records, and cleared items without a reason.
          </p>
        </div>
        <span className="font-mono text-xs font-semibold text-ink-accent tabular-nums">
          {flaggedItems.length} item{flaggedItems.length === 1 ? '' : 's'} flagged
        </span>
      </div>

      {/* Breakdown Counters */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <AuditMetricCard
          label="Issue Date > Expiry Date"
          count={issueDateAfterExpiryCount}
          severity="high"
        />
        <AuditMetricCard
          label="Missing Owner or Backup"
          count={missingOwnershipCount}
          severity="medium"
        />
        <AuditMetricCard
          label="Missing Lead Time"
          count={missingLeadTimeCount}
          severity="medium"
        />
        <AuditMetricCard
          label="No Verification Record"
          count={missingVerificationCount}
          severity="high"
        />
        <AuditMetricCard
          label="Cleared with no reason recorded"
          count={clearedNoReasonCount}
          severity="high"
        />
      </div>

      {flaggedItems.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-status-green-border bg-status-green-bg p-6 text-sm font-medium text-status-green-text">
          <CheckCircle2 className="h-4 w-4 text-status-green-icon" />
          <span>All compliance records pass data quality checks.</span>
        </div>
      ) : (
        <div className="divide-y divide-line rounded-md border border-line">
          {flaggedItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="font-medium text-sm text-ink-accent hover:underline text-left"
                  >
                    {item.itemName}
                  </button>
                  <CompanyScopeLabel company={item.company} />
                  <span className="text-xs text-ink-muted">· {item.group}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {item.dataQualityIssues.map((dq) => (
                    <span
                      key={dq.code}
                      className={`inline-flex items-center gap-1 font-medium ${
                        dq.severity === 'High' ? 'text-tone-red' : 'text-tone-yellow'
                      }`}
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{dq.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onEditItem(item)}
                className="inline-flex items-center gap-1.5 self-start rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-accent transition-colors hover:bg-hover-surface sm:self-center whitespace-nowrap shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Fix Record</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AuditMetricCard({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: 'high' | 'medium';
}) {
  const tone =
    count === 0
      ? 'text-tone-green'
      : severity === 'high'
        ? 'text-tone-red'
        : 'text-tone-yellow';

  return (
    <div className="rounded-md border border-line bg-subtle px-3.5 py-3">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${tone}`}>{count}</div>
    </div>
  );
}
