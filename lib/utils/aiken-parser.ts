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

export function parseAikenToGroups(rawText: string) {
  const lines = rawText.split("\n").map(line => line.trim());
  
  const groups: ParsedAikenGroup[] = [];
  let currentGroup: ParsedAikenGroup | null = null;
  let currentQuestion: ParsedAikenQuestion | null = null;

  for (const line of lines) {
    if (!line) continue;

    // 1. PHÁT HIỆN NHÓM NGỮ LIỆU (PASSAGE)
    if (line.toLowerCase().startsWith("passage:")) {
      currentGroup = {
        passage_text: line.substring(8).trim(),
        audio_url: undefined, // 🔥 GIỮ NGUYÊN: Định dạng string | undefined chuẩn Zod .optional()
        image_url: undefined, // 🔥 GIỮ NGUYÊN: Định dạng string | undefined chuẩn Zod .optional()
        questions: []
      };
      groups.push(currentGroup);
      currentQuestion = null; 
      continue;
    }

    // 2. PHÁT HIỆN LINK AUDIO ĐÍNH KÈM
    if (line.toLowerCase().startsWith("[audio]:")) {
      if (!currentGroup) {
        currentGroup = { 
          passage_text: undefined, 
          audio_url: undefined, 
          image_url: undefined, 
          questions: [] 
        };
        groups.push(currentGroup);
      }
      currentGroup.audio_url = line.substring(8).trim(); // Khi có data, gán lại thành dạng string ngon lành!
      continue;
    }

    // 3. PHÁT HIỆN CÂU HỎI
    if (line.toLowerCase().startsWith("q:") || /^[q]\d+[:\.]/i.test(line)) {
      if (!currentGroup) {
        currentGroup = { 
          passage_text: undefined, 
          audio_url: undefined, 
          image_url: undefined, 
          questions: [] 
        };
        groups.push(currentGroup);
      }
      
      const content = line.replace(/^[q]:?\d*[:\.]?\s*/i, "").trim();
      currentQuestion = { content, options: [] };
      currentGroup.questions.push(currentQuestion);
      continue;
    }

    // 4. PHÁT HIỆN CÁC ĐÁP ÁN LỰA CHỌN
    const optionMatch = line.match(/^([A-Z])[\)\.]\s*(.*)$/i);
    if (optionMatch) {
      if (!currentQuestion) continue;
      const letter = optionMatch[1].toUpperCase();
      const content = optionMatch[2].trim();
      
      currentQuestion.options.push({
        letter, 
        content,
        is_correct: false
      });
      continue;
    }

    // 5. PHÁT HIỆN CHỐT ĐÁP ÁN ĐÚNG
    if (line.toLowerCase().startsWith("answer:")) {
      if (!currentQuestion) continue;
      const correctLetter = line.substring(7).trim().toUpperCase();
      
      currentQuestion.options.forEach((opt) => {
        if (opt.letter === correctLetter) {
          opt.is_correct = true;
        }
        delete opt.letter; 
      });
      continue;
    }
  }

  return groups;
}
