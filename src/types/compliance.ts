export type CompanyScope = 'Consulting' | 'Academy' | 'Both';

export type DivisionFilter = 'Consulting' | 'Academy' | 'All';

export type SourceType =
  | 'system retrieval'
  | 'fee invoice'
  | 'bank letter'
  | 'application'
  | 'other';

export type YesNo = 'Yes' | 'No';

export type VerificationStatus = 'Yes' | 'No' | 'Not checked';

export type AutomaticStatus = 'Red' | 'Yellow' | 'Green';

export type TrafficLightStatus = AutomaticStatus | 'Pending review';

export type TrafficLightFilter = TrafficLightStatus | 'All';

export type FindingSource =
  | 'Rule engine'
  | 'Document check'
  | 'Manual flag'
  | 'Statutory system';

export type ReviewDecisionType =
  | 'Confirm non-compliant'
  | 'Clear'
  | 'Request more evidence';

export type AuditEntryKind = ReviewDecisionType | 'OCR + AI document check';

export type UserRole = 'Compliance Officer' | 'Document Owner' | 'Viewer';

export type DocumentConfidence = 'High' | 'Medium' | 'Low';

export type OcrDateParseStatus = 'valid' | 'ambiguous' | 'missing';

export interface OcrDateResult {
  isoValue: string; // YYYY-MM-DD when valid, otherwise ''
  displayValue: string; // DD/MM/YYYY, 'ambiguous', or ''
  status: OcrDateParseStatus;
}

export interface OcrFieldExtraction {
  confidence: number; // 0..100
  confidenceLevel: 'High' | 'Low'; // >= 80 High, < 80 Low
  sourceMode: 'pdf-text-layer' | 'pdf-ocr' | 'image-ocr';
  pagesProcessed: number;
  companyName: string;
  documentType: string;
  documentKeywords: string[];
  issueDate: OcrDateResult;
  expiryDate: OcrDateResult;
}

export interface ExtractedTextField {
  value: string;
  confidence: DocumentConfidence;
  lowConfidenceReason: string;
}

export interface ExtractedYesNoField {
  value: YesNo;
  confidence: DocumentConfidence;
  lowConfidenceReason: string;
}

export interface DocumentCheckExtraction {
  documentType: ExtractedTextField;
  companyName: ExtractedTextField;
  issueDate: ExtractedTextField;
  expiryDate: ExtractedTextField;
  signaturePresent: ExtractedYesNoField;
  stampPresent: ExtractedYesNoField;
  referenceNumberPresent: ExtractedYesNoField;
  unreadableOrIncomplete: boolean;
  unreadableReason: string;
}

export interface DocumentCheckComparisonRow {
  field: 'companyName' | 'documentType' | 'issueDate' | 'expiryDate';
  label: string;
  registerValue: string;
  ocrValue: string;
  ocrMatchesRegister: boolean;
  ocrIsAmbiguous: boolean;
  ocrIsMissing: boolean;
  extractedValue: string; // Gemini extracted value
  geminiMatchesRegister: boolean;
  geminiIsMissing: boolean;
  ocrGeminiAgree: boolean;
  allAgree: boolean;
  confidence: DocumentConfidence;
  lowConfidenceReason: string;
  matches: boolean;
  isMissing: boolean;
}

export interface DocumentCheckRecord {
  checkedAt: string; // YYYY-MM-DD
  checkedTimestamp: string; // ISO timestamp
  fileName: string; // Display filename only; file bytes and raw OCR text are never stored
  outcome: 'Passed' | 'Routed to Pending review';
  routingReason: string;
  ocrAvailable: boolean;
  ocrErrorMessage?: string;
  ocrResult: OcrFieldExtraction | null;
  aiAvailable: boolean;
  errorMessage?: string;
  extraction: DocumentCheckExtraction | null;
  comparisons: DocumentCheckComparisonRow[];
}

export interface ManagementSummaryMetrics {
  asAtDate: string;
  asAtDisplayDate: string;
  companyFilter: DivisionFilter;
  total: number;
  compliantGreen: number;
  actionRequiredYellow: number;
  pendingReview: number;
  nonCompliantRed: number;
  atRisk: number;
  awaitingDecisionOver3Days: number;
  longestWaitingPendingDays: number | null;
  expired: number;
  dueWithin30Days: number;
  dueWithin60Days: number;
  dueWithin90Days: number;
  unverifiedRequired: number;
  expiryClustersCount: number;
  itemsInExpiryClusters: number;
  itemsWithoutBackupOwner: number;
  ownersWithBackupGaps: number;
  dataQualityFlaggedItems: number;
  incompleteDataCount: number;
  dataQualityIssueCounts: {
    issueDateAfterExpiry: number;
    missingOwnership: number;
    missingLeadTime: number;
    missingVerification: number;
    clearedNoReason: number;
  };
}

export interface ManagementSummaryResult {
  summaryText: string;
  source: 'ai' | 'fallback';
  fallbackReason?: string;
  generatedAt: string;
  asAtDate: string;
  companyFilter: DivisionFilter;
  wordCount: number;
  unverifiedNumbersFound: string[];
}

