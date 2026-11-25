import {
  AutomaticStatus,
  ComplianceItem,
  DataQualityIssue,
  DivisionFilter,
  DocumentCheckComparisonRow,
  DocumentCheckExtraction,
  DocumentCheckRecord,
  EvaluatedComplianceItem,
  ExpiryCluster,
  ManagementSummaryMetrics,
  OcrDateResult,
  OcrFieldExtraction,
  OwnerSummary,
  ReviewAuditEntry,
  SourceType,
  SummaryMetrics,
  TrafficLightDefinition,
  TrafficLightFilter,
  TrafficLightSummaryItem,
} from '../types/compliance';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse YYYY-MM-DD safely in UTC to avoid local timezone drift.
 */
export function parseIsoDateUTC(dateStr: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return null;
  }
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return utc;
}

export function formatUtcTimestampToIso(utcMs: number): string {
  const dt = new Date(utcMs);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const utc = parseIsoDateUTC(dateStr);
  if (utc === null) return dateStr;
  return new Date(utc).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function diffDaysUTC(fromIso: string, toIso: string): number | null {
  const fromMs = parseIsoDateUTC(fromIso);
  const toMs = parseIsoDateUTC(toIso);
  if (fromMs === null || toMs === null) return null;
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

export function subtractDaysIso(dateIso: string, days: number): string | null {
  const utc = parseIsoDateUTC(dateIso);
  if (utc === null) return null;
  return formatUtcTimestampToIso(utc - days * MS_PER_DAY);
}

export function addDaysIso(dateIso: string, days: number): string | null {
  const utc = parseIsoDateUTC(dateIso);
  if (utc === null) return null;
  return formatUtcTimestampToIso(utc + days * MS_PER_DAY);
}

/**
 * Deterministic fingerprint of underlying compliance data fields.
 * Used to detect post-decision changes and automatically re-queue items to Pending review.
 */
export function computeItemDataFingerprint(item: ComplianceItem): string {
  return JSON.stringify([
    item.company,
    item.itemName.trim(),
    item.group,
    item.issueDate,
    item.expiryDate,
    item.leadTimeDays,
    item.documentLink.trim(),
    item.systemVerificationRequired,
    item.verifiedInStatutorySystem,
    item.dateVerified,
  ]);
}

/**
 * Filter items by active division tab.
 * Items marked "Both" apply to both Consulting and Academy.
 */
export function filterItemsByDivision<T extends { company: ComplianceItem['company'] }>(
  items: T[],
  division: DivisionFilter
): T[] {
  if (division === 'All') return items;
  return items.filter((item) => item.company === division || item.company === 'Both');
}

/**
 * Audit data quality issues on a compliance item.
 */
export function auditDataQuality(item: ComplianceItem): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  const issueMs = parseIsoDateUTC(item.issueDate);
  const expiryMs = parseIsoDateUTC(item.expiryDate);

  if (issueMs !== null && expiryMs !== null && issueMs > expiryMs) {
    issues.push({
      code: 'ISSUE_AFTER_EXPIRY',
      label: 'Issue date is after expiry date',
      severity: 'High',
    });
  }

  if (!item.owner.trim()) {
    issues.push({
      code: 'MISSING_OWNER',
      label: 'Primary owner is missing',
      severity: 'High',
    });
  }

  if (!item.backupOwner.trim()) {
    issues.push({
      code: 'MISSING_BACKUP',
      label: 'Backup owner is not assigned',
      severity: 'Medium',
    });
  }

  if (item.leadTimeDays === null || Number.isNaN(item.leadTimeDays) || item.leadTimeDays < 0) {
    issues.push({
      code: 'MISSING_LEAD_TIME',
      label: 'Renewal lead time (days) is missing',
      severity: 'Medium',
    });
  }

  if (
    item.systemVerificationRequired === 'Yes' &&
    (item.verifiedInStatutorySystem === 'Not checked' ||
      (item.verifiedInStatutorySystem === 'Yes' &&
        (!item.dateVerified.trim() || !item.verifiedBy.trim())))
  ) {
    issues.push({
      code: 'MISSING_VERIFICATION',
      label:
        item.verifiedInStatutorySystem === 'Not checked'
          ? 'Statutory system verification required but not checked'
          : 'Verified status missing date verified or verifier name',
      severity: 'High',
    });
  }

  if (!item.documentLink.trim()) {
    issues.push({
      code: 'MISSING_DOCUMENT',
      label: 'Supporting document link is missing',
      severity: 'Medium',
    });
  }

  if (!item.expiryDate.trim() || !item.issueDate.trim()) {
    issues.push({
      code: 'MISSING_DATES',
      label:
        !item.expiryDate.trim() && !item.issueDate.trim()
          ? 'Issue date and expiry date are missing'
          : !item.expiryDate.trim()
            ? 'Expiry date is missing'
            : 'Issue date is missing',
      severity: !item.expiryDate.trim() ? 'High' : 'Medium',
    });
  }

  if (
    item.reviewState?.decision === 'Clear' &&
    !item.reviewState.decisionReason.trim()
  ) {
    issues.push({
      code: 'CLEARED_NO_REASON',
      label: 'Cleared with no reason recorded',
      severity: 'High',
    });
  }

  return issues;
}

/**
 * SINGLE SOURCE OF TRUTH FOR TRAFFIC-LIGHT & HUMAN-IN-THE-LOOP STATUS
 *
 * Automatic Rule Engine:
 * - Red (Non-Compliant): Expired or confirmed non-compliant in statutory system (overrides document date).
 * - Yellow (Action Required): Within lead time or 30 days, missing evidence/verification, or owner/date gaps.
 * - Green (Compliant): Valid, outside alert window, complete, and verified where required.
 *
 * Human-in-the-loop Review Layer:
 * - When automatic rules produce a Red result or a low-confidence result (expired date, failed/missing
 *   system verification, date inconsistency, or uncertain document check), the item moves to "Pending review"
 *   unless a valid human decision has been recorded for the current underlying data.
 * - Underlying data changes after a decision automatically return the item to "Pending review".
 * - The automatic result is always preserved alongside any human decision.
 */
export function evaluateComplianceStatus(
  item: ComplianceItem,
  asAtDate: string
): EvaluatedComplianceItem {
  const daysUntilExpiry = item.expiryDate ? diffDaysUTC(asAtDate, item.expiryDate) : null;
  const alertDate =
    item.expiryDate && item.leadTimeDays !== null && item.leadTimeDays >= 0
      ? subtractDaysIso(item.expiryDate, item.leadTimeDays)
      : null;
  const daysUntilAlert = alertDate ? diffDaysUTC(asAtDate, alertDate) : null;

  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const isStatutoryNonCompliant = item.verifiedInStatutorySystem === 'No';
  const isDueWithin30 = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  const isDueWithin60 = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 60;
  const isDueWithin90 = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
  const isDueWithin120 = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 120;
  const isWithinLeadTime =
    daysUntilAlert !== null &&
    daysUntilAlert <= 0 &&
    daysUntilExpiry !== null &&
    daysUntilExpiry >= 0;

  const isUnverified =
    item.systemVerificationRequired === 'Yes' && item.verifiedInStatutorySystem !== 'Yes';

  const dataQualityIssues = auditDataQuality(item);

  const redReasons: string[] = [];
  const yellowReasons: string[] = [];

  if (isStatutoryNonCompliant) {
    redReasons.push(
      'Confirmed non-compliant in statutory system (statutory position overrides document date)'
    );
  }
  if (isExpired && daysUntilExpiry !== null) {
    redReasons.push(
      `Expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) === 1 ? '' : 's'} ago (${formatDisplayDate(item.expiryDate)})`
    );
  }

  if (isWithinLeadTime && alertDate) {
    yellowReasons.push(
      `Within ${item.leadTimeDays}-day renewal lead time (alert date was ${formatDisplayDate(alertDate)})`
    );
  }
  if (isDueWithin30 && daysUntilExpiry !== null) {
    yellowReasons.push(
      `Expires within 30 days (${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'} remaining)`
    );
  }
  if (!item.documentLink.trim()) {
    yellowReasons.push('Supporting document or evidence link is missing');
  }
  if (item.systemVerificationRequired === 'Yes' && item.verifiedInStatutorySystem === 'Not checked') {
    yellowReasons.push(
      'System verification is required but not yet confirmed (stored document alone cannot count as compliant)'
    );
  }
  if (!item.expiryDate.trim()) {
    yellowReasons.push('Expiry date is missing');
  }
  if (!item.issueDate.trim()) {
    yellowReasons.push('Issue date is missing');
  }
  if (item.leadTimeDays === null || item.leadTimeDays < 0) {
    yellowReasons.push('Renewal lead time in days is missing');
  }
  if (!item.owner.trim()) {
    yellowReasons.push('Primary owner is missing');
  }
  if (!item.backupOwner.trim()) {
    yellowReasons.push('Backup owner is not assigned');
  }
  const issueMs = parseIsoDateUTC(item.issueDate);
  const expiryMs = parseIsoDateUTC(item.expiryDate);
  const hasDateInconsistency = issueMs !== null && expiryMs !== null && issueMs > expiryMs;
  if (hasDateInconsistency) {
    yellowReasons.push('Issue date is after expiry date (date inconsistency)');
  }

  let automaticStatus: AutomaticStatus;
  let automaticStatusLabel: string;
  let automaticReasons: string[];

  if (redReasons.length > 0) {
    automaticStatus = 'Red';
    automaticStatusLabel = 'Non-Compliant';
    automaticReasons = [...redReasons, ...yellowReasons];
  } else if (yellowReasons.length > 0) {
    automaticStatus = 'Yellow';
    automaticStatusLabel = 'Action Required';
    automaticReasons = yellowReasons;
  } else {
    automaticStatus = 'Green';
    automaticStatusLabel = 'Compliant';
    automaticReasons = [
      'Valid, outside renewal alert window, evidence complete, and verified where required.',
    ];
  }

  // Low-confidence triggers: date inconsistency, missing expiry date, missing required verification, or uncertain document/manual flag
  const isLowConfidence =
    hasDateInconsistency ||
    !item.expiryDate.trim() ||
    (item.systemVerificationRequired === 'Yes' && item.verifiedInStatutorySystem === 'Not checked') ||
    item.findingSource === 'Document check' ||
    item.findingSource === 'Manual flag';

  const currentFingerprint = computeItemDataFingerprint(item);
  const hasDecision = item.reviewState?.status === 'Decided' && Boolean(item.reviewState.decision);
  const dataChangedAfterDecision =
    hasDecision &&
    Boolean(item.reviewState?.snapshotHash) &&
    item.reviewState?.snapshotHash !== currentFingerprint;

  const autoTriggersReview = automaticStatus === 'Red' || isLowConfidence;

  let status: EvaluatedComplianceItem['status'];
  let statusLabel: string;
  let statusReasons: string[];
  let isPendingReview = false;
  let pendingSince: string | null = null;
  let daysWaiting: number | null = null;
  let humanDecision: EvaluatedComplianceItem['humanDecision'] = null;
  let effectiveTriggerReason = item.triggerReason.trim();

  if (dataChangedAfterDecision) {
    isPendingReview = true;
    status = 'Pending review';
    statusLabel = 'Pending review';
    pendingSince = asAtDate;
    daysWaiting = 0;
    effectiveTriggerReason =
      'Underlying compliance data changed after prior decision — re-queued for review';
    statusReasons = [
      effectiveTriggerReason,
      ...automaticReasons,
    ];
  } else if (hasDecision && item.reviewState?.decision) {
    humanDecision = item.reviewState.decision;
    if (humanDecision === 'Confirm non-compliant') {
      status = 'Red';
      statusLabel = 'Non-Compliant';
      statusReasons = [
        `Confirmed non-compliant by ${item.reviewState.reviewerName} on ${formatDisplayDate(item.reviewState.decisionDate)}: ${item.reviewState.decisionReason}`,
        ...automaticReasons,
      ];
    } else if (humanDecision === 'Request more evidence') {
      status = 'Yellow';
      statusLabel = 'Action Required';
      const dueText = item.reviewState.evidenceDueDate
        ? ` (evidence due ${formatDisplayDate(item.reviewState.evidenceDueDate)})`
        : '';
      statusReasons = [
        `More evidence requested from ${item.owner || 'owner'}${dueText}: ${item.reviewState.decisionReason}`,
        ...automaticReasons,
      ];
    } else {
      // Clear: status returns to whatever the automatic rules give
      status = automaticStatus;
      statusLabel = automaticStatusLabel;
      statusReasons = [
        `Cleared by ${item.reviewState.reviewerName} on ${formatDisplayDate(item.reviewState.decisionDate)} (status follows automatic rules: ${automaticStatusLabel}): ${item.reviewState.decisionReason}`,
        ...automaticReasons,
      ];
    }
  } else if (item.reviewState?.status === 'Pending review' || autoTriggersReview) {
    isPendingReview = true;
    status = 'Pending review';
    statusLabel = 'Pending review';
    pendingSince = item.reviewState?.pendingSince || asAtDate;
    daysWaiting = diffDaysUTC(pendingSince, asAtDate);
    if (daysWaiting !== null && daysWaiting < 0) {
      daysWaiting = 0;
    }
    if (!effectiveTriggerReason) {
      effectiveTriggerReason = automaticReasons[0] ?? 'Flagged for Compliance Officer review';
    }
    statusReasons = [
      `Pending Compliance Officer review (${daysWaiting ?? 0} day${daysWaiting === 1 ? '' : 's'} waiting): ${effectiveTriggerReason}`,
      ...automaticReasons,
    ];
  } else {
    status = automaticStatus;
    statusLabel = automaticStatusLabel;
    statusReasons = automaticReasons;
  }

  const isAwaitingOver3Days = isPendingReview && daysWaiting !== null && daysWaiting > 3;

  // Urgency scoring (lower = more urgent)
  let urgencyScore = 5000;
  if (status === 'Red') {
    if (isExpired && daysUntilExpiry !== null) {
      urgencyScore = -2000 + daysUntilExpiry;
    } else {
      urgencyScore = -1500;
    }
  } else if (status === 'Pending review') {
    urgencyScore = -1000 - (daysWaiting ?? 0); // Older pending items rank higher
  } else if (status === 'Yellow') {
    if (daysUntilAlert !== null && daysUntilAlert <= 0) {
      urgencyScore = 0 + daysUntilAlert;
    } else if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
      urgencyScore = 100 + daysUntilExpiry;
    } else if (isUnverified) {
      urgencyScore = 300;
    } else {
      urgencyScore = 500 + (daysUntilExpiry ?? 999);
    }
  } else {
    urgencyScore = 5000 + (daysUntilExpiry ?? 9999);
  }

  const actionSummary = statusReasons[0] ?? 'No action required';

  return {
    ...item,
    status,
    statusLabel,
    statusReasons,
    automaticStatus,
    automaticStatusLabel,
    automaticReasons,
    isLowConfidence,
    isPendingReview,
    pendingSince,
    daysWaiting,
    isAwaitingOver3Days,
    effectiveTriggerReason: effectiveTriggerReason || automaticReasons[0] || '—',
    humanDecision,
    alertDate,
    daysUntilExpiry,
    daysUntilAlert,
    isExpired,
    isDueWithin30,
    isDueWithin60,
    isDueWithin90,
    isDueWithin120,
    isWithinLeadTime,
    isUnverified,
    urgencyScore,
    actionSummary,
    dataQualityIssues,
  };
}

