import { formatDisplayDate } from './complianceEngine';
import {
  EvaluatedComplianceItem,
  NotificationTriggerStatus,
  SimulatedEmailNotification,
  TrafficLightStatus,
} from '../types/compliance';

const SENDER_NAME = 'Mindworx Compliance Governance Desk';
const SENDER_EMAIL = 'compliance-alerts@mindworx.co.za';

export function resolveOwnerEmailAddress(ownerName: string): string {
  const trimmed = ownerName.trim();
  if (!trimmed) {
    return 'compliance-escalation@mindworx.co.za';
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${slug || 'owner'}@mindworx.co.za`;
}

function formatCompanyDisplay(company: EvaluatedComplianceItem['company']): string {
  if (company === 'Both') return 'Mindworx Consulting & Academy';
  return `Mindworx ${company}`;
}

export function createSimulatedEmailNotification(params: {
  item: EvaluatedComplianceItem;
  previousStatus: TrafficLightStatus | 'New';
  newStatus: NotificationTriggerStatus;
  asAtDate: string;
}): SimulatedEmailNotification {
  const { item, previousStatus, newStatus, asAtDate } = params;

  const recipientName = item.owner.trim() || 'Compliance Owner (Unassigned)';
  const recipientEmail = resolveOwnerEmailAddress(item.owner);

  const backupName = item.backupOwner.trim();
  const ccRecipientName = backupName
    ? `${backupName} (Backup Owner)`
    : 'Compliance Officer Desk';
  const ccRecipientEmail = backupName
    ? resolveOwnerEmailAddress(backupName)
    : 'compliance@mindworx.co.za';

  const companyLabel = formatCompanyDisplay(item.company);
  const expiryDateDisplay = item.expiryDate
    ? formatDisplayDate(item.expiryDate)
    : 'Not recorded';
  const triggerReason =
    item.effectiveTriggerReason || item.statusReasons[0] || 'Compliance rule threshold triggered';

  const isRed = newStatus === 'Red';
  const subject = isRed
    ? `[URGENT · Non-Compliant] ${item.itemName} (${companyLabel})`
    : `[Review Required · Pending Review] ${item.itemName} (${companyLabel})`;

  const greeting = `Dear ${recipientName},`;

  const leadMessage = isRed
    ? `This automated compliance notice confirms that "${item.itemName}" for ${companyLabel} (${item.group}) has changed from ${previousStatus} to Non-Compliant (Red) as at ${formatDisplayDate(asAtDate)}. Immediate remediation is required to restore statutory standing.`
    : `This automated compliance notice informs you that "${item.itemName}" for ${companyLabel} (${item.group}) has moved from ${previousStatus} to Pending review as at ${formatDisplayDate(asAtDate)}. Downstream regulatory filings and "Mark as compliant" actions are temporarily locked until a Compliance Officer completes review.`;

  const actionRequired = isRed
    ? 'Please renew or remediate the underlying statutory registration immediately, upload the updated certificate to the Document Management System, and notify the Compliance Officer so the item can be re-evaluated.'
    : 'Please verify the supporting record, address the trigger reason listed below, and provide updated evidence or confirmation to the Compliance Officer desk for queue resolution.';

  const reviewerName = item.reviewState?.reviewerName?.trim() || undefined;
  const reviewerReason = item.reviewState?.decisionReason?.trim() || undefined;

  const detailLines = [
    `Item: ${item.itemName}`,
    `Company / Group: ${companyLabel} · ${item.group}`,
    `Status Change: ${previousStatus} -> ${newStatus}`,
    `Automatic Rule Result: ${item.automaticStatusLabel} (${item.automaticStatus})`,
    `Finding Source: ${item.findingSource}`,
    `Trigger Reason: ${triggerReason}`,
    `Expiry Date: ${expiryDateDisplay}`,
    item.documentLink.trim() ? `Document Link: ${item.documentLink.trim()}` : 'Document Link: Missing',
    ...(reviewerName && reviewerReason
      ? [`Compliance Officer Decision (${reviewerName}): ${reviewerReason}`]
      : []),
  ];

  const plainTextEmail = [
    `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
    `To: ${recipientName} <${recipientEmail}>`,
    `Cc: ${ccRecipientName} <${ccRecipientEmail}>`,
    `Date: ${formatDisplayDate(asAtDate)}`,
    `Subject: ${subject}`,
    '',
    greeting,
    '',
    leadMessage,
    '',
    'Compliance Record Summary',
    '-------------------------',
    ...detailLines,
    '',
    'Required Next Steps',
    '-------------------',
    actionRequired,
    '',
    'Regards,',
    SENDER_NAME,
    'Simulated Notification Service (no external email was transmitted)',
  ].join('\n');

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    itemName: item.itemName,
    company: item.company,
    group: item.group,
    previousStatus,
    newStatus,
    recipientName,
    recipientEmail,
    ccRecipientName,
    ccRecipientEmail,
    senderName: SENDER_NAME,
    senderEmail: SENDER_EMAIL,
    subject,
    greeting,
    leadMessage,
    actionRequired,
    triggerReason,
    findingSource: item.findingSource,
    automaticStatusLabel: item.automaticStatusLabel,
    expiryDateDisplay,
    documentLink: item.documentLink.trim(),
    daysWaiting: item.daysWaiting,
    reviewerName,
    reviewerReason,
    plainTextEmail,
    createdAt: new Date().toISOString(),
    asAtDate,
    deliveryStatus: 'Previewed',
  };
}
