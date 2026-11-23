import viLearning from "@/messages/vi/learning.json";
import { staticTranslate } from "./translate";

// H7: các thành phần học tập dùng chung (QuestionNavigator, ExerciseContext, ChoiceGroup, CourseLearningActivity, formatRelativeDay)
// nhận `t` tuỳ chọn. Màn hình U2 truyền bản dịch theo ngôn ngữ đang dùng; người gọi khác (màn hình học U3) không truyền nên vẫn
// ra đúng tiếng Việt hiện tại, không cần provider `learning`.
export const viLearningText = staticTranslate("learning", viLearning);
