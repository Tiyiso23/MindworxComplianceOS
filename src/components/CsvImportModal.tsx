import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  normalizeCompanyScope,
  normalizeFindingSource,
  normalizeSourceType,
  normalizeVerificationStatus,
  normalizeYesNo,
  parseCsvText,
  SAMPLE_CSV_TEMPLATE,
} from '../lib/complianceEngine';
import { ComplianceItem } from '../types/compliance';

interface CsvImportModalProps {
  isOpen: boolean;
  onImport: (items: ComplianceItem[], mode: 'append' | 'replace') => void;
  onClose: () => void;
}

type TargetFieldKey = keyof Omit<ComplianceItem, 'id' | 'reviewState' | 'lastDocumentCheck'> | 'ignore';

const TARGET_FIELDS: {
  key: keyof Omit<ComplianceItem, 'id' | 'reviewState' | 'lastDocumentCheck'>;
  label: string;
}[] = [
  { key: 'company', label: 'Company (Consulting / Academy / Both)' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'group', label: 'Group' },
  { key: 'issueDate', label: 'Issue Date (YYYY-MM-DD)' },
  { key: 'expiryDate', label: 'Expiry Date (YYYY-MM-DD)' },
  { key: 'renewalCycle', label: 'Renewal Cycle' },
  { key: 'leadTimeDays', label: 'Lead Time (Days)' },
  { key: 'howObtained', label: 'How It Is Obtained' },
  { key: 'sourceType', label: 'Source Type' },
  { key: 'accessMethod', label: 'Access Method' },
  { key: 'loginMethod', label: 'Login Method' },
  { key: 'credentialSource', label: 'Where Password / PIN Is Obtained' },
  { key: 'documentLink', label: 'Document Link' },
  { key: 'owner', label: 'Owner' },
  { key: 'backupOwner', label: 'Backup Owner' },
  { key: 'systemVerificationRequired', label: 'System Verification Required' },
  { key: 'verifiedInStatutorySystem', label: 'Verified in Statutory System' },
  { key: 'dateVerified', label: 'Date Verified' },
  { key: 'verifiedBy', label: 'Verified By' },
  { key: 'findingSource', label: 'Finding Source' },
  { key: 'triggerReason', label: 'Trigger Reason' },
  { key: 'notes', label: 'Notes' },
];

function guessFieldMapping(header: string): TargetFieldKey {
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = TARGET_FIELDS.find((f) => f.key.toLowerCase() === norm);
  if (exact) return exact.key;

  if (norm.includes('company') || norm.includes('division')) return 'company';
  if (norm.includes('item') || norm === 'name' || norm === 'title') return 'itemName';
  if (norm.includes('group') || norm.includes('category')) return 'group';
  if (norm.includes('issuedate') || norm === 'issued') return 'issueDate';
  if (norm.includes('expiry') || norm.includes('expires')) return 'expiryDate';
  if (norm.includes('cycle') || norm.includes('frequency')) return 'renewalCycle';
  if (norm.includes('leadtime') || norm.includes('notice')) return 'leadTimeDays';
  if (norm.includes('howobtained') || norm.includes('process')) return 'howObtained';
  if (norm.includes('sourcetype')) return 'sourceType';
  if (norm.includes('access')) return 'accessMethod';
  if (norm.includes('login')) return 'loginMethod';
  if (norm.includes('credential') || norm.includes('password') || norm.includes('pin'))
    return 'credentialSource';
  if (norm.includes('document') || norm.includes('link') || norm.includes('url'))
    return 'documentLink';
  if (norm.includes('backup')) return 'backupOwner';
  if (norm.includes('owner')) return 'owner';
  if (norm.includes('verificationrequired') || norm.includes('required'))
    return 'systemVerificationRequired';
  if (norm.includes('verifiedinstatutory') || norm.includes('statutory'))
    return 'verifiedInStatutorySystem';
  if (norm.includes('dateverified')) return 'dateVerified';
  if (norm.includes('verifiedby')) return 'verifiedBy';
  if (norm.includes('findingsource')) return 'findingSource';
  if (norm.includes('trigger')) return 'triggerReason';
  if (norm.includes('note') || norm.includes('comment')) return 'notes';
  return 'ignore';
}

