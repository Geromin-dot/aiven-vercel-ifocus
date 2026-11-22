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
  return <p className="ai-usage-notice" role="status">
    {usage ? `${usage.remaining} of ${usage.limit} AI requests remaining today.` : `Daily allowance: ${limit} AI requests.`}
    {' '}Resets at midnight, Philippine time. Submitted AI requests count toward the allowance.
  </p>;
}
