type Values = {
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

type Props = {
  errors: Partial<Record<keyof Values, string>>
  defaults?: Values
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : <span className="muted"> (اختياري)</span>}
      </label>
      {children}
      {error ? (
        <div className="field-error" id={`${id}-error`} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Shared fields for the create and edit customer forms.
 */
export function CustomerFormFields({ errors, defaults = {} }: Props) {
  const describedBy = (key: keyof Values) => (errors[key] ? `${key}-error` : undefined)
  return (
    <>
      <Field id="name" label="الاسم" error={errors.name} required>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={defaults.name ?? ''}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name')}
        />
      </Field>
      <Field id="email" label="البريد الإلكتروني" error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          maxLength={254}
          defaultValue={defaults.email ?? ''}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email')}
        />
      </Field>
      <Field id="phone" label="الهاتف" error={errors.phone}>
        <input
          id="phone"
          name="phone"
          type="tel"
          dir="ltr"
          maxLength={20}
          defaultValue={defaults.phone ?? ''}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={describedBy('phone')}
        />
      </Field>
      <Field id="address" label="العنوان" error={errors.address}>
        <textarea
          id="address"
          name="address"
          rows={3}
          maxLength={500}
          defaultValue={defaults.address ?? ''}
          aria-invalid={errors.address ? true : undefined}
          aria-describedby={describedBy('address')}
        />
      </Field>
    </>
  )
}
