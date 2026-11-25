import { AlertTriangle, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import {
  TrafficLightFilter,
  TrafficLightStatus,
  TrafficLightSummaryItem,
} from '../types/compliance';

interface TrafficLightControlProps {
  lights: TrafficLightSummaryItem[];
  activeLight: TrafficLightFilter;
  totalItems: number;
  onSelectLight: (light: TrafficLightFilter) => void;
  onOpenRegisterWithLight?: (light: TrafficLightStatus) => void;
}

export function TrafficLightControl({
  lights,
  activeLight,
  totalItems,
  onSelectLight,
  onOpenRegisterWithLight,
}: TrafficLightControlProps) {
  const activeDefinition = lights.find((l) => l.status === activeLight) ?? null;

  const getButtonStyles = (status: TrafficLightStatus, isActive: boolean) => {
    if (status === 'Green') {
      return isActive
        ? 'border-status-green-solid bg-status-green-solid text-status-green-solid-text shadow-sm'
        : 'border-status-green-border bg-status-green-bg text-status-green-text hover:opacity-90';
    }
    if (status === 'Yellow') {
      return isActive
        ? 'border-status-yellow-solid bg-status-yellow-solid text-status-yellow-solid-text shadow-sm'
        : 'border-status-yellow-border bg-status-yellow-bg text-status-yellow-text hover:opacity-90';
    }
    if (status === 'Pending review') {
      return isActive
        ? 'border-status-pending-solid bg-status-pending-solid text-status-pending-solid-text shadow-sm'
        : 'border-status-pending-border bg-status-pending-bg text-status-pending-text hover:opacity-90';
    }
    return isActive
      ? 'border-status-red-solid bg-status-red-solid text-status-red-solid-text shadow-sm'
      : 'border-status-red-border bg-status-red-bg text-status-red-text hover:opacity-90';
  };

  const getLampFill = (status: TrafficLightStatus, isLit: boolean) => {
    if (!isLit) return 'bg-slate-600/70 border-slate-500';
    if (status === 'Green') return 'bg-emerald-400 border-emerald-200';
    if (status === 'Yellow') return 'bg-amber-400 border-amber-200';
    if (status === 'Pending review') return 'bg-purple-400 border-purple-200';
    return 'bg-red-500 border-red-300';
  };

  const renderIcon = (status: TrafficLightStatus, isActive: boolean) => {
    const iconColor = isActive
      ? status === 'Yellow'
        ? 'text-status-yellow-solid-text'
        : 'text-white'
      : status === 'Green'
        ? 'text-status-green-icon'
        : status === 'Yellow'
          ? 'text-status-yellow-icon'
          : status === 'Pending review'
            ? 'text-status-pending-icon'
            : 'text-status-red-icon';

    if (status === 'Green') {
      return <CheckCircle2 className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />;
    }
    if (status === 'Yellow') {
      return <AlertTriangle className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />;
    }
    if (status === 'Pending review') {
      return <Clock className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />;
    }
    return <XCircle className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />;
  };

  return (
    <section
      aria-label="Traffic Light Status System"
      className="rounded-lg border border-line bg-card p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        {/* Left: Traffic Light Signal Housing + Title */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 rounded-lg border border-topbar-border bg-topbar px-2.5 py-2 shrink-0"
            aria-label="Traffic light signal indicator"
          >
            {lights.map((light) => {
              const isLit =
                activeLight === 'All' ? light.count > 0 : activeLight === light.status;
              return (
                <button
                  key={light.status}
                  type="button"
                  onClick={() =>
                    onSelectLight(activeLight === light.status ? 'All' : light.status)
                  }
                  title={`${light.shortLabel} (${light.label}): ${light.count} items`}
                  aria-label={`Select ${light.shortLabel} signal (${light.count} items)`}
                  className={`h-4 w-4 rounded-full border transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${getLampFill(
                    light.status,
                    isLit
                  )}`}
                />
              );
            })}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-semibold text-ink-accent sm:text-base">
                Compliance Traffic-Light System
              </h2>
              <span className="text-xs text-ink-muted tabular-nums">
                · {totalItems} evaluated item{totalItems === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Filter by Green, Yellow, Pending review, or Red directly from the data layer.
            </p>
          </div>
        </div>

        {/* Right: Interactive Buttons + All Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {lights.map((light) => {
            const isActive = activeLight === light.status;
            const buttonText =
              light.status === 'Pending review'
                ? 'Pending review'
                : `${light.shortLabel} · ${light.label}`;
            return (
              <button
                key={light.status}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectLight(isActive ? 'All' : light.status)}
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${getButtonStyles(
                  light.status,
                  isActive
                )}`}
              >
                {renderIcon(light.status, isActive)}
                <span>{buttonText}</span>
                <span className="ml-0.5 font-mono tabular-nums opacity-90">
                  ({light.count})
                </span>
              </button>
            );
          })}

          {activeLight !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectLight('All')}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-card px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-hover-surface whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show All</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Light Data-Layer Rule Readout */}
      {activeDefinition && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-subtle px-3.5 py-2.5 text-xs">
          <div className="text-ink-secondary">
            <strong className="font-semibold text-ink-accent">
              {activeDefinition.label} — {activeDefinition.count}{' '}
              item{activeDefinition.count === 1 ? '' : 's'} ({activeDefinition.percentage}%):
            </strong>{' '}
            {activeDefinition.ruleSummary}
          </div>
          {onOpenRegisterWithLight && (
            <button
              type="button"
              onClick={() => onOpenRegisterWithLight(activeDefinition.status)}
              className="font-semibold text-ink-link underline underline-offset-2 hover:text-ink-link-hover whitespace-nowrap shrink-0"
            >
              View in Register
            </button>
          )}
        </div>
      )}
    </section>
  );
}
