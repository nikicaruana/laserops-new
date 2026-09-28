/**
 * lib/match-time.ts
 * --------------------------------------------------------------------
 * Format a match's date + time range (Malta time) for notifications/emails.
 * Games have a fixed duration (matches.duration_minutes, default 180 = 3h), so
 * the end time is scheduled_at + that. Players never pick it; admins can raise it
 * for longer events. Used to fill the {{matchDate}} / {{matchTimeRange}} tokens.
 */
const TZ = "Europe/Malta";
export const DEFAULT_DURATION_MIN = 180;

export function matchDateLabel(scheduledAt: string | Date): string {
  return new Date(scheduledAt).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
export function matchTimeLabel(scheduledAt: string | Date): string {
  return new Date(scheduledAt).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}
export function matchTimeRangeLabel(scheduledAt: string | Date, durationMin: number | null | undefined = DEFAULT_DURATION_MIN): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + (durationMin || DEFAULT_DURATION_MIN) * 60000);
  return `${matchTimeLabel(start)} – ${matchTimeLabel(end)}`; // en dash range (allowed for timeframes)
}
