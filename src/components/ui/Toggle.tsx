interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}

/** iOS-style switch. Controlled: parent owns `checked`. */
export function Toggle(props: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label ?? "Toggle"}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      style={`position:relative;width:40px;height:22px;border-radius:999px;border:none;cursor:pointer;flex-shrink:0;transition:background var(--transition-fast);background:${props.checked ? "var(--rudra-orange)" : "var(--border)"};${props.disabled ? "opacity:0.5;cursor:not-allowed;" : ""}`}
    >
      <span
        style={`position:absolute;top:2px;left:${props.checked ? "20px" : "2px"};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:left var(--transition-fast)`}
      />
    </button>
  );
}
