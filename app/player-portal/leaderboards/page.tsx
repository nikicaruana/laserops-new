import { redirect } from "next/navigation";

export default function LeaderboardsIndexPage() {
  redirect("/player-portal/leaderboards/all-time");
}
