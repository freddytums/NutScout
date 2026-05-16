import { HelpButton } from '@/components/ui/HelpButton';
import { ChatPanel } from '@/components/ai/ChatPanel';
import { useEventStore } from '@/store/eventStore';

export function AIChat() {
  const { currentEvent } = useEventStore();

  const suggestions = currentEvent
    ? [
        `List events`,
        `Run data quality checks on ${currentEvent.id}`,
        `Which pits are unscouted at ${currentEvent.id}?`,
        `Scout leaderboard for ${currentEvent.id}`,
      ]
    : ['List events', 'Which events are available?'];

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-5rem)] max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-base font-semibold">Scout AI</h2>
        <HelpButton
          content={{
            title: 'Scout AI',
            description:
              'Ask the AI questions about your scouting data. It can read events, matches, pits, schedules, scout activity, and data-quality issues — but it cannot modify anything.',
            steps: [
              { heading: 'Picking an event', detail: 'If your question is about the current event, mention it by name or id. The AI can also call list_events to discover.' },
              { heading: 'Tool calls', detail: 'You will see small cards each time the AI looks up data. Tap one to inspect what it queried and what it got back.' },
              { heading: 'Rate limits', detail: '30 messages per user per hour. The AI is metered to keep costs predictable for the team.' },
              { heading: 'Quick actions', detail: 'Buttons on the Lead Dashboard, Match Scouting, and Pit Map open this chat with a question pre-filled.' },
            ],
            tip: 'Shift+Enter for a newline. Esc closes the drawer view.',
          }}
        />
      </div>
      <div className="flex-1 min-h-0 border-t border-[hsl(var(--border))]">
        <ChatPanel suggestions={suggestions} />
      </div>
    </div>
  );
}
