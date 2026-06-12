// lib/utils/aiken-parser.ts

type ParsedAikenOption = {
  letter?: string;
  content: string;
  is_correct: boolean;
};

type ParsedAikenQuestion = {
  content: string;
  options: ParsedAikenOption[];
};

type ParsedAikenGroup = {
  passage_text?: string;
  audio_url?: string;
  image_url?: string;
  questions: ParsedAikenQuestion[];
};

export type AikenParseIssue = {
  line: number;
  message: string;
};

export class AikenParseError extends Error {
  issues: AikenParseIssue[];

  constructor(issues: AikenParseIssue[]) {
    super("Định dạng nhập hàng loạt không hợp lệ.");
    this.name = "AikenParseError";
    this.issues = issues;
  }
}

type ParserQuestionState = {
  question: ParsedAikenQuestion;
  line: number;
  answerLine?: number;
};

function createEmptyGroup(): ParsedAikenGroup {
  return {
    passage_text: undefined,
    audio_url: undefined,
    image_url: undefined,
    questions: [],
  };
}

function ensureGroup(groups: ParsedAikenGroup[]) {
  if (groups.length === 0) {
    groups.push(createEmptyGroup());
  }

  return groups[groups.length - 1];
}

function finalizeQuestion(
  currentQuestion: ParserQuestionState | null,
  issues: AikenParseIssue[],
) {
  if (!currentQuestion) return;

  const { question, line, answerLine } = currentQuestion;
  const validOptions = question.options.filter((option) => option.content.trim() !== "");

  if (validOptions.length < 2) {
    issues.push({
      line,
      message: `Dòng ${line}: Câu hỏi phải có ít nhất 2 đáp án.`,
    });
  }

  if (!answerLine) {
    issues.push({
      line,
      message: `Dòng ${line}: Thiếu ANSWER.`,
    });
    return;
  }

  if (!validOptions.some((option) => option.is_correct)) {
    issues.push({
      line: answerLine,
      message: `Dòng ${answerLine}: Không tìm thấy đáp án đúng trong danh sách lựa chọn.`,
    });
  }
}

export function formatAikenParseIssues(error: AikenParseError) {
  return error.issues.map((issue) => issue.message).join("\n");
}

export function parseAikenToGroups(rawText: string) {
  const sourceLines = rawText.split(/\r?\n/);
  const groups: ParsedAikenGroup[] = [];
  const issues: AikenParseIssue[] = [];
  let currentQuestion: ParserQuestionState | null = null;

  sourceLines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    if (/^passage:/i.test(line)) {
      finalizeQuestion(currentQuestion, issues);
      const passage = line.replace(/^passage:/i, "").trim();
      groups.push({
        ...createEmptyGroup(),
        passage_text: passage || undefined,
      });
      currentQuestion = null;
      return;
    }

    if (/^\[audio\]:/i.test(line)) {
      ensureGroup(groups).audio_url = line.replace(/^\[audio\]:/i, "").trim() || undefined;
      return;
    }

    if (/^\[image\]:/i.test(line)) {
      ensureGroup(groups).image_url = line.replace(/^\[image\]:/i, "").trim() || undefined;
      return;
    }

    if (/^q(?::|\d+[:.])/i.test(line)) {
      finalizeQuestion(currentQuestion, issues);
      const group = ensureGroup(groups);
      const content = line.replace(/^q(?::|\d+[:.])\s*/i, "").trim();

      if (!content) {
        issues.push({
          line: lineNumber,
          message: `Dòng ${lineNumber}: Nội dung câu hỏi không được để trống.`,
        });
      }

      const question = { content, options: [] };
      group.questions.push(question);
      currentQuestion = { question, line: lineNumber };
      return;
    }

    const optionMatch = line.match(/^([A-Z])[).]\s*(.+)$/i);
    if (optionMatch) {
      if (!currentQuestion) {
        issues.push({
          line: lineNumber,
          message: `Dòng ${lineNumber}: Lựa chọn phải nằm sau một dòng Q:.`,
        });
        return;
      }

      currentQuestion.question.options.push({
        letter: optionMatch[1].toUpperCase(),
        content: optionMatch[2].trim(),
        is_correct: false,
      });
      return;
    }

    if (/^answer:/i.test(line)) {
      if (!currentQuestion) {
        issues.push({
          line: lineNumber,
          message: `Dòng ${lineNumber}: ANSWER phải nằm sau một câu hỏi.`,
        });
        return;
      }

      const correctLetter = line.replace(/^answer:/i, "").trim().toUpperCase();
      currentQuestion.answerLine = lineNumber;
      currentQuestion.question.options.forEach((option) => {
        option.is_correct = option.letter === correctLetter;
        delete option.letter;
      });
      return;
    }

    issues.push({
      line: lineNumber,
      message: `Dòng ${lineNumber}: Định dạng dòng không hợp lệ.`,
    });
  });

  finalizeQuestion(currentQuestion, issues);

  const nonEmptyGroups = groups.filter((group) => group.questions.length > 0);
  if (nonEmptyGroups.length === 0 && issues.length === 0) {
    issues.push({
      line: 1,
      message: "Dòng 1: Không tìm thấy câu hỏi hợp lệ.",
    });
  }

  if (issues.length > 0) {
    throw new AikenParseError(issues);
  }

  return nonEmptyGroups;
}
