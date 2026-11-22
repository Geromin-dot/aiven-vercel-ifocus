export const GENDER_IDENTITIES = ['Woman', 'Man', 'Non-binary', 'Another identity', 'Prefer not to say'];

export function isGenderIdentity(value) {
  return GENDER_IDENTITIES.includes(value);
}
