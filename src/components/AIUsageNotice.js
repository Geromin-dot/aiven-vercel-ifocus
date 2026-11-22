'use client';

import { useEffect, useState } from 'react';

export default function AIUsageNotice({ feature }) {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/ai/usage', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.usage?.[feature]) setUsage(data.usage[feature]);
      } catch {}
    };
    load();
    window.addEventListener('ifocus_ai_usage_updated', load);
    return () => { active = false; window.removeEventListener('ifocus_ai_usage_updated', load); };
  }, [feature]);
  const limit = feature === 'reflection' ? 10 : 3;
  const label = `${usage?.remaining ?? '–'}/${usage?.limit ?? limit}`;
  return <span className="ai-usage-notice" role="status" aria-label={`${label} AI requests remaining today`}
    title="Daily AI requests remaining · resets at midnight, Philippine time">{label}</span>;
}
