import { CalendarClock, Layers } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  build120DayTimelineBuckets,
  detectExpiryClusters,
  formatDisplayDate,
} from '../lib/complianceEngine';
import { useTheme } from '../lib/theme';
import { EvaluatedComplianceItem } from '../types/compliance';
import { CompanyScopeLabel, StatusBadge } from './StatusBadge';

interface ExpiryTimelineProps {
  items: EvaluatedComplianceItem[];
  asAtDate: string;
  onSelectItem: (item: EvaluatedComplianceItem) => void;
  compact?: boolean;
}

export function ExpiryTimeline({
  items,
  asAtDate,
  onSelectItem,
  compact = false,
}: ExpiryTimelineProps) {
  const { chartPalette } = useTheme();
  const buckets = build120DayTimelineBuckets(items, asAtDate);
  const clusters = detectExpiryClusters(items, asAtDate, 120, 10);

  const upcoming120 = items
    .filter(
      (i) => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= 120
    )
    .slice()
    .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));

  const clusteredIds = new Set(clusters.flatMap((c) => c.items.map((i) => i.id)));

  return (
    <section
      aria-label="120-Day Expiry Timeline"
      className="rounded-lg border border-line bg-card p-5 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink-accent">
            120-Day Expiry Timeline & Cluster Detection
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Expiries across the next 120 days from {formatDisplayDate(asAtDate)} grouped in 10-day windows.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-muted tabular-nums">
          <span>
            <strong className="text-ink-accent">{upcoming120.length}</strong> expiring in 120d
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className={clusters.length > 0 ? 'text-tone-yellow' : 'text-ink-accent'}>
              {clusters.length}
            </strong>{' '}
            expiry cluster{clusters.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Recharts 120-Day Stacked Bar Chart */}
      <div className="h-60 w-full">
        {upcoming120.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-line bg-subtle text-xs text-ink-muted">
            No items expiring within the next 120 days for the selected division.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} vertical={false} />
              <XAxis
                dataKey="bucketLabel"
                tick={{ fontSize: 11, fill: chartPalette.tick }}
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
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const bucket = payload[0].payload as (typeof buckets)[number];
                  return (
                    <div className="max-w-xs rounded-md border border-line-strong bg-subtle p-3 text-xs shadow-md">
                      <div className="font-semibold text-ink-accent">{bucket.rangeLabel}</div>
                      <div className="mt-1 text-ink-muted tabular-nums">
                        {bucket.totalCount} item{bucket.totalCount === 1 ? '' : 's'} expiring
                        {bucket.isCluster ? ' (Cluster)' : ''}
                      </div>
                      {bucket.items.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-line pt-1.5 text-ink-secondary">
                          {bucket.items.map((it) => (
                            <li key={it.id} className="truncate">
                              • {it.itemName} ({formatDisplayDate(it.expiryDate)})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="redCount" stackId="a" fill={chartPalette.red} name="Non-Compliant" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pendingCount" stackId="a" fill={chartPalette.pending} name="Pending review" radius={[0, 0, 0, 0]} />
              <Bar dataKey="yellowCount" stackId="a" fill={chartPalette.yellow} name="Action Required" radius={[0, 0, 0, 0]} />
              <Bar dataKey="greenCount" stackId="a" fill={chartPalette.green} name="Compliant" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cluster Alerts */}
      {clusters.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-accent">
            <Layers className="h-4 w-4 text-tone-yellow" aria-hidden="true" />
            <span>Detected Renewal Clusters (items expiring close together)</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="rounded-md border border-status-yellow-border bg-status-yellow-bg p-3.5 text-status-yellow-text"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {cluster.windowLabel}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {cluster.items.length} items clustered
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {cluster.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-hover-surface/60"
                      >
                        <span className="truncate font-medium text-ink">
                          {item.itemName}
                        </span>
                        <span className="font-mono text-status-yellow-text tabular-nums shrink-0">
                          {formatDisplayDate(item.expiryDate)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological 120-day schedule */}
      {!compact && upcoming120.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-accent">
            <CalendarClock className="h-4 w-4 text-ink-accent" aria-hidden="true" />
            <span>Chronological 120-Day Schedule</span>
          </div>
          <div className="divide-y divide-line rounded-md border border-line">
            {upcoming120.map((item) => {
              const inCluster = clusteredIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover-surface ${
                    inCluster ? 'bg-status-yellow-bg' : 'bg-card'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-ink-accent">{item.itemName}</span>
                      <CompanyScopeLabel company={item.company} />
                      {inCluster && (
                        <span className="text-xs font-medium text-tone-yellow">
                          · Cluster window
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      Owner: {item.owner || 'Unassigned'} · Alert date: {formatDisplayDate(item.alertDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={item.status} label={item.statusLabel} compact />
                    <div className="text-right font-mono text-xs tabular-nums">
                      <div className="font-semibold text-ink">
                        {formatDisplayDate(item.expiryDate)}
                      </div>
                      <div className="text-ink-muted">in {item.daysUntilExpiry}d</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
