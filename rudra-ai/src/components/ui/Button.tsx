import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] " +
  "transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rudra-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none " +
  "active:scale-[0.97] select-none";

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px] leading-none",
  md: "px-4 py-2 text-[13px]",
  lg: "px-5 py-2.5 text-[14px]",
};

const variants: Record<Variant, string> = {
  primary:
    "text-white border border-transparent shadow-sm " +
    "hover:shadow-md hover:-translate-y-[1px] hover:brightness-[1.05] " +
    "active:translate-y-0 active:shadow-sm",
  ghost:
    "bg-transparent text-[var(--fg)] border border-[var(--border)] " +
    "hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] hover:-translate-y-[0.5px] " +
    "active:translate-y-0",
  subtle:
    "bg-[var(--surface)] text-[var(--fg)] border border-transparent " +
    "hover:bg-[var(--surface-active)] hover:border-[var(--border)]",
  danger:
    "bg-transparent text-[var(--danger)] border border-[var(--danger)]/50 " +
    "hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)] hover:shadow-sm",
};

const variantStyle: Record<Variant, string> = {
  primary: "background: var(--rudra-gradient);",
  ghost: "",
  subtle: "",
  danger: "",
};

/** Rich RUDRA button with hover lift, glow and press feedback. */
export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "size", "loading", "style", "children", "disabled"]);
  const v = () => local.variant ?? "ghost";
  const s = () => local.size ?? "md";
  return (
    <button
      {...rest}
      disabled={local.disabled || local.loading}
      style={`${variantStyle[v()]}${local.style ?? ""}`}
      class={`${base} ${sizes[s()]} ${variants[v()]}`}
    >
      <Show when={local.loading}>
        <span
          style="width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;display:inline-block;animation:rudra-spin 0.6s linear infinite"
          aria-hidden="true"
        />
      </Show>
      {local.children}
    </button>
  );
}
