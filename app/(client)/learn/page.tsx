import { redirect } from "next/navigation";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import { SIGN_IN_REQUIRED_LOGIN_PATH } from "@/lib/auth/sign-in-reason";
import LearnDashboardClient from "./_components/LearnDashboardClient";

export default async function LearnDashboardPage() {
  const result = await getLearnDashboard();
  if (!result.success && result.errorCode === "AUTH_REQUIRED") {
    redirect(SIGN_IN_REQUIRED_LOGIN_PATH);
  }

  return <LearnDashboardClient result={result} />;
}
