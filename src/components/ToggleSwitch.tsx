export function ToggleSwitch({
  checked,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-white" : "bg-[#333]"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-4 bg-black" : "translate-x-0 bg-white"
        }`}
      />
    </button>
  );
}
