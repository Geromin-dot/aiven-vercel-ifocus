import { GENDER_IDENTITIES } from '@/lib/genderIdentity';

export default function GenderIdentityField({ id = 'gender-identity', value, onChange }) {
  return <div className="gender-identity-field">
    <label htmlFor={id}>Gender identity</label>
    <select id={id} name="genderIdentity" value={value} onChange={onChange} defaultValue={value === undefined ? '' : undefined} required>
      <option value="" disabled>Select an option</option>
      {GENDER_IDENTITIES.map(identity => <option key={identity} value={identity}>{identity}</option>)}
    </select>
    <small>Your selection is saved once and cannot be changed. You may choose “Prefer not to say.”</small>
  </div>;
}
