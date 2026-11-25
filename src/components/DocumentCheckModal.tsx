import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileSearch,
  FileUp,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestDocumentCheck } from '../lib/aiClient';
import {
  evaluateCombinedDocumentCheck,
  extractFieldsFromOcrText,
  formatDisplayDate,
} from '../lib/complianceEngine';
import { extractText, type OcrProgressUpdate } from '../lib/ocrService';
import {
  CompanyScope,
  DocumentCheckExtraction,
  DocumentCheckRecord,
  DocumentConfidence,
  OcrFieldExtraction,
} from '../types/compliance';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export interface DocumentCheckTarget {
  id: string;
  company: CompanyScope;
  itemName: string;
  group: string;
  issueDate: string;
  expiryDate: string;
  documentLink: string;
  lastDocumentCheck?: DocumentCheckRecord;
}

interface DocumentCheckModalProps {
  isOpen: boolean;
  target: DocumentCheckTarget | null;
  asAtDate: string;
  onSavePassedCheck: (targetId: string, record: DocumentCheckRecord) => void;
  onRouteToPendingReview: (targetId: string, record: DocumentCheckRecord) => void;
  onClose: () => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => {
      reject(new Error('Could not read the selected file from disk.'));
    };
    reader.readAsDataURL(file);
  });
}

function ConfidenceBadge({ confidence }: { confidence: DocumentConfidence }) {
  if (confidence === 'High') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-status-green-border bg-status-green-bg px-2 py-0.5 text-[11px] font-semibold text-status-green-text">
        <CheckCircle2 className="h-3 w-3 text-status-green-icon" aria-hidden="true" />
        <span>High</span>
      </span>
    );
  }
  if (confidence === 'Medium') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-status-yellow-border bg-status-yellow-bg px-2 py-0.5 text-[11px] font-semibold text-status-yellow-text">
        <AlertTriangle className="h-3 w-3 text-status-yellow-icon" aria-hidden="true" />
        <span>Medium</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-status-red-border bg-status-red-bg px-2 py-0.5 text-[11px] font-semibold text-status-red-text">
      <XCircle className="h-3 w-3 text-status-red-icon" aria-hidden="true" />
      <span>Low</span>
    </span>
  );
}

function formatOcrSourceMode(mode: OcrFieldExtraction['sourceMode']): string {
  if (mode === 'pdf-text-layer') return 'PDF embedded text layer';
  if (mode === 'pdf-ocr') return 'PDF OCR (240 DPI)';
  return 'Image OCR';
}

