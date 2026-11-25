import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { requestManagementSummary } from '../lib/aiClient';
import {
  buildFallbackManagementSummary,
  buildManagementSummaryInput,
  verifySummaryNumbersAgainstFacts,
} from '../lib/complianceEngine';
import {
  DivisionFilter,
  EvaluatedComplianceItem,
  ManagementSummaryResult,
} from '../types/compliance';

interface ManagementSummaryPanelProps {
  items: EvaluatedComplianceItem[];
  asAtDate: string;
  division: DivisionFilter;
}

export function ManagementSummaryPanel({
  items,
  asAtDate,
  division,
}: ManagementSummaryPanelProps) {
  const [summary, setSummary] = useState<ManagementSummaryResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const metrics = useMemo(
    () => buildManagementSummaryInput(items, asAtDate, division),
    [items, asAtDate, division]
  );

  // Clear stale summary whenever the underlying division, date, or item counts change
  useEffect(() => {
    setSummary(null);
    setCopied(false);
  }, [
    division,
    asAtDate,
    metrics.total,
    metrics.atRisk,
    metrics.pendingReview,
    metrics.nonCompliantRed,
    metrics.actionRequiredYellow,
    metrics.compliantGreen,
    metrics.dataQualityFlaggedItems,
  ]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCopied(false);

    try {
      const res = await requestManagementSummary(metrics);
      const verification = verifySummaryNumbersAgainstFacts(res.summaryText, metrics);

      if (verification.valid) {
        const wordCount = res.summaryText.trim().split(/\s+/).filter(Boolean).length;
        setSummary({
          summaryText: res.summaryText.trim(),
          source: 'ai',
          generatedAt: new Date().toISOString(),
          asAtDate: metrics.asAtDate,
          companyFilter: metrics.companyFilter,
          wordCount,
          unverifiedNumbersFound: [],
        });
      } else {
        const fallbackText = buildFallbackManagementSummary(metrics);
        const wordCount = fallbackText.trim().split(/\s+/).filter(Boolean).length;
        setSummary({
          summaryText: fallbackText,
          source: 'fallback',
          fallbackReason: `AI output contained unverified number(s) (${verification.unverifiedNumbers.join(', ')}) and was discarded. Showing verified template summary.`,
          generatedAt: new Date().toISOString(),
          asAtDate: metrics.asAtDate,
          companyFilter: metrics.companyFilter,
          wordCount,
          unverifiedNumbersFound: verification.unverifiedNumbers,
        });
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Management summary AI service unavailable.';
      const fallbackText = buildFallbackManagementSummary(metrics);
      const wordCount = fallbackText.trim().split(/\s+/).filter(Boolean).length;
      setSummary({
        summaryText: fallbackText,
        source: 'fallback',
        fallbackReason: `${errorMsg} Showing verified template summary.`,
        generatedAt: new Date().toISOString(),
        asAtDate: metrics.asAtDate,
        companyFilter: metrics.companyFilter,
        wordCount,
        unverifiedNumbersFound: [],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    const scopeLabel =
      summary.companyFilter === 'All'
        ? 'All Divisions (Consulting & Academy)'
        : `Mindworx ${summary.companyFilter}`;
    const textToCopy = [
      `Mindworx Compliance — Management Summary (${scopeLabel}, As at ${metrics.asAtDisplayDate})`,
      'Figures come from the dashboard. Wording is AI-generated. AI-generated, check before use.',
      '',
      summary.summaryText,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const scopeLabel =
    division === 'All' ? 'All (Consulting & Academy)' : `Mindworx ${division}`;

  return (
    <section
      aria-label="Management Summary"
      className="rounded-lg border border-line bg-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink-accent shrink-0" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-ink-accent">
              Management Summary
            </h2>
            <span className="inline-flex items-center rounded border border-accent-soft-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ink-accent">
              AI-generated, check before use
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            Plain-language executive briefing generated strictly from verified dashboard figures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-tone-green" aria-hidden="true" />
                  <span className="text-tone-green">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={isGenerating}
            onClick={() => void handleGenerate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Generating...</span>
              </>
            ) : summary ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Regenerate</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Generate summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Context Header Above Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-subtle px-3.5 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-ink-secondary">
          <span>
            As at date: <strong className="font-mono text-ink">{metrics.asAtDisplayDate}</strong>
          </span>
          <span aria-hidden="true" className="text-line-strong">
            |
          </span>
          <span>
            Company filter: <strong className="text-ink">{scopeLabel}</strong>
          </span>
        </div>
        <span className="font-medium text-ink-accent">
          Figures come from the dashboard. Wording is AI-generated.
        </span>
      </div>

      {/* Summary Body */}
      {summary ? (
        <div className="space-y-3">
          {summary.source === 'fallback' && summary.fallbackReason && (
            <div className="flex items-start gap-2 rounded-md border border-status-yellow-border bg-status-yellow-bg px-3.5 py-2.5 text-xs text-status-yellow-text">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 text-status-yellow-icon shrink-0"
                aria-hidden="true"
              />
              <span>{summary.fallbackReason}</span>
            </div>
          )}

          <div className="rounded-md border border-line bg-card p-4 text-sm leading-relaxed text-ink">
            {summary.summaryText}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-line-strong bg-subtle/60 px-4 py-5 text-center text-xs text-ink-muted">
          Click <strong className="text-ink-accent">Generate summary</strong> to create a 120–180 word
          management briefing for <strong>{scopeLabel}</strong> as at{' '}
          <strong className="font-mono">{metrics.asAtDisplayDate}</strong>. All figures are computed
          in code and checked before display.
        </div>
      )}
    </section>
  );
}
