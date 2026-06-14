"use client"; // <-- THÊM DÒNG NÀY LÊN ĐẦU TIÊN
// // app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, ClipboardList, Settings } from "lucide-react";
import ExerciseTab from "./ExerciseTab";
import FlashcardTab from "./FlashcardTab";
import SettingsTab from "./SettingsTab";
import { getTopicBuilderTab } from "./topic-builder-tab";

export default function TopicBuilderTabs({ topicId }: { topicId: string }) {
  const searchParams = useSearchParams();
  const initialTab = getTopicBuilderTab(searchParams.get("tab"));

  return (
    <Tabs defaultValue={initialTab} className="w-full">
      <TabsList className="bg-white border p-1 rounded-xl h-14 mb-8 shadow-sm py-5">
        <TabsTrigger
          value="flashcards"
          className="rounded-lg px-8 py-4 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 gap-2 font-bold cursor-pointer"
        >
          <BookOpen size={18} /> Từ vựng
        </TabsTrigger>
        <TabsTrigger
          value="exercises"
          className="rounded-lg px-8 py-4 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 gap-2 font-bold cursor-pointer"
        >
          <ClipboardList size={18} /> Bài tập TOEIC
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className="rounded-lg px-8 py-4 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 gap-2 font-bold cursor-pointer"
        >
          <Settings size={18} /> Cài đặt bài học
        </TabsTrigger>
      </TabsList>

      <TabsContent value="flashcards">
        <FlashcardTab topicId={topicId} />
      </TabsContent>

      <TabsContent value="exercises">
        <ExerciseTab topicId={topicId}/>
      </TabsContent>

      <TabsContent value="settings">
        <SettingsTab topicId={topicId}/>
      </TabsContent>
    </Tabs>
  );
}
