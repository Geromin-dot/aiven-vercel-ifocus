export function detectDeviceType(userAgent = '', mobileHint = '', touchPoints = 0) {
  if (mobileHint === '?1' || /android|iphone|ipad|ipod|mobile|tablet/i.test(userAgent)
    || (/macintosh/i.test(userAgent) && touchPoints > 1)) return 'mobile';
  if (/windows|macintosh|x11|cros|linux/i.test(userAgent)) return 'pc';
  return 'unknown';
}

export function browserDeviceType() {
  if (typeof navigator === 'undefined') return 'unknown';
  return detectDeviceType(navigator.userAgent, navigator.userAgentData?.mobile ? '?1' : '', navigator.maxTouchPoints);
}

export function summarizeDevices(sessions) {
  const totals = { pc: { count: 0, minutes: 0 }, mobile: { count: 0, minutes: 0 }, unknown: { count: 0, minutes: 0 } };
  for (const session of sessions) {
    if (session.verification === 'pending') continue;
    const type = ['pc', 'mobile'].includes(session.deviceType) ? session.deviceType : 'unknown';
    totals[type].count++;
    totals[type].minutes += Math.max(0, Number(session.durationSeconds ?? Number(session.duration) * 60) || 0) / 60;
  }
  return totals;
}
