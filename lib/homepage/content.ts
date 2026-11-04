// Nội dung trang chủ do Owner cung cấp. Hai danh sách thật để trống cho tới khi có dữ liệu thật: trang chủ ẩn khối tương ứng
// thay vì hiện đánh giá hay link mạng xã hội bịa (U1 G1). Khi thêm đánh giá thật, cùng PR phải cập nhật /privacy vì đó là
// dữ liệu học viên hiện cho người khác xem (U1 G2, AGENTS.md).

export type HomeTestimonial = {
  id: string;
  quote: string;
  name: string;
  courseTitle: string;
  /** Chỉ điền khi lấy từ dữ liệu học thật của chính học viên đó, ví dụ "Đã ôn 1.180 thẻ trong 42 ngày". */
  proof?: string;
};

export type HomeSocialNetwork = "facebook" | "youtube" | "instagram";

export type HomeSocialLink = {
  network: HomeSocialNetwork;
  href: string;
};

export type HomeContent = {
  testimonials: readonly HomeTestimonial[];
  socialLinks: readonly HomeSocialLink[];
};

export const HOME_TESTIMONIALS: readonly HomeTestimonial[] = [];

export const HOME_SOCIAL_LINKS: readonly HomeSocialLink[] = [];

// Nội dung mẫu chỉ để xem bố cục đầy đủ khi chạy local; người và số liệu dưới đây không có thật.
const SAMPLE_CONTENT: HomeContent = {
  testimonials: [
    {
      id: "sample-1",
      quote:
        "Trước mình học từ theo danh sách rồi quên gần hết sau một tuần. Giờ mỗi ngày chỉ ôn những thẻ đến hạn, khoảng 15 phút là xong.",
      name: "Minh Anh",
      courseTitle: "TOEIC 600: từ vựng cốt lõi",
      proof: "Đã ôn 1.180 thẻ trong 42 ngày",
    },
    {
      id: "sample-2",
      quote:
        "Phần tự đánh giá Lại, Khó, Ổn, Dễ giúp mình thật thà với bản thân. Từ nào chưa chắc thì nó quay lại sớm, không bị bỏ sót.",
      name: "Quốc Huy",
      courseTitle: "IELTS Academic Word List",
      proof: "Đã ôn 2.430 thẻ trong 75 ngày",
    },
    {
      id: "sample-3",
      quote: "Mình thích câu ví dụ trong từng thẻ, học xong là biết dùng từ trong email công việc luôn.",
      name: "Thu Linh",
      courseTitle: "Tiếng Anh văn phòng",
    },
  ],
  socialLinks: [
    { network: "facebook", href: "https://www.facebook.com/" },
    { network: "youtube", href: "https://www.youtube.com/" },
    { network: "instagram", href: "https://www.instagram.com/" },
  ],
};

/**
 * Trả nội dung mẫu chỉ khi chạy ngoài production và bật `HOME_SAMPLE_CONTENT=1`; build production luôn nhận nội dung thật,
 * nên quên tắt biến môi trường cũng không làm lộ đánh giá giả (U1 G1).
 */
export function getHomeContent(env: Partial<Record<string, string>> = process.env): HomeContent {
  if (env.NODE_ENV !== "production" && env.HOME_SAMPLE_CONTENT === "1") return SAMPLE_CONTENT;
  return { testimonials: HOME_TESTIMONIALS, socialLinks: HOME_SOCIAL_LINKS };
}
