// Tìm không phân biệt hoa thường và dấu tiếng Việt, để gõ "dam phan" vẫn ra "đàm phán".
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function matchesSearch(query: string, values: (string | null | undefined)[]) {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  return values.some((value) => value && normalizeSearchText(value).includes(needle));
}
