import { redirect } from "next/navigation";

export default function PlayerStatsIndexPage() {
  redirect("/dashboards/player-stats/summary");
}
