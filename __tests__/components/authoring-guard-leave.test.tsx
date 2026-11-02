// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthoringGuardProvider,
  useAuthoringGuard,
  useRegisterAuthoringEditor,
} from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/authoring-guard";

const mocks = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

// Test plan:
// - Mục tiêu: AC6 khi có nhiều editor cùng dở (tên bài học và thẻ đang sửa): rời đi phải xử lý hết, không editor nào
//   bị bỏ qua và mất chữ âm thầm.
// - Loại test: component interaction trong jsdom với guard thật và editor giả.
// - Case: lần lưu đang chạy của editor đầu thành công thì vẫn hỏi editor thứ hai; bỏ thay đổi từng editor rồi mới đi tiếp;
//   chọn tiếp tục sửa thì dừng, không đụng editor còn lại; lần lưu thất bại thì hỏi đúng editor đó.
// - Invariant: editor đã xử lý trong lượt không bị hỏi lại, dù cờ dirty của nó chỉ đổi sau lần render tới.

interface FakeEditor {
  label: string;
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
  pendingSave?: () => Promise<boolean> | null;
}

function fakeEditor(label: string, overrides: Partial<FakeEditor> = {}): FakeEditor {
  return {
    label,
    isDirty: () => true,
    save: vi.fn(async () => true),
    discard: vi.fn(),
    ...overrides,
  };
}

function RegisteredEditor({ editor }: { editor: FakeEditor }) {
  useRegisterAuthoringEditor(editor);
  return null;
}

function LeaveProbe() {
  const guard = useAuthoringGuard();
  const [result, setResult] = useState("chưa chạy");
  return (
    <button type="button" onClick={() => void guard.confirmLeave().then((proceed) => setResult(proceed ? "đi tiếp" : "ở lại"))}>
      {result}
    </button>
  );
}

function renderGuard(...editors: FakeEditor[]) {
  render(
    <AuthoringGuardProvider>
      {editors.map((editor) => (
        <RegisteredEditor key={editor.label} editor={editor} />
      ))}
      <LeaveProbe />
    </AuthoringGuardProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "chưa chạy" }));
}

const prompt = (label: string) =>
  waitFor(() => {
    const dialog = screen.getByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" });
    expect(dialog.textContent).toContain(`${label} có thay đổi chưa lưu.`);
    return dialog;
  });

describe("confirmLeave with several unsaved editors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still asks about the second editor after the first one's in-flight save succeeds", async () => {
    const title = fakeEditor("Tên bài học", { pendingSave: () => Promise.resolve(true) });
    const card = fakeEditor("Thẻ từ vựng đang sửa");
    renderGuard(title, card);

    await prompt("Thẻ từ vựng đang sửa");
    expect(screen.queryByRole("button", { name: "đi tiếp" })).toBeNull();
    expect(card.discard).not.toHaveBeenCalled();
  });

  it("asks about each editor in turn, once each, before going on", async () => {
    const title = fakeEditor("Tên bài học");
    const card = fakeEditor("Thẻ từ vựng đang sửa");
    renderGuard(title, card);

    fireEvent.click(within(await prompt("Tên bài học")).getByRole("button", { name: "Bỏ thay đổi" }));
    expect(title.discard).toHaveBeenCalledTimes(1);

    fireEvent.click(within(await prompt("Thẻ từ vựng đang sửa")).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(card.save).toHaveBeenCalledTimes(1));

    expect(await screen.findByRole("button", { name: "đi tiếp" })).toBeTruthy();
    expect(title.discard).toHaveBeenCalledTimes(1);
  });

  it("stops at Tiếp tục sửa without touching the other editor", async () => {
    const title = fakeEditor("Tên bài học");
    const card = fakeEditor("Thẻ từ vựng đang sửa");
    renderGuard(title, card);

    fireEvent.click(within(await prompt("Tên bài học")).getByRole("button", { name: "Tiếp tục sửa" }));

    expect(await screen.findByRole("button", { name: "ở lại" })).toBeTruthy();
    expect(card.save).not.toHaveBeenCalled();
    expect(card.discard).not.toHaveBeenCalled();
  });

  it("asks about the same editor when its in-flight save fails", async () => {
    const title = fakeEditor("Tên bài học", { pendingSave: () => Promise.resolve(false) });
    renderGuard(title);

    fireEvent.click(within(await prompt("Tên bài học")).getByRole("button", { name: "Bỏ thay đổi" }));

    expect(await screen.findByRole("button", { name: "đi tiếp" })).toBeTruthy();
    expect(title.discard).toHaveBeenCalledTimes(1);
  });

  it("goes on at once when nothing is unsaved", async () => {
    renderGuard(fakeEditor("Tên bài học", { isDirty: () => false }));

    expect(await screen.findByRole("button", { name: "đi tiếp" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
