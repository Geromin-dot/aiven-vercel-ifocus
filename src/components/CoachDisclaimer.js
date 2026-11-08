"use client";

import { useId, useState } from 'react';
import AppDialog from './AppDialog';

export default function CoachDisclaimer() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button type="button" className="coach-disclaimer-button" aria-label="Disclaimer for AI Coach" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Disclaimer
      </button>
      {open && (
        <AppDialog titleId={titleId} onDismiss={() => setOpen(false)}>
          <h2 id={titleId}>About AI Coach</h2>
          <p><strong>Your AI study buddy.</strong> AI Coach can help you plan a study session, break down school tasks, and try techniques such as self-testing and spaced review.</p>
          <p>AI estimates and suggestions can be incomplete or mistaken. Review each suggestion and dismiss it if it does not fit your needs. You decide which strategies to apply.</p>
          <p><strong>For health and well-being.</strong> Rely on qualified healthcare or mental health professionals for advice, diagnosis, treatment, and ongoing care. If you need urgent help, contact your local emergency services.</p>
          <footer><button type="button" className="btn-primary" onClick={() => setOpen(false)}>Got it</button></footer>
        </AppDialog>
      )}
    </>
  );
}
