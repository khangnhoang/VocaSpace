const TOPIC_BUILDER_TABS = ["flashcards", "exercises", "settings"] as const;

export type TopicBuilderTab = (typeof TOPIC_BUILDER_TABS)[number];

export function getTopicBuilderTab(rawTab: string | null): TopicBuilderTab {
  return TOPIC_BUILDER_TABS.includes(rawTab as TopicBuilderTab)
    ? (rawTab as TopicBuilderTab)
    : "exercises";
}
