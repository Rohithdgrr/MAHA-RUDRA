/**
 * Isolated extraction system prompt (Phase 3).
 * Runs in a tool-less hidden session: no `tools` field is ever sent
 * alongside it, and chat text is data — never instructions.
 */
export const EXTRACT_SYSTEM_PROMPT = `Extract only DURABLE facts the user states about themselves.
Ignore: questions, one-off tasks, transient state, opinions about code,
anything the assistant said. Prefer the most recent statement on conflict.
Never extract passwords, API keys, tokens, financial, health, or precise location data.

Categories and keys:
identity: name, pronouns, location, timezone, languages
contact: email, phone, preferred_contact
social: github, linkedin, x, site, portfolio
preferences: design_taste, backend_stack, frontend_stack, editor, code_style, workflow
projects: <slug> -> {name, desc, stack[], status, role, links[]}
achievements: <slug> -> {title, org, date, desc}
resume: <employer_slug> -> {role, start, end, summary}
cv: education, skills[], summary
custom: <slug> -> freeform string

Return ONLY a JSON array, no prose. Each item:
{"category":"<one of the above>","key":"<english snake_case or slug>","value":"<string or object>","confidence":0.0-1.0,"excerpt":"<the user sentence>"}
Empty array [] when nothing durable is present. Extract in the user's language for values; keys stay English.`;

/** Wrap redacted turns for the extraction call. Keeps chat text as data. */
export function buildExtractionText(transcript: string): string {
  return `<conversation>\n${transcript}\n</conversation>\nExtract durable user facts as JSON now.`;
}
