import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Pencil,
  QrCode,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { formatDisplayDate } from '../lib/complianceEngine';
import { EvaluatedComplianceItem, UserRole } from '../types/compliance';
import { CompanyScopeLabel, StatusBadge } from './StatusBadge';

function getSafeDocumentUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

interface ItemDetailDrawerProps {
  item: EvaluatedComplianceItem | null;
  userRole: UserRole;
  onClose: () => void;
  onEdit: (item: EvaluatedComplianceItem) => void;
  onDelete: (id: string) => void;
  onOpenReview: (item: EvaluatedComplianceItem) => void;
  onCheckDocument: (item: EvaluatedComplianceItem) => void;
  onMarkAsCompliant: (item: EvaluatedComplianceItem) => void;
  onSubmitRegulatory: (item: EvaluatedComplianceItem) => void;
}

export function ItemDetailDrawer({
  item,
  userRole,
  onClose,
  onEdit,
  onDelete,
  onOpenReview,
  onCheckDocument,
  onMarkAsCompliant,
  onSubmitRegulatory,
}: ItemDetailDrawerProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConfirmDelete(false);
    setSubmissionFeedback('');
    setShowQrCode(false);
    setCopiedLink(false);
  }, [item?.id]);

  if (!item) return null;

  const isPending = item.status === 'Pending review';
  const canPerformGovernanceAction = !isPending && userRole === 'Compliance Officer';
  const safeDocumentUrl = getSafeDocumentUrl(item.documentLink);

  const handleCopyDocumentLink = async () => {
    if (!safeDocumentUrl) return;
    try {
      await navigator.clipboard.writeText(safeDocumentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
    }
  };

  const handleDownloadQrSvg = () => {
    if (!safeDocumentUrl || !qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgSource = serializer.serializeToString(svg);
    const blob = new Blob([svgSource], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const slug = item.itemName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || item.id}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-backdrop backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-drawer-title"
    >
      <div className="theme-surface flex h-full w-full max-w-2xl flex-col border-l border-line bg-card text-ink shadow-xl">
        {/* Drawer Header */}
        <div className="flex items-start justify-between gap-4 border-b border-topbar-border bg-topbar px-6 py-4 text-topbar-text">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-topbar-muted">
              <span>{item.company === 'Both' ? 'Consulting & Academy (Both)' : `Mindworx ${item.company}`}</span>
              <span aria-hidden="true">·</span>
              <span>{item.group}</span>
              <span aria-hidden="true">·</span>
              <span>{item.renewalCycle || 'Cycle unspecified'}</span>
            </div>
            <h2
              id="detail-drawer-title"
              className="mt-1 font-display text-lg font-semibold leading-snug text-topbar-text"
            >
              {item.itemName}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              setSubmissionFeedback('');
              onClose();
            }}
            className="rounded-md p-1.5 text-topbar-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close detail panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Evaluation Summary: Current Status + Automatic Result side-by-side */}
          <div className="rounded-lg border border-line bg-subtle p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} label={item.statusLabel} />
                <StatusBadge
                  status={item.automaticStatus}
                  label={`Auto rule: ${item.automaticStatusLabel}`}
                  compact
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-muted font-mono tabular-nums">
                <span>
                  Expiry: <strong className="text-ink">{formatDisplayDate(item.expiryDate)}</strong>
                </span>
                <span>
                  Alert: <strong className="text-ink">{formatDisplayDate(item.alertDate)}</strong>
                </span>
                <span>
                  {item.daysUntilExpiry === null
                    ? 'No expiry date'
                    : item.daysUntilExpiry < 0
                      ? `${Math.abs(item.daysUntilExpiry)}d overdue`
                      : `${item.daysUntilExpiry}d left`}
                </span>
              </div>
            </div>

            <ul className="space-y-1 text-xs text-ink-secondary">
              {item.statusReasons.map((reason, idx) => (
                <li key={idx}>• {reason}</li>
              ))}
            </ul>

            {/* Human-in-the-loop Review Summary & Rule 7 Controls */}
            <div className="border-t border-line pt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-ink-muted">
                {item.isPendingReview ? (
                  <span className="font-medium text-tone-pending">
                    Waiting {item.daysWaiting ?? 0}d since {formatDisplayDate(item.pendingSince)} ·
                    Downstream regulatory actions locked
                  </span>
                ) : item.humanDecision && item.reviewState ? (
                  <span>
                    Human decision: <strong className="text-ink-accent">{item.humanDecision}</strong> by{' '}
                    {item.reviewState.reviewerName} ({formatDisplayDate(item.reviewState.decisionDate)})
                  </span>
                ) : (
                  <span>No human review required (rules green/yellow).</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCheckDocument(item)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-2.5 py-1.5 text-xs font-semibold text-ink-accent hover:bg-hover-surface"
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  <span>Check document</span>
                </button>

                {isPending && (
                  <button
                    type="button"
                    onClick={() => onOpenReview(item)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-status-pending-solid px-3 py-1.5 text-xs font-semibold text-status-pending-solid-text hover:opacity-90"
                  >
                    <FileSearch className="h-3.5 w-3.5" />
                    <span>Open Review Panel</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={!canPerformGovernanceAction}
                  onClick={() => {
                    onSubmitRegulatory(item);
                    setSubmissionFeedback('Regulatory submission logged in register notes.');
                  }}
                  title={
                    isPending
                      ? 'Disabled while item is Pending review'
                      : userRole !== 'Compliance Officer'
                        ? 'Requires Compliance Officer role'
                        : 'Submit regulatory filing'
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium text-ink-accent hover:bg-hover-surface disabled:cursor-not-allowed disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit Filing</span>
                </button>

                <button
                  type="button"
                  disabled={!canPerformGovernanceAction || item.status === 'Green'}
                  onClick={() => {
                    onMarkAsCompliant(item);
                    setSubmissionFeedback('Statutory verification confirmed.');
                  }}
                  title={
                    isPending
                      ? 'Disabled while item is Pending review'
                      : userRole !== 'Compliance Officer'
                        ? 'Requires Compliance Officer role'
                        : 'Confirm statutory verification'
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium text-tone-green hover:bg-status-green-bg disabled:cursor-not-allowed disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>Mark as Compliant</span>
                </button>
              </div>
            </div>

            {submissionFeedback && (
              <div className="text-xs font-medium text-tone-green">{submissionFeedback}</div>
            )}
          </div>

          {/* Review & Finding Provenance */}
          <DetailSection title="00. Finding & Human Review Audit">
            <DetailRow label="Automatic Rule Result" value={<StatusBadge status={item.automaticStatus} label={item.automaticStatusLabel} compact />} />
            <DetailRow label="Finding Source" value={item.findingSource} />
            <DetailRow label="Trigger Reason" value={item.effectiveTriggerReason} fullWidth />
            <DetailRow
              label="Human Review Decision"
              value={item.humanDecision || (item.isPendingReview ? 'Pending review' : 'Not required')}
            />
            <DetailRow
              label="Reviewer / Date"
              value={
                item.reviewState?.reviewerName
                  ? `${item.reviewState.reviewerName} (${formatDisplayDate(item.reviewState.decisionDate)})`
                  : '—'
              }
            />
            {item.reviewState?.decisionReason && (
              <DetailRow
                label="Written Decision Reason"
                value={item.reviewState.decisionReason}
                fullWidth
              />
            )}
            {item.reviewState?.evidenceDueDate && (
              <DetailRow
                label="Requested Evidence Due Date"
                value={formatDisplayDate(item.reviewState.evidenceDueDate)}
                mono
              />
            )}
          </DetailSection>

          {/* Field Grid */}
          <DetailSection title="01. Classification & Dates">
            <DetailRow label="Company / Division" value={<CompanyScopeLabel company={item.company} />} />
            <DetailRow label="Group" value={item.group} />
            <DetailRow label="Issue Date" value={formatDisplayDate(item.issueDate)} mono />
            <DetailRow label="Expiry Date" value={formatDisplayDate(item.expiryDate)} mono />
            <DetailRow label="Renewal Cycle" value={item.renewalCycle || '—'} />
            <DetailRow
              label="Lead Time (Days)"
              value={item.leadTimeDays !== null ? `${item.leadTimeDays} days` : 'Missing'}
              mono
            />
            <DetailRow label="Calculated Alert Date" value={formatDisplayDate(item.alertDate)} mono />
          </DetailSection>

          <DetailSection title="02. Source & Credential Access">
            <DetailRow label="Source Type" value={item.sourceType} />
            <DetailRow label="How It Is Obtained" value={item.howObtained || '—'} fullWidth />
            <DetailRow label="Access Method" value={item.accessMethod || '—'} />
            <DetailRow label="Login Method" value={item.loginMethod || '—'} />
            <DetailRow
              label="Where Password / PIN Is Obtained"
              value={<span className="text-ink-secondary">{item.credentialSource || '—'}</span>}
              fullWidth
            />
            <DetailRow
              label="Document Link & Field QR Access"
              value={
                safeDocumentUrl ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={safeDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ink-link underline underline-offset-2 hover:text-ink-link-hover break-all"
                      >
                        <span>{safeDocumentUrl}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>

                      <button
                        type="button"
                        onClick={() => setShowQrCode((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-subtle px-2.5 py-1.5 text-xs font-semibold text-ink-accent transition-colors hover:bg-hover-surface shrink-0"
                      >
                        <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{showQrCode ? 'Hide QR Code' : 'Generate QR Code'}</span>
                      </button>
                    </div>

                    {showQrCode && (
                      <div className="flex flex-col gap-4 rounded-lg border border-line bg-subtle p-4 sm:flex-row sm:items-center">
                        <div
                          ref={qrContainerRef}
                          className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-2.5 shadow-xs self-start"
                        >
                          <QRCodeSVG
                            value={safeDocumentUrl}
                            size={136}
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                            level="M"
                            marginSize={1}
                            title={`QR code for ${item.itemName}`}
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div>
                            <div className="font-display text-xs font-semibold text-ink-accent">
                              Quick Field Access QR Code
                            </div>
                            <p className="mt-0.5 text-xs text-ink-secondary">
                              Scan with a mobile camera to open this compliance record directly in
                              the document management system.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleDownloadQrSvg}
                              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Download QR (SVG)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleCopyDocumentLink()}
                              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
                            >
                              {copiedLink ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-tone-green" aria-hidden="true" />
                                  <span className="text-tone-green">Link Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : item.documentLink.trim() ? (
                  <div className="space-y-1">
                    <div className="text-xs text-ink-secondary break-all">
                      {item.documentLink}
                    </div>
                    <div className="text-xs font-medium text-tone-yellow">
                      Enter a valid http:// or https:// DMS link to generate a scannable QR code.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-tone-yellow">
                      Missing document link — add a DMS link to generate a QR code.
                    </span>
                    <button
                      type="button"
                      disabled
                      title="Document link required before generating QR code"
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-muted-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted opacity-60 cursor-not-allowed"
                    >
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Generate QR Code</span>
                    </button>
                  </div>
                )
              }
              fullWidth
            />
          </DetailSection>

          <DetailSection title="03. Ownership & Statutory Verification">
            <DetailRow
              label="Primary Owner"
              value={item.owner || <span className="font-medium text-tone-red">Missing</span>}
            />
            <DetailRow
              label="Backup Owner"
              value={item.backupOwner || <span className="font-medium text-tone-yellow">Unassigned</span>}
            />
            <DetailRow label="System Verification Required" value={item.systemVerificationRequired} />
            <DetailRow label="Verified in Statutory System" value={item.verifiedInStatutorySystem} />
            <DetailRow label="Date Verified" value={formatDisplayDate(item.dateVerified)} mono />
            <DetailRow label="Verified By" value={item.verifiedBy || '—'} />
          </DetailSection>

          <DetailSection title="04. Notes">
            <div className="col-span-2 text-sm leading-relaxed text-ink-secondary">
              {item.notes || 'No notes recorded.'}
            </div>
          </DetailSection>

          {item.lastDocumentCheck && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1.5">
                <h3 className="font-display text-xs font-semibold text-ink-accent">
                  05. Latest Document Check (OCR + AI)
                </h3>
                <span className="inline-flex items-center gap-1 rounded border border-accent-soft-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ink-accent">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>AI-generated, check before use</span>
                </span>
              </div>

              <div className="rounded-md border border-line bg-subtle p-3.5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {item.lastDocumentCheck.outcome === 'Passed' ? (
                      <span className="inline-flex items-center gap-1 text-tone-green">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Check passed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-tone-pending">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Routed to Pending review</span>
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-ink-muted tabular-nums">
                    {item.lastDocumentCheck.ocrResult && (
                      <span
                        className={
                          item.lastDocumentCheck.ocrResult.confidence >= 80
                            ? 'font-semibold text-tone-green'
                            : 'font-semibold text-tone-red'
                        }
                      >
                        OCR {item.lastDocumentCheck.ocrResult.confidence}%
                      </span>
                    )}
                    <span>
                      {item.lastDocumentCheck.fileName} ·{' '}
                      {formatDisplayDate(item.lastDocumentCheck.checkedAt)}
                    </span>
                  </div>
                </div>

                <div className="text-ink-secondary">{item.lastDocumentCheck.routingReason}</div>

                {item.lastDocumentCheck.comparisons.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 border-t border-line pt-2 sm:grid-cols-2">
                    {item.lastDocumentCheck.comparisons.map((row) => (
                      <div key={row.field} className="rounded border border-line bg-card p-2 space-y-0.5">
                        <div className="flex items-center justify-between gap-1 text-[11px] text-ink-muted">
                          <span className="font-semibold text-ink">{row.label}</span>
                          <span
                            className={
                              row.allAgree
                                ? 'text-tone-green font-semibold'
                                : 'text-tone-red font-semibold'
                            }
                          >
                            {row.allAgree ? 'All 3 agree' : 'Differs / Flagged'} ({row.confidence})
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          <span className="text-ink-muted">OCR:</span>{' '}
                          {row.ocrIsAmbiguous ? 'ambiguous' : row.ocrValue || 'Not found'}
                        </div>
                        <div className="text-[11px] text-ink-secondary">
                          <span className="text-ink-muted">Gemini:</span>{' '}
                          {row.extractedValue || 'Not found'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {item.dataQualityIssues.length > 0 && (
            <div className="rounded-lg border border-status-yellow-border bg-status-yellow-bg p-4 text-status-yellow-text">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldAlert className="h-4 w-4 text-status-yellow-icon" />
                <span>Data Quality Flags ({item.dataQualityIssues.length})</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {item.dataQualityIssues.map((dq) => (
                  <li key={dq.code}>• {dq.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-6 py-3.5">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-tone-red transition-colors hover:bg-status-red-bg hover:border-status-red-border"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Item</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-tone-red">Confirm delete?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(item.id);
                  setConfirmDelete(false);
                  onClose();
                }}
                className="rounded-md bg-status-red-solid px-3 py-1.5 text-xs font-medium text-status-red-solid-text hover:opacity-90"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line-strong bg-card px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Item</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="border-b border-line pb-1.5 font-display text-xs font-semibold text-ink-accent">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  fullWidth = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
