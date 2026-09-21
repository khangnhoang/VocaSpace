export function confirmPublishedTopicMutation(action: string) {
  if (typeof window === "undefined") return false;

  return window.confirm(
    `Bài học đã xuất bản. ${action} sẽ chuyển bài học về bản nháp để cập nhật lại nội dung. Bạn có muốn tiếp tục không?`,
  );
}
