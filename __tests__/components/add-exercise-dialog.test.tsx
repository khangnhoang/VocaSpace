// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddExerciseDialog from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/AddExerciseDialog";

const mocks = vi.hoisted(() => ({
  createExercise: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/exercise", () => ({
  createExercise: mocks.createExercise,
  deleteQuestionGroupMedia: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

// Mock scrollIntoView and focus
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("AddExerciseDialog validation and authoring", () => {
  const topicId = "topic-1111-2222-3333";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createExercise.mockResolvedValue({
      data: { id: "exercise-1" },
      message: "Tạo bài tập thành công.",
    });
  });

  it("completes and saves a TOEIC Part 7 (grouped) exercise with inactive standalone branch absent", async () => {
    const onSuccess = vi.fn();
    const setIsOpen = vi.fn();

    render(
      <AddExerciseDialog
        isOpen={true}
        setIsOpen={setIsOpen}
        topicId={topicId}
        onSuccess={onSuccess}
      />,
    );

    // Fill Title
    fireEvent.change(screen.getByLabelText("Exercise title"), {
      target: { value: "TOEIC Part 7 Reading Comprehension" },
    });

    // Fill Passage text
    fireEvent.change(screen.getByLabelText("Passage text group 1"), {
      target: { value: "The marketing department announced a new campaign starting next Monday." },
    });

    // Fill Question 1 content
    fireEvent.change(screen.getByLabelText("Question content group 1 question 1"), {
      target: { value: "When will the campaign start?" },
    });

    // Fill Answers
    fireEvent.change(screen.getByLabelText("Answer A"), {
      target: { value: "Next Monday" },
    });
    fireEvent.change(screen.getByLabelText("Answer B"), {
      target: { value: "Next Month" },
    });

    // Click Save
    fireEvent.click(screen.getByLabelText("Save exercise"));

    await waitFor(() => {
      expect(mocks.createExercise).toHaveBeenCalledTimes(1);
    });

    const [calledTopicId, payload] = mocks.createExercise.mock.calls[0];
    expect(calledTopicId).toBe(topicId);
    expect(payload.part_type).toBe("part7");
    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].passage_text).toBe(
      "The marketing department announced a new campaign starting next Monday.",
    );
    expect(payload.groups[0].questions[0].content).toBe("When will the campaign start?");
    // Crucial check: inactive standalone branch must be absent / undefined
    expect(payload.questions).toBeUndefined();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("completes and saves a TOEIC Part 5 (standalone) exercise with inactive grouped branch absent", async () => {
    const onSuccess = vi.fn();
    const setIsOpen = vi.fn();

    render(
      <AddExerciseDialog
        isOpen={true}
        setIsOpen={setIsOpen}
        topicId={topicId}
        onSuccess={onSuccess}
      />,
    );

    // Switch part_type to part5
    const selectTrigger = screen.getByRole("combobox");
    fireEvent.click(selectTrigger);

    // In Radix Select, option item can be selected
    const part5Option = await screen.findByRole("option", { name: /Part 5/i });
    fireEvent.click(part5Option);

    // Fill Title
    fireEvent.change(screen.getByLabelText("Exercise title"), {
      target: { value: "TOEIC Part 5 Incomplete Sentences" },
    });

    // Fill Standalone Question 1 content
    const questionInput = await screen.findByLabelText("Question content 1");
    fireEvent.change(questionInput, {
      target: { value: "The committee decided to _______ the recommended security measures." },
    });

    // Fill Answers
    fireEvent.change(screen.getByLabelText("Answer A"), {
      target: { value: "implement" },
    });
    fireEvent.change(screen.getByLabelText("Answer B"), {
      target: { value: "implementation" },
    });

    // Click Save
    fireEvent.click(screen.getByLabelText("Save exercise"));

    await waitFor(() => {
      expect(mocks.createExercise).toHaveBeenCalledTimes(1);
    });

    const [calledTopicId, payload] = mocks.createExercise.mock.calls[0];
    expect(calledTopicId).toBe(topicId);
    expect(payload.part_type).toBe("part5");
    expect(payload.questions).toHaveLength(1);
    expect(payload.questions[0].content).toBe(
      "The committee decided to _______ the recommended security measures.",
    );
    // Crucial check: inactive grouped branch must be absent / undefined
    expect(payload.groups).toBeUndefined();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("maintains clean state and succeeds after form reset / dialog reopening", async () => {
    const onSuccess = vi.fn();
    let isOpenState = true;
    const setIsOpen = vi.fn((open) => {
      isOpenState = open;
    });

    const { rerender } = render(
      <AddExerciseDialog
        isOpen={isOpenState}
        setIsOpen={setIsOpen}
        topicId={topicId}
        onSuccess={onSuccess}
      />,
    );

    // Save a Part 7 exercise
    fireEvent.change(screen.getByLabelText("Exercise title"), {
      target: { value: "First Part 7 Exercise" },
    });
    fireEvent.change(screen.getByLabelText("Passage text group 1"), {
      target: { value: "First passage content here." },
    });
    fireEvent.change(screen.getByLabelText("Question content group 1 question 1"), {
      target: { value: "First question content?" },
    });
    fireEvent.change(screen.getByLabelText("Answer A"), {
      target: { value: "Option A" },
    });
    fireEvent.change(screen.getByLabelText("Answer B"), {
      target: { value: "Option B" },
    });

    fireEvent.click(screen.getByLabelText("Save exercise"));
    await waitFor(() => expect(mocks.createExercise).toHaveBeenCalledTimes(1));

    // Reopen dialog for another exercise
    rerender(
      <AddExerciseDialog
        isOpen={true}
        setIsOpen={setIsOpen}
        topicId={topicId}
        onSuccess={onSuccess}
      />,
    );

    // Switch to Part 5
    fireEvent.click(screen.getByRole("combobox"));
    const part5Option = await screen.findByRole("option", { name: /Part 5/i });
    fireEvent.click(part5Option);

    fireEvent.change(screen.getByLabelText("Exercise title"), {
      target: { value: "Second Part 5 Exercise" },
    });
    const questionInput = await screen.findByLabelText("Question content 1");
    fireEvent.change(questionInput, {
      target: { value: "Second question content for part 5?" },
    });
    fireEvent.change(screen.getByLabelText("Answer A"), {
      target: { value: "Answer A" },
    });
    fireEvent.change(screen.getByLabelText("Answer B"), {
      target: { value: "Answer B" },
    });

    fireEvent.click(screen.getByLabelText("Save exercise"));
    await waitFor(() => expect(mocks.createExercise).toHaveBeenCalledTimes(2));

    const secondCallPayload = mocks.createExercise.mock.calls[1][1];
    expect(secondCallPayload.part_type).toBe("part5");
    expect(secondCallPayload.groups).toBeUndefined();
    expect(secondCallPayload.questions).toHaveLength(1);
  });
});
