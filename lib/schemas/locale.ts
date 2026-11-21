import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";

// English localization U1 G4: action đổi ngôn ngữ chỉ nhận đúng các ngôn ngữ được hỗ trợ.
export const localeSchema = z.enum(LOCALES);