export function evaluateComplianceRegister(
  items: ComplianceItem[],
  asAtDate: string
): EvaluatedComplianceItem[] {
  return items.map((item) => evaluateComplianceStatus(item, asAtDate));
}

export function computeSummaryMetrics(items: EvaluatedComplianceItem[]): SummaryMetrics {
  const green = items.filter((i) => i.status === 'Green').length;
  const yellow = items.filter((i) => i.status === 'Yellow').length;
  const red = items.filter((i) => i.status === 'Red').length;
  const pendingReview = items.filter((i) => i.status === 'Pending review').length;

  return {
    total: items.length,
    green,
    yellow,
    red,
    pendingReview,
    atRisk: red + yellow + pendingReview,
    awaitingOver3Days: items.filter((i) => i.isAwaitingOver3Days).length,
    expired: items.filter((i) => i.isExpired).length,
    dueWithin30: items.filter((i) => i.isDueWithin30).length,
    dueWithin60: items.filter((i) => i.isDueWithin60).length,
    dueWithin90: items.filter((i) => i.isDueWithin90).length,
    unverified: items.filter((i) => i.isUnverified).length,
  };
}

/**
 * Compute traffic-light breakdown driven by definitions from the data layer.
 */
export function getTrafficLightSummary(
  items: EvaluatedComplianceItem[],
  definitions: TrafficLightDefinition[]
): TrafficLightSummaryItem[] {
  const total = items.length;
  return definitions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((def) => {
      const count = items.filter((item) => item.status === def.status).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        ...def,
        count,
        percentage,
      };
    });
}

