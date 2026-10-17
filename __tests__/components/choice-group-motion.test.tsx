/**
 * @vitest-environment jsdom
 */

import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChoiceGroup, {
  type ChoiceResult,
} from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/ChoiceGroup";

// Test plan:
// - LF9 Owner QA: từng đáp án còn mở có trong thứ tự Tab kể cả sau khi chọn; phím mũi tên vẫn đổi lựa chọn/focus; đáp án đã khóa không tương tác.
// - Mục tiêu: bảo vệ chuyển động phản hồi đáp án sai (corrective) của ChoiceGroup, dùng chung cho bài tập, memory check và Preview; đáp án đúng chỉ đổi trạng thái, không có chuyển động hay thanh viền trái.
// - Loại test: component test trong jsdom; jsdom không chạy CSS animation nên kiểm tra dấu hiệu kích hoạt `data-motion` và hợp đồng CSS.
// - Case thành công: đáp án sai gắn `corrective` chỉ trên lựa chọn đã chấm, đáp án đúng không gắn gì; trạng thái vẫn có biểu tượng và chữ cho trình đọc màn hình.
// - Một lần mỗi lượt chấm: mount sẵn ở trạng thái đã chấm (xem lại câu) không chạy; render lại không đổi; "Thử lại" gỡ dấu hiệu rồi lượt chấm mới chạy lại.
// - Reduced motion: hoạt ảnh chỉ áp qua `motion-safe:`; keyframes `corrective` là chuyển ngang duy nhất và nằm trong globals.css.
// - Kết quả verify LF9 hiện hành: xem State trong docs/programs/student-user-flow-route/progress.md; kiểm tra file bằng `npx vitest run __tests__/components/choice-group-motion.test.tsx`.

const options = [
  { id: "o1", content: "Đáp án một", label: "A", order_index: 1 },
  { id: "o2", content: "Đáp án hai", label: "B", order_index: 2 },
];

function group(selectedId: string | null, result: ChoiceResult | null) {
  return (
    <>
      <p id="q">Câu hỏi</p>
      <ChoiceGroup
        options={options}
        selectedId={selectedId}
        result={result}
        disabled={result !== null}
        onSelect={() => {}}
        labelledBy="q"
      />
    </>
  );
}

const motionOf = (name: RegExp) => screen.getByRole("radio", { name }).getAttribute("data-motion");

describe("ChoiceGroup answer motion", () => {
  it("keeps every enabled answer in the Tab order before and after selection", () => {
    const { rerender } = render(group(null, null));
    expect(screen.getAllByRole("radio").map((option) => option.tabIndex)).toEqual([0, 0]);
    rerender(group("o2", null));
    expect(screen.getAllByRole("radio").map((option) => option.tabIndex)).toEqual([0, 0]);
    expect(screen.getByRole("radio", { name: /Đáp án hai/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("preserves arrow-key selection and locks graded answers against interaction", () => {
    const onSelect = vi.fn();
    const props = { options, selectedId: null, result: null, disabled: false, onSelect, labelledBy: "q" };
    const { rerender } = render(<><p id="q">Câu hỏi</p><ChoiceGroup {...props} /></>);
    const [first, second] = screen.getAllByRole("radio");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);
    expect(onSelect).toHaveBeenLastCalledWith("o2");
    rerender(<><p id="q">Câu hỏi</p><ChoiceGroup {...props} selectedId="o2" result="correct" disabled /></>);
    expect(screen.getAllByRole("radio").every((option) => option.matches(":disabled"))).toBe(true);
    onSelect.mockClear();
    fireEvent.keyDown(second, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("nudges the chosen option when it is graded wrong and leaves a right one still", () => {
    const { rerender } = render(group("o1", null));
    expect(motionOf(/Đáp án một/)).toBeNull();

    rerender(group("o1", "incorrect"));
    expect(motionOf(/Đáp án một/)).toBe("corrective");
    expect(motionOf(/Đáp án hai/)).toBeNull();
    // The state is carried by words as well as motion and color.
    expect(screen.getByRole("radio", { name: /bạn chọn chưa đúng/ })).not.toBeNull();

    rerender(group("o1", null));
    rerender(group("o1", "correct"));
    expect(motionOf(/Đáp án một/)).toBeNull();
    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ })).not.toBeNull();
  });

  it("stays still when it mounts already graded, as on a revisited question", () => {
    render(group("o1", "correct"));

    expect(motionOf(/Đáp án một/)).toBeNull();
    expect(screen.getByRole("radio", { name: /bạn chọn đúng/ })).not.toBeNull();
  });

  it("plays once per validation: re-rendering keeps it, retrying clears it, the next validation replays", () => {
    const { rerender } = render(group("o1", null));
    rerender(group("o1", "incorrect"));
    const first = screen.getByRole("radio", { name: /Đáp án một/ });
    expect(first.getAttribute("data-motion")).toBe("corrective");

    // A plain re-render keeps the same marker on the same node, so the CSS animation does not restart.
    rerender(group("o1", "incorrect"));
    expect(screen.getByRole("radio", { name: /Đáp án một/ })).toBe(first);
    expect(first.getAttribute("data-motion")).toBe("corrective");

    // "Thử lại" clears the result, which removes the marker; the next wrong answer sets it again.
    rerender(group(null, null));
    expect(motionOf(/Đáp án một/)).toBeNull();
    rerender(group("o2", null));
    rerender(group("o2", "incorrect"));
    expect(motionOf(/Đáp án hai/)).toBe("corrective");
  });

  it("applies the animation only under motion-safe and defines the nudge in the global styles", () => {
    render(group("o1", "incorrect"));
    const classes = screen.getByRole("radio", { name: /Đáp án một/ }).className;
    expect(classes).toContain("motion-safe:data-[motion=corrective]:animate-corrective");
    // No unconditional animation utility, so reduced motion keeps only the state change.
    expect(classes.split(/\s+/)).not.toContain("animate-corrective");
    // The wrong state reads from the Correction role, with no inset status bar.
    expect(classes).toContain("border-correction");
    expect(classes).toContain("bg-correction-quiet");
    expect(classes).not.toContain("shadow-[inset");

    // A right answer keeps the plain Growth tint and border, with no status bar or motion.
    cleanup();
    render(group("o1", "correct"));
    const correctClasses = screen.getByRole("radio", { name: /Đáp án một/ }).className;
    expect(correctClasses).toContain("border-growth");
    expect(correctClasses).toContain("bg-growth-quiet");
    expect(correctClasses).not.toContain("shadow-[inset");

    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/--animate-corrective:\s*corrective 220ms cubic-bezier\(0\.2, 0, 0, 1\)/);
    expect(css).toMatch(/@keyframes corrective[\s\S]*translateX\(-4px\)[\s\S]*translateX\(3px\)/);
    expect(css).not.toContain("correct-in");
  });
});
