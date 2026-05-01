import { redirect } from "next/navigation";

export default function LeaderboardsIndexPage() {
  redirect("/dashboards/leaderboards/all-time");
}
