import { ArrowDown, ArrowUp, ArrowUpDown, FileSearch, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SOURCE_TYPE_OPTIONS } from '../data/seedComplianceData';
import { formatDisplayDate } from '../lib/complianceEngine';
import {
  EvaluatedComplianceItem,
  TrafficLightFilter,
  TrafficLightStatus,
} from '../types/compliance';
import { CompanyScopeLabel, StatusBadge } from './StatusBadge';
import { QuickSliceFilter } from './SummaryCards';

type SortField =
  | 'itemName'
  | 'company'
  | 'group'
  | 'status'
  | 'expiryDate'
  | 'alertDate'
  | 'daysUntilExpiry'
  | 'owner';

type SortDirection = 'asc' | 'desc';

interface RegisterTableProps {
  items: EvaluatedComplianceItem[];
  groups: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sliceFilter: QuickSliceFilter;
  trafficLightFilter: TrafficLightFilter;
  onSliceFilterChange: (slice: QuickSliceFilter) => void;
  onTrafficLightFilterChange: (light: TrafficLightFilter) => void;
  onSelectItem: (item: EvaluatedComplianceItem) => void;
  onCheckDocument: (item: EvaluatedComplianceItem) => void;
  onAddNew: () => void;
}

export function RegisterTable({
  items,
  groups,
  searchQuery,
  onSearchChange,
  sliceFilter,
  trafficLightFilter,
  onSliceFilterChange,
  onTrafficLightFilterChange,
  onSelectItem,
  onCheckDocument,
  onAddNew,
}: RegisterTableProps) {
  const [groupFilter, setGroupFilter] = useState<string>('All');
  const [ownerFilter, setOwnerFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('daysUntilExpiry');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const owners = useMemo(() => {
    const set = new Set(items.map((i) => i.owner.trim() || 'Unassigned'));
    return Array.from(set).sort();
  }, [items]);

  const effectiveStatusFilter: TrafficLightFilter =
    sliceFilter === 'Green' ||
    sliceFilter === 'Yellow' ||
    sliceFilter === 'Red' ||
    sliceFilter === 'Pending review'
      ? sliceFilter
      : trafficLightFilter;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return items
      .filter((item) => {
        if (sliceFilter === 'atRisk' && item.status === 'Green') return false;
        if (sliceFilter === 'awaitingOver3Days' && !item.isAwaitingOver3Days) return false;
        if (sliceFilter === 'expired' && !item.isExpired) return false;
        if (sliceFilter === 'due30' && !item.isDueWithin30) return false;
        if (sliceFilter === 'due60' && !item.isDueWithin60) return false;
        if (sliceFilter === 'due90' && !item.isDueWithin90) return false;
        if (sliceFilter === 'unverified' && !item.isUnverified) return false;

        if (effectiveStatusFilter !== 'All' && item.status !== effectiveStatusFilter) {
          return false;
        }
        if (groupFilter !== 'All' && item.group !== groupFilter) return false;
        if (ownerFilter !== 'All') {
          const itemOwner = item.owner.trim() || 'Unassigned';
          if (itemOwner !== ownerFilter) return false;
        }
        if (sourceFilter !== 'All' && item.sourceType !== sourceFilter) return false;

        if (q) {
          const matchesItemName = item.itemName.toLowerCase().includes(q);
          const matchesOwner =
            item.owner.toLowerCase().includes(q) ||
            item.backupOwner.toLowerCase().includes(q);
          const matchesGroup = item.group.toLowerCase().includes(q);
          if (!matchesItemName && !matchesOwner && !matchesGroup) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortField) {
          case 'itemName':
            return a.itemName.localeCompare(b.itemName) * dir;
          case 'company':
            return a.company.localeCompare(b.company) * dir;
          case 'group':
            return a.group.localeCompare(b.group) * dir;
          case 'status': {
            const rank: Record<TrafficLightStatus, number> = {
              Red: 0,
              'Pending review': 1,
              Yellow: 2,
              Green: 3,
            };
            return (rank[a.status] - rank[b.status]) * dir;
          }
          case 'expiryDate':
            return (a.expiryDate || '9999-99-99').localeCompare(b.expiryDate || '9999-99-99') * dir;
          case 'alertDate':
            return (a.alertDate || '9999-99-99').localeCompare(b.alertDate || '9999-99-99') * dir;
          case 'daysUntilExpiry': {
            const da = a.daysUntilExpiry ?? 99999;
            const db = b.daysUntilExpiry ?? 99999;
            return (da - db) * dir;
          }
          case 'owner':
            return (a.owner || 'zzz').localeCompare(b.owner || 'zzz') * dir;
          default:
            return 0;
        }
      });
  }, [
    items,
    searchQuery,
    sliceFilter,
    effectiveStatusFilter,
    groupFilter,
    ownerFilter,
    sourceFilter,
    sortField,
    sortDir,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    effectiveStatusFilter !== 'All' ||
    groupFilter !== 'All' ||
    ownerFilter !== 'All' ||
    sourceFilter !== 'All' ||
    sliceFilter !== 'all';

  const resetAllFilters = () => {
    onSearchChange('');
    onTrafficLightFilterChange('All');
    setGroupFilter('All');
    setOwnerFilter('All');
    setSourceFilter('All');
    onSliceFilterChange('all');
  };

  return (
    <section
      aria-label="Compliance Register Table"
      className="rounded-lg border border-line bg-card"
    >
      {/* Filter Toolbar */}
      <div className="border-b border-line p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink-accent">
              Compliance Register
            </h2>
            <p className="text-xs text-ink-muted">
              Click any row to inspect all statutory, credential-source, and audit fields.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted tabular-nums">
            <span>
              Showing <strong className="text-ink-accent">{filteredItems.length}</strong> of{' '}
              <strong className="text-ink-accent">{items.length}</strong> items
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-card px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={effectiveStatusFilter}
            onChange={(e) => {
              onSliceFilterChange('all');
              onTrafficLightFilterChange(e.target.value as TrafficLightFilter);
            }}
            aria-label="Filter by status"
            className="rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
          >
            <option value="All">All Statuses</option>
            <option value="Green">Green — Compliant</option>
            <option value="Yellow">Yellow — Action Required</option>
            <option value="Pending review">Pending review</option>
            <option value="Red">Red — Non-Compliant</option>
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label="Filter by group"
            className="rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
          >
            <option value="All">All Groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filter by owner"
            className="rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
          >
            <option value="All">All Owners</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filter by source type"
            className="rounded-md border border-line-strong bg-subtle px-3 py-2 text-sm text-ink focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
          >
            <option value="All">All Source Types</option>
            {SOURCE_TYPE_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Active window slice selector */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="mr-1 text-xs font-medium text-ink-muted">Quick window:</span>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'atRisk', label: 'At risk' },
              { id: 'awaitingOver3Days', label: 'Review > 3d' },
              { id: 'expired', label: 'Expired' },
              { id: 'due30', label: 'Due ≤ 30d' },
              { id: 'due60', label: 'Due ≤ 60d' },
              { id: 'due90', label: 'Due ≤ 90d' },
              { id: 'unverified', label: 'Unverified' },
            ] as { id: QuickSliceFilter; label: string }[]
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onSliceFilterChange(btn.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                sliceFilter === btn.id
                  ? 'bg-accent text-on-accent'
                  : 'bg-muted-surface text-ink-secondary hover:bg-hover-surface'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle text-xs font-semibold text-ink-muted">
              <SortableTh
                label="Item Name"
                field="itemName"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Division"
                field="company"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Group"
                field="group"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Status"
                field="status"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Expiry Date"
                field="expiryDate"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Alert Date"
                field="alertDate"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Days"
                field="daysUntilExpiry"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="Owner / Backup"
                field="owner"
                currentField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Verification</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                Document Check
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-ink">
                    No compliance items match the current filters.
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Adjust your search or filter criteria, or add a new compliance item.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
                      >
                        Clear Filters
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onAddNew}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover"
                    >
                      Add Compliance Item
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="cursor-pointer transition-colors hover:bg-hover-surface"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-accent">{item.itemName}</div>
                    <div className="mt-0.5 text-xs text-ink-muted truncate max-w-xs">
                      {item.sourceType} · {item.renewalCycle || 'No cycle'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CompanyScopeLabel company={item.company} />
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-ink-secondary whitespace-nowrap">
                    {item.group}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} label={item.statusLabel} compact />
                    {(item.isPendingReview || item.humanDecision) && (
                      <div className="mt-1 text-[11px] text-ink-muted">
                        Auto: {item.automaticStatusLabel}
                        {item.humanDecision ? ` · ${item.humanDecision}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink-secondary tabular-nums whitespace-nowrap">
                    {formatDisplayDate(item.expiryDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink-muted tabular-nums whitespace-nowrap">
                    {formatDisplayDate(item.alertDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    {item.daysUntilExpiry === null ? (
                      <span className="text-ink-muted">—</span>
                    ) : item.daysUntilExpiry < 0 ? (
                      <span className="font-semibold text-tone-red">
                        {Math.abs(item.daysUntilExpiry)}d overdue
                      </span>
                    ) : (
                      <span
                        className={
                          item.daysUntilExpiry <= 30
                            ? 'font-semibold text-tone-yellow'
                            : 'text-ink-secondary'
                        }
                      >
                        {item.daysUntilExpiry}d
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-ink">
                      {item.owner || <span className="text-tone-red">Missing</span>}
                    </div>
                    <div className="text-ink-muted">
                      {item.backupOwner ? (
                        `Backup: ${item.backupOwner}`
                      ) : (
                        <span className="text-tone-yellow">No backup</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-secondary whitespace-nowrap">
                    {item.systemVerificationRequired === 'No' ? (
                      <span className="text-ink-muted">Not required</span>
                    ) : item.verifiedInStatutorySystem === 'Yes' ? (
                      <span className="font-medium text-tone-green">Verified</span>
                    ) : item.verifiedInStatutorySystem === 'No' ? (
                      <span className="font-semibold text-tone-red">Non-compliant</span>
                    ) : (
                      <span className="font-medium text-tone-yellow">Not checked</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCheckDocument(item);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-2.5 py-1.5 text-xs font-medium text-ink-accent transition-colors hover:bg-hover-surface"
                    >
                      <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Check document</span>
                    </button>
                    {item.lastDocumentCheck && (
                      <div
                        className={`mt-1 text-[11px] font-medium ${
                          item.lastDocumentCheck.outcome === 'Passed'
                            ? 'text-tone-green'
                            : 'text-tone-pending'
                        }`}
                      >
                        {item.lastDocumentCheck.outcome === 'Passed'
                          ? 'Check passed'
                          : 'Flagged for review'}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortableTh({
  label,
  field,
  currentField,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentField === field;
  return (
    <th className={`px-4 py-3 font-semibold whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-ink-accent ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-ink-accent" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-ink-accent" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-ink-muted" />
        )}
      </button>
    </th>
  );
}
