import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Talk — the consult path, permanently one tap from every screen.
 *
 * Messages are polled rather than pushed: the provider's real-time channel
 * authorises a web session only, and this app holds a bearer token, so a
 * private channel is structurally unreachable. That is an upstream gap on the
 * change request, not something to work around in the browser — polling is the
 * documented interim, and it is why `unread_count` matters.
 */
export default function TalkPage() {
  return (
    <Screen
      title="Talk to your provider"
      path="/patient/conversations"
      empty="No conversations yet."
      emptyAction={{ href: '/talk/new', label: 'Start a consult' }}
    >
      {(rows) => (
        <ul className="prx-rows">
          {rows.map((conversation) => (
            <li className="prx-row" key={conversation.id}>
              <span>{conversation.subject ?? 'Conversation'}</span>
              {conversation.unread_count > 0 ? (
                <span className="prx-task__chip">{conversation.unread_count} new</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
