import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDisplayDate } from '../lib/complianceEngine';
import { SimulatedEmailNotification } from '../types/compliance';
import { StatusBadge } from './StatusBadge';

interface EmailPreviewPanelProps {
  isOpen: boolean;
  notifications: SimulatedEmailNotification[];
  selectedId: string | null;
  onSelectId: (id: string) => void;
  onSimulateSend: (id: string) => void;
  onOpenItem: (itemId: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

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

export function EmailPreviewPanel({
  isOpen,
  notifications,
  selectedId,
  onSelectId,
  onSimulateSend,
  onOpenItem,
  onClearAll,
  onClose,
}: EmailPreviewPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  useEffect(() => {
    setCopiedId(null);
    setViewMode('formatted');
  }, [selectedId, isOpen]);

  if (!isOpen) return null;

  const active =
    notifications.find((n) => n.id === selectedId) ?? notifications[0] ?? null;

  const safeDocUrl = active ? getSafeDocumentUrl(active.documentLink) : null;

  const handleCopyEmail = async (notification: SimulatedEmailNotification) => {
    try {
      await navigator.clipboard.writeText(notification.plainTextEmail);
      setCopiedId(notification.id);
      setTimeout(() => {
        setCopiedId((current) => (current === notification.id ? null : current));
      }, 2000);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-backdrop backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-preview-title"
    >
      <div className="theme-surface flex h-full w-full max-w-3xl flex-col border-l border-line bg-card text-ink shadow-xl">
        {/* Panel Top Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-topbar-border bg-topbar px-6 py-4 text-topbar-text">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-topbar-muted">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Simulated Notification Service</span>
              <span aria-hidden="true">·</span>
              <span>Prototype preview only (no real email sent)</span>
            </div>
            <h2
              id="email-preview-title"
              className="mt-1 font-display text-lg font-semibold leading-snug text-topbar-text"
            >
              Email Preview
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-topbar-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close email preview panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {notifications.length === 0 || !active ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-subtle text-ink-accent">
              <Mail className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold text-ink">
              No status notifications queued yet
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-ink-muted">
              Whenever a compliance item changes status to <strong className="text-ink">Red</strong>{' '}
              (Non-Compliant) or <strong className="text-ink">Pending review</strong>, this
              simulated service automatically generates an owner notification preview here.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Multi-Notification Selector Strip */}
            {notifications.length > 1 && (
              <div className="border-b border-line bg-subtle px-6 py-3">
                <div className="flex items-center justify-between gap-2 pb-2">
                  <span className="text-xs font-semibold text-ink-secondary tabular-nums">
                    Generated owner notifications ({notifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="inline-flex items-center gap-1 text-xs font-medium text-tone-red hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clear all</span>
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {notifications.map((notif) => {
                    const isSelected = notif.id === active.id;
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => onSelectId(notif.id)}
                        className={`flex min-w-[220px] max-w-[260px] shrink-0 flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-accent bg-card text-ink shadow-xs'
                            : 'border-line bg-card/60 text-ink-secondary hover:bg-hover-surface'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <StatusBadge
                            status={notif.newStatus}
                            label={notif.newStatus === 'Red' ? 'Non-Compliant' : 'Pending review'}
                            compact
                          />
                          <span className="text-[11px] font-mono text-ink-muted tabular-nums">
                            {notif.deliveryStatus === 'Simulated Sent' ? 'Sent' : 'Preview'}
                          </span>
                        </div>
                        <span className="w-full truncate text-xs font-semibold text-ink">
                          {notif.itemName}
                        </span>
                        <span className="w-full truncate text-[11px] text-ink-muted">
                          To: {notif.recipientName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main Email Preview Frame */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Transition Context & View Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <StatusBadge
                    status={active.newStatus}
                    label={active.newStatus === 'Red' ? 'Non-Compliant (Red)' : 'Pending review'}
                  />
                  <span>
                    Transition:{' '}
                    <strong className="text-ink">{active.previousStatus}</strong> to{' '}
                    <strong className="text-ink">{active.newStatus}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {active.deliveryStatus === 'Simulated Sent' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-tone-green">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Simulated Sent</span>
                      </span>
                    ) : (
                      <span>Awaiting simulated send</span>
                    )}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label="Email preview format"
                  className="inline-flex items-center rounded-md border border-line bg-subtle p-0.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('formatted')}
                    className={`rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === 'formatted'
                        ? 'bg-accent text-on-accent'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    Formatted Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('raw')}
                    className={`rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === 'raw'
                        ? 'bg-accent text-on-accent'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    Plain Text
                  </button>
                </div>
              </div>

              {/* Email Client Envelope */}
              <div className="rounded-lg border border-line bg-card overflow-hidden">
                {/* Envelope Headers */}
                <div className="border-b border-line bg-subtle px-5 py-4 space-y-2 text-xs">
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-2">
                    <span className="font-medium text-ink-muted">From</span>
                    <span className="text-ink">
                      {active.senderName}{' '}
                      <span className="font-mono text-ink-muted">&lt;{active.senderEmail}&gt;</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-2">
                    <span className="font-medium text-ink-muted">To</span>
                    <span className="font-medium text-ink">
                      {active.recipientName}{' '}
                      <span className="font-mono font-normal text-ink-muted">
                        &lt;{active.recipientEmail}&gt;
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-2">
                    <span className="font-medium text-ink-muted">Cc</span>
                    <span className="text-ink-secondary">
                      {active.ccRecipientName}{' '}
                      <span className="font-mono text-ink-muted">
                        &lt;{active.ccRecipientEmail}&gt;
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-2">
                    <span className="font-medium text-ink-muted">Date</span>
                    <span className="font-mono text-ink-secondary tabular-nums">
                      {formatDisplayDate(active.asAtDate)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-2 border-t border-line pt-2 mt-2">
                    <span className="font-medium text-ink-muted">Subject</span>
                    <span className="font-display text-sm font-semibold text-ink">
                      {active.subject}
                    </span>
                  </div>
                </div>

                {/* Email Content */}
                {viewMode === 'formatted' ? (
                  <div className="px-5 py-5 space-y-5 text-sm leading-relaxed text-ink">
                    <p className="font-medium text-ink">{active.greeting}</p>

                    <p className="text-ink-secondary">{active.leadMessage}</p>

                    {/* Structured Compliance Summary inside Email */}
                    <div className="rounded-md border border-line bg-subtle p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                        <span className="font-display text-xs font-semibold text-ink-accent">
                          Compliance Record Details
                        </span>
                        <span className="text-xs text-ink-muted">
                          {active.company === 'Both'
                            ? 'Consulting & Academy (Both)'
                            : `Mindworx ${active.company}`}{' '}
                          · {active.group}
                        </span>
                      </div>

                      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-ink-muted">Compliance Item</dt>
                          <dd className="mt-0.5 font-semibold text-ink">{active.itemName}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-ink-muted">New Status</dt>
                          <dd className="mt-0.5 font-semibold text-ink">
                            {active.newStatus === 'Red' ? 'Non-Compliant (Red)' : 'Pending review'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-ink-muted">Automatic Rule Result</dt>
                          <dd className="mt-0.5 text-ink">{active.automaticStatusLabel}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-ink-muted">Finding Source</dt>
                          <dd className="mt-0.5 text-ink">{active.findingSource}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-ink-muted">Expiry Date</dt>
                          <dd className="mt-0.5 font-mono text-ink tabular-nums">
                            {active.expiryDateDisplay}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-ink-muted">Document Reference</dt>
                          <dd className="mt-0.5">
                            {safeDocUrl ? (
                              <a
                                href={safeDocUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-ink-link underline underline-offset-2 hover:text-ink-link-hover"
                              >
                                <span>Open DMS Document</span>
                                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-tone-yellow font-medium">
                                {active.documentLink || 'Missing document link'}
                              </span>
                            )}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-medium text-ink-muted">Trigger Reason</dt>
                          <dd className="mt-0.5 text-ink-secondary">{active.triggerReason}</dd>
                        </div>
                        {active.reviewerName && active.reviewerReason && (
                          <div className="sm:col-span-2 border-t border-line pt-2">
                            <dt className="font-medium text-ink-muted">
                              Compliance Officer Note ({active.reviewerName})
                            </dt>
                            <dd className="mt-0.5 text-ink-secondary">{active.reviewerReason}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Owner Action Required Callout */}
                    <div
                      className={`rounded-md border p-4 text-xs leading-relaxed ${
                        active.newStatus === 'Red'
                          ? 'border-status-red-border bg-status-red-bg text-status-red-text'
                          : 'border-status-pending-border bg-status-pending-bg text-status-pending-text'
                      }`}
                    >
                      <div className="font-semibold">Action Required from {active.recipientName}</div>
                      <p className="mt-1">{active.actionRequired}</p>
                    </div>

                    <div className="border-t border-line pt-4 text-xs text-ink-muted space-y-1">
                      <p>Regards,</p>
                      <p className="font-semibold text-ink">{active.senderName}</p>
                      <p>
                        Simulated notification preview generated locally · No live email server
                        connected.
                      </p>
                    </div>
                  </div>
                ) : (
                  <pre className="overflow-x-auto bg-subtle p-5 font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap">
                    {active.plainTextEmail}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {active && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopyEmail(active)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
                >
                  {copiedId === active.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-tone-green" aria-hidden="true" />
                      <span className="text-tone-green">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy Email</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenItem(active.itemId)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-ink-accent hover:bg-hover-surface whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Item</span>
                </button>
              </>
            )}

            {notifications.length === 1 && (
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-tone-red hover:bg-status-red-bg whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line-strong bg-card px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
            >
              Close
            </button>

            {active && (
              <button
                type="button"
                disabled={active.deliveryStatus === 'Simulated Sent'}
                onClick={() => onSimulateSend(active.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-muted-surface disabled:text-ink-muted disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {active.deliveryStatus === 'Simulated Sent'
                    ? 'Simulated Sent'
                    : 'Simulate Send'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
