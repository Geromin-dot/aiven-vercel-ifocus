export const IFOCUS_SUPPORT_EMAIL = 'grv_manese.student@ua.edu.ph';
export const MAX_FEEDBACK_LENGTH = 4000;
export const FEEDBACK_CATEGORIES = [
  { id: 'feedback', label: 'Feature Request' },
  { id: 'bug', label: 'Bug Report' },
  { id: 'ui', label: 'Design Suggestion' },
  { id: 'question', label: 'General Inquiry' },
];

export const CONTACT_TOPICS = [
  { id: 'general', label: 'General Feedback' },
  { id: 'breakgate', label: 'BreakGate™ Algorithm Suggestion' },
  { id: 'flashcards', label: 'Flashcard Deck Feature' },
  { id: 'research', label: 'UA Academic Research Inquiry' },
  { id: 'bug', label: 'Bug Report' },
];

export async function sendFeedback(payload) {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.sent) {
    throw new Error(result?.error || 'Your message could not be sent. Please try again.');
  }
}
