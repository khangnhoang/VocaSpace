// File: lib/schemas/topic.ts
import { z } from "zod";

// 1. SCHEMA TĨNH CHO BACKEND (Chỉ check kiểu dữ liệu cơ bản)
export const topicSchema = z.object({
  title: z
    .string()
    .min(4, { message: "Tên bài học phải dài hơn 3 ký tự" }),
  order_index: z.coerce
    .number({ message: "Vui lòng nhập số" }),
  status: z.enum(["draft", "pending", "published"], {
    message: "Vui lòng chọn trạng thái",
  }),
});

// 2. SCHEMA ĐỘNG CHO FRONTEND (Kế thừa Schema tĩnh, thêm logic check maxOrder)
export const createTopicSchema = (maxOrder: number) => 
  topicSchema.extend({
    order_index: z.coerce
      .number({ message: "Vui lòng nhập số" })
      .min(maxOrder + 1, { message: `Số thứ tự phải lớn hơn ${maxOrder}` }),
  });

export type TopicFormValues = z.infer<typeof topicSchema>;