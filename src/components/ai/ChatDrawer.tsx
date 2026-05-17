import { useEffect } from 'react';
import { X, Bot, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChatStore } from '@/store/chatStore';
import { ChatPanel } from './ChatPanel';

export function ChatDrawer() {
  const { drawerOpen, close, pendingPrompt, clearPendingPrompt } = useChatStore();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && drawerOpen) close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, close]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex sm:items-stretch sm:justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div className="relative ml-auto w-full sm:max-w-md flex flex-col bg-[hsl(var(--background))] border-l border-[hsl(var(--border))] shadow-2xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-[hsl(var(--accent))]" />
            <span className="font-[Orbitron] tracking-wider text-xs">SCOUT AI</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/ai-chat"
              onClick={close}
              title="Open full page"
              className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
            >
              <ExternalLink size={14} />
            </Link>
            <button
              type="button"
              onClick={close}
              className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel
            initialPrompt={pendingPrompt}
            onPromptConsumed={clearPendingPrompt}
            suggestions={[
              'List events',
              'Which pits are still unscouted?',
              'Run data quality checks on the current event',
            ]}
          />
        </div>
      </div>
    </div>
  );
}
