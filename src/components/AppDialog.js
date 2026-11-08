"use client";

import { useEffect, useRef } from 'react';
import styles from './AppDialog.module.css';

export default function AppDialog({ titleId, onDismiss, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onDismiss(); }}>
      {children}
    </dialog>
  );
}
