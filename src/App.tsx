import {
  Calendar,
  FileSpreadsheet,
  Mail,
  Moon,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionsRequiredList } from './components/ActionsRequiredList';
import { CsvImportModal } from './components/CsvImportModal';
import { DataQualityPanel } from './components/DataQualityPanel';
import { DocumentCheckModal } from './components/DocumentCheckModal';
import { EmailPreviewPanel } from './components/EmailPreviewPanel';
import { ExecutivePrintView } from './components/ExecutivePrintView';
import { ExpiryTimeline } from './components/ExpiryTimeline';
import { GroupConfigModal } from './components/GroupConfigModal';
import { ItemDetailDrawer } from './components/ItemDetailDrawer';
import { ItemFormModal } from './components/ItemFormModal';
import { ManagementSummaryPanel } from './components/ManagementSummaryPanel';
import { OwnershipView } from './components/OwnershipView';
import { RegisterTable } from './components/RegisterTable';
import { ReviewDecisionModal } from './components/ReviewDecisionModal';
import { ReviewQueue } from './components/ReviewQueue';
import { StatusRulesPanel } from './components/StatusRulesPanel';
import { QuickSliceFilter, SummaryCards } from './components/SummaryCards';
import { TrafficLightControl } from './components/TrafficLightControl';
import {
  DEFAULT_AS_AT_DATE,
  DEFAULT_COMPLIANCE_GROUPS,
  DEFAULT_TRAFFIC_LIGHT_DEFINITIONS,
  SEED_COMPLIANCE_ITEMS,
  SEED_DECISION_HISTORY,
  seedDataSource,
} from './data/seedComplianceData';
import {
  buildOwnershipSummary,
  computeItemDataFingerprint,
  computeSummaryMetrics,
  evaluateComplianceRegister,
  filterItemsByDivision,
  filterItemsByTrafficLight,
  formatDisplayDate,
  getTrafficLightSummary,
} from './lib/complianceEngine';
import { createSimulatedEmailNotification } from './lib/notificationService';
import { useTheme } from './lib/theme';
import {
  ComplianceItem,
  DivisionFilter,
  DocumentCheckRecord,
  EvaluatedComplianceItem,
  ReviewAuditEntry,
  ReviewDecisionType,
  SimulatedEmailNotification,
  TrafficLightDefinition,
  TrafficLightFilter,
  TrafficLightStatus,
  UserRole,
} from './types/compliance';

type ActiveScreen = 'overview' | 'register' | 'reviews' | 'timeline' | 'governance';

