import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolCallEvent } from '@/lib/aiClient';

interface Props {
  call: ToolCallEvent;
}

function preview(result: string): string {
  if (result.length <= 220) return result;
  return `${result.slice(0, 220)}…`;
}

export function ToolCallCard({ call }: Props) {
  const [open, setOpen] = useState(false);
  const running = call.result === undefined;
  const isError = !running && (() => {
    try {
      const parsed = JSON.parse(call.result!);
      return parsed?.error !== undefined || parsed?.isError === true;
    } catch {
      return false;
    }
  })();

  return (
    <div
      className={cn(
        'rounded-md border text-xs',
        isError
          ? 'border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.05)]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer"
      >
        {running ? (
          <Loader2 size={12} className="animate-spin text-[hsl(var(--accent))]" />
        ) : open ? (
          <ChevronDown size={12} className="text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronRight size={12} className="text-[hsl(var(--muted-foreground))]" />
        )}
        <Wrench size={11} className="text-[hsl(var(--muted-foreground))]" />
        <span className="font-data text-[11px] text-[hsl(var(--foreground))]">{call.name}</span>
        {running && <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">running…</span>}
        {!running && isError && (
          <span className="ml-auto text-[10px] text-[hsl(var(--destructive))]">error</span>
        )}
      </button>
      {open && (
        <div className="px-2.5 pb-2 flex flex-col gap-1.5">
          {call.input !== undefined && (
            <div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-0.5">input</div>
              <pre className="font-data text-[10px] whitespace-pre-wrap break-all rounded bg-[hsl(var(--background))] p-1.5 border border-[hsl(var(--border)/0.5)]">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
          )}
          {call.result !== undefined && (
            <div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-0.5">result</div>
              <pre className="font-data text-[10px] whitespace-pre-wrap break-all rounded bg-[hsl(var(--background))] p-1.5 border border-[hsl(var(--border)/0.5)] max-h-48 overflow-y-auto">
                {preview(call.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
