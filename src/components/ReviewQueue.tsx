import { AlertTriangle, CheckCircle2, Clock, Download, FileSearch, History } from 'lucide-react';
import {
  exportAuditTrailToCsv,
  formatDisplayDate,
  getPendingReviewQueue,
} from '../lib/complianceEngine';
import {
  EvaluatedComplianceItem,
  ReviewAuditEntry,
  UserRole,
} from '../types/compliance';
import { CompanyScopeLabel, StatusBadge } from './StatusBadge';

interface ReviewQueueProps {
  items: EvaluatedComplianceItem[];
  decisionHistory: ReviewAuditEntry[];
  userRole: UserRole;
  isSampleData: boolean;
  onOpenReviewPanel: (item: EvaluatedComplianceItem) => void;
  onSelectItem: (item: EvaluatedComplianceItem) => void;
}

export function ReviewQueue({
  items,
  decisionHistory,
  userRole,
  isSampleData,
  onOpenReviewPanel,
  onSelectItem,
}: ReviewQueueProps) {
  const queue = getPendingReviewQueue(items);
  const overdueQueueCount = queue.filter((i) => i.isAwaitingOver3Days).length;

  const handleExportAuditCsv = () => {
    const csv = exportAuditTrailToCsv(decisionHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindworx-review-audit-trail.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Pending Review Queue */}
      <section
        aria-label="Pending Review Queue"
        className="rounded-lg border border-line bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold text-ink-accent">
                Review Queue — Human-in-the-Loop Gate ({queue.length})
              </h2>
              {isSampleData && (
                <span className="text-xs font-semibold text-ink-accent">· SAMPLE DATA</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              Sorted oldest first. Active role: <strong className="text-ink-accent">{userRole}</strong>
              {userRole !== 'Compliance Officer' &&
                ' (view-only; switch to Compliance Officer to record decisions)'}
              .
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="inline-flex items-center gap-1.5 font-medium text-tone-pending">
              <Clock className="h-3.5 w-3.5 text-tone-pending" aria-hidden="true" />
              <span>{queue.length} awaiting review</span>
            </span>
            <span aria-hidden="true" className="text-line-strong">
              |
            </span>
            <span
              className={`font-semibold ${
                overdueQueueCount > 0 ? 'text-tone-red' : 'text-ink-muted'
              }`}
            >
              {overdueQueueCount} waiting &gt; 3 days
            </span>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <CheckCircle2 className="h-6 w-6 text-tone-green" />
            <p className="text-sm font-medium text-ink">
              No items currently awaiting review in this division.
            </p>
            <p className="text-xs text-ink-muted">
              Automatic Red or low-confidence findings will appear here before final non-compliance confirmation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-xs font-semibold text-ink-muted">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Trigger Reason</th>
                  <th className="px-4 py-3">Finding Source</th>
                  <th className="px-4 py-3 text-right">Days Waiting</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {queue.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      item.isAwaitingOver3Days
                        ? 'bg-status-pending-bg hover:bg-hover-surface'
                        : 'hover:bg-hover-surface'
                    }
                  >
                    <td className="px-4 py-3 align-top">
                      <CompanyScopeLabel company={item.company} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="font-medium text-ink-accent hover:underline text-left"
                      >
                        {item.itemName}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={item.status} label={item.statusLabel} compact />
                        <span className="text-xs text-ink-muted">
                          Auto: {item.automaticStatusLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-ink-secondary max-w-sm">
                      {item.effectiveTriggerReason}
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-ink-secondary whitespace-nowrap">
                      {item.findingSource}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-mono text-xs tabular-nums whitespace-nowrap">
                      {item.isAwaitingOver3Days ? (
                        <span className="inline-flex items-center gap-1 rounded border border-status-red-border bg-status-red-bg px-2 py-0.5 font-semibold text-status-red-text">
                          <AlertTriangle className="h-3.5 w-3.5 text-status-red-icon" aria-hidden="true" />
                          <span>{item.daysWaiting}d (&gt;3d)</span>
                        </span>
                      ) : (
                        <span className="font-medium text-ink">
                          {item.daysWaiting ?? 0}d
                        </span>
                      )}
                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        Since {formatDisplayDate(item.pendingSince)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-ink-secondary whitespace-nowrap">
                      <div className="font-medium text-ink">
                        {item.owner || <span className="text-tone-red">Missing</span>}
                      </div>
                      <div className="text-ink-muted">
                        {item.backupOwner ? `Backup: ${item.backupOwner}` : 'No backup'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenReviewPanel(item)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover"
                      >
                        <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Open Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Decision History (Audit Trail) */}
      <section
        aria-label="Decision History Audit Trail"
        className="rounded-lg border border-line bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div className="flex items-center gap-2.5">
            <History className="h-4 w-4 text-ink-accent shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-semibold text-ink-accent">
                Decision History (Audit Trail) — {decisionHistory.length} record
                {decisionHistory.length === 1 ? '' : 's'}
              </h2>
              <p className="text-xs text-ink-muted">
                Immutable log preserving the automatic rule result alongside every Compliance Officer decision.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportAuditCsv}
            disabled={decisionHistory.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3.5 py-2 text-xs font-semibold text-ink-accent hover:bg-hover-surface disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export Audit CSV</span>
          </button>
        </div>

        {decisionHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            No review decisions have been recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-xs font-semibold text-ink-muted">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Auto Finding</th>
                  <th className="px-4 py-3">Decision / Event</th>
                  <th className="px-4 py-3">Reviewer / Source</th>
                  <th className="px-4 py-3 text-right">Date</th>
                  <th className="px-4 py-3">Written Reason / Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {decisionHistory.map((entry) => (
                  <tr key={entry.id} className="align-top hover:bg-hover-surface">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-accent">{entry.itemName}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                        <CompanyScopeLabel company={entry.company} />
                        <span>· {entry.findingSource}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.automaticStatus} compact />
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-ink whitespace-nowrap">
                      <div>{entry.decision}</div>
                      {entry.checkResult && (
                        <div
                          className={`mt-0.5 font-medium ${
                            entry.checkResult === 'Passed'
                              ? 'text-tone-green'
                              : 'text-tone-pending'
                          }`}
                        >
                          {entry.checkResult}
                        </div>
                      )}
                      {entry.evidenceDueDate && (
                        <div className="mt-0.5 font-mono font-normal text-tone-yellow tabular-nums">
                          Due: {formatDisplayDate(entry.evidenceDueDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-secondary whitespace-nowrap">
                      {entry.reviewerName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink-secondary tabular-nums whitespace-nowrap">
                      {formatDisplayDate(entry.decisionDate)}
                    </td>
                    <td className="px-4 py-3 text-xs leading-relaxed text-ink-secondary max-w-md">
                      {entry.decisionReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
