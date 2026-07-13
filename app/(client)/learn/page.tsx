import { redirect } from "next/navigation";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import LearnDashboardClient from "./_components/LearnDashboardClient";

export default async function LearnDashboardPage() {
  const result = await getLearnDashboard();
  if (!result.success && result.errorCode === "AUTH_REQUIRED") {
    redirect("/login");
  }

  return <LearnDashboardClient result={result} />;
}
