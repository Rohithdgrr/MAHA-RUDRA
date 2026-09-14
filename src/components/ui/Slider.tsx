interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Range slider with orange accent. Controlled: parent owns `value`.
 * Markers / threshold badges are rendered by the caller.
 */
export function Slider(props: SliderProps) {
  return (
    <input
      type="range"
      aria-label={props.label ?? "Slider"}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      value={props.value}
      disabled={props.disabled}
      onInput={(e) => props.onChange(Number(e.currentTarget.value))}
      style="width:100%;height:6px;border-radius:999px;background:var(--border);outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;accent-color:var(--rudra-orange)"
    />
  );
}
