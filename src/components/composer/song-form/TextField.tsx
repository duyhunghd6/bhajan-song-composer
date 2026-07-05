interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

export function TextField({ id, label, value, onChange, required = false, className = "" }: TextFieldProps) {
  return (
    <label className={`block space-y-1.5 ${className}`} htmlFor={id}>
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-zinc-400"
      />
    </label>
  );
}
