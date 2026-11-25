import { AlertTriangle, Clock, FileSearch, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FINDING_SOURCE_OPTIONS,
  SOURCE_TYPE_OPTIONS,
} from '../data/seedComplianceData';
import {
  CompanyScope,
  ComplianceItem,
  DocumentCheckRecord,
  FindingSource,
  SourceType,
  VerificationStatus,
  YesNo,
} from '../types/compliance';
import { DocumentCheckModal } from './DocumentCheckModal';

interface ItemFormModalProps {
  isOpen: boolean;
  initialItem: ComplianceItem | null;
  groups: string[];
  asAtDate: string;
  defaultCompany?: CompanyScope;
  onSave: (item: ComplianceItem, documentCheckRecords?: DocumentCheckRecord[]) => void;
  onClose: () => void;
}

function createEmptyItem(groups: string[], defaultCompany: CompanyScope): ComplianceItem {
  return {
    id: `mw-${Date.now()}`,
    company: defaultCompany,
    itemName: '',
    group: groups[0] ?? 'Other',
    issueDate: '',
    expiryDate: '',
    renewalCycle: 'Annual',
    leadTimeDays: 30,
    howObtained: '',
    sourceType: 'system retrieval',
    accessMethod: '',
    loginMethod: '',
    credentialSource: '',
    documentLink: '',
    owner: '',
    backupOwner: '',
    systemVerificationRequired: 'Yes',
    verifiedInStatutorySystem: 'Not checked',
    dateVerified: '',
    verifiedBy: '',
    notes: '',
    findingSource: 'Rule engine',
    triggerReason: '',
  };
}

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring';

