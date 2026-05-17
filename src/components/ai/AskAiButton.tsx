import { Sparkles } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function AskAiButton({ prompt, label = 'Ask AI', className, size = 'sm' }: Props) {
  const openWith = useChatStore((s) => s.openWith);

  return (
    <button
      type="button"
      onClick={() => openWith(prompt)}
      title={prompt}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--accent)/0.4)] text-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.08)] hover:bg-[hsl(var(--accent)/0.15)] transition-colors cursor-pointer',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1.5',
        className
      )}
    >
      <Sparkles size={size === 'sm' ? 10 : 12} />
      {label}
    </button>
  );
}
