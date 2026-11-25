import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Lock,
  Send,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDisplayDate } from '../lib/complianceEngine';
import {
  EvaluatedComplianceItem,
  ReviewDecisionType,
  UserRole,
} from '../types/compliance';
import { CompanyScopeLabel, StatusBadge } from './StatusBadge';

interface ReviewDecisionModalProps {
  item: EvaluatedComplianceItem | null;
  asAtDate: string;
  userRole: UserRole;
  onDecide: (
    itemId: string,
    payload: {
      decision: ReviewDecisionType;
      reviewerName: string;
      decisionDate: string;
      decisionReason: string;
      evidenceDueDate: string;
    }
  ) => void;
  onClose: () => void;
}

export function ReviewDecisionModal({
  item,
  asAtDate,
  userRole,
  onDecide,
  onClose,
}: ReviewDecisionModalProps) {
  const [reviewerName, setReviewerName] = useState('S. Naidoo');
  const [decisionDate, setDecisionDate] = useState(asAtDate);
  const [decisionReason, setDecisionReason] = useState('');
  const [evidenceDueDate, setEvidenceDueDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setReviewerName(item.reviewState?.reviewerName || 'S. Naidoo');
      setDecisionDate(asAtDate);
      setDecisionReason('');
      setEvidenceDueDate(item.reviewState?.evidenceDueDate || '');
      setError('');
    }
  }, [item, asAtDate]);

  if (!item) return null;

  const isComplianceOfficer = userRole === 'Compliance Officer';

  const handleDecision = (decision: ReviewDecisionType) => {
    if (!isComplianceOfficer) return;
    if (!reviewerName.trim()) {
      setError('Reviewer name is required.');
      return;
    }
    if (!decisionDate.trim()) {
      setError('Decision date is required.');
      return;
    }
    if (!decisionReason.trim()) {
      setError('A written reason is required before recording any review decision.');
      return;
    }
    if (decision === 'Request more evidence' && !evidenceDueDate.trim()) {
      setError('An evidence due date is required when requesting more evidence.');
      return;
    }

    onDecide(item.id, {
      decision,
      reviewerName: reviewerName.trim(),
      decisionDate: decisionDate.trim(),
      decisionReason: decisionReason.trim(),
      evidenceDueDate: decision === 'Request more evidence' ? evidenceDueDate.trim() : '',
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-panel-title"
    >
      <div className="theme-surface flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg border border-line bg-card text-ink shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-topbar-border bg-topbar px-6 py-4 text-topbar-text rounded-t-lg">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-topbar-muted">
              <span>Compliance Officer Review Panel</span>
              <span aria-hidden="true">·</span>
              <span>{item.company === 'Both' ? 'Consulting & Academy (Both)' : `Mindworx ${item.company}`}</span>
              <span aria-hidden="true">·</span>
              <span>{item.group}</span>
            </div>
            <h2
              id="review-panel-title"
              className="mt-1 font-display text-lg font-semibold leading-snug text-topbar-text"
            >
              {item.itemName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-topbar-muted hover:bg-white/10 hover:text-white"
            aria-label="Close review panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Role Permission Notice */}
          {!isComplianceOfficer && (
            <div className="flex items-start gap-2.5 rounded-md border border-status-yellow-border bg-status-yellow-bg p-3.5 text-xs text-status-yellow-text">
              <Lock className="mt-0.5 h-4 w-4 text-status-yellow-icon shrink-0" aria-hidden="true" />
              <div>
                <strong className="font-semibold">Read-only access ({userRole}).</strong> Only a
                user with the <strong>Compliance Officer</strong> role can decide a review. Switch
                roles in the workspace bar to record a decision.
              </div>
            </div>
          )}

          {/* Status & Timing Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-subtle p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} label={item.statusLabel} />
              <CompanyScopeLabel company={item.company} />
              {item.isAwaitingOver3Days && (
                <span className="inline-flex items-center gap-1 rounded-md border border-status-pending-border bg-status-pending-bg px-2 py-0.5 text-xs font-semibold text-status-pending-text">
                  <AlertTriangle className="h-3.5 w-3.5 text-status-pending-icon" aria-hidden="true" />
                  <span>Waiting {item.daysWaiting}d (&gt; 3 days)</span>
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-ink-muted tabular-nums">
              Pending since: <strong className="text-ink">{formatDisplayDate(item.pendingSince)}</strong> ·
              Owner: <strong className="text-ink">{item.owner || 'Missing'}</strong>
            </div>
          </div>

          {/* Automatic Finding & Trigger Rule */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line bg-subtle p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-muted">
                  Automatic Rule Engine Result
                </span>
                <StatusBadge
                  status={item.automaticStatus}
                  label={`Auto: ${item.automaticStatusLabel}`}
                  compact
                />
              </div>
              <ul className="space-y-1 text-xs text-ink-secondary">
                {item.automaticReasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-line bg-subtle p-4 space-y-2">
              <div className="text-xs font-semibold text-ink-muted">
                Trigger & Evidence Reference
              </div>
              <div className="text-xs text-ink-secondary">
                <span className="font-medium text-ink-muted">Finding source:</span>{' '}
                <strong className="text-ink-accent">{item.findingSource}</strong>
              </div>
              <div className="text-xs text-ink-secondary">
                <span className="font-medium text-ink-muted">Rule / trigger reason:</span>{' '}
                <span>{item.effectiveTriggerReason}</span>
              </div>
              <div className="pt-1 text-xs space-y-1">
                <div>
                  <span className="font-medium text-ink-muted">Uploaded file / document link:</span>{' '}
                  {item.documentLink ? (
                    <a
                      href={item.documentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-ink-link underline underline-offset-2 hover:text-ink-link-hover break-all"
                    >
                      <span>Open Supporting Document</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="font-medium text-tone-yellow">No supporting document linked</span>
                  )}
                </div>
                {item.lastDocumentCheck?.fileName && (
                  <div className="text-ink-muted">
                    Checked file:{' '}
                    <strong className="font-mono text-ink">{item.lastDocumentCheck.fileName}</strong>{' '}
                    ({formatDisplayDate(item.lastDocumentCheck.checkedAt)})
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Extracted Values from OCR + AI Document Check */}
          {item.lastDocumentCheck && (
            <div className="rounded-lg border border-line bg-subtle p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xs font-semibold text-ink-accent">
                    Document Check Readings (Register vs OCR vs Gemini)
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded border border-accent-soft-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ink-accent">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    <span>AI-generated, check before use</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-ink-muted tabular-nums">
                  {item.lastDocumentCheck.ocrResult && (
                    <span
                      className={`font-semibold ${
                        item.lastDocumentCheck.ocrResult.confidence >= 80
                          ? 'text-tone-green'
                          : 'text-tone-red'
                      }`}
                    >
                      OCR: {item.lastDocumentCheck.ocrResult.confidence}% (
                      {item.lastDocumentCheck.ocrResult.confidenceLevel})
                    </span>
                  )}
                  <span>
                    {item.lastDocumentCheck.fileName} · Checked{' '}
                    {formatDisplayDate(item.lastDocumentCheck.checkedAt)}
                  </span>
                </div>
              </div>

              {item.lastDocumentCheck.comparisons.length > 0 ? (
                <div className="overflow-x-auto rounded border border-line bg-card">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-subtle font-semibold text-ink-muted">
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Register</th>
                        <th className="px-3 py-2">OCR Reading</th>
                        <th className="px-3 py-2">Gemini Reading</th>
                        <th className="px-3 py-2">Status / Conf.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {item.lastDocumentCheck.comparisons.map((row) => (
                        <tr
                          key={row.field}
                          className={!row.allAgree || row.isMissing || row.ocrIsAmbiguous ? 'bg-status-red-bg/40' : ''}
                        >
                          <td className="px-3 py-2 font-medium text-ink">{row.label}</td>
                          <td className="px-3 py-2 text-ink-secondary">
                            {row.registerValue || '—'}
                          </td>
                          <td className="px-3 py-2 font-medium text-ink">
                            {row.ocrIsAmbiguous ? (
                              <span className="font-semibold text-tone-yellow">ambiguous</span>
                            ) : row.ocrValue ? (
                              <span className={!row.ocrMatchesRegister || !row.ocrGeminiAgree ? 'text-tone-red' : ''}>
                                {row.ocrValue}
                              </span>
                            ) : (
                              <span className="italic text-tone-red">Not found</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-ink">
                            {row.extractedValue ? (
                              <span className={!row.geminiMatchesRegister || !row.ocrGeminiAgree ? 'text-tone-red' : ''}>
                                {row.extractedValue}
                              </span>
                            ) : (
                              <span className="italic text-tone-red">Not found</span>
                            )}
                            {row.confidence === 'Low' && row.lowConfidenceReason && (
                              <div className="text-[11px] text-tone-red">
                                {row.lowConfidenceReason}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={
                                row.allAgree
                                  ? 'font-semibold text-tone-green'
                                  : 'font-semibold text-tone-red'
                              }
                            >
                              {row.allAgree
                                ? 'All agree'
                                : row.ocrIsAmbiguous
                                  ? 'Ambiguous'
                                  : !row.ocrGeminiAgree && !row.ocrIsMissing && !row.geminiIsMissing
                                    ? 'OCR vs AI differ'
                                    : row.isMissing
                                      ? 'Missing'
                                      : 'Differs'}
                            </span>{' '}
                            {item.lastDocumentCheck?.aiAvailable && (
                              <span className="text-ink-muted">({row.confidence})</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded border border-status-red-border bg-status-red-bg px-3 py-2 text-xs text-status-red-text">
                  {item.lastDocumentCheck.routingReason}
                  {item.lastDocumentCheck.errorMessage
                    ? ` (${item.lastDocumentCheck.errorMessage})`
                    : ''}
                </div>
              )}

              {item.lastDocumentCheck.extraction && (
                <div className="flex flex-wrap gap-4 text-xs text-ink-secondary">
                  <span>
                    Signature present:{' '}
                    <strong className="text-ink">
                      {item.lastDocumentCheck.extraction.signaturePresent.value}
                    </strong>{' '}
                    ({item.lastDocumentCheck.extraction.signaturePresent.confidence})
                  </span>
                  <span>
                    Stamp present:{' '}
                    <strong className="text-ink">
                      {item.lastDocumentCheck.extraction.stampPresent.value}
                    </strong>{' '}
                    ({item.lastDocumentCheck.extraction.stampPresent.confidence})
                  </span>
                  <span>
                    Reference number present:{' '}
                    <strong className="text-ink">
                      {item.lastDocumentCheck.extraction.referenceNumberPresent.value}
                    </strong>{' '}
                    ({item.lastDocumentCheck.extraction.referenceNumberPresent.confidence})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Locked Downstream Actions Notice (Rule 7) */}
          {item.status === 'Pending review' && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-subtle px-4 py-3">
              <div className="text-xs text-ink-muted">
                Regulatory submissions and “Mark as compliant” are locked while status is{' '}
                <strong className="text-tone-pending">Pending review</strong>.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Disabled while item is Pending review"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-muted-surface px-3 py-1.5 text-xs font-medium text-ink-muted opacity-60 cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit Regulatory Filing</span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Disabled while item is Pending review"
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-muted-surface px-3 py-1.5 text-xs font-medium text-ink-muted opacity-60 cursor-not-allowed"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>Mark as Compliant</span>
                </button>
              </div>
            </div>
          )}

          {/* Decision Form */}
          <div className="rounded-lg border border-line bg-card p-4 space-y-4">
            <h3 className="font-display text-sm font-semibold text-ink-accent">
              Record Compliance Officer Decision
            </h3>

            {error && (
              <div className="rounded-md border border-status-red-border bg-status-red-bg px-3.5 py-2 text-xs font-medium text-status-red-text">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Reviewer Name <span className="text-tone-red">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isComplianceOfficer}
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Compliance Officer name"
                  className="mt-1 w-full rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink placeholder:text-ink-muted disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60 focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Decision Date <span className="text-tone-red">*</span>
                </label>
                <input
                  type="date"
                  disabled={!isComplianceOfficer}
                  value={decisionDate}
                  onChange={(e) => setDecisionDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line-strong bg-subtle px-3 py-2 font-mono text-sm text-ink disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60 focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Evidence Due Date (if requesting evidence)
                </label>
                <input
                  type="date"
                  disabled={!isComplianceOfficer}
                  value={evidenceDueDate}
                  onChange={(e) => setEvidenceDueDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line-strong bg-subtle px-3 py-2 font-mono text-sm text-ink disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60 focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary">
                Written Reason (mandatory for all outcomes) <span className="text-tone-red">*</span>
              </label>
              <textarea
                rows={3}
                disabled={!isComplianceOfficer}
                value={decisionReason}
                onChange={(e) => {
                  setDecisionReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Explain why this item is confirmed non-compliant, cleared back to rule status, or requires additional owner evidence..."
                className="mt-1 w-full rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink placeholder:text-ink-muted disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60 focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
              />
            </div>

            {/* Three Decision Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={!isComplianceOfficer}
                onClick={() => handleDecision('Confirm non-compliant')}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-red-solid px-4 py-2 text-xs font-semibold text-status-red-solid-text transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span>Confirm non-compliant (Red)</span>
              </button>

              <button
                type="button"
                disabled={!isComplianceOfficer}
                onClick={() => handleDecision('Clear')}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Clear (Return to {item.automaticStatusLabel})</span>
              </button>

              <button
                type="button"
                disabled={!isComplianceOfficer}
                onClick={() => handleDecision('Request more evidence')}
                className="inline-flex items-center gap-1.5 rounded-md border border-status-yellow-border bg-status-yellow-solid px-4 py-2 text-xs font-semibold text-status-yellow-solid-text transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:border-line disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60"
              >
                <Clock className="h-4 w-4 shrink-0" />
                <span>Request more evidence (Yellow)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-line bg-subtle px-6 py-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line-strong bg-card px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