export function ItemFormModal({
  isOpen,
  initialItem,
  groups,
  asAtDate,
  defaultCompany = 'Consulting',
  onSave,
  onClose,
}: ItemFormModalProps) {
  const [form, setForm] = useState<ComplianceItem>(() =>
    initialItem ? { ...initialItem } : createEmptyItem(groups, defaultCompany)
  );
  const [error, setError] = useState('');
  const [isDocCheckOpen, setIsDocCheckOpen] = useState(false);
  const [formDocChecks, setFormDocChecks] = useState<DocumentCheckRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      setForm(initialItem ? { ...initialItem } : createEmptyItem(groups, defaultCompany));
      setError('');
      setIsDocCheckOpen(false);
      setFormDocChecks([]);
    }
  }, [isOpen, initialItem, groups, defaultCompany]);

  if (!isOpen) return null;

  const dateMismatch =
    Boolean(form.issueDate) && Boolean(form.expiryDate) && form.issueDate > form.expiryDate;

  const handleSavePassedDocCheck = (_targetId: string, record: DocumentCheckRecord) => {
    setForm((prev) => ({
      ...prev,
      lastDocumentCheck: record,
    }));
    setFormDocChecks((prev) => [...prev, record]);
  };

  const handleRouteDocCheckToPending = (_targetId: string, record: DocumentCheckRecord) => {
    setForm((prev) => ({
      ...prev,
      findingSource: 'Document check',
      triggerReason: record.routingReason,
      lastDocumentCheck: record,
      reviewState: {
        status: 'Pending review',
        pendingSince: asAtDate,
        decision: null,
        reviewerName: '',
        decisionDate: '',
        decisionReason: '',
        evidenceDueDate: '',
        snapshotHash: '',
      },
    }));
    setFormDocChecks((prev) => [...prev, record]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemName.trim()) {
      setError('Item name is required.');
      return;
    }
    onSave(
      {
        ...form,
        itemName: form.itemName.trim(),
        owner: form.owner.trim(),
        backupOwner: form.backupOwner.trim(),
        documentLink: form.documentLink.trim(),
        credentialSource: form.credentialSource.trim(),
        verifiedBy: form.verifiedBy.trim(),
        triggerReason: form.triggerReason.trim(),
      },
      formDocChecks
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-form-title"
    >
      <form
        onSubmit={handleSubmit}
        className="theme-surface flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg border border-line bg-card text-ink shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-topbar-border bg-topbar px-6 py-4 text-topbar-text rounded-t-lg">
          <div>
            <h2 id="item-form-title" className="font-display text-base font-semibold">
              {initialItem ? 'Edit Compliance Item' : 'Add Compliance Item'}
            </h2>
            <p className="text-xs text-topbar-muted">
              Complete statutory, evidence, and ownership metadata for the Mindworx register.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-topbar-muted hover:bg-white/10 hover:text-white"
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Mandatory Credential Security Notice */}
          <div className="flex items-start gap-3 rounded-md border border-status-yellow-border bg-status-yellow-bg p-3.5 text-xs text-status-yellow-text">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-status-yellow-icon shrink-0" aria-hidden="true" />
            <div>
              <strong className="font-semibold">
                Security Notice — Never store or enter passwords or PINs.
              </strong>{' '}
              Do not paste actual passwords, passcodes, or OTPs into any field. Only record where
              the credential or PIN is obtained (for example, “Finance Bitwarden vault” or “OTP sent
              to Compliance Officer”).
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-status-red-border bg-status-red-bg px-4 py-2.5 text-xs font-medium text-status-red-text">
              {error}
            </div>
          )}

          {dateMismatch && (
            <div className="flex items-center gap-2 rounded-md border border-status-yellow-border bg-status-yellow-bg px-4 py-2.5 text-xs text-status-yellow-text">
              <AlertTriangle className="h-4 w-4 text-status-yellow-icon shrink-0" />
              <span>
                Warning: Issue date ({form.issueDate}) is after expiry date ({form.expiryDate}).
                If saved as-is, the item will be flagged in Data Quality.
              </span>
            </div>
          )}

          {/* Section 1: Core Identification */}
          <div className="space-y-3">
            <h3 className="border-b border-line pb-1 font-display text-xs font-semibold text-ink-accent">
              01. Identification & Schedule
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-secondary">
                  Item Name <span className="text-tone-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.itemName}
                  onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                  placeholder="e.g., SARS Tax Compliance Status (TCS) PIN"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Company / Division</label>
                <select
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value as CompanyScope })}
                  className={INPUT_CLASS}
                >
                  <option value="Consulting">Mindworx Consulting</option>
                  <option value="Academy">Mindworx Academy</option>
                  <option value="Both">Both (Consulting & Academy)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Group</label>
                <select
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  {!groups.includes(form.group) && (
                    <option value={form.group}>{form.group}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Issue Date</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Expiry Date</label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Renewal Cycle</label>
                <input
                  type="text"
                  value={form.renewalCycle}
                  onChange={(e) => setForm({ ...form, renewalCycle: e.target.value })}
                  placeholder="e.g., Annual, Quarterly, Every 3 months"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Lead Time (Days ahead of expiry)
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={form.leadTimeDays ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      leadTimeDays: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="e.g., 30 or 135"
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Retrieval & Access */}
          <div className="space-y-3">
            <h3 className="border-b border-line pb-1 font-display text-xs font-semibold text-ink-accent">
              02. Retrieval, Source & Access Location
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-ink-secondary">Source Type</label>
                <select
                  value={form.sourceType}
                  onChange={(e) => setForm({ ...form, sourceType: e.target.value as SourceType })}
                  className={INPUT_CLASS}
                >
                  {SOURCE_TYPE_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Access Method</label>
                <input
                  type="text"
                  value={form.accessMethod}
                  onChange={(e) => setForm({ ...form, accessMethod: e.target.value })}
                  placeholder="e.g., SARS eFiling Portal, Email"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-secondary">How It Is Obtained</label>
                <input
                  type="text"
                  value={form.howObtained}
                  onChange={(e) => setForm({ ...form, howObtained: e.target.value })}
                  placeholder="Describe step-by-step renewal or retrieval process"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Login Method</label>
                <input
                  type="text"
                  value={form.loginMethod}
                  onChange={(e) => setForm({ ...form, loginMethod: e.target.value })}
                  placeholder="e.g., Username & OTP, Corporate SSO"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Where Password / PIN Is Obtained (No secrets)
                </label>
                <input
                  type="text"
                  value={form.credentialSource}
                  onChange={(e) => setForm({ ...form, credentialSource: e.target.value })}
                  placeholder="e.g., Emailed to compliance inbox / Finance Vault"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-ink-secondary">Document Link</label>
                  <button
                    type="button"
                    onClick={() => setIsDocCheckOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-accent hover:bg-hover-surface"
                  >
                    <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Check document</span>
                  </button>
                </div>
                <input
                  type="url"
                  value={form.documentLink}
                  onChange={(e) => setForm({ ...form, documentLink: e.target.value })}
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />

                {form.lastDocumentCheck && (
                  <div
                    className={`rounded-md border p-3 text-xs space-y-1 ${
                      form.lastDocumentCheck.outcome === 'Passed'
                        ? 'border-status-green-border bg-status-green-bg text-status-green-text'
                        : 'border-status-pending-border bg-status-pending-bg text-status-pending-text'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                      <span>
                        Document Check ({form.lastDocumentCheck.fileName}):{' '}
                        {form.lastDocumentCheck.outcome}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        <span>AI-generated, check before use</span>
                      </span>
                    </div>
                    <div>{form.lastDocumentCheck.routingReason}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Ownership & Verification */}
          <div className="space-y-3">
            <h3 className="border-b border-line pb-1 font-display text-xs font-semibold text-ink-accent">
              03. Ownership & Statutory Verification
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-ink-secondary">Owner</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  placeholder="e.g., Owner A"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Backup Owner</label>
                <input
                  type="text"
                  value={form.backupOwner}
                  onChange={(e) => setForm({ ...form, backupOwner: e.target.value })}
                  placeholder="e.g., Owner B"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  System Verification Required
                </label>
                <select
                  value={form.systemVerificationRequired}
                  onChange={(e) =>
                    setForm({ ...form, systemVerificationRequired: e.target.value as YesNo })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Verified in Statutory System
                </label>
                <select
                  value={form.verifiedInStatutorySystem}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      verifiedInStatutorySystem: e.target.value as VerificationStatus,
                    })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="Yes">Yes (Compliant in system)</option>
                  <option value="No">No (Non-compliant in system)</option>
                  <option value="Not checked">Not checked</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Date Verified</label>
                <input
                  type="date"
                  value={form.dateVerified}
                  onChange={(e) => setForm({ ...form, dateVerified: e.target.value })}
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Verified By</label>
                <input
                  type="text"
                  value={form.verifiedBy}
                  onChange={(e) => setForm({ ...form, verifiedBy: e.target.value })}
                  placeholder="e.g., Owner A"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">Finding Source</label>
                <select
                  value={form.findingSource}
                  onChange={(e) =>
                    setForm({ ...form, findingSource: e.target.value as FindingSource })
                  }
                  className={INPUT_CLASS}
                >
                  {FINDING_SOURCE_OPTIONS.map((fs) => (
                    <option key={fs} value={fs}>
                      {fs}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary">
                  Trigger Reason (if flagged)
                </label>
                <input
                  type="text"
                  value={form.triggerReason}
                  onChange={(e) => setForm({ ...form, triggerReason: e.target.value })}
                  placeholder="Optional manual or rule trigger note"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-secondary">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Audit context, statutory caveats, or renewal instructions"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {initialItem?.reviewState?.status === 'Decided' && (
            <div className="flex items-start gap-2.5 rounded-md border border-status-pending-border bg-status-pending-bg p-3 text-xs text-status-pending-text">
              <Clock className="mt-0.5 h-4 w-4 text-status-pending-icon shrink-0" />
              <span>
                This item has a prior Compliance Officer decision ({initialItem.reviewState.decision}).
                Changing dates, verification status, or document link will automatically return it to{' '}
                <strong>Pending review</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line-strong bg-card px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover"
          >
            {initialItem ? 'Save Changes' : 'Add to Register'}
          </button>
        </div>
      </form>

      <DocumentCheckModal
        isOpen={isDocCheckOpen}
        target={{
          id: form.id,
          company: form.company,
          itemName: form.itemName,
          group: form.group,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          documentLink: form.documentLink,
          lastDocumentCheck: form.lastDocumentCheck,
        }}
        asAtDate={asAtDate}
        onSavePassedCheck={handleSavePassedDocCheck}
        onRouteToPendingReview={handleRouteDocCheckToPending}
        onClose={() => setIsDocCheckOpen(false)}
      />
    </div>
  );
}