export function DocumentCheckModal({
  isOpen,
  target,
  asAtDate,
  onSavePassedCheck,
  onRouteToPendingReview,
  onClose,
}: DocumentCheckModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [progressState, setProgressState] = useState<OcrProgressUpdate | null>(null);
  const [validationError, setValidationError] = useState('');
  const [resultRecord, setResultRecord] = useState<DocumentCheckRecord | null>(null);
  const [passedSaved, setPassedSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsChecking(false);
      setProgressState(null);
      setValidationError('');
      setResultRecord(target?.lastDocumentCheck ?? null);
      setPassedSaved(false);
    }
  }, [isOpen, target?.id]);

  const handleFileSelected = useCallback(async (file: File | null) => {
    if (!file || !target) return;
    setValidationError('');
    setPassedSaved(false);

    const mimeType = file.type.toLowerCase();
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      setValidationError(
        'Unsupported file format. Please upload a PDF, PNG, JPEG, or WebP document (max 10 MB).'
      );
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setValidationError(
        'File size must be greater than 0 bytes and no larger than 10 MB.'
      );
      return;
    }

    setIsChecking(true);
    setProgressState({ stage: 'Starting independent OCR check...', progress: 2 });

    let ocrResult: OcrFieldExtraction | null = null;
    let ocrError: string | undefined;
    let geminiExtraction: DocumentCheckExtraction | null = null;
    let geminiError: string | undefined;
    let base64Data = '';

    try {
      // Step 1: Independent browser-side OCR (files are never sent anywhere for this step)
      try {
        const ocrOutput = await extractText(file, (update) => {
          setProgressState(update);
        });
        ocrResult = extractFieldsFromOcrText(
          ocrOutput.text,
          ocrOutput.confidence,
          ocrOutput.sourceMode,
          ocrOutput.pagesProcessed,
          { itemName: target.itemName, group: target.group }
        );
        // Raw OCR text is never retained beyond this scope
      } catch (err) {
        ocrError =
          err instanceof Error ? err.message : 'Browser OCR step failed.';
      }

      // Step 2: Independent Gemini AI reading on the same file
      setProgressState({
        stage: 'Running Gemini AI second reading...',
        progress: 99,
      });

      try {
        base64Data = await readFileAsBase64(file);
        geminiExtraction = await requestDocumentCheck({
          base64Data,
          mimeType,
        });
      } catch (err) {
        geminiError =
          err instanceof Error ? err.message : 'Gemini document check service unavailable.';
      } finally {
        base64Data = '';
      }

      // Step 3: Deterministic 3-way routing (code, never AI)
      const evaluated = evaluateCombinedDocumentCheck({
        item: {
          company: target.company,
          itemName: target.itemName,
          group: target.group,
          issueDate: target.issueDate,
          expiryDate: target.expiryDate,
        },
        ocrResult,
        ocrError,
        geminiExtraction,
        geminiError,
        asAtDate,
        fileName: file.name,
      });

      setResultRecord(evaluated);

      if (evaluated.outcome === 'Routed to Pending review') {
        onRouteToPendingReview(target.id, evaluated);
      }
    } finally {
      base64Data = '';
      setIsChecking(false);
      setProgressState(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [asAtDate, onRouteToPendingReview, target]);

  if (!isOpen || !target) return null;

  const handleSavePassed = () => {
    if (!resultRecord || resultRecord.outcome !== 'Passed') return;
    onSavePassedCheck(target.id, resultRecord);
    setPassedSaved(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-backdrop p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-check-modal-title"
    >
      <div className="theme-surface flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-line bg-card text-ink shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-topbar-border bg-topbar px-6 py-4 text-topbar-text rounded-t-lg">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-topbar-muted">
              <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>OCR + AI Document Check (Two Independent Readers)</span>
              <span aria-hidden="true">·</span>
              <span>
                {target.company === 'Both'
                  ? 'Consulting & Academy (Both)'
                  : `Mindworx ${target.company}`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{target.group}</span>
            </div>
            <h2
              id="doc-check-modal-title"
              className="mt-1 font-display text-lg font-semibold leading-snug text-topbar-text"
            >
              {target.itemName || 'Untitled Compliance Item'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-topbar-muted hover:bg-white/10 hover:text-white"
            aria-label="Close document check"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Mandatory Prototype & Privacy Notice */}
          <div className="flex items-start gap-3 rounded-md border border-status-yellow-border bg-status-yellow-bg p-3.5 text-xs text-status-yellow-text">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 text-status-yellow-icon shrink-0"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <div className="font-semibold">
                Use sample or redacted documents in this prototype.
              </div>
              <p>
                Step 1 runs local English OCR in your browser (first 3 PDF pages or image) without
                sending files anywhere, then discards raw text immediately. Step 2 runs Gemini on
                the same file (max 10 MB). ID numbers, bank account numbers, and passwords are
                never stored or displayed. Neither OCR nor AI ever changes compliance status.
              </p>
            </div>
          </div>

          {/* Upload Control & Progress Indicator */}
          <div className="rounded-lg border border-dashed border-line-strong bg-subtle p-5 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-display text-sm font-semibold text-ink-accent">
                  Upload Document for Dual Verification (OCR + Gemini)
                </h3>
                <p className="text-xs text-ink-muted">
                  Accepted formats: PDF (first 3 pages), PNG, JPEG, or WebP · Max size: 10 MB
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
                  disabled={isChecking}
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    void handleFileSelected(selected);
                  }}
                  className="hidden"
                  id="doc-check-file-input"
                />
                <label
                  htmlFor="doc-check-file-input"
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                    isChecking
                      ? 'cursor-not-allowed bg-muted-surface text-ink-muted'
                      : 'cursor-pointer bg-accent text-on-accent hover:bg-accent-hover'
                  }`}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Running Dual Check...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4" aria-hidden="true" />
                      <span>{resultRecord ? 'Check Another File' : 'Upload PDF or Image'}</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {isChecking && progressState && (
              <div className="space-y-1.5 border-t border-line pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-accent">{progressState.stage}</span>
                  <span className="font-mono font-semibold text-ink tabular-nums">
                    {progressState.progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted-surface">
                  <div
                    className="h-full bg-accent transition-all duration-150"
                    style={{ width: `${Math.max(4, Math.min(100, progressState.progress))}%` }}
                  />
                </div>
              </div>
            )}

            {validationError && (
              <div className="flex items-center gap-2 rounded-md border border-status-red-border bg-status-red-bg px-3 py-2 text-xs font-medium text-status-red-text">
                <XCircle className="h-4 w-4 text-status-red-icon shrink-0" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Results Section */}
          {resultRecord && (
            <div className="space-y-5">
              {/* Reader Status + Mandatory AI Label */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded border border-accent-soft-border bg-accent-soft px-2.5 py-1 text-xs font-semibold text-ink-accent">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>AI-generated, check before use</span>
                  </span>
                  {resultRecord.ocrResult && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold ${
                        resultRecord.ocrResult.confidence >= 80
                          ? 'border-status-green-border bg-status-green-bg text-status-green-text'
                          : 'border-status-red-border bg-status-red-bg text-status-red-text'
                      }`}
                    >
                      <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        OCR Confidence: {resultRecord.ocrResult.confidence}% (
                        {resultRecord.ocrResult.confidenceLevel}) ·{' '}
                        {formatOcrSourceMode(resultRecord.ocrResult.sourceMode)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-muted font-mono tabular-nums">
                  File: <strong className="text-ink">{resultRecord.fileName}</strong> · Checked{' '}
                  {formatDisplayDate(resultRecord.checkedAt)}
                </div>
              </div>

              {/* Deterministic Routing Outcome Banner */}
              {resultRecord.outcome === 'Passed' ? (
                <div className="rounded-lg border border-status-green-border bg-status-green-bg p-4 text-status-green-text space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className="h-5 w-5 text-status-green-icon shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="font-display text-sm font-bold">Check passed</div>
                        <p className="text-xs">{resultRecord.routingReason}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={passedSaved}
                      onClick={handleSavePassed}
                      className="inline-flex items-center gap-1.5 rounded-md bg-status-green-solid px-3.5 py-2 text-xs font-semibold text-status-green-solid-text hover:opacity-90 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {passedSaved ? 'Check Result Saved' : 'Save Check Result to Item'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-start gap-2 border-t border-status-green-border/60 pt-2.5 text-xs">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Saving this document check does <strong>not</strong> make the item compliant by
                      itself — statutory system verification rules and renewal lead-time rules still
                      govern compliance status.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-status-pending-border bg-status-pending-bg p-4 text-status-pending-text space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 text-status-pending-icon shrink-0"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <div className="font-display text-sm font-bold">
                        Routed to Pending review
                      </div>
                      <div className="text-xs">
                        <strong>Finding source:</strong> Document check ·{' '}
                        <strong>Trigger reason:</strong> {resultRecord.routingReason}
                      </div>
                      {(!resultRecord.ocrAvailable || !resultRecord.aiAvailable) && (
                        <div className="mt-1 rounded border border-status-red-border bg-status-red-bg px-2.5 py-1.5 text-xs text-status-red-text space-y-0.5">
                          {!resultRecord.ocrAvailable && (
                            <div>
                              <strong>OCR reader failed:</strong>{' '}
                              {resultRecord.ocrErrorMessage || 'Local OCR unavailable'}
                            </div>
                          )}
                          {!resultRecord.aiAvailable && (
                            <div>
                              <strong>Gemini reader failed:</strong>{' '}
                              {resultRecord.errorMessage || 'Gemini service unavailable'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Three-Source Side-by-Side Comparison Table */}
              {resultRecord.comparisons.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-display text-xs font-semibold text-ink-accent">
                    Three-Way Comparison (Register vs Local OCR vs Gemini AI)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-subtle font-semibold text-ink-muted">
                          <th className="px-3.5 py-2.5">Field</th>
                          <th className="px-3.5 py-2.5">Register Value</th>
                          <th className="px-3.5 py-2.5">OCR Value (Regex)</th>
                          <th className="px-3.5 py-2.5">Gemini Value (AI)</th>
                          <th className="px-3.5 py-2.5">3-Way Agreement</th>
                          <th className="px-3.5 py-2.5">Gemini Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {resultRecord.comparisons.map((row) => {
                          const hasProblem = !row.allAgree || row.isMissing || row.ocrIsAmbiguous;
                          return (
                            <tr
                              key={row.field}
                              className={hasProblem ? 'bg-status-red-bg/40' : 'bg-card'}
                            >
                              <td className="px-3.5 py-2.5 font-semibold text-ink whitespace-nowrap">
                                {row.label}
                              </td>
                              <td className="px-3.5 py-2.5 text-ink-secondary">
                                {row.registerValue || (
                                  <span className="italic text-ink-muted">Missing in register</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 font-medium text-ink">
                                {row.ocrIsAmbiguous ? (
                                  <span className="inline-flex items-center gap-1 rounded border border-status-yellow-border bg-status-yellow-bg px-1.5 py-0.5 text-[11px] font-semibold text-status-yellow-text">
                                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                    <span>ambiguous</span>
                                  </span>
                                ) : row.ocrValue ? (
                                  <span
                                    className={
                                      !row.ocrMatchesRegister || !row.ocrGeminiAgree
                                        ? 'font-semibold text-tone-red'
                                        : ''
                                    }
                                  >
                                    {row.ocrValue}
                                  </span>
                                ) : (
                                  <span className="italic text-tone-red">Not found</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 font-medium text-ink">
                                {row.extractedValue ? (
                                  <span
                                    className={
                                      !row.geminiMatchesRegister || !row.ocrGeminiAgree
                                        ? 'font-semibold text-tone-red'
                                        : ''
                                    }
                                  >
                                    {row.extractedValue}
                                  </span>
                                ) : (
                                  <span className="italic text-tone-red">Not found</span>
                                )}
                                {row.confidence === 'Low' && row.lowConfidenceReason && (
                                  <div className="mt-1 text-[11px] text-tone-red">
                                    Low reason: {row.lowConfidenceReason}
                                  </div>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 whitespace-nowrap">
                                {row.allAgree ? (
                                  <span className="inline-flex items-center gap-1 rounded border border-status-green-border bg-status-green-bg px-2 py-0.5 text-[11px] font-semibold text-status-green-text">
                                    <CheckCircle2
                                      className="h-3 w-3 text-status-green-icon"
                                      aria-hidden="true"
                                    />
                                    <span>All 3 agree</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded border border-status-red-border bg-status-red-bg px-2 py-0.5 text-[11px] font-semibold text-status-red-text">
                                    <XCircle
                                      className="h-3 w-3 text-status-red-icon"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {row.ocrIsAmbiguous
                                        ? 'Ambiguous date'
                                        : !row.ocrGeminiAgree && !row.ocrIsMissing && !row.geminiIsMissing
                                          ? 'OCR vs AI differ'
                                          : row.isMissing
                                            ? 'Missing field'
                                            : 'Differs'}
                                    </span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 whitespace-nowrap">
                                {resultRecord.aiAvailable ? (
                                  <ConfidenceBadge confidence={row.confidence} />
                                ) : (
                                  <span className="text-ink-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* OCR Keywords & Gemini Presence Signals */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {resultRecord.ocrResult && (
                  <div className="rounded-md border border-line bg-subtle p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold text-ink-accent">
                        Local OCR Summary ({resultRecord.ocrResult.pagesProcessed} page
                        {resultRecord.ocrResult.pagesProcessed === 1 ? '' : 's'})
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          resultRecord.ocrResult.confidence >= 80
                            ? 'text-tone-green'
                            : 'text-tone-red'
                        }`}
                      >
                        {resultRecord.ocrResult.confidence}% ({resultRecord.ocrResult.confidenceLevel})
                      </span>
                    </div>
                    <div className="text-ink-secondary">
                      <span className="text-ink-muted">Matched keywords:</span>{' '}
                      {resultRecord.ocrResult.documentKeywords.length > 0
                        ? resultRecord.ocrResult.documentKeywords.join(', ')
                        : 'None matched'}
                    </div>
                  </div>
                )}

                {resultRecord.extraction && (
                  <div className="rounded-md border border-line bg-subtle p-3.5 space-y-2 text-xs">
                    <div className="font-display font-semibold text-ink-accent">
                      Gemini Completeness Signals (Yes / No Only)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          {
                            label: 'Signature',
                            field: resultRecord.extraction.signaturePresent,
                          },
                          {
                            label: 'Stamp',
                            field: resultRecord.extraction.stampPresent,
                          },
                          {
                            label: 'Ref No.',
                            field: resultRecord.extraction.referenceNumberPresent,
                          },
                        ] as const
                      ).map((sig) => (
                        <div key={sig.label} className="rounded border border-line bg-card p-2">
                          <div className="text-[11px] text-ink-muted">{sig.label}</div>
                          <div className="mt-0.5 flex items-center justify-between gap-1">
                            <span className="font-bold text-ink">{sig.field.value}</span>
                            <ConfidenceBadge confidence={sig.field.confidence} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3 rounded-b-lg">
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