export function CsvImportModal({ isOpen, onImport, onClose }: CsvImportModalProps) {
  const [csvText, setCsvText] = useState('');
  const [columnMap, setColumnMap] = useState<Record<number, TargetFieldKey>>({});
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const parsed = useMemo(() => parseCsvText(csvText), [csvText]);

  const handleLoadText = (text: string) => {
    setCsvText(text);
    const { headers } = parseCsvText(text);
    const initialMap: Record<number, TargetFieldKey> = {};
    headers.forEach((h, idx) => {
      initialMap[idx] = guessFieldMapping(h);
    });
    setColumnMap(initialMap);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleLoadText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindworx-compliance-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const mappedItems = useMemo<ComplianceItem[]>(() => {
    if (parsed.headers.length === 0 || parsed.rows.length === 0) return [];
    return parsed.rows
      .map((row, rowIdx) => {
        const record: ComplianceItem = {
          id: `csv-${Date.now()}-${rowIdx}`,
          company: 'Consulting',
          itemName: '',
          group: 'Other',
          issueDate: '',
          expiryDate: '',
          renewalCycle: 'Annual',
          leadTimeDays: null,
          howObtained: '',
          sourceType: 'other',
          accessMethod: '',
          loginMethod: '',
          credentialSource: '',
          documentLink: '',
          owner: '',
          backupOwner: '',
          systemVerificationRequired: 'No',
          verifiedInStatutorySystem: 'Not checked',
          dateVerified: '',
          verifiedBy: '',
          notes: '',
          findingSource: 'Rule engine',
          triggerReason: '',
        };

        row.forEach((cellValue, colIdx) => {
          const target = columnMap[colIdx];
          if (!target || target === 'ignore') return;
          const val = cellValue.trim();

          switch (target) {
            case 'company':
              record.company = normalizeCompanyScope(val);
              break;
            case 'leadTimeDays': {
              const num = Number(val);
              record.leadTimeDays = val !== '' && !Number.isNaN(num) ? num : null;
              break;
            }
            case 'sourceType':
              record.sourceType = normalizeSourceType(val);
              break;
            case 'systemVerificationRequired':
              record.systemVerificationRequired = normalizeYesNo(val);
              break;
            case 'verifiedInStatutorySystem':
              record.verifiedInStatutorySystem = normalizeVerificationStatus(val);
              break;
            case 'findingSource':
              record.findingSource = normalizeFindingSource(val);
              break;
            default:
              record[target] = val;
              break;
          }
        });

        return record;
      })
      .filter((item) => item.itemName.trim() !== '');
  }, [parsed, columnMap]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-title"
    >
      <div className="theme-surface flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg border border-line bg-card text-ink shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-topbar-border bg-topbar px-6 py-4 text-topbar-text rounded-t-lg">
          <div>
            <h2 id="csv-import-title" className="font-display text-base font-semibold">
              Import Cleaned Compliance Register (CSV)
            </h2>
            <p className="text-xs text-topbar-muted">
              Upload a CSV file or paste spreadsheet rows, then map columns to Mindworx fields.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-topbar-muted hover:bg-white/10 hover:text-white"
            aria-label="Close CSV import"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Upload / Sample Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-subtle p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover">
                <Upload className="h-3.5 w-3.5" />
                <span>Choose CSV File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => handleLoadText(SAMPLE_CSV_TEMPLATE)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Load Sample CSV</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Template</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-ink-secondary">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                />
                <span>Append to register</span>
              </label>
              <label className="flex items-center gap-1.5 text-ink-secondary">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                <span>Replace register</span>
              </label>
            </div>
          </div>

          {/* Paste area */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary">
              Or paste CSV text directly (first row must be column headers)
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => handleLoadText(e.target.value)}
              placeholder="company,itemName,group,issueDate,expiryDate,..."
              className="mt-1 w-full rounded-md border border-line-strong bg-subtle p-3 font-mono text-xs text-ink placeholder:text-ink-muted focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          {/* Column Mapping */}
          {parsed.headers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-semibold text-ink-accent">
                  Column Mapping ({parsed.headers.length} columns detected)
                </h3>
                <span className="text-xs text-ink-muted tabular-nums">
                  {mappedItems.length} valid row{mappedItems.length === 1 ? '' : 's'} ready to import
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {parsed.headers.map((header, idx) => (
                  <div
                    key={`${header}-${idx}`}
                    className="rounded-md border border-line bg-subtle p-2.5"
                  >
                    <div className="truncate text-xs font-semibold text-ink" title={header}>
                      CSV: {header}
                    </div>
                    <select
                      value={columnMap[idx] ?? 'ignore'}
                      onChange={(e) =>
                        setColumnMap({ ...columnMap, [idx]: e.target.value as TargetFieldKey })
                      }
                      aria-label={`Map column ${header}`}
                      className="mt-1.5 w-full rounded border border-line-strong bg-card px-2 py-1 text-xs text-ink focus:border-focus-ring focus:outline-none"
                    >
                      <option value="ignore">— Ignore column —</option>
                      {TARGET_FIELDS.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {mappedItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-display text-xs font-semibold text-ink-accent">
                Preview (first {Math.min(5, mappedItems.length)} mapped records)
              </h3>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-subtle text-ink-muted">
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Item Name</th>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Expiry Date</th>
                      <th className="px-3 py-2">Lead Time</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {mappedItems.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium text-ink-secondary">{item.company}</td>
                        <td className="px-3 py-2 text-ink-accent font-medium">{item.itemName}</td>
                        <td className="px-3 py-2 text-ink-secondary">{item.group}</td>
                        <td className="px-3 py-2 font-mono tabular-nums text-ink-secondary">{item.expiryDate || '—'}</td>
                        <td className="px-3 py-2 font-mono tabular-nums text-ink-secondary">
                          {item.leadTimeDays !== null ? `${item.leadTimeDays}d` : '—'}
                        </td>
                        <td className="px-3 py-2 text-ink-secondary">{item.owner || '—'}</td>
                        <td className="px-3 py-2 text-ink-secondary">{item.verifiedInStatutorySystem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line bg-subtle px-6 py-3.5 rounded-b-lg">
          <span className="text-xs text-ink-muted">
            Note: Any imported password/PIN fields should only indicate credential storage location.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line-strong bg-card px-4 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={mappedItems.length === 0}
              onClick={() => {
                onImport(mappedItems, importMode);
                onClose();
              }}
              className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-40"
            >
              Import {mappedItems.length} Item{mappedItems.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
