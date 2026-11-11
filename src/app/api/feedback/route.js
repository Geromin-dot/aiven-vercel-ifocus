import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { CONTACT_TOPICS, FEEDBACK_CATEGORIES, IFOCUS_SUPPORT_EMAIL, MAX_FEEDBACK_LENGTH } from '@/lib/feedbackEmail';

const emailPattern = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const isContact = body?.source === 'contact';
  const categories = isContact ? CONTACT_TOPICS : FEEDBACK_CATEGORIES;
  const category = categories.find(({ id }) => id === body?.category);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!category || !message || message.length > MAX_FEEDBACK_LENGTH) {
    return Response.json({ error: `Choose a category and write a message of up to ${MAX_FEEDBACK_LENGTH} characters.` }, { status: 400 });
  }

  let name;
  let email;
  if (isContact) {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    email = typeof body.email === 'string' ? body.email.trim() : '';
    if (body.website || request.headers.get('sec-fetch-site') === 'cross-site' ||
        !name || name.length > 120 || email.length > 254 || !emailPattern.test(email)) {
      return Response.json({ error: 'Check your name and email address before sending.' }, { status: 400 });
    }
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.error) {
      return Response.json({ error: 'Please sign in to send feedback.' }, { status: 401 });
    }
    ({ name, email } = session.user);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: 'Direct sending is unavailable. You can use the support email link above.' }, { status: 503 });
  }

  const replyTo = emailPattern.test(email || '') ? email : undefined;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM_EMAIL?.trim() || 'iFocus <onboarding@resend.dev>',
        to: [IFOCUS_SUPPORT_EMAIL],
        subject: `iFocus – ${category.label}`,
        text: `${message}\n\nFrom: ${name || 'iFocus user'}${replyTo ? `\nEmail: ${replyTo}` : ''}`,
        reply_to: replyTo,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok && (await response.json()).id) return Response.json({ sent: true });
    console.warn('Feedback email rejected by provider', { status: response.status });
  } catch (error) {
    console.warn('Feedback email request failed', { type: error.name });
  }
  return Response.json({ error: 'Feedback could not be sent. Try again or use the support email link above.' }, { status: 502 });
}
