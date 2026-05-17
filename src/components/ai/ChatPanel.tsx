import { useEffect, useRef, useState } from 'react';
import { Send, Square, Loader2, Bot, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStream, type ChatTurn } from '@/hooks/useChatStream';
import { ToolCallCard } from './ToolCallCard';

interface Props {
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
  suggestions?: string[];
}

function TurnView({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div className={cn('flex gap-2 items-start', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent))]'
            : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
        )}
      >
        {isUser ? <UserIcon size={14} /> : <Bot size={14} />}
      </div>
      <div className={cn('flex flex-col gap-1.5 min-w-0 flex-1', isUser && 'items-end')}>
        {turn.toolCalls && turn.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1 w-full max-w-full">
            {turn.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} call={tc} />
            ))}
          </div>
        )}
        {turn.content && (
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words max-w-full',
              isUser
                ? 'bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--foreground))]'
                : 'bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--foreground))]'
            )}
          >
            {turn.content}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ initialPrompt, onPromptConsumed, suggestions }: Props) {
  const { turns, isStreaming, error, send, cancel } = useChatStream();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      void send(initialPrompt);
      onPromptConsumed?.();
    }
    // We only want this on first prompt mount-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    void send(text);
  }

  function fillSuggestion(text: string) {
    if (isStreaming) return;
    void send(text);
  }

  const showEmpty = turns.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {showEmpty && (
          <div className="flex flex-col gap-3 items-center text-center pt-6 pb-2">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--accent)/0.15)] flex items-center justify-center">
              <Bot className="text-[hsl(var(--accent))]" size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">Ask about your scouting data</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Read-only access to events, matches, pits, and data-quality checks.
              </p>
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5 w-full mt-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => fillSuggestion(s)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--accent)/0.4)] hover:bg-[hsl(var(--muted)/0.4)] transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {turns.map((turn, i) => <TurnView key={i} turn={turn} />)}

        {isStreaming && turns[turns.length - 1]?.content === '' && !turns[turns.length - 1]?.toolCalls?.length && (
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] pl-9">
            <Loader2 size={12} className="animate-spin" />
            Thinking…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))] px-3 py-2 text-xs">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-[hsl(var(--border))] p-2 flex items-end gap-2 bg-[hsl(var(--primary))]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ask about scouting data…"
          rows={1}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-lg bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:border-[hsl(var(--accent)/0.5)] disabled:opacity-50 max-h-40"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={cancel}
            className="shrink-0 w-9 h-9 rounded-lg bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))] flex items-center justify-center cursor-pointer hover:bg-[hsl(var(--destructive)/0.25)] transition-colors"
            aria-label="Stop"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 w-9 h-9 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground,_var(--background)))] flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default hover:opacity-90 transition-opacity"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        )}
      </form>
    </div>
  );
}
