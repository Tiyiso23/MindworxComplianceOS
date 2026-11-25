import { AlertTriangle, CheckCircle2, Clock, Info, XCircle } from 'lucide-react';

export function StatusRulesPanel() {
  return (
    <section
      aria-label="Compliance Status Rules"
      className="rounded-lg border border-line bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink-accent">
            Traffic-Light Status Rules & Human-in-the-Loop Governance
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Automatic rules evaluate every record; Red and low-confidence findings route to Pending review before final confirmation.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-accent">
          <Info className="h-3.5 w-3.5 text-ink-accent" aria-hidden="true" />
          Alert Date = Expiry Date − Lead Time (days)
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-status-pending-border bg-status-pending-bg p-3.5 text-status-pending-text">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-status-pending-icon shrink-0" aria-hidden="true" />
            <span>Pending review — Officer Gate</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
            <li>• Automatic Red or low-confidence findings (expired, failed/missing verification, inconsistent dates, uncertain document check).</li>
            <li>• Never counts as compliant; included in At risk total.</li>
            <li className="font-semibold">
              • Re-queues automatically if underlying data changes after a decision.
            </li>
          </ul>
        </div>

        <div className="rounded-md border border-status-red-border bg-status-red-bg p-3.5 text-status-red-text">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <XCircle className="h-4 w-4 text-status-red-icon shrink-0" aria-hidden="true" />
            <span>Red — Non-Compliant</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
            <li>• Expiry date is before the “As at” date (expired), or confirmed non-compliant in the statutory system.</li>
            <li>• Confirmed by a Compliance Officer decision (or returned by rules when cleared).</li>
            <li className="font-semibold">
              • Statutory system position overrides the document date.
            </li>
          </ul>
        </div>

        <div className="rounded-md border border-status-yellow-border bg-status-yellow-bg p-3.5 text-status-yellow-text">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-status-yellow-icon shrink-0" aria-hidden="true" />
            <span>Yellow — Action Required / Gap</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
            <li>• Expiry is within the item’s lead time or within 30 days.</li>
            <li>• Supporting document, owner, backup owner, or lead time is missing.</li>
            <li>• Compliance Officer requested more evidence with a due date.</li>
          </ul>
        </div>

        <div className="rounded-md border border-status-green-border bg-status-green-bg p-3.5 text-status-green-text">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-status-green-icon shrink-0" aria-hidden="true" />
            <span>Green — Compliant</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
            <li>• Valid and outside both the lead-time and 30-day alert windows.</li>
            <li>• All ownership, date, and evidence fields are complete.</li>
            <li className="font-semibold">
              • Stored documents never count as compliant unless verified where required.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
