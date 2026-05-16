import { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HelpStep {
  heading: string;
  detail?: string;
}

export interface HelpContent {
  title: string;
  description: string;
  steps: HelpStep[];
  tip?: string;
}

function HelpModal({ content, onClose }: { content: HelpContent; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--primary))] shadow-2xl flex flex-col gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <HelpCircle size={17} className="text-[hsl(var(--accent))] shrink-0" />
            <h3 className="text-base font-semibold leading-tight">{content.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 -mt-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="px-5 pb-4 text-sm text-[hsl(var(--muted-foreground))] leading-relaxed border-b border-[hsl(var(--border)/0.6)]">
          {content.description}
        </p>

        {/* Steps */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {content.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className={cn(
                'flex-none w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5 shrink-0',
                'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
              )}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{step.heading}</p>
                {step.detail && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Optional tip */}
        {content.tip && (
          <div className="mx-5 mb-5 rounded-lg bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.2)] px-3 py-2">
            <p className="text-xs text-[hsl(var(--accent)/0.9)] leading-relaxed">
              <span className="font-semibold">Tip: </span>{content.tip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function HelpButton({ content, className }: { content: HelpContent; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help"
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-full border',
          'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)]',
          'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]',
          'hover:border-[hsl(var(--accent)/0.5)] hover:bg-[hsl(var(--accent)/0.08)]',
          'cursor-pointer transition-colors shrink-0',
          className
        )}
      >
        <HelpCircle size={14} />
      </button>
      {open && <HelpModal content={content} onClose={() => setOpen(false)} />}
    </>
  );
}
