import StartConversation from '@/components/talk/StartConversation';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Start a conversation: pick the visit it is about. The provider opens (or
 * reuses) the conversation for that visit, so choosing a visit that already has
 * one simply goes to it.
 */
export default function NewConversationPage() {
  return (
    <>
      <p className="prx-back"><a href="/talk">← Conversations</a></p>
      <Screen title="Message your care team" path="/patient/encounters" empty="There are no visits to message about yet.">
        {(rows) => <StartConversation encounters={rows} />}
      </Screen>
    </>
  );
}
