'use client';

export default function StudyCycleButtons({ value, onChange }) {
  return <fieldset className="study-cycle-picker">
    <legend>Study cycles</legend>
    <div role="group" aria-label="Study cycles">
      {[1, 2, 3, 4, 5].map(count => <button key={count} type="button" aria-pressed={Number(value) === count}
        onClick={() => onChange(count)}>{count}</button>)}
    </div>
  </fieldset>;
}
