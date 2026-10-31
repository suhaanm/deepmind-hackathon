import { useId, type ReactElement } from 'react'

export interface SwitchProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Switch({ label, hint, checked, onChange, disabled }: SwitchProps): ReactElement {
  const id = useId()
  return (
    <label className="al-switch" htmlFor={id}>
      <span className="al-switch__text">
        <span className="al-switch__label">{label}</span>
        {hint ? <span className="al-switch__hint">{hint}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="al-switch__track" aria-hidden="true">
        <span className="al-switch__thumb" />
      </span>
    </label>
  )
}

export interface SegmentedProps<T extends string | number> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>): ReactElement {
  return (
    <div className="al-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className="al-seg__btn" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
