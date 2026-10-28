/** Small segmented control: FR | EN, Protein Tracker | WWF FG1, List | Matrix, 2028 | 2030. */
export function Segmented<T extends string | number>({ options, value, onChange, label, size = "md", tour }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; size?: "sm" | "md"; tour?: string }) {
  return (
    <div className={`seg seg-${size}`} role="group" aria-label={label} data-tour={tour}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