const ROLES: UserRole[] = ['Compliance Officer', 'Document Owner', 'Viewer'];

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [items, setItems] = useState<ComplianceItem[]>(SEED_COMPLIANCE_ITEMS);
  const [groups, setGroups] = useState<string[]>(DEFAULT_COMPLIANCE_GROUPS);
  const [trafficLightDefs, setTrafficLightDefs] = useState<TrafficLightDefinition[]>(
    DEFAULT_TRAFFIC_LIGHT_DEFINITIONS
  );
  const [decisionHistory, setDecisionHistory] = useState<ReviewAuditEntry[]>(SEED_DECISION_HISTORY);
  const [isCustomData, setIsCustomData] = useState(false);

  const [division, setDivision] = useState<DivisionFilter>('Consulting');
  const [asAtDate, setAsAtDate] = useState<string>(DEFAULT_AS_AT_DATE);
  const [userRole, setUserRole] = useState<UserRole>('Compliance Officer');
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('overview');
  const [sliceFilter, setSliceFilter] = useState<QuickSliceFilter>('all');
  const [activeTrafficLight, setActiveTrafficLight] = useState<TrafficLightFilter>('All');
  const [registerSearch, setRegisterSearch] = useState('');

  // Modals & Drawers
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [reviewingItemId, setReviewingItemId] = useState<string | null>(null);
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [isGroupConfigOpen, setIsGroupConfigOpen] = useState(false);

  // Simulated Notification Service & Email Preview state
  const [emailNotifications, setEmailNotifications] = useState<SimulatedEmailNotification[]>([]);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const prevStatusMapRef = useRef<Map<string, TrafficLightStatus> | null>(null);

  // Load initial data via swappable ComplianceDataSource adapter
  useEffect(() => {
    let active = true;
    Promise.all([
      seedDataSource.loadItems(),
      seedDataSource.loadGroups(),
      seedDataSource.loadTrafficLightDefinitions(),
      seedDataSource.loadDecisionHistory(),
    ]).then(([loadedItems, loadedGroups, loadedLights, loadedHistory]) => {
      if (!active) return;
      setItems(loadedItems);
      setGroups(loadedGroups);
      setTrafficLightDefs(loadedLights);
      setDecisionHistory(loadedHistory);
    });
    return () => {
      active = false;
    };
  }, []);

  // Evaluate all items once against the active "As at" date
  const evaluatedAll = useMemo(
    () => evaluateComplianceRegister(items, asAtDate),
    [items, asAtDate]
  );

  // Detect transitions to 'Red' or 'Pending review' and open Email Preview panel
  useEffect(() => {
    if (prevStatusMapRef.current === null) {
      prevStatusMapRef.current = new Map(
        evaluatedAll.map((item) => [item.id, item.status])
      );
      return;
    }

    const prevMap = prevStatusMapRef.current;
    const newlyTriggered: SimulatedEmailNotification[] = [];

    for (const item of evaluatedAll) {
      const previousStatus = prevMap.get(item.id);
      if (
        previousStatus !== item.status &&
        (item.status === 'Red' || item.status === 'Pending review')
      ) {
        newlyTriggered.push(
          createSimulatedEmailNotification({
            item,
            previousStatus: previousStatus ?? 'New',
            newStatus: item.status,
            asAtDate,
          })
        );
      }
    }

    prevStatusMapRef.current = new Map(
      evaluatedAll.map((item) => [item.id, item.status])
    );

    if (newlyTriggered.length > 0) {
      setEmailNotifications((prev) => [...newlyTriggered, ...prev]);
      setSelectedEmailId(newlyTriggered[0].id);
      setIsEmailPreviewOpen(true);
    }
  }, [evaluatedAll, asAtDate]);

  // Division counts ("Both" counts in Consulting and Academy)
  const divisionCounts = useMemo(
    () => ({
      Consulting: filterItemsByDivision(evaluatedAll, 'Consulting').length,
      Academy: filterItemsByDivision(evaluatedAll, 'Academy').length,
      All: evaluatedAll.length,
    }),
    [evaluatedAll]
  );

  // Active division items
  const divisionItems = useMemo(
    () => filterItemsByDivision(evaluatedAll, division),
    [evaluatedAll, division]
  );

  // Traffic light summary & filtered items driven from data layer
  const trafficLightSummary = useMemo(
    () => getTrafficLightSummary(divisionItems, trafficLightDefs),
    [divisionItems, trafficLightDefs]
  );

  const trafficFilteredItems = useMemo(
    () => filterItemsByTrafficLight(divisionItems, activeTrafficLight),
    [divisionItems, activeTrafficLight]
  );

  const metrics = useMemo(() => computeSummaryMetrics(divisionItems), [divisionItems]);

  const dataQualityFlagCount = useMemo(
    () => divisionItems.filter((i) => i.dataQualityIssues.length > 0).length,
    [divisionItems]
  );

  const backupGapOwnerCount = useMemo(
    () => buildOwnershipSummary(divisionItems).filter((o) => o.hasBackupGap).length,
    [divisionItems]
  );

  const selectedItem: EvaluatedComplianceItem | null = useMemo(
    () => evaluatedAll.find((i) => i.id === selectedItemId) ?? null,
    [evaluatedAll, selectedItemId]
  );

  const reviewingItem: EvaluatedComplianceItem | null = useMemo(
    () => evaluatedAll.find((i) => i.id === reviewingItemId) ?? null,
    [evaluatedAll, reviewingItemId]
  );

  const checkingItem: EvaluatedComplianceItem | null = useMemo(
    () => evaluatedAll.find((i) => i.id === checkingItemId) ?? null,
    [evaluatedAll, checkingItemId]
  );

  const appendDocumentCheckAudit = (
    targetItem: Pick<ComplianceItem, 'id' | 'itemName' | 'company'>,
    automaticStatus: EvaluatedComplianceItem['automaticStatus'],
    record: DocumentCheckRecord
  ) => {
    const newAuditEntry: ReviewAuditEntry = {
      id: `aud-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: targetItem.id,
      itemName: targetItem.itemName,
      company: targetItem.company,
      automaticStatus,
      findingSource: 'Document check',
      triggerReason: record.routingReason,
      decision: 'OCR + AI document check',
      checkResult: record.outcome,
      reviewerName: `OCR + Gemini (${record.fileName})`,
      decisionDate: record.checkedAt,
      decisionReason: record.routingReason,
    };
    setDecisionHistory((prev) => [newAuditEntry, ...prev]);
  };

  // Save item with Rule #6: if underlying data changed after a decision, send back to Pending review automatically
  const handleSaveItem = (
    saved: ComplianceItem,
    documentCheckRecords?: DocumentCheckRecord[]
  ) => {
    const latestFormCheck =
      documentCheckRecords && documentCheckRecords.length > 0
        ? documentCheckRecords[documentCheckRecords.length - 1]
        : undefined;

    setItems((prev) => {
      const existing = prev.find((i) => i.id === saved.id);
      if (existing) {
        let nextItem = saved;
        const routedByFormCheck = latestFormCheck?.outcome === 'Routed to Pending review';
        if (
          !routedByFormCheck &&
          existing.reviewState?.status === 'Decided' &&
          computeItemDataFingerprint(saved) !== existing.reviewState.snapshotHash
        ) {
          nextItem = {
            ...saved,
            findingSource: 'Rule engine',
            triggerReason:
              'Underlying compliance data changed after prior decision — returned to Pending review',
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
          };
        }
        return prev.map((i) => (i.id === saved.id ? nextItem : i));
      }
      return [saved, ...prev];
    });

    if (documentCheckRecords && documentCheckRecords.length > 0) {
      const evaluatedDraft = evaluateComplianceRegister([saved], asAtDate)[0];
      for (const rec of documentCheckRecords) {
        appendDocumentCheckAudit(saved, evaluatedDraft.automaticStatus, rec);
      }
    }

    setIsCustomData(true);
  };

  const handleSavePassedDocumentCheck = (itemId: string, record: DocumentCheckRecord) => {
    const evaluatedTarget = evaluatedAll.find((i) => i.id === itemId);
    if (!evaluatedTarget) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              lastDocumentCheck: record,
            }
          : item
      )
    );

    appendDocumentCheckAudit(evaluatedTarget, evaluatedTarget.automaticStatus, record);
    setIsCustomData(true);
  };

  const handleRouteDocumentCheckToPending = (itemId: string, record: DocumentCheckRecord) => {
    const evaluatedTarget = evaluatedAll.find((i) => i.id === itemId);
    if (!evaluatedTarget) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          findingSource: 'Document check',
          triggerReason: record.routingReason,
          lastDocumentCheck: record,
          reviewState: {
            status: 'Pending review',
            pendingSince: record.checkedAt,
            decision: null,
            reviewerName: '',
            decisionDate: '',
            decisionReason: '',
            evidenceDueDate: '',
            snapshotHash: '',
          },
        };
      })
    );

    appendDocumentCheckAudit(evaluatedTarget, evaluatedTarget.automaticStatus, record);
    setIsCustomData(true);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setIsCustomData(true);
  };

  const handleCsvImport = (imported: ComplianceItem[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setItems(imported);
    } else {
      setItems((prev) => [...imported, ...prev]);
    }
    setIsCustomData(true);
  };

  const handleRecordReviewDecision = (
    itemId: string,
    payload: {
      decision: ReviewDecisionType;
      reviewerName: string;
      decisionDate: string;
      decisionReason: string;
      evidenceDueDate: string;
    }
  ) => {
    const evaluatedTarget = evaluatedAll.find((i) => i.id === itemId);
    if (!evaluatedTarget) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          reviewState: {
            status: 'Decided',
            pendingSince: item.reviewState?.pendingSince || asAtDate,
            decision: payload.decision,
            reviewerName: payload.reviewerName,
            decisionDate: payload.decisionDate,
            decisionReason: payload.decisionReason,
            evidenceDueDate: payload.evidenceDueDate,
            snapshotHash: computeItemDataFingerprint(item),
          },
        };
      })
    );

    const newAuditEntry: ReviewAuditEntry = {
      id: `aud-${Date.now()}`,
      itemId: evaluatedTarget.id,
      itemName: evaluatedTarget.itemName,
      company: evaluatedTarget.company,
      automaticStatus: evaluatedTarget.automaticStatus,
      findingSource: evaluatedTarget.findingSource,
      triggerReason: evaluatedTarget.effectiveTriggerReason,
      decision: payload.decision,
      reviewerName: payload.reviewerName,
      decisionDate: payload.decisionDate,
      decisionReason: payload.decisionReason,
      evidenceDueDate: payload.evidenceDueDate || undefined,
    };

    setDecisionHistory((prev) => [newAuditEntry, ...prev]);
    setIsCustomData(true);
  };

  const handleMarkAsCompliant = (evaluatedItem: EvaluatedComplianceItem) => {
    if (evaluatedItem.status === 'Pending review' || userRole !== 'Compliance Officer') return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== evaluatedItem.id) return item;
        const updated: ComplianceItem = {
          ...item,
          verifiedInStatutorySystem: 'Yes',
          dateVerified: asAtDate,
          verifiedBy: userRole,
        };
        if (updated.reviewState?.status === 'Decided') {
          updated.reviewState = {
            ...updated.reviewState,
            snapshotHash: computeItemDataFingerprint(updated),
          };
        }
        return updated;
      })
    );
    setIsCustomData(true);
  };

  const handleSubmitRegulatory = (evaluatedItem: EvaluatedComplianceItem) => {
    if (evaluatedItem.status === 'Pending review' || userRole !== 'Compliance Officer') return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== evaluatedItem.id) return item;
        const stamp = `Regulatory submission recorded on ${asAtDate} by ${userRole}.`;
        return {
          ...item,
          notes: item.notes ? `${item.notes} | ${stamp}` : stamp,
        };
      })
    );
    setIsCustomData(true);
  };

  const handleSelectSummarySlice = (slice: QuickSliceFilter) => {
    setSliceFilter(slice);
    if (
      slice === 'Green' ||
      slice === 'Yellow' ||
      slice === 'Red' ||
      slice === 'Pending review'
    ) {
      setActiveTrafficLight(slice);
    } else if (slice === 'all') {
      setActiveTrafficLight('All');
    }
    setActiveScreen('register');
  };

  const handleSelectTrafficLight = (light: TrafficLightFilter) => {
    setActiveTrafficLight(light);
    if (light === 'All') {
      if (
        sliceFilter === 'Green' ||
        sliceFilter === 'Yellow' ||
        sliceFilter === 'Red' ||
        sliceFilter === 'Pending review'
      ) {
        setSliceFilter('all');
      }
    } else {
      setSliceFilter(light);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: ComplianceItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleSimulateSendEmail = (notificationId: string) => {
    setEmailNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId
          ? { ...notif, deliveryStatus: 'Simulated Sent' }
          : notif
      )
    );
  };

  const handleClearEmailNotifications = () => {
    setEmailNotifications([]);
    setSelectedEmailId(null);
  };

  const navItems: { id: ActiveScreen; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'register', label: 'Register' },
    { id: 'reviews', label: `Review Queue (${metrics.pendingReview})` },
    { id: 'timeline', label: 'Timeline & Actions' },
    { id: 'governance', label: 'Quality & Ownership' },
  ];

  const themeToggleLabel =
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <>
      <div className="theme-surface no-print min-h-screen flex flex-col bg-canvas text-ink">
        {/* Top Bar Contract: 3 clean zones (Brand, 5 Nav Links, 1 Primary Action) */}
        <header className="sticky top-0 z-30 border-b border-topbar-border bg-topbar text-topbar-text">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
            {/* Zone 1: Brand wordmark */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveScreen('overview');
              }}
              className="font-display text-lg font-bold tracking-tight text-topbar-text whitespace-nowrap shrink-0"
            >
              Mindworx Compliance
            </a>

            {/* Zone 2: Concise single-line navigation links */}
            <nav
              aria-label="Primary sections"
              className="hidden lg:flex items-center gap-6 text-sm font-medium"
            >
              {navItems.map((nav) => (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveScreen(nav.id)}
                  className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    activeScreen === nav.id
                      ? 'border-white text-white dark:border-ink-accent dark:text-ink-accent'
                      : 'border-transparent text-topbar-muted hover:text-white'
                  }`}
                >
                  {nav.label}
                </button>
              ))}
            </nav>

            {/* Zone 3: 1 Primary CTA */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-slate-100 dark:bg-accent dark:text-on-accent dark:hover:bg-accent-hover whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Mobile / tablet navigation row */}
          <nav
            aria-label="Mobile sections"
            className="flex lg:hidden items-center gap-4 overflow-x-auto border-t border-topbar-border px-4 py-2 text-xs font-medium"
          >
            {navItems.map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveScreen(nav.id)}
                className={`py-1 whitespace-nowrap shrink-0 tabular-nums ${
                  activeScreen === nav.id
                    ? 'text-white underline underline-offset-4 dark:text-ink-accent'
                    : 'text-topbar-muted'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>
        </header>

        {/* Workspace Control Bar: Division Tabs, Theme Toggle, Sample Data Notice, Role Switcher, As-at Date & Utility Tools */}
        <div className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            {/* Division Tabs, Icon-Only Theme Toggle & Sample Data Notice */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="tablist"
                aria-label="Company divisions"
                className="inline-flex items-center rounded-lg border border-line bg-muted-surface p-1"
              >
                {(
                  [
                    { id: 'Consulting', label: 'Consulting' },
                    { id: 'Academy', label: 'Academy' },
                    { id: 'All', label: 'All' },
                  ] as { id: DivisionFilter; label: string }[]
                ).map((tab) => {
                  const active = division === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      type="button"
                      onClick={() => setDivision(tab.id)}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        active
                          ? 'bg-accent text-on-accent shadow-xs'
                          : 'text-ink-secondary hover:text-ink-accent'
                      }`}
                    >
                      {tab.label} ({divisionCounts[tab.id]})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-subtle text-ink-accent transition-colors hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              <span className="text-xs font-medium text-ink-muted">
                {!isCustomData ? (
                  <span className="font-semibold text-ink-accent">
                    SAMPLE DATA · Illustrative seed register & audit trail (“Both” items appear in Consulting & Academy)
                  </span>
                ) : (
                  <span className="font-semibold text-ink-accent">
                    SAMPLE DATA (Modified) · Active local session
                  </span>
                )}
              </span>
            </div>

            {/* Role Switcher, As-at Date & Utility Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-line-strong bg-subtle px-2.5 py-1.5">
                <UserCheck className="h-3.5 w-3.5 text-ink-accent shrink-0" aria-hidden="true" />
                <label htmlFor="role-switcher" className="text-xs font-medium text-ink-muted whitespace-nowrap">
                  Role:
                </label>
                <select
                  id="role-switcher"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="bg-transparent text-xs font-semibold text-ink-accent focus:outline-none"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role} className="bg-card text-ink">
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-line-strong bg-subtle px-2.5 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-ink-accent shrink-0" aria-hidden="true" />
                <label htmlFor="as-at-date" className="text-xs font-medium text-ink-muted whitespace-nowrap">
                  As at:
                </label>
                <input
                  id="as-at-date"
                  type="date"
                  value={asAtDate}
                  onChange={(e) => {
                    if (e.target.value) setAsAtDate(e.target.value);
                  }}
                  className="bg-transparent font-mono text-xs font-semibold text-ink-accent focus:outline-none tabular-nums"
                />
                {asAtDate !== DEFAULT_AS_AT_DATE && (
                  <button
                    type="button"
                    onClick={() => setAsAtDate(DEFAULT_AS_AT_DATE)}
                    title="Reset to 24 November 2026"
                    className="inline-flex items-center gap-1 rounded bg-card px-1.5 py-0.5 text-[11px] font-medium text-ink-accent border border-line hover:bg-hover-surface"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>24 Nov</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsCsvOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-ink-accent" aria-hidden="true" />
                <span>Import CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGroupConfigOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
              >
                <Settings2 className="h-3.5 w-3.5 text-ink-accent" aria-hidden="true" />
                <span>Groups</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedEmailId && emailNotifications.length > 0) {
                    setSelectedEmailId(emailNotifications[0].id);
                  }
                  setIsEmailPreviewOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0 tabular-nums"
              >
                <Mail className="h-3.5 w-3.5 text-ink-accent" aria-hidden="true" />
                <span>
                  Email Preview{emailNotifications.length > 0 ? ` (${emailNotifications.length})` : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-1.5 text-xs font-semibold text-ink-accent hover:bg-accent hover:text-on-accent hover:border-accent transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Print Executive View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 space-y-6">
          {/* Context Heading (+ Global Search Bar on Register Screen) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-ink-accent sm:text-2xl">
                {division === 'All'
                  ? 'Mindworx Group — Combined Compliance View'
                  : `Mindworx ${division} — Statutory & Corporate Compliance`}
              </h1>
              <p className="mt-0.5 text-xs text-ink-muted">
                Evaluated as at <strong className="text-ink">{formatDisplayDate(asAtDate)}</strong> ·
                Role: <strong className="text-ink">{userRole}</strong> ·
                Data layer: {seedDataSource.name}
              </p>
            </div>

            {activeScreen === 'register' && (
              <div className="relative w-full sm:w-80 md:w-96 shrink-0">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  placeholder="Search by item name, owner, or group..."
                  aria-label="Search register by item name, owner, or group"
                  className="w-full rounded-md border border-line-strong bg-card py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
                />
                {registerSearch && (
                  <button
                    type="button"
                    onClick={() => setRegisterSearch('')}
                    aria-label="Clear register search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:bg-hover-surface hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {activeScreen !== 'governance' && activeScreen !== 'reviews' && (
            <TrafficLightControl
              lights={trafficLightSummary}
              activeLight={activeTrafficLight}
              totalItems={divisionItems.length}
              onSelectLight={handleSelectTrafficLight}
              onOpenRegisterWithLight={
                activeScreen !== 'register'
                  ? (light) => {
                      handleSelectTrafficLight(light);
                      setActiveScreen('register');
                    }
                  : undefined
              }
            />
          )}

          {activeScreen === 'overview' && (
            <div className="space-y-6">
              <SummaryCards
                metrics={metrics}
                onSelectSlice={handleSelectSummarySlice}
                onOpenReviewQueue={() => setActiveScreen('reviews')}
              />

              <ManagementSummaryPanel
                items={divisionItems}
                asAtDate={asAtDate}
                division={division}
              />

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
                <div className="xl:col-span-7">
                  <ExpiryTimeline
                    items={trafficFilteredItems}
                    asAtDate={asAtDate}
                    onSelectItem={(item) => setSelectedItemId(item.id)}
                    compact
                  />
                </div>
                <div className="xl:col-span-5">
                  <ActionsRequiredList
                    items={trafficFilteredItems}
                    onSelectItem={(item) => setSelectedItemId(item.id)}
                    limit={6}
                    onViewAll={() => setActiveScreen('timeline')}
                  />
                </div>
              </div>

              {/* Governance Readiness Strip */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActiveScreen('governance')}
                  className="flex items-center justify-between rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-line-strong hover:bg-hover-surface"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-ink-accent shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-display text-sm font-semibold text-ink-accent">
                        Data Quality & Audit Readiness
                      </div>
                      <div className="text-xs text-ink-muted">
                        Date reversals, missing lead times, unverified records, and cleared-without-reason checks
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      dataQualityFlagCount > 0 ? 'text-tone-yellow' : 'text-tone-green'
                    }`}
                  >
                    {dataQualityFlagCount} flagged
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveScreen('governance')}
                  className="flex items-center justify-between rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-line-strong hover:bg-hover-surface"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-ink-accent shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-display text-sm font-semibold text-ink-accent">
                        Ownership & Backup Coverage
                      </div>
                      <div className="text-xs text-ink-muted">
                        Primary owners missing assigned backup owners
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      backupGapOwnerCount > 0 ? 'text-tone-yellow' : 'text-tone-green'
                    }`}
                  >
                    {backupGapOwnerCount} owner gap{backupGapOwnerCount === 1 ? '' : 's'}
                  </span>
                </button>
              </div>

              <StatusRulesPanel />
            </div>
          )}

          {activeScreen === 'register' && (
            <div className="space-y-6">
              <SummaryCards
                metrics={metrics}
                onSelectSlice={handleSelectSummarySlice}
                onOpenReviewQueue={() => setActiveScreen('reviews')}
              />
              <RegisterTable
                items={divisionItems}
                groups={groups}
                searchQuery={registerSearch}
                onSearchChange={setRegisterSearch}
                sliceFilter={sliceFilter}
                trafficLightFilter={activeTrafficLight}
                onSliceFilterChange={setSliceFilter}
                onTrafficLightFilterChange={handleSelectTrafficLight}
                onSelectItem={(item) => setSelectedItemId(item.id)}
                onCheckDocument={(item) => setCheckingItemId(item.id)}
                onAddNew={handleOpenAdd}
              />
            </div>
          )}

          {activeScreen === 'reviews' && (
            <div className="space-y-6">
              <SummaryCards
                metrics={metrics}
                onSelectSlice={handleSelectSummarySlice}
                onOpenReviewQueue={() => setActiveScreen('reviews')}
              />
              <ReviewQueue
                items={divisionItems}
                decisionHistory={decisionHistory}
                userRole={userRole}
                isSampleData={!isCustomData}
                onOpenReviewPanel={(item) => setReviewingItemId(item.id)}
                onSelectItem={(item) => setSelectedItemId(item.id)}
              />
            </div>
          )}

          {activeScreen === 'timeline' && (
            <div className="space-y-6">
              <ExpiryTimeline
                items={trafficFilteredItems}
                asAtDate={asAtDate}
                onSelectItem={(item) => setSelectedItemId(item.id)}
              />
              <ActionsRequiredList
                items={trafficFilteredItems}
                onSelectItem={(item) => setSelectedItemId(item.id)}
              />
            </div>
          )}

          {activeScreen === 'governance' && (
            <div className="space-y-6">
              <DataQualityPanel
                items={divisionItems}
                onEditItem={(item) => handleOpenEdit(item)}
                onSelectItem={(item) => setSelectedItemId(item.id)}
              />
              <OwnershipView
                items={divisionItems}
                onSelectItem={(item) => setSelectedItemId(item.id)}
              />
              <StatusRulesPanel />
            </div>
          )}
        </main>

        <footer className="border-t border-line bg-card py-4">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 text-xs text-ink-muted sm:px-6">
            <span>Mindworx Group Compliance Prototype · Consulting & Academy</span>
            <span>Passwords and PINs are never stored in this register.</span>
          </div>
        </footer>
      </div>

      {/* Executive One-Page Print Layout (always prints white theme) */}
      <ExecutivePrintView
        division={division}
        asAtDate={asAtDate}
        metrics={metrics}
        items={divisionItems}
      />

      {/* Row Detail Panel */}
      <ItemDetailDrawer
        item={selectedItem}
        userRole={userRole}
        onClose={() => setSelectedItemId(null)}
        onEdit={(item) => {
          setSelectedItemId(null);
          handleOpenEdit(item);
        }}
        onDelete={handleDeleteItem}
        onOpenReview={(item) => {
          setSelectedItemId(null);
          setReviewingItemId(item.id);
        }}
        onCheckDocument={(item) => {
          setSelectedItemId(null);
          setCheckingItemId(item.id);
        }}
        onMarkAsCompliant={handleMarkAsCompliant}
        onSubmitRegulatory={handleSubmitRegulatory}
      />

      {/* Document Check Modal (OCR + Gemini Extraction + Deterministic Routing) */}
      <DocumentCheckModal
        isOpen={Boolean(checkingItem)}
        target={
          checkingItem
            ? {
                id: checkingItem.id,
                company: checkingItem.company,
                itemName: checkingItem.itemName,
                group: checkingItem.group,
                issueDate: checkingItem.issueDate,
                expiryDate: checkingItem.expiryDate,
                documentLink: checkingItem.documentLink,
                lastDocumentCheck: checkingItem.lastDocumentCheck,
              }
            : null
        }
        asAtDate={asAtDate}
        onSavePassedCheck={handleSavePassedDocumentCheck}
        onRouteToPendingReview={handleRouteDocumentCheckToPending}
        onClose={() => setCheckingItemId(null)}
      />

      {/* Human-in-the-loop Review Decision Panel */}
      <ReviewDecisionModal
        item={reviewingItem}
        asAtDate={asAtDate}
        userRole={userRole}
        onDecide={handleRecordReviewDecision}
        onClose={() => setReviewingItemId(null)}
      />

      {/* Add / Edit Item Form */}
      <ItemFormModal
        isOpen={isFormOpen}
        initialItem={editingItem}
        groups={groups}
        asAtDate={asAtDate}
        defaultCompany={division === 'Academy' ? 'Academy' : 'Consulting'}
        onSave={handleSaveItem}
        onClose={() => setIsFormOpen(false)}
      />

      {/* CSV Import with Column Mapping */}
      <CsvImportModal
        isOpen={isCsvOpen}
        onImport={handleCsvImport}
        onClose={() => setIsCsvOpen(false)}
      />

      {/* Configurable Group Names */}
      <GroupConfigModal
        isOpen={isGroupConfigOpen}
        groups={groups}
        onSaveGroups={setGroups}
        onClose={() => setIsGroupConfigOpen(false)}
      />

      {/* Simulated Notification Service — Owner Email Preview Panel */}
      <EmailPreviewPanel
        isOpen={isEmailPreviewOpen}
        notifications={emailNotifications}
        selectedId={selectedEmailId}
        onSelectId={setSelectedEmailId}
        onSimulateSend={handleSimulateSendEmail}
        onOpenItem={(itemId) => {
          setIsEmailPreviewOpen(false);
          setSelectedItemId(itemId);
        }}
        onClearAll={handleClearEmailNotifications}
        onClose={() => setIsEmailPreviewOpen(false)}
      />
    </>
  );
}
