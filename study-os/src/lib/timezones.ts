// Timezones offered in Settings — the IANA names most likely to matter for
// a German-learner audience plus UTC. `Intl.supportedValuesOf` would give
// the exhaustive list, but a short curated list keeps the settings UI
// usable rather than a 400-item dropdown.
//
// Plain data, not a Server Action: a "use server" file may only export
// async functions, so this lives here and is imported by both the action
// (for validation) and the client form (to render the <select>).
export const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Istanbul",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tehran",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;
