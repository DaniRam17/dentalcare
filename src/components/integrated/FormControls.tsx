import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  children: ReactNode;
};

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
};

export function Field({ label, children }: FieldProps) {
  return <div className="space-y-1"><label className="text-sm font-medium text-zinc-700">{label}</label>{children}</div>;
}

export function SelectField({ label, value, onChange, options, required = true }: SelectFieldProps) {
  return (
    <Field label={label}>
      <select required={required} className="w-full p-2 border rounded-lg" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seleccionar...</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}