/**
 * Filter evaluated compliance items by active traffic light button state.
 */
export function filterItemsByTrafficLight(
  items: EvaluatedComplianceItem[],
  activeLight: TrafficLightFilter
): EvaluatedComplianceItem[] {
  if (activeLight === 'All') return items;
  return items.filter((item) => item.status === activeLight);
}

/**
 * Pending review queue sorted oldest first (longest waiting first).
 */
export function getPendingReviewQueue(
  items: EvaluatedComplianceItem[]
): EvaluatedComplianceItem[] {
  return items
    .filter((i) => i.status === 'Pending review')
    .slice()
    .sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
}

/**
 * Actions required sorted by urgency: Red & Pending review & Yellow items.
 */
export function getActionsRequired(items: EvaluatedComplianceItem[]): EvaluatedComplianceItem[] {
  return items
    .filter((i) => i.status === 'Red' || i.status === 'Yellow' || i.status === 'Pending review')
    .slice()
    .sort((a, b) => a.urgencyScore - b.urgencyScore);
}

/**
 * Detect clusters of items expiring within `windowDays` (default 10 days) inside the next 120 days.
 */
export function detectExpiryClusters(
  items: EvaluatedComplianceItem[],
  asAtDate: string,
  horizonDays = 120,
  windowDays = 10
): ExpiryCluster[] {
  const upcoming = items
    .filter(
      (item) =>
        item.daysUntilExpiry !== null &&
        item.daysUntilExpiry >= 0 &&
        item.daysUntilExpiry <= horizonDays &&
        item.expiryDate
    )
    .slice()
    .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0));

  const clusters: ExpiryCluster[] = [];
  let i = 0;

  while (i < upcoming.length) {
    const group: EvaluatedComplianceItem[] = [upcoming[i]];
    let j = i + 1;
    while (j < upcoming.length) {
      const prevDays = group[group.length - 1].daysUntilExpiry ?? 0;
      const currDays = upcoming[j].daysUntilExpiry ?? 0;
      const firstDays = group[0].daysUntilExpiry ?? 0;
      if (currDays - prevDays <= windowDays && currDays - firstDays <= 14) {
        group.push(upcoming[j]);
        j++;
      } else {
        break;
      }
    }

    if (group.length >= 2) {
      const startDate = group[0].expiryDate;
      const endDate = group[group.length - 1].expiryDate;
      const windowLabel =
        startDate === endDate
          ? formatDisplayDate(startDate)
          : `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;

      clusters.push({
        id: `cluster-${startDate}-${endDate}`,
        startDate,
        endDate,
        windowLabel,
        items: group,
      });
    }
    i = j;
  }

  void asAtDate;
  return clusters;
}

export interface TimelineBucket {
  bucketLabel: string;
  rangeLabel: string;
  startDate: string;
  endDate: string;
  redCount: number;
  pendingCount: number;
  yellowCount: number;
  greenCount: number;
  totalCount: number;
  isCluster: boolean;
  items: EvaluatedComplianceItem[];
}

export function build120DayTimelineBuckets(
  items: EvaluatedComplianceItem[],
  asAtDate: string
): TimelineBucket[] {
  const buckets: TimelineBucket[] = [];
  const bucketSizeDays = 10;
  const totalBuckets = 12;

  for (let b = 0; b < totalBuckets; b++) {
    const startOffset = b * bucketSizeDays;
    const endOffset = startOffset + bucketSizeDays - 1;
    const startDate = addDaysIso(asAtDate, startOffset) ?? asAtDate;
    const endDate = addDaysIso(asAtDate, endOffset) ?? asAtDate;

    const bucketItems = items.filter(
      (item) =>
        item.daysUntilExpiry !== null &&
        item.daysUntilExpiry >= startOffset &&
        item.daysUntilExpiry <= endOffset
    );

    buckets.push({
      bucketLabel: `D${startOffset}–${endOffset}`,
      rangeLabel: `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`,
      startDate,
      endDate,
      redCount: bucketItems.filter((i) => i.status === 'Red').length,
      pendingCount: bucketItems.filter((i) => i.status === 'Pending review').length,
      yellowCount: bucketItems.filter((i) => i.status === 'Yellow').length,
      greenCount: bucketItems.filter((i) => i.status === 'Green').length,
      totalCount: bucketItems.length,
      isCluster: bucketItems.length >= 2,
      items: bucketItems,
    });
  }

  return buckets;
}

/**
 * Ownership summary showing items per owner and flagging owners with missing backup coverage.
 */
export function buildOwnershipSummary(items: EvaluatedComplianceItem[]): OwnerSummary[] {
  const map = new Map<string, EvaluatedComplianceItem[]>();

  for (const item of items) {
    const key = item.owner.trim() || 'Unassigned';
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }

  const summaries: OwnerSummary[] = [];
  for (const [owner, ownerItems] of map.entries()) {
    const itemsWithoutBackup = ownerItems.filter((i) => !i.backupOwner.trim()).length;
    const backupOwners = Array.from(
      new Set(ownerItems.map((i) => i.backupOwner.trim()).filter(Boolean))
    );
    summaries.push({
      owner,
      totalItems: ownerItems.length,
      greenCount: ownerItems.filter((i) => i.status === 'Green').length,
      yellowCount: ownerItems.filter((i) => i.status === 'Yellow').length,
      redCount: ownerItems.filter((i) => i.status === 'Red').length,
      pendingReviewCount: ownerItems.filter((i) => i.status === 'Pending review').length,
      itemsWithoutBackup,
      backupOwners,
      hasBackupGap: itemsWithoutBackup > 0 || owner === 'Unassigned',
      items: ownerItems,
    });
  }

  return summaries.sort((a, b) => {
    if (a.hasBackupGap !== b.hasBackupGap) return a.hasBackupGap ? -1 : 1;
    return b.totalItems - a.totalItems;
  });
}

/**
 * Export audit trail decisions as RFC-4180 CSV text.
 */
export function exportAuditTrailToCsv(entries: ReviewAuditEntry[]): string {
  const escape = (val: string) => {
    const str = val ?? '';
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Audit ID',
    'Company',
    'Item Name',
    'Automatic Result',
    'Finding Source',
    'Trigger Reason',
    'Decision / Event',
    'Check Result',
    'Reviewer',
    'Decision Date',
    'Evidence Due Date',
    'Written Reason',
  ];

  const rows = entries.map((e) =>
    [
      e.id,
      e.company,
      e.itemName,
      e.automaticStatus,
      e.findingSource,
      e.triggerReason,
      e.decision,
      e.checkResult ?? '',
      e.reviewerName,
      e.decisionDate,
      e.evidenceDueDate ?? '',
      e.decisionReason,
    ]
      .map(escape)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Normalize text for deterministic comparison between register metadata and extracted document values.
 */
function normalizeTextForMatch(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(pty\)\s*ltd\.?/g, '')
    .replace(/\bpty\s*ltd\.?\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_DOC_STOPWORDS = new Set([
  'of',
  'and',
  'for',
  'the',
  'letter',
  'certificate',
  'report',
  'registration',
  'renewal',
  'compliance',
  'annual',
  'document',
  'confirmation',
  'group',
  'status',
]);

function doesCompanyMatch(
  registerCompany: ComplianceItem['company'],
  extractedCompany: string
): boolean {
  const norm = normalizeTextForMatch(extractedCompany);
  if (!norm) return false;
  const hasMindworx = norm.includes('mindworx');
  if (!hasMindworx) return false;

  const hasConsulting = norm.includes('consulting');
  const hasAcademy = norm.includes('academy');

  if (registerCompany === 'Consulting') {
    if (hasAcademy && !hasConsulting) return false;
    return hasConsulting || norm === 'mindworx';
  }
  if (registerCompany === 'Academy') {
    if (hasConsulting && !hasAcademy) return false;
    return hasAcademy;
  }
  // Both
  return hasMindworx;
}

function doesDocumentTypeMatch(
  registerItemName: string,
  registerGroup: string,
  extractedDocType: string
): boolean {
  const normExtracted = normalizeTextForMatch(extractedDocType);
  const normItem = normalizeTextForMatch(`${registerItemName} ${registerGroup}`);
  if (!normExtracted || !normItem) return false;

  if (normItem.includes(normExtracted) || normExtracted.includes(normalizeTextForMatch(registerItemName))) {
    return true;
  }

  const extractedTokens = normExtracted
    .split(' ')
    .filter((t) => t.length >= 2 && !GENERIC_DOC_STOPWORDS.has(t));
  const itemTokenSet = new Set(
    normItem.split(' ').filter((t) => t.length >= 2 && !GENERIC_DOC_STOPWORDS.has(t))
  );

  if (extractedTokens.length === 0) return false;
  const matched = extractedTokens.filter((t) => itemTokenSet.has(t)).length;
  return matched >= 1 && matched / extractedTokens.length >= 0.5;
}

/**
 * Format ISO YYYY-MM-DD as South African DD/MM/YYYY for comparison & trigger reasons.
 */
export function formatSaSlashDate(dateStr: string): string {
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Strip SA ID numbers, bank account numbers, and passwords/PINs before regex parsing.
 * Raw OCR text is never returned or stored.
 */
export function redactSensitiveOcrData(rawText: string): string {
  return rawText
    // Redact credential / PIN / account labelled values
    .replace(
      /\b(?:password|passcode|pin|otp|secret|account\s*(?:no|number|#)?|acc\s*(?:no|#)?|iban|swift|branch\s*code)\b\s*[:=\-]?\s*[A-Za-z0-9\- ]{3,28}/gi,
      '[REDACTED]'
    )
    // Redact 13-digit South African ID numbers (with optional standard spacing)
    .replace(/\b\d{6}[\s\-]?\d{4}[\s\-]?[01]\d{2}\b/g, '[REDACTED]')
    // Redact any standalone 9-to-16 digit numbers (account/tax/ID runs)
    .replace(/\b\d{9,16}\b/g, '[REDACTED]');
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function buildValidatedIso(year: number, month: number, day: number): string | null {
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type ParsedDateToken =
  | { kind: 'valid'; iso: string }
  | { kind: 'ambiguous' };

const DATE_CANDIDATE_REGEX =
  /\b(?:\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,]?\s+\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{2,4}|[\d?]{1,2}[/\-.][\d?]{1,2}[/\-.][\d?]{2,4})\b/gi;

function parseSaDateToken(rawToken: string): ParsedDateToken {
  const token = rawToken.trim();
  if (!token || token.includes('?')) {
    return { kind: 'ambiguous' };
  }

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(token);
  if (isoMatch) {
    const iso = buildValidatedIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return iso ? { kind: 'valid', iso } : { kind: 'ambiguous' };
  }

  // Written month: "8 December 2026" or "08 Dec 2026"
  const dayFirstMonthMatch =
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)[,]?\s+(\d{2,4})$/i.exec(token);
  if (dayFirstMonthMatch) {
    if (dayFirstMonthMatch[3].length !== 4) {
      return { kind: 'ambiguous' };
    }
    const month = MONTH_NAME_MAP[dayFirstMonthMatch[2].toLowerCase()];
    if (!month) return { kind: 'ambiguous' };
    const iso = buildValidatedIso(
      Number(dayFirstMonthMatch[3]),
      month,
      Number(dayFirstMonthMatch[1])
    );
    return iso ? { kind: 'valid', iso } : { kind: 'ambiguous' };
  }

  // Written month: "December 8, 2026"
  const monthFirstMatch =
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{2,4})$/i.exec(token);
  if (monthFirstMatch) {
    if (monthFirstMatch[3].length !== 4) {
      return { kind: 'ambiguous' };
    }
    const month = MONTH_NAME_MAP[monthFirstMatch[1].toLowerCase()];
    if (!month) return { kind: 'ambiguous' };
    const iso = buildValidatedIso(
      Number(monthFirstMatch[3]),
      month,
      Number(monthFirstMatch[2])
    );
    return iso ? { kind: 'valid', iso } : { kind: 'ambiguous' };
  }

  // South African numeric DMY: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyMatch = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(token);
  if (dmyMatch) {
    // 2-digit years can be read two ways (YY vs DD) -> mark ambiguous
    if (dmyMatch[3].length !== 4) {
      return { kind: 'ambiguous' };
    }
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    // If month > 12 (e.g. MM/DD/YYYY US format like 12/25/2026), do not guess -> ambiguous
    if (second > 12) {
      return { kind: 'ambiguous' };
    }
    const iso = buildValidatedIso(year, second, first);
    return iso ? { kind: 'valid', iso } : { kind: 'ambiguous' };
  }

  return { kind: 'ambiguous' };
}

function collectDatesInSnippet(snippet: string): ParsedDateToken[] {
  const matches = snippet.match(DATE_CANDIDATE_REGEX) ?? [];
  return matches.map((m) => parseSaDateToken(m));
}

function resolveTokensToOcrDate(tokens: ParsedDateToken[]): OcrDateResult {
  if (tokens.length === 0) {
    return { isoValue: '', displayValue: '', status: 'missing' };
  }
  if (tokens.some((t) => t.kind === 'ambiguous')) {
    return { isoValue: '', displayValue: 'ambiguous', status: 'ambiguous' };
  }
  const uniqueIsos = Array.from(
    new Set(tokens.map((t) => (t.kind === 'valid' ? t.iso : '')).filter(Boolean))
  );
  if (uniqueIsos.length === 1) {
    const iso = uniqueIsos[0];
    return {
      isoValue: iso,
      displayValue: formatSaSlashDate(iso),
      status: 'valid',
    };
  }
  // Multiple distinct dates found for the same field -> ambiguous
  return { isoValue: '', displayValue: 'ambiguous', status: 'ambiguous' };
}

function extractLabeledOcrDate(sanitizedText: string, labelPattern: RegExp): OcrDateResult {
  const allTokens: ParsedDateToken[] = [];
  const lines = sanitizedText.split(/\n+/);

  for (const line of lines) {
    const globalRegex = new RegExp(labelPattern.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = globalRegex.exec(line)) !== null) {
      const tail = line.slice(match.index + match[0].length, match.index + match[0].length + 70);
      // Stop before another date label on the same line
      const nextLabelIdx = tail.search(
        /\b(?:expiry|expires|expiration|valid\s*(?:until|to|from)|issue\s*date|issued|date\s*(?:of\s*)?issue|renewal\s*date|end\s*date|due\s*date)\b/i
      );
      const bounded = nextLabelIdx > 0 ? tail.slice(0, nextLabelIdx) : tail;
      const tokens = collectDatesInSnippet(bounded);
      if (tokens.length > 0) {
        // Take the date immediately following this label
        allTokens.push(tokens[0]);
      } else if (/\b(?:tbd|unknown|n\/a|unclear|\?)\b/i.test(bounded.slice(0, 20))) {
        allTokens.push({ kind: 'ambiguous' });
      }
    }
  }

  return resolveTokensToOcrDate(allTokens);
}

const DOC_TYPE_KEYWORD_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\btax\s+compliance\s+status\b|\btcs\b|\btax\s+clearance\b/i, label: 'Tax Compliance Status (TCS)' },
  { pattern: /\bcipc\b|\bannual\s+return\b|\bcor39\b|\bcompany\s+registration\b/i, label: 'CIPC Registration / Annual Return' },
  { pattern: /\bcsd\b|\bcentral\s+supplier\s+database\b|\bmaaa\b/i, label: 'CSD Registration' },
  { pattern: /\bb-?bbee\b|\bbroad[\s-]based\s+black\s+economic\b/i, label: 'B-BBEE Certificate / Affidavit' },
  { pattern: /\bsworn\s+affidavit\b|\baffidavit\b/i, label: 'Sworn Affidavit' },
  { pattern: /\bcoida\b|\bcompensation\s+fund\b|\bletter\s+of\s+good\s+standing\b/i, label: 'COIDA Letter of Good Standing' },
  { pattern: /\bvat\b|\bvalue[\s-]added\s+tax\b/i, label: 'VAT Compliance' },
  { pattern: /\bpaye\b|\bemp201\b|\bemp501\b/i, label: 'PAYE / EMP Declaration' },
  { pattern: /\buif\b|\bunemployment\s+insurance\b/i, label: 'UIF Compliance' },
  { pattern: /\bmict\s+seta\b|\bseta\b|\bqcto\b|\bdhet\b|\baccreditation\b/i, label: 'SETA / Accreditation' },
  { pattern: /\bbank\s+(?:confirmation|code|letter|account\s+confirmation)\b/i, label: 'Bank Confirmation / Code' },
  { pattern: /\bpublic\s+liability\b|\bprofessional\s+indemnity\b|\binsurance\b/i, label: 'Insurance Certificate' },
  { pattern: /\bpopia\b|\bpaia\b|\binformation\s+officer\b/i, label: 'POPIA / PAIA Registration' },
  { pattern: /\bsars\b/i, label: 'SARS' },
];

/**
 * Deterministic regex extraction from OCR text (code only, never AI).
 * Discards raw text and redacts sensitive IDs, bank accounts, and passwords.
 */
export function extractFieldsFromOcrText(
  rawText: string,
  confidence: number,
  sourceMode: OcrFieldExtraction['sourceMode'],
  pagesProcessed: number,
  itemContext: Pick<ComplianceItem, 'itemName' | 'group'>
): OcrFieldExtraction {
  const sanitized = redactSensitiveOcrData(rawText);

  // 1. Company name match
  const hasMindworx = /\bmindworx\b/i.test(sanitized);
  const hasConsulting = /\bmindworx\s+consulting\b/i.test(sanitized);
  const hasAcademy = /\bmindworx\s+academy\b/i.test(sanitized);

  let companyName = '';
  if (hasConsulting && hasAcademy) {
    companyName = 'Mindworx Consulting & Academy';
  } else if (hasConsulting) {
    companyName = 'Mindworx Consulting';
  } else if (hasAcademy) {
    companyName = 'Mindworx Academy';
  } else if (hasMindworx) {
    const m = /\bmindworx(?:\s+group)?(?:\s*\(pty\)\s*ltd\.?)?/i.exec(sanitized);
    companyName = m ? m[0].replace(/\s+/g, ' ').trim() : 'Mindworx';
  }

  // 2. Document type keywords
  const keywordHits: string[] = [];
  for (const entry of DOC_TYPE_KEYWORD_PATTERNS) {
    if (entry.pattern.test(sanitized) && !keywordHits.includes(entry.label)) {
      keywordHits.push(entry.label);
    }
  }

  // Also check specific register item tokens (>= 3 chars) present in text
  const itemTokens = normalizeTextForMatch(`${itemContext.itemName} ${itemContext.group}`)
    .split(' ')
    .filter((t) => t.length >= 3 && !GENERIC_DOC_STOPWORDS.has(t));
  const normSanitized = normalizeTextForMatch(sanitized);
  const matchedItemTokens = itemTokens.filter((t) =>
    new RegExp(`\\b${t}\\b`, 'i').test(normSanitized)
  );

  let documentType = '';
  if (keywordHits.length > 0) {
    documentType = keywordHits.slice(0, 2).join(' · ');
  } else if (matchedItemTokens.length > 0) {
    documentType = matchedItemTokens.join(' ');
  }

  // 3. Issue & Expiry dates via South African DD/MM/YYYY + written months
  let issueDate = extractLabeledOcrDate(
    sanitized,
    /\b(?:issue\s*date|date\s*(?:of\s*)?issue|issued(?:\s*on)?|commencement\s*date|effective\s*(?:from|date)|valid\s*from|start\s*date|date\s*signed)\b/
  );
  let expiryDate = extractLabeledOcrDate(
    sanitized,
    /\b(?:expiry\s*date|expires(?:\s*on)?|expiration\s*date|valid\s*(?:until|to|thru|through)|certificate\s*expiry|renewal\s*date|end\s*date|due\s*date)\b/
  );

  // Unlabelled fallback ONLY when unambiguous (exactly 2 distinct valid dates & no ambiguous tokens)
  if (issueDate.status === 'missing' && expiryDate.status === 'missing') {
    const allDocTokens = collectDatesInSnippet(sanitized);
    if (allDocTokens.some((t) => t.kind === 'ambiguous')) {
      issueDate = { isoValue: '', displayValue: 'ambiguous', status: 'ambiguous' };
      expiryDate = { isoValue: '', displayValue: 'ambiguous', status: 'ambiguous' };
    } else {
      const uniqueIsos = Array.from(
        new Set(allDocTokens.map((t) => (t.kind === 'valid' ? t.iso : '')).filter(Boolean))
      ).sort();
      if (uniqueIsos.length === 2) {
        issueDate = {
          isoValue: uniqueIsos[0],
          displayValue: formatSaSlashDate(uniqueIsos[0]),
          status: 'valid',
        };
        expiryDate = {
          isoValue: uniqueIsos[1],
          displayValue: formatSaSlashDate(uniqueIsos[1]),
          status: 'valid',
        };
      } else if (uniqueIsos.length > 2) {
        issueDate = { isoValue: '', displayValue: 'ambiguous', status: 'ambiguous' };
        expiryDate = { isoValue: '', displayValue: 'ambiguous', status: 'ambiguous' };
      }
    }
  }

  const roundedConfidence = Math.round(confidence * 10) / 10;
  return {
    confidence: roundedConfidence,
    confidenceLevel: roundedConfidence >= 80 ? 'High' : 'Low',
    sourceMode,
    pagesProcessed,
    companyName,
    documentType,
    documentKeywords: Array.from(new Set([...keywordHits, ...matchedItemTokens])),
    issueDate,
    expiryDate,
  };
}

function doExtractedCompaniesAgree(ocrCompany: string, geminiCompany: string): boolean {
  const normOcr = normalizeTextForMatch(ocrCompany);
  const normGem = normalizeTextForMatch(geminiCompany);
  if (!normOcr || !normGem) return false;

  const ocrConsulting = normOcr.includes('consulting');
  const ocrAcademy = normOcr.includes('academy');
  const gemConsulting = normGem.includes('consulting');
  const gemAcademy = normGem.includes('academy');

  if ((ocrConsulting || ocrAcademy) && (gemConsulting || gemAcademy)) {
    return ocrConsulting === gemConsulting && ocrAcademy === gemAcademy;
  }
  return normOcr.includes('mindworx') && normGem.includes('mindworx');
}

function doExtractedDocTypesAgree(
  itemName: string,
  itemGroup: string,
  ocrDocType: string,
  geminiDocType: string
): boolean {
  if (!ocrDocType.trim() || !geminiDocType.trim()) return false;
  if (
    doesDocumentTypeMatch(itemName, itemGroup, ocrDocType) &&
    doesDocumentTypeMatch(itemName, itemGroup, geminiDocType)
  ) {
    return true;
  }
  const ocrTokens = normalizeTextForMatch(ocrDocType)
    .split(' ')
    .filter((t) => t.length >= 2 && !GENERIC_DOC_STOPWORDS.has(t));
  const gemTokenSet = new Set(
    normalizeTextForMatch(geminiDocType)
      .split(' ')
      .filter((t) => t.length >= 2 && !GENERIC_DOC_STOPWORDS.has(t))
  );
  if (ocrTokens.length === 0) return false;
  const overlap = ocrTokens.filter((t) => gemTokenSet.has(t)).length;
  return overlap >= 1 && overlap / ocrTokens.length >= 0.5;
}

/**
 * Deterministic 3-way routing for OCR + Gemini Document Check (code, never AI).
 */
export function evaluateCombinedDocumentCheck(params: {
  item: Pick<ComplianceItem, 'company' | 'itemName' | 'group' | 'issueDate' | 'expiryDate'>;
  ocrResult: OcrFieldExtraction | null;
  ocrError?: string;
  geminiExtraction: DocumentCheckExtraction | null;
  geminiError?: string;
  asAtDate: string;
  fileName: string;
}): DocumentCheckRecord {
  const { item, ocrResult, ocrError, geminiExtraction, geminiError, asAtDate, fileName } = params;

  const ocrAvailable = Boolean(ocrResult);
  const aiAvailable = Boolean(geminiExtraction);

  const registerCompanyLabel =
    item.company === 'Both'
      ? 'Mindworx Consulting & Academy (Both)'
      : `Mindworx ${item.company}`;
  const registerDocLabel = `${item.itemName} (${item.group})`;
  const registerIssueIso = item.issueDate.trim();
  const registerExpiryIso = item.expiryDate.trim();
  const registerIssueDisplay = registerIssueIso ? formatSaSlashDate(registerIssueIso) : '';
  const registerExpiryDisplay = registerExpiryIso ? formatSaSlashDate(registerExpiryIso) : '';

  const ocrCompany = ocrResult?.companyName.trim() ?? '';
  const ocrDocType = ocrResult?.documentType.trim() ?? '';
  const ocrIssueStatus = ocrResult?.issueDate.status ?? 'missing';
  const ocrExpiryStatus = ocrResult?.expiryDate.status ?? 'missing';
  const ocrIssueIso = ocrResult?.issueDate.isoValue ?? '';
  const ocrExpiryIso = ocrResult?.expiryDate.isoValue ?? '';
  const ocrIssueDisplay =
    ocrIssueStatus === 'ambiguous'
      ? 'ambiguous'
      : ocrIssueIso
        ? formatSaSlashDate(ocrIssueIso)
        : '';
  const ocrExpiryDisplay =
    ocrExpiryStatus === 'ambiguous'
      ? 'ambiguous'
      : ocrExpiryIso
        ? formatSaSlashDate(ocrExpiryIso)
        : '';

  const gemCompany = geminiExtraction?.companyName.value.trim() ?? '';
  const gemDocType = geminiExtraction?.documentType.value.trim() ?? '';
  const gemIssueIso = geminiExtraction?.issueDate.value.trim() ?? '';
  const gemExpiryIso = geminiExtraction?.expiryDate.value.trim() ?? '';
  const gemIssueValid = Boolean(gemIssueIso && parseIsoDateUTC(gemIssueIso) !== null);
  const gemExpiryValid = Boolean(gemExpiryIso && parseIsoDateUTC(gemExpiryIso) !== null);
  const gemIssueDisplay = gemIssueIso ? formatSaSlashDate(gemIssueIso) : '';
  const gemExpiryDisplay = gemExpiryIso ? formatSaSlashDate(gemExpiryIso) : '';

  // Build 3-way comparisons whenever at least one reader returned data
  const comparisons: DocumentCheckComparisonRow[] =
    ocrAvailable || aiAvailable
      ? [
          (() => {
            const ocrMatchesReg = ocrAvailable && doesCompanyMatch(item.company, ocrCompany);
            const gemMatchesReg = aiAvailable && doesCompanyMatch(item.company, gemCompany);
            const agree =
              ocrAvailable && aiAvailable && doExtractedCompaniesAgree(ocrCompany, gemCompany);
            const allAgree = ocrMatchesReg && gemMatchesReg && agree;
            return {
              field: 'companyName',
              label: 'Company',
              registerValue: registerCompanyLabel,
              ocrValue: ocrAvailable ? ocrCompany : 'Unavailable',
              ocrMatchesRegister: ocrMatchesReg,
              ocrIsAmbiguous: false,
              ocrIsMissing: !ocrCompany,
              extractedValue: aiAvailable ? gemCompany : 'Unavailable',
              geminiMatchesRegister: gemMatchesReg,
              geminiIsMissing: !gemCompany,
              ocrGeminiAgree: agree,
              allAgree,
              confidence: geminiExtraction?.companyName.confidence ?? 'Low',
              lowConfidenceReason: geminiExtraction?.companyName.lowConfidenceReason ?? '',
              matches: allAgree,
              isMissing: !ocrCompany || !gemCompany,
            };
          })(),
          (() => {
            const ocrMatchesReg =
              ocrAvailable && doesDocumentTypeMatch(item.itemName, item.group, ocrDocType);
            const gemMatchesReg =
              aiAvailable && doesDocumentTypeMatch(item.itemName, item.group, gemDocType);
            const agree =
              ocrAvailable &&
              aiAvailable &&
              doExtractedDocTypesAgree(item.itemName, item.group, ocrDocType, gemDocType);
            const allAgree = ocrMatchesReg && gemMatchesReg && agree;
            return {
              field: 'documentType',
              label: 'Document Type',
              registerValue: registerDocLabel,
              ocrValue: ocrAvailable ? ocrDocType : 'Unavailable',
              ocrMatchesRegister: ocrMatchesReg,
              ocrIsAmbiguous: false,
              ocrIsMissing: !ocrDocType,
              extractedValue: aiAvailable ? gemDocType : 'Unavailable',
              geminiMatchesRegister: gemMatchesReg,
              geminiIsMissing: !gemDocType,
              ocrGeminiAgree: agree,
              allAgree,
              confidence: geminiExtraction?.documentType.confidence ?? 'Low',
              lowConfidenceReason: geminiExtraction?.documentType.lowConfidenceReason ?? '',
              matches: allAgree,
              isMissing: !ocrDocType || !gemDocType,
            };
          })(),
          (() => {
            const ocrMatchesReg =
              ocrAvailable &&
              ocrIssueStatus === 'valid' &&
              Boolean(registerIssueIso) &&
              ocrIssueIso === registerIssueIso;
            const gemMatchesReg =
              aiAvailable &&
              gemIssueValid &&
              Boolean(registerIssueIso) &&
              gemIssueIso === registerIssueIso;
            const agree =
              ocrAvailable &&
              aiAvailable &&
              ocrIssueStatus === 'valid' &&
              gemIssueValid &&
              ocrIssueIso === gemIssueIso;
            const allAgree = ocrMatchesReg && gemMatchesReg && agree;
            return {
              field: 'issueDate',
              label: 'Issue Date',
              registerValue: registerIssueDisplay,
              ocrValue: ocrAvailable ? ocrIssueDisplay : 'Unavailable',
              ocrMatchesRegister: ocrMatchesReg,
              ocrIsAmbiguous: ocrIssueStatus === 'ambiguous',
              ocrIsMissing: ocrIssueStatus === 'missing',
              extractedValue: aiAvailable ? gemIssueDisplay : 'Unavailable',
              geminiMatchesRegister: gemMatchesReg,
              geminiIsMissing: !gemIssueValid,
              ocrGeminiAgree: agree,
              allAgree,
              confidence: geminiExtraction?.issueDate.confidence ?? 'Low',
              lowConfidenceReason: geminiExtraction?.issueDate.lowConfidenceReason ?? '',
              matches: allAgree,
              isMissing:
                !registerIssueIso || ocrIssueStatus === 'missing' || !gemIssueValid,
            };
          })(),
          (() => {
            const ocrMatchesReg =
              ocrAvailable &&
              ocrExpiryStatus === 'valid' &&
              Boolean(registerExpiryIso) &&
              ocrExpiryIso === registerExpiryIso;
            const gemMatchesReg =
              aiAvailable &&
              gemExpiryValid &&
              Boolean(registerExpiryIso) &&
              gemExpiryIso === registerExpiryIso;
            const agree =
              ocrAvailable &&
              aiAvailable &&
              ocrExpiryStatus === 'valid' &&
              gemExpiryValid &&
              ocrExpiryIso === gemExpiryIso;
            const allAgree = ocrMatchesReg && gemMatchesReg && agree;
            return {
              field: 'expiryDate',
              label: 'Expiry Date',
              registerValue: registerExpiryDisplay,
              ocrValue: ocrAvailable ? ocrExpiryDisplay : 'Unavailable',
              ocrMatchesRegister: ocrMatchesReg,
              ocrIsAmbiguous: ocrExpiryStatus === 'ambiguous',
              ocrIsMissing: ocrExpiryStatus === 'missing',
              extractedValue: aiAvailable ? gemExpiryDisplay : 'Unavailable',
              geminiMatchesRegister: gemMatchesReg,
              geminiIsMissing: !gemExpiryValid,
              ocrGeminiAgree: agree,
              allAgree,
              confidence: geminiExtraction?.expiryDate.confidence ?? 'Low',
              lowConfidenceReason: geminiExtraction?.expiryDate.lowConfidenceReason ?? '',
              matches: allAgree,
              isMissing:
                !registerExpiryIso || ocrExpiryStatus === 'missing' || !gemExpiryValid,
            };
          })(),
        ]
      : [];

  // Rule: Neither reader succeeded
  if (!ocrAvailable && !aiAvailable) {
    return {
      checkedAt: asAtDate,
      checkedTimestamp: new Date().toISOString(),
      fileName,
      outcome: 'Routed to Pending review',
      routingReason: 'Document check unavailable (OCR and Gemini failed)',
      ocrAvailable: false,
      ocrErrorMessage: ocrError,
      ocrResult: null,
      aiAvailable: false,
      errorMessage: geminiError,
      extraction: null,
      comparisons: [],
    };
  }

  // Rule: Never pass on one reading alone
  if (ocrAvailable !== aiAvailable) {
    return {
      checkedAt: asAtDate,
      checkedTimestamp: new Date().toISOString(),
      fileName,
      outcome: 'Routed to Pending review',
      routingReason: 'Single reader only, second reading unavailable',
      ocrAvailable,
      ocrErrorMessage: ocrError,
      ocrResult,
      aiAvailable,
      errorMessage: geminiError,
      extraction: geminiExtraction,
      comparisons,
    };
  }

  // Both OCR and Gemini are available — apply strict combined deterministic rules
  const problems: string[] = [];

  if (geminiExtraction?.unreadableOrIncomplete) {
    problems.push(
      geminiExtraction.unreadableReason.trim() || 'Uploaded document is unreadable or incomplete'
    );
  }

  // 1. Ambiguous OCR dates
  if (ocrIssueStatus === 'ambiguous') {
    problems.push('Issue date is ambiguous or unparseable in OCR reading');
  }
  if (ocrExpiryStatus === 'ambiguous') {
    problems.push('Expiry date is ambiguous or unparseable in OCR reading');
  }

  // 2. OCR vs Gemini disagreement & Register disagreement
  for (const row of comparisons) {
    if (!row.ocrIsAmbiguous && !row.ocrIsMissing && !row.geminiIsMissing && !row.ocrGeminiAgree) {
      problems.push(
        `${row.label} differs: OCR ${row.ocrValue}, Gemini ${row.extractedValue}`
      );
    } else if (
      row.registerValue &&
      !row.ocrIsAmbiguous &&
      (!row.ocrIsMissing || !row.geminiIsMissing) &&
      (!row.ocrMatchesRegister || !row.geminiMatchesRegister)
    ) {
      problems.push(
        `${row.label} differs from register: Register ${row.registerValue}, OCR ${row.ocrValue || 'Not found'}, Gemini ${row.extractedValue || 'Not found'}`
      );
    }
  }

  // 3. Missing expected fields
  const missingOcr: string[] = [];
  if (!ocrCompany) missingOcr.push('company');
  if (!ocrDocType) missingOcr.push('document type');
  if (ocrIssueStatus === 'missing') missingOcr.push('issue date');
  if (ocrExpiryStatus === 'missing') missingOcr.push('expiry date');
  if (missingOcr.length > 0) {
    problems.push(`OCR could not find: ${missingOcr.join(', ')}`);
  }

  const missingGemini: string[] = [];
  if (!gemCompany) missingGemini.push('company');
  if (!gemDocType) missingGemini.push('document type');
  if (!gemIssueValid) missingGemini.push('issue date');
  if (!gemExpiryValid) missingGemini.push('expiry date');
  if (missingGemini.length > 0) {
    problems.push(`Gemini could not find: ${missingGemini.join(', ')}`);
  }

  const missingRegister: string[] = [];
  if (!registerIssueIso) missingRegister.push('register issue date');
  if (!registerExpiryIso) missingRegister.push('register expiry date');
  if (missingRegister.length > 0) {
    problems.push(`Missing ${missingRegister.join(' and ')} to verify against`);
  }

  // 4. Expiry before issue (checked on both OCR and Gemini)
  const ocrIssueMs = parseIsoDateUTC(ocrIssueIso);
  const ocrExpiryMs = parseIsoDateUTC(ocrExpiryIso);
  if (ocrIssueMs !== null && ocrExpiryMs !== null && ocrExpiryMs < ocrIssueMs) {
    problems.push(
      `OCR expiry date (${ocrExpiryDisplay}) is earlier than issue date (${ocrIssueDisplay})`
    );
  }
  const gemIssueMs = parseIsoDateUTC(gemIssueIso);
  const gemExpiryMs = parseIsoDateUTC(gemExpiryIso);
  if (gemIssueMs !== null && gemExpiryMs !== null && gemExpiryMs < gemIssueMs) {
    problems.push(
      `Gemini expiry date (${gemExpiryDisplay}) is earlier than issue date (${gemIssueDisplay})`
    );
  }

  // 5. OCR confidence threshold (< 80% -> Low confidence -> Pending review)
  if (ocrResult && ocrResult.confidence < 80) {
    problems.push(
      `OCR confidence is ${ocrResult.confidence}% (below 80% threshold)`
    );
  }

  // 6. Gemini confidence threshold (any Medium or Low -> Pending review)
  if (geminiExtraction) {
    const nonHighFields: string[] = [];
    const checkConf = (label: string, conf: string, reason: string) => {
      if (conf !== 'High') {
        nonHighFields.push(`${label} (${conf}${reason.trim() ? `: ${reason.trim()}` : ''})`);
      }
    };
    checkConf('Document type', geminiExtraction.documentType.confidence, geminiExtraction.documentType.lowConfidenceReason);
    checkConf('Company name', geminiExtraction.companyName.confidence, geminiExtraction.companyName.lowConfidenceReason);
    checkConf('Issue date', geminiExtraction.issueDate.confidence, geminiExtraction.issueDate.lowConfidenceReason);
    checkConf('Expiry date', geminiExtraction.expiryDate.confidence, geminiExtraction.expiryDate.lowConfidenceReason);
    checkConf('Signature', geminiExtraction.signaturePresent.confidence, geminiExtraction.signaturePresent.lowConfidenceReason);
    checkConf('Stamp', geminiExtraction.stampPresent.confidence, geminiExtraction.stampPresent.lowConfidenceReason);
    checkConf('Reference number presence', geminiExtraction.referenceNumberPresent.confidence, geminiExtraction.referenceNumberPresent.lowConfidenceReason);

    if (nonHighFields.length > 0) {
      problems.push(`Gemini Medium/Low confidence on ${nonHighFields.join(', ')}`);
    }
  }

  const passed = problems.length === 0;

  return {
    checkedAt: asAtDate,
    checkedTimestamp: new Date().toISOString(),
    fileName,
    outcome: passed ? 'Passed' : 'Routed to Pending review',
    routingReason: passed
      ? 'Register, OCR, and Gemini all agree with OCR >= 80% and Gemini High confidence (system verification rules still apply).'
      : Array.from(new Set(problems)).join(' · '),
    ocrAvailable: true,
    ocrResult,
    aiAvailable: true,
    extraction: geminiExtraction,
    comparisons,
  };
}

/**
 * Compute all Management Summary figures strictly in code before calling Gemini.
 */
export function buildManagementSummaryInput(
  items: EvaluatedComplianceItem[],
  asAtDate: string,
  companyFilter: DivisionFilter
): ManagementSummaryMetrics {
  const summary = computeSummaryMetrics(items);
  const clusters = detectExpiryClusters(items, asAtDate, 120, 10);
  const owners = buildOwnershipSummary(items);

  const pendingWaitingDays = items
    .filter((i) => i.status === 'Pending review' && i.daysWaiting !== null)
    .map((i) => i.daysWaiting as number);

  const longestWaitingPendingDays =
    pendingWaitingDays.length > 0 ? Math.max(...pendingWaitingDays) : null;

  const countByDqCode = (code: string) =>
    items.filter((i) => i.dataQualityIssues.some((dq) => dq.code === code)).length;

  const incompleteDataCount = items.filter(
    (i) =>
      i.dataQualityIssues.length > 0 ||
      !i.issueDate.trim() ||
      !i.expiryDate.trim() ||
      i.leadTimeDays === null ||
      !i.owner.trim() ||
      !i.backupOwner.trim() ||
      !i.documentLink.trim()
  ).length;

  return {
    asAtDate,
    asAtDisplayDate: formatDisplayDate(asAtDate),
    companyFilter,
    total: summary.total,
    compliantGreen: summary.green,
    actionRequiredYellow: summary.yellow,
    pendingReview: summary.pendingReview,
    nonCompliantRed: summary.red,
    atRisk: summary.atRisk,
    awaitingDecisionOver3Days: summary.awaitingOver3Days,
    longestWaitingPendingDays,
    expired: summary.expired,
    dueWithin30Days: summary.dueWithin30,
    dueWithin60Days: summary.dueWithin60,
    dueWithin90Days: summary.dueWithin90,
    unverifiedRequired: summary.unverified,
    expiryClustersCount: clusters.length,
    itemsInExpiryClusters: new Set(clusters.flatMap((c) => c.items.map((x) => x.id))).size,
    itemsWithoutBackupOwner: items.filter((i) => !i.backupOwner.trim()).length,
    ownersWithBackupGaps: owners.filter((o) => o.hasBackupGap).length,
    dataQualityFlaggedItems: items.filter((i) => i.dataQualityIssues.length > 0).length,
    incompleteDataCount,
    dataQualityIssueCounts: {
      issueDateAfterExpiry: countByDqCode('ISSUE_AFTER_EXPIRY'),
      missingOwnership: items.filter((i) =>
        i.dataQualityIssues.some(
          (dq) => dq.code === 'MISSING_OWNER' || dq.code === 'MISSING_BACKUP'
        )
      ).length,
      missingLeadTime: countByDqCode('MISSING_LEAD_TIME'),
      missingVerification: countByDqCode('MISSING_VERIFICATION'),
      clearedNoReason: countByDqCode('CLEARED_NO_REASON'),
    },
  };
}

/**
 * Verify in code that every numeric token in the AI summary exists in the supplied metrics.
 */
export function verifySummaryNumbersAgainstFacts(
  summaryText: string,
  metrics: ManagementSummaryMetrics
): { valid: boolean; unverifiedNumbers: string[] } {
  const allowed = new Set<string>([
    String(metrics.total),
    String(metrics.compliantGreen),
    String(metrics.actionRequiredYellow),
    String(metrics.pendingReview),
    String(metrics.nonCompliantRed),
    String(metrics.atRisk),
    String(metrics.awaitingDecisionOver3Days),
    String(metrics.expired),
    String(metrics.dueWithin30Days),
    String(metrics.dueWithin60Days),
    String(metrics.dueWithin90Days),
    String(metrics.unverifiedRequired),
    String(metrics.expiryClustersCount),
    String(metrics.itemsInExpiryClusters),
    String(metrics.itemsWithoutBackupOwner),
    String(metrics.ownersWithBackupGaps),
    String(metrics.dataQualityFlaggedItems),
    String(metrics.incompleteDataCount),
    String(metrics.dataQualityIssueCounts.issueDateAfterExpiry),
    String(metrics.dataQualityIssueCounts.missingOwnership),
    String(metrics.dataQualityIssueCounts.missingLeadTime),
    String(metrics.dataQualityIssueCounts.missingVerification),
    String(metrics.dataQualityIssueCounts.clearedNoReason),
    // Threshold labels inherent in the metric names
    '3',
    '30',
    '60',
    '90',
  ]);

  if (metrics.longestWaitingPendingDays !== null) {
    allowed.add(String(metrics.longestWaitingPendingDays));
  }

  // Date tokens from asAtDate (YYYY-MM-DD, plus unpadded day/month)
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(metrics.asAtDate);
  if (dateMatch) {
    allowed.add(dateMatch[1]);
    allowed.add(dateMatch[2]);
    allowed.add(String(Number(dateMatch[2])));
    allowed.add(dateMatch[3]);
    allowed.add(String(Number(dateMatch[3])));
  }

  const foundNumbers = summaryText.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  const unverifiedNumbers: string[] = [];
  for (const token of foundNumbers) {
    const normalized = token.includes('.') ? token : String(Number(token));
    if (!allowed.has(token) && !allowed.has(normalized)) {
      unverifiedNumbers.push(token);
    }
  }

  return {
    valid: unverifiedNumbers.length === 0 && summaryText.trim().length > 0,
    unverifiedNumbers: Array.from(new Set(unverifiedNumbers)),
  };
}

/**
 * Deterministic fixed-template Management Summary (~125-165 words) used as fallback
 * when Gemini is unavailable or fails numeric verification.
 */
export function buildFallbackManagementSummary(metrics: ManagementSummaryMetrics): string {
  const scopeLabel =
    metrics.companyFilter === 'All'
      ? 'Mindworx Consulting and Academy combined'
      : `Mindworx ${metrics.companyFilter}`;

  const longestWaitText =
    metrics.longestWaitingPendingDays !== null
      ? `with the longest waiting item open for ${metrics.longestWaitingPendingDays} days`
      : 'with no items currently waiting in the queue';

  const clusterSentence =
    metrics.expiryClustersCount > 0
      ? `There are ${metrics.expiryClustersCount} expiry clusters covering ${metrics.itemsInExpiryClusters} items expiring close together.`
      : `There are 0 expiry clusters currently detected.`;

  const dataSentence =
    metrics.dataQualityFlaggedItems > 0 || metrics.itemsWithoutBackupOwner > 0
      ? `Register data is incomplete in places: ${metrics.dataQualityFlaggedItems} items carry data quality flags, ${metrics.incompleteDataCount} records have incomplete fields, ${metrics.unverifiedRequired} items still require statutory verification, and ${metrics.itemsWithoutBackupOwner} items lack a backup owner.`
      : `All ${metrics.total} register records currently have complete fields, required verifications, and assigned backup owners.`;

  return [
    `As at ${metrics.asAtDisplayDate}, the ${scopeLabel} register tracks ${metrics.total} compliance items, of which ${metrics.atRisk} are currently at risk and ${metrics.compliantGreen} meet compliant status rules.`,
    `Immediate attention is required on ${metrics.nonCompliantRed} confirmed non-compliant items, ${metrics.expired} expired items, and ${metrics.pendingReview} items in pending review (${metrics.awaitingDecisionOver3Days} awaiting decision longer than 3 days, ${longestWaitText}), alongside ${metrics.actionRequiredYellow} items requiring owner action.`,
    `Looking ahead, ${metrics.dueWithin30Days} items fall due within 30 days, ${metrics.dueWithin60Days} within 60 days, and ${metrics.dueWithin90Days} within 90 days. ${clusterSentence}`,
    dataSentence,
  ].join(' ');
}

/**
 * Robust RFC-4180-compatible CSV parser for the CSV Import feature.
 */
export function parseCsvText(csvText: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return { headers: [], rows: [] };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell !== '')) {
    rows.push(currentRow);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  return {
    headers: rows[0],
    rows: rows.slice(1),
  };
}

export function normalizeSourceType(raw: string): SourceType {
  const val = raw.trim().toLowerCase();
  if (val.includes('system')) return 'system retrieval';
  if (val.includes('invoice') || val.includes('fee')) return 'fee invoice';
  if (val.includes('bank')) return 'bank letter';
  if (val.includes('app')) return 'application';
  return 'other';
}

export function normalizeCompanyScope(raw: string): ComplianceItem['company'] {
  const val = raw.trim().toLowerCase();
  if (val === 'both' || val.includes('shared') || val.includes('all')) return 'Both';
  if (val.includes('acad')) return 'Academy';
  return 'Consulting';
}

export function normalizeYesNo(raw: string): 'Yes' | 'No' {
  const val = raw.trim().toLowerCase();
  if (val === 'yes' || val === 'true' || val === 'y' || val === '1') return 'Yes';
  return 'No';
}

export function normalizeVerificationStatus(
  raw: string
): ComplianceItem['verifiedInStatutorySystem'] {
  const val = raw.trim().toLowerCase();
  if (val === 'yes' || val === 'verified' || val === 'compliant' || val === 'true') return 'Yes';
  if (val === 'no' || val === 'non-compliant' || val === 'non compliant' || val === 'failed')
    return 'No';
  return 'Not checked';
}

export function normalizeFindingSource(raw: string): ComplianceItem['findingSource'] {
  const val = raw.trim().toLowerCase();
  if (val.includes('doc')) return 'Document check';
  if (val.includes('manual')) return 'Manual flag';
  if (val.includes('stat')) return 'Statutory system';
  return 'Rule engine';
}

export const SAMPLE_CSV_TEMPLATE = `company,itemName,group,issueDate,expiryDate,renewalCycle,leadTimeDays,howObtained,sourceType,accessMethod,loginMethod,credentialSource,documentLink,owner,backupOwner,systemVerificationRequired,verifiedInStatutorySystem,dateVerified,verifiedBy,findingSource,triggerReason,notes
Consulting,Tax Clearance Verification,SARS,2026-03-01,2027-03-01,Annual,30,SARS eFiling TCS request,system retrieval,SARS eFiling,Tax Practitioner Profile,Finance Manager OTP,https://mindworx.sharepoint.com/compliance/tcs-2026.pdf,Owner A,Owner B,Yes,Yes,2026-11-10,Owner A,Rule engine,,Imported sample row
Both,Public Liability Schedule,Other,2026-09-01,2027-08-31,Annual,45,Broker renewal invoice,fee invoice,Broker Email,Account Ref,Finance Insurance Folder,https://mindworx.sharepoint.com/compliance/pl-2026.pdf,Owner A,Owner B,No,Not checked,,,Rule engine,,Applies to Consulting & Academy`;
