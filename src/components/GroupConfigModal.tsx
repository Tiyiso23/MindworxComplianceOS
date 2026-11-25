import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface GroupConfigModalProps {
  isOpen: boolean;
  groups: string[];
  onSaveGroups: (groups: string[]) => void;
  onClose: () => void;
}

export function GroupConfigModal({
  isOpen,
  groups,
  onSaveGroups,
  onClose,
}: GroupConfigModalProps) {
  const [draftGroups, setDraftGroups] = useState<string[]>(groups);
  const [newGroup, setNewGroup] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newGroup.trim();
    if (!trimmed) return;
    if (!draftGroups.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
      setDraftGroups([...draftGroups, trimmed]);
    }
    setNewGroup('');
  };

  const handleRename = (index: number, value: string) => {
    const next = [...draftGroups];
    next[index] = value;
    setDraftGroups(next);
  };

  const handleRemove = (index: number) => {
    if (draftGroups.length <= 1) return;
    setDraftGroups(draftGroups.filter((_, i) => i !== index));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-config-title"
    >
      <div className="theme-surface w-full max-w-md rounded-lg border border-line bg-card text-ink shadow-xl">
        <div className="flex items-center justify-between border-b border-topbar-border bg-topbar px-5 py-3.5 text-topbar-text rounded-t-lg">
          <div>
            <h2 id="group-config-title" className="font-display text-base font-semibold">
              Configure Compliance Groups
            </h2>
            <p className="text-xs text-topbar-muted">
              Adjust group labels while statutory group names are finalised.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-topbar-muted hover:bg-white/10 hover:text-white"
            aria-label="Close group settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add new group (e.g. QCTO, SETA)..."
              className="flex-1 rounded-md border border-line-strong bg-subtle px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {draftGroups.map((group, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={group}
                  onChange={(e) => handleRename(index, e.target.value)}
                  aria-label={`Group ${index + 1} name`}
                  className="flex-1 rounded-md border border-line-strong bg-subtle px-3 py-1.5 text-sm text-ink focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus-ring"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  disabled={draftGroups.length <= 1}
                  className="rounded-md border border-line-strong bg-card p-1.5 text-ink-muted hover:border-status-red-border hover:bg-status-red-bg hover:text-tone-red disabled:opacity-40"
                  aria-label={`Remove ${group}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line bg-subtle px-5 py-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line-strong bg-card px-4 py-1.5 text-xs font-medium text-ink-secondary hover:bg-hover-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const cleaned = draftGroups.map((g) => g.trim()).filter(Boolean);
              if (cleaned.length > 0) {
                onSaveGroups(Array.from(new Set(cleaned)));
              }
              onClose();
            }}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover"
          >
            Save Groups
          </button>
        </div>
      </div>
    </div>
  );
}
