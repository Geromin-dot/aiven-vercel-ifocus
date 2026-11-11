export const AI_VERIFICATION_MESSAGE = 'Your account must be verified by the College Dean’s Office before you can use AI features.';

export function canUseStudyAI(user) {
  return user?.verificationStatus === 'VERIFIED';
}
