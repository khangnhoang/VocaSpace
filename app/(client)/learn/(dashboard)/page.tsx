import { redirect } from "next/navigation";
import { getLearnDashboard } from "@/app/actions/learn-dashboard";
import { getLearningSummary } from "@/app/actions/learning-activity";
import { SIGN_IN_REQUIRED_LOGIN_PATH } from "@/lib/auth/sign-in-reason";
import LearnDashboardClient from "../_components/LearnDashboardClient";

export default async function LearnDashboardPage() {
  // Chuỗi ngày học đọc song song và không bao giờ throw: lỗi chỉ làm thẻ của nó hiện trạng thái chưa tải được (AC10).
  const [result, learningSummary] = await Promise.all([getLearnDashboard(), getLearningSummary()]);
  if (!result.success && result.errorCode === "AUTH_REQUIRED") {
    redirect(SIGN_IN_REQUIRED_LOGIN_PATH);
  }

  return <LearnDashboardClient result={result} learningSummary={learningSummary} />;
}
