export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative mb-1 h-8 overflow-hidden rounded-lg bg-panel">
      <div
        className="absolute inset-y-0 left-0 bg-[#2a2a2a]"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute bottom-0 top-0 w-px bg-white"
        style={{ left: `${pct}%` }}
      />
      <div className="relative flex h-full items-center justify-between px-2.5 text-[13px]">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={label}
      />
    </div>
  );
}
