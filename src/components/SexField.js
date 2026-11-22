import { SEX_OPTIONS } from '@/lib/sex';

export default function SexField({ id = 'sex', value, onChange }) {
  return <fieldset className="sex-field">
    <legend>Sex</legend>
    <div className="sex-options">
      {SEX_OPTIONS.map(option => <label key={option} htmlFor={`${id}-${option.toLowerCase()}`}>
        <input id={`${id}-${option.toLowerCase()}`} type="radio" name="sex" value={option}
          checked={value === undefined ? undefined : value === option} onChange={onChange} required />
        <span>{option}</span>
      </label>)}
    </div>
    <small>Check before saving. Your selection cannot be changed.</small>
  </fieldset>;
}
