export const IFOCUS_SUPPORT_EMAIL = 'grv_manese.student@ua.edu.ph';

export function feedbackEmailLink(topic, message, sender = {}) {
  const subject = `iFocus – ${topic}`;
  const replyDetails = [sender.name && `Name: ${sender.name}`, sender.email && `Email: ${sender.email}`].filter(Boolean);
  const body = [message.trim(), ...(replyDetails.length ? ['', ...replyDetails] : [])].join('\r\n');
  return `mailto:${IFOCUS_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