export interface ReviewState {
  status: 'None' | 'Pending review' | 'Decided';
  pendingSince: string; // YYYY-MM-DD
  decision: ReviewDecisionType | null;
  reviewerName: string;
  decisionDate: string; // YYYY-MM-DD
  decisionReason: string;
  evidenceDueDate: string; // YYYY-MM-DD or ''
  snapshotHash: string;
}

export interface ReviewAuditEntry {
  id: string;
  itemId: string;
  itemName: string;
  company: CompanyScope;
  automaticStatus: AutomaticStatus;
  findingSource: FindingSource;
  triggerReason: string;
  decision: AuditEntryKind;
  checkResult?: 'Passed' | 'Routed to Pending review';
  reviewerName: string;
  decisionDate: string;
  decisionReason: string;
  evidenceDueDate?: string;
}

export interface TrafficLightDefinition {
  status: TrafficLightStatus;
  label: string;
  shortLabel: string;
  ruleSummary: string;
  order: number;
}

export interface TrafficLightSummaryItem extends TrafficLightDefinition {
  count: number;
  percentage: number;
}

export interface ComplianceItem {
  id: string;
  company: CompanyScope;
  itemName: string;
  group: string;
  issueDate: string; // YYYY-MM-DD or ''
  expiryDate: string; // YYYY-MM-DD or ''
  renewalCycle: string;
  leadTimeDays: number | null;
  howObtained: string;
  sourceType: SourceType;
  accessMethod: string;
  loginMethod: string;
  credentialSource: string; // Where password/PIN is obtained (never actual credentials)
  documentLink: string;
  owner: string;
  backupOwner: string;
  systemVerificationRequired: YesNo;
  verifiedInStatutorySystem: VerificationStatus;
  dateVerified: string; // YYYY-MM-DD or ''
  verifiedBy: string;
  notes: string;
  triggerReason: string;
  findingSource: FindingSource;
  reviewState?: ReviewState;
  lastDocumentCheck?: DocumentCheckRecord;
}

export interface DataQualityIssue {
  code:
    | 'ISSUE_AFTER_EXPIRY'
    | 'MISSING_OWNER'
    | 'MISSING_BACKUP'
    | 'MISSING_LEAD_TIME'
    | 'MISSING_VERIFICATION'
    | 'MISSING_DOCUMENT'
    | 'MISSING_DATES'
    | 'CLEARED_NO_REASON';
  label: string;
  severity: 'High' | 'Medium';
}

export interface EvaluatedComplianceItem extends ComplianceItem {
  status: TrafficLightStatus;
  statusLabel: string;
  statusReasons: string[];
  automaticStatus: AutomaticStatus;
  automaticStatusLabel: string;
  automaticReasons: string[];
  isLowConfidence: boolean;
  isPendingReview: boolean;
  pendingSince: string | null;
  daysWaiting: number | null;
  isAwaitingOver3Days: boolean;
  effectiveTriggerReason: string;
  humanDecision: ReviewDecisionType | null;
  alertDate: string | null; // expiryDate - leadTimeDays
  daysUntilExpiry: number | null;
  daysUntilAlert: number | null;
  isExpired: boolean;
  isDueWithin30: boolean;
  isDueWithin60: boolean;
  isDueWithin90: boolean;
  isDueWithin120: boolean;
  isWithinLeadTime: boolean;
  isUnverified: boolean;
  urgencyScore: number; // Lower = more urgent
  actionSummary: string;
  dataQualityIssues: DataQualityIssue[];
}

export interface SummaryMetrics {
  total: number;
  green: number;
  yellow: number;
  red: number;
  pendingReview: number;
  atRisk: number; // red + yellow + pendingReview
  awaitingOver3Days: number;
  expired: number;
  dueWithin30: number;
  dueWithin60: number;
  dueWithin90: number;
  unverified: number;
}

export interface ExpiryCluster {
  id: string;
  startDate: string;
  endDate: string;
  windowLabel: string;
  items: EvaluatedComplianceItem[];
}

export interface OwnerSummary {
  owner: string;
  totalItems: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  pendingReviewCount: number;
  itemsWithoutBackup: number;
  backupOwners: string[];
  hasBackupGap: boolean;
  items: EvaluatedComplianceItem[];
}

export interface ComplianceDataSource {
  name: string;
  loadItems: () => Promise<ComplianceItem[]>;
  loadGroups: () => Promise<string[]>;
  loadTrafficLightDefinitions: () => Promise<TrafficLightDefinition[]>;
  loadDecisionHistory: () => Promise<ReviewAuditEntry[]>;
}

export type NotificationTriggerStatus = 'Red' | 'Pending review';

export interface SimulatedEmailNotification {
  id: string;
  itemId: string;
  itemName: string;
  company: CompanyScope;
  group: string;
  previousStatus: TrafficLightStatus | 'New';
  newStatus: NotificationTriggerStatus;
  recipientName: string;
  recipientEmail: string;
  ccRecipientName: string;
  ccRecipientEmail: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  greeting: string;
  leadMessage: string;
  actionRequired: string;
  triggerReason: string;
  findingSource: FindingSource;
  automaticStatusLabel: string;
  expiryDateDisplay: string;
  documentLink: string;
  daysWaiting: number | null;
  reviewerName?: string;
  reviewerReason?: string;
  plainTextEmail: string;
  createdAt: string;
  asAtDate: string;
  deliveryStatus: 'Previewed' | 'Simulated Sent';
}

