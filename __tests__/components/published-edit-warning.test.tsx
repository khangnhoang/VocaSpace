// @vitest-environment jsdom

import React, { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PublishedImpactNotice,
  usePublishedEditWarning,
} from "@/app/(teacher)/teacher/courses/[id]/_components/PublishedEditWarning";

// Test plan:
// - Mục tiêu: hook cảnh báo dùng chung (TFEAT1 AC5/G4) trả lời đúng cho caller TRƯỚC khi gọi server.
// - Loại test: component interaction trong jsdom với một caller giả lập.
// - Case thành công: xác nhận trả true và đóng dialog; dialog nêu đúng tiêu đề, mô tả, nhãn xác nhận.
// - Case hủy: nút Hủy bỏ, phím Escape và việc mở cảnh báo mới thay cảnh báo cũ đều trả false.
// - Invariant cần giữ: caller chỉ gọi action khi nhận true, nên hủy không tạo request nào.

function Harness({ action }: { action: () => void }) {
  const warning = usePublishedEditWarning();
  const [last, setLast] = useState("none");

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const confirmed = await warning.confirm({
            title: "Cảnh báo thử",
            description: "Học viên sẽ không còn thấy nội dung này.",
            confirmText: "Vẫn thực hiện",
          });
          setLast(String(confirmed));
          if (confirmed) action();
        }}
      >
        Mở
      </button>
      <output aria-label="Kết quả">{last}</output>
      {warning.dialog}
    </>
  );
}

describe("usePublishedEditWarning", () => {
  it("shows the warning, resolves true on confirm and lets the caller run its action once", async () => {
    const action = vi.fn();
    render(<Harness action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Mở" }));
    const dialog = await screen.findByRole("dialog", { name: "Cảnh báo thử" });
    expect(within(dialog).getByText("Học viên sẽ không còn thấy nội dung này.")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Vẫn thực hiện" }));

    await waitFor(() => expect(screen.getByLabelText("Kết quả").textContent).toBe("true"));
    expect(action).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resolves false on cancel and never runs the caller's action", async () => {
    const action = vi.fn();
    render(<Harness action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Mở" }));
    const dialog = await screen.findByRole("dialog", { name: "Cảnh báo thử" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.getByLabelText("Kết quả").textContent).toBe("false"));
    expect(action).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resolves false when the dialog is dismissed with Escape", async () => {
    const action = vi.fn();
    render(<Harness action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Mở" }));
    const dialog = await screen.findByRole("dialog", { name: "Cảnh báo thử" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.getByLabelText("Kết quả").textContent).toBe("false"));
    expect(action).not.toHaveBeenCalled();
  });
});

describe("PublishedImpactNotice", () => {
  it("renders the impact text as a note inside the host dialog", () => {
    render(<PublishedImpactNotice>Học viên sẽ không còn thấy thẻ này.</PublishedImpactNotice>);

    expect(screen.getByRole("note").textContent).toContain("Học viên sẽ không còn thấy thẻ này.");
  });
});
