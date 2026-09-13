import { notFound, redirect } from 'next/navigation';

import Thread from '@/components/talk/Thread';
import Reference from '@/components/ui/Reference';
import { adminFetch } from '@/lib/adminApi';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F-]{36}$/;

/**
 * One conversation. The first page is read here, server-side (newest first from
 * the provider, reversed for reading); new messages are polled by Thread.
 * The provider answers 404 both for a conversation that doesn't exist and for
 * one this patient isn't part of.
 */
export default async function ConversationPage({ params }) {
  const { id } = await params;

  if (!UUID.test(id)) notFound();

  const [page, list] = await Promise.all([
    adminFetch(`/patient/conversations/${id}/messages?per_page=50`),
    adminFetch('/patient/conversations').catch(() => null),
  ]);

  if (page.status === 401) redirect('/login');
  if (page.status === 403 && page.code === 'two_factor_setup_required') redirect('/record/security?required=1');

  if (page.status === 404) {
    return (
      <>
        <p className="prx-back"><a href="/talk">← Conversations</a></p>
        <h1>Conversation not found</h1>
        <p className="prx-muted">This conversation isn&rsquo;t available.</p>
      </>
    );
  }

  if (!page.ok) {
    return (
      <>
        <p className="prx-back"><a href="/talk">← Conversations</a></p>
        <h1>Messages</h1>
        <p className="prx-muted">We can&rsquo;t load these messages right now. Please try again in a moment.</p>
        {page.status >= 500 ? <Reference id={page.requestId} /> : null}
      </>
    );
  }

  const messages = (Array.isArray(page.data) ? page.data : []).slice().reverse();
  const subject = (Array.isArray(list?.data) ? list.data : []).find((c) => c.id === id)?.subject;
  // The newest message id is the cursor. An empty thread starts from "now"
  // (a second early, since a time cursor is strict and second-granular).
  const initialCursor = messages.at(-1)?.id ?? new Date(Date.now() - 1000).toISOString();

  return (
    <>
      <p className="prx-back"><a href="/talk">← Conversations</a></p>
      <h1>{subject ?? 'Messages'}</h1>
      <Thread conversationId={id} initialMessages={messages} initialCursor={initialCursor} />
    </>
  );
}
