import { AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildOwnershipSummary } from '../lib/complianceEngine';
import { useTheme } from '../lib/theme';
import { EvaluatedComplianceItem } from '../types/compliance';

interface OwnershipViewProps {
  items: EvaluatedComplianceItem[];
  onSelectItem: (item: EvaluatedComplianceItem) => void;
}

export function OwnershipView({ items, onSelectItem }: OwnershipViewProps) {
  const { chartPalette } = useTheme();
  const owners = buildOwnershipSummary(items);
  const gapCount = owners.filter((o) => o.hasBackupGap).length;

  return (
    <section
      aria-label="Ownership Coverage View"
      className="rounded-lg border border-line bg-card p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink-accent">
            Ownership & Backup Coverage
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Compliance workload per primary owner, highlighting single-point-of-failure backup gaps.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <Users className="h-4 w-4 text-ink-accent" aria-hidden="true" />
          <span className="tabular-nums text-ink-secondary">
            {owners.length} owners ·{' '}
            <strong className={gapCount > 0 ? 'text-tone-yellow' : 'text-tone-green'}>
              {gapCount} with backup gaps
            </strong>
          </span>
        </div>
      </div>

      {/* Recharts Owner Workload Breakdown */}
      <div className="h-56 w-full">
        {owners.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-line bg-subtle text-xs text-ink-muted">
            No ownership records in this view.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={owners} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} vertical={false} />
              <XAxis
                dataKey="owner"
                tick={{ fontSize: 12, fill: chartPalette.tick }}
                axisLine={{ stroke: chartPalette.axis }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: chartPalette.tick }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: chartPalette.cursor }}
                contentStyle={{
                  backgroundColor: chartPalette.tooltipBg,
                  borderColor: chartPalette.tooltipBorder,
                  borderRadius: '6px',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  fontSize: '12px',
                  color: chartPalette.tooltipText,
                }}
                labelStyle={{
                  color: chartPalette.tooltipTitle,
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
                itemStyle={{
                  color: chartPalette.tooltipText,
                }}
              />
              <Bar dataKey="redCount" stackId="owner" fill={chartPalette.red} name="Red (Non-Compliant)" />
              <Bar dataKey="pendingReviewCount" stackId="owner" fill={chartPalette.pending} name="Pending review" />
              <Bar dataKey="yellowCount" stackId="owner" fill={chartPalette.yellow} name="Yellow (Action Required)" />
              <Bar
                dataKey="greenCount"
                stackId="owner"
                fill={chartPalette.green}
                name="Green (Compliant)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Owner Matrix */}
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle text-xs font-semibold text-ink-muted">
              <th className="px-4 py-2.5">Owner</th>
              <th className="px-4 py-2.5 text-right">Total Items</th>
              <th className="px-4 py-2.5 text-right">Red</th>
              <th className="px-4 py-2.5 text-right">Pending review</th>
              <th className="px-4 py-2.5 text-right">Yellow</th>
              <th className="px-4 py-2.5 text-right">Green</th>
              <th className="px-4 py-2.5">Assigned Backup(s)</th>
              <th className="px-4 py-2.5">Backup Continuity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {owners.map((summary) => (
              <tr key={summary.owner} className="align-top hover:bg-hover-surface">
                <td className="px-4 py-3 font-semibold text-ink-accent">
                  <div>{summary.owner}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {summary.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="text-xs font-normal text-ink-link hover:underline text-left"
                      >
                        {item.itemName}
                        {!item.backupOwner.trim() ? ' (no backup)' : ''}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-ink tabular-nums">
                  {summary.totalItems}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-tone-red tabular-nums">
                  {summary.redCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-tone-pending tabular-nums">
                  {summary.pendingReviewCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-tone-yellow tabular-nums">
                  {summary.yellowCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-tone-green tabular-nums">
                  {summary.greenCount}
                </td>
                <td className="px-4 py-3 text-xs text-ink-secondary">
                  {summary.backupOwners.length > 0 ? (
                    summary.backupOwners.join(', ')
                  ) : (
                    <span className="font-medium text-tone-red">None assigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {summary.hasBackupGap ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-status-yellow-border bg-status-yellow-bg px-2.5 py-1 font-medium text-status-yellow-text">
                      <AlertTriangle className="h-3.5 w-3.5 text-status-yellow-icon shrink-0" />
                      <span>
                        {summary.itemsWithoutBackup} of {summary.totalItems} missing backup
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-status-green-border bg-status-green-bg px-2.5 py-1 font-medium text-status-green-text">
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-green-icon shrink-0" />
                      <span>Full backup coverage</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
