'use client';

import { useEffect, useRef } from 'react';
import LocalSupportOptions from './LocalSupportOptions';

export default function CoachSupportDialog({ feedback, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="coach-support-dialog" aria-labelledby="safety-support-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="coach-support-content">
      <h2 id="safety-support-title">{feedback.title}</h2>
      <LocalSupportOptions />
      <p className="coach-support-message">{feedback.message}</p>
      {feedback.contacts?.length > 0 && <div className="coach-support-contacts" role="group" aria-label="Philippines support contacts">
        {feedback.contacts.map(contact => <a key={contact.href} href={contact.href}>{contact.label}</a>)}
      </div>}
      <footer><button type="button" className="btn-secondary" onClick={onClose}>Close</button></footer>
    </div>
  </dialog>;
}
