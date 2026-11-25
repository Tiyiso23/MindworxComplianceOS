import {
  detectExpiryClusters,
  formatDisplayDate,
  getActionsRequired,
} from '../lib/complianceEngine';
import { DivisionFilter, EvaluatedComplianceItem, SummaryMetrics } from '../types/compliance';

interface ExecutivePrintViewProps {
  division: DivisionFilter;
  asAtDate: string;
  metrics: SummaryMetrics;
  items: EvaluatedComplianceItem[];
}

export function ExecutivePrintView({
  division,
  asAtDate,
  metrics,
  items,
}: ExecutivePrintViewProps) {
  const urgentActions = getActionsRequired(items).slice(0, 8);
  const clusters = detectExpiryClusters(items, asAtDate, 120, 10);

  return (
    <div className="hidden print-only bg-white text-slate-900 space-y-4">
      {/* Executive Print Header */}
      <div className="flex items-end justify-between border-b-2 border-navy-900 pb-2">
        <div>
          <div className="text-xs font-semibold text-navy-800">
            MINDWORX GROUP · STATUTORY & CORPORATE COMPLIANCE BRIEFING (SAMPLE DATA)
          </div>
          <h1 className="font-display text-xl font-bold text-navy-900">
            Executive Compliance Summary —{' '}
            {division === 'All' ? 'Consulting & Academy (All)' : `Mindworx ${division}`}
          </h1>
        </div>
        <div className="text-right font-mono text-xs tabular-nums text-slate-700">
          <div>As at: {formatDisplayDate(asAtDate)}</div>
          <div>Total Items: {metrics.total}</div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-10 gap-1.5 text-center">
        {[
          { label: 'Total', value: metrics.total },
          { label: 'Compliant', value: metrics.green },
          { label: 'Action Req.', value: metrics.yellow },
          { label: 'Pending Rev.', value: metrics.pendingReview },
          { label: 'Non-Comp.', value: metrics.red },
          { label: 'At risk', value: metrics.atRisk },
          { label: 'Rev. > 3d', value: metrics.awaitingOver3Days },
          { label: 'Expired', value: metrics.expired },
          { label: 'Due ≤30d', value: metrics.dueWithin30 },
          { label: 'Unverified', value: metrics.unverified },
        ].map((k) => (
          <div key={k.label} className="rounded border border-slate-300 px-1.5 py-1.5">
            <div className="text-[10px] font-medium text-slate-600">{k.label}</div>
            <div className="font-mono text-sm font-bold text-navy-900 tabular-nums">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Urgent Actions & Clusters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <h2 className="mb-1.5 font-display text-xs font-bold text-navy-900">
            Priority Actions & Review Queue (Top {urgentActions.length})
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 px-2 py-1">Status</th>
                <th className="border border-slate-300 px-2 py-1">Item</th>
                <th className="border border-slate-300 px-2 py-1">Div.</th>
                <th className="border border-slate-300 px-2 py-1">Alert</th>
                <th className="border border-slate-300 px-2 py-1">Expiry</th>
                <th className="border border-slate-300 px-2 py-1">Owner / Backup</th>
              </tr>
            </thead>
            <tbody>
              {urgentActions.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 px-2 py-1 font-semibold whitespace-nowrap">
                    {item.status === 'Pending review'
                      ? 'PENDING REVIEW'
                      : item.status.toUpperCase()}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">
                    <div className="font-semibold">{item.itemName}</div>
                    <div className="text-slate-600">{item.actionSummary}</div>
                  </td>
                  <td className="border border-slate-300 px-2 py-1">{item.company}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono tabular-nums">
                    {formatDisplayDate(item.alertDate)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 font-mono tabular-nums">
                    {formatDisplayDate(item.expiryDate)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">
                    {item.owner || 'Missing'} / {item.backupOwner || 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="mb-1.5 font-display text-xs font-bold text-navy-900">
              120-Day Renewal Clusters
            </h2>
            {clusters.length === 0 ? (
              <p className="text-[10px] text-slate-600">No renewal clusters in next 120 days.</p>
            ) : (
              clusters.map((c) => (
                <div key={c.id} className="mb-2 rounded border border-slate-300 p-2 text-[10px]">
                  <div className="font-mono font-bold text-navy-900">{c.windowLabel}</div>
                  <ul className="mt-1 space-y-0.5">
                    {c.items.map((it) => (
                      <li key={it.id}>
                        • {it.itemName} ({formatDisplayDate(it.expiryDate)})
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="rounded border border-slate-300 p-2 text-[10px] space-y-1">
            <div className="font-bold text-navy-900">Traffic-Light & Review Rules</div>
            <div>• <strong>Pending review:</strong> Automatic Red or low-confidence findings awaiting Compliance Officer review.</div>
            <div>• <strong>Red:</strong> Confirmed non-compliant (expired or statutory failure).</div>
            <div>• <strong>Yellow:</strong> Within lead time/30d, missing evidence, or owner/date gaps.</div>
            <div>• <strong>Green:</strong> Valid, outside alert window, complete, and verified where required.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
