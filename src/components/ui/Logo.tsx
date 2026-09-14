import { strings } from "../../lib/i18n/en";

/** Stylized trident-meets-bolt mark. CSS vars only, no hardcoded palette. */
export function Logo() {
  return (
    <span style="display:inline-flex;align-items:center;gap:10px">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <path
          d="M14 2 L17 12 L14 14 L11 12 Z"
          fill="var(--rudra-orange)"
        />
        <path
          d="M6 4 L9 4 L8 12 L13 13 L8 26 L10 14 L5 13 Z"
          fill="var(--rudra-orange)"
          opacity="0.85"
        />
        <path
          d="M22 4 L19 4 L20 12 L15 13 L20 26 L18 14 L23 13 Z"
          fill="var(--rudra-orange)"
          opacity="0.85"
        />
      </svg>
      <span style="display:flex;flex-direction:column;line-height:1.1">
        <strong style="letter-spacing:0.12em;font-size:15px">{strings.appName}</strong>
        <small style="color:var(--muted);font-size:11px">{strings.tagline}</small>
      </span>
    </span>
  );
}
