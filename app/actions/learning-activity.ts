"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import {
  courseLearningSummarySchema,
  overallLearningSummarySchema,
  type CourseLearningSummaryResult,
  type OverallLearningSummaryResult,
} from "@/lib/schemas/learning-activity";

// Thông báo theo ngôn ngữ của request; mọi nơi gọi là trang server (hook client chỉ giữ kết quả thành công) nên không cần wrapper (U3 H3).
const unavailable = async () => ({
  success: false as const,
  error: (await getTranslations("learn"))("actions.summary.unavailable"),
});

// Người gọi luôn là chính học viên: RPC chỉ nhận auth.uid() nên không có tham số người dùng nào để giả mạo (FEAT3 G4).
// Mọi lỗi (RPC chưa có trên DB, mạng, JSON lạ, chưa đăng nhập) đều thành kết quả "chưa tải được" và không bao giờ throw,
// để không trang nào bị chặn bởi khối này (AC10).
async function callSummary(args: { p_course_id?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feat3_learning_summary", args);
  if (error) {
    console.error("Learning summary RPC failed", error);
    return null;
  }
  return data;
}

export async function getLearningSummary(): Promise<OverallLearningSummaryResult> {
  try {
    const raw = await callSummary({});
    const parsed = overallLearningSummarySchema.safeParse(raw);
    if (!parsed.success) {
      if (raw !== null) console.error("Learning summary contract drift", parsed.error.issues);
      return unavailable();
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    console.error("Learning summary unexpected failure", error);
    return unavailable();
  }
}

export async function getCourseLearningSummary(courseId: string): Promise<CourseLearningSummaryResult> {
  const id = z.uuid().safeParse(courseId);
  if (!id.success) return unavailable();

  try {
    const raw = await callSummary({ p_course_id: id.data });
    const parsed = courseLearningSummarySchema.safeParse(raw);
    if (!parsed.success) {
      if (raw !== null) console.error("Course learning summary contract drift", parsed.error.issues);
      return unavailable();
    }
    return { success: true, data: parsed.data };
  } catch (error) {
    console.error("Course learning summary unexpected failure", error);
    return unavailable();
  }
}
