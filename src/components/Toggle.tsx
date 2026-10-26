/** Switch for a lever's active state. */
export function Toggle({ on, onChange, label, small }: { on: boolean; onChange: (on: boolean) => void; label: string; small?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} className={`switch ${on ? "on" : ""} ${small ? "sm" : ""}`}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}>
      <i />
    </button>
  );
}
