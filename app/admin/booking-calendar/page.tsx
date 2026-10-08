/**
 * app/admin/booking-calendar/page.tsx
 * --------------------------------------------------------------------
 * The booking availability master calendar. Admins set the weekly hours, override
 * specific dates, and black out ranges (e.g. away time). Player bookings outside
 * the available windows are blocked by is_booking_open, and the games calendar on
 * the player side reflects this availability.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { BookingCalendarManager } from "@/components/admin/BookingCalendarManager";

export const metadata: Metadata = { title: "Booking calendar" };

type Weekly = { season_id: string; weekday: number; is_open: boolean; open_time: string; close_time: string };
type Season = { id: string; name: string; start_month: number | null; start_day: number | null; end_month: number | null; end_day: number | null; is_default: boolean };

export default async function BookingCalendarPage() {
  const supabase = await createClient();
  const [{ data: seasonRows }, { data: weeklyRows }] = await Promise.all([
    supabase.from("booking_seasons").select("id, name, start_month, start_day, end_month, end_day, is_default").order("is_default", { ascending: false }).order("start_month").order("start_day"),
    supabase.from("booking_weekly_hours").select("season_id, weekday, is_open, open_time, close_time").order("weekday"),
  ]);
  const seasons = (seasonRows ?? []) as Season[];
  const weekly = (weeklyRows ?? []) as Weekly[];

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Booking calendar</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Control when games can be booked. Set weekly hours per season, override individual dates, or black out a range
          while you&apos;re away. The start time is the earliest a game can begin and the end time is the latest it can start.
          Players can only book inside these windows.
        </p>
      </header>

      <BookingCalendarManager initialSeasons={seasons} initialWeekly={weekly} />
    </div>
  );
}
