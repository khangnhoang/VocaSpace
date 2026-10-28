"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktop(listener: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

// Môi trường không có matchMedia (jsdom) coi như màn rộng; server render luôn ở dạng hẹp
// vì editor chưa mở ở lần render đầu, nên không lệch hydration.
export function useIsDesktopWorkbench() {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => (window.matchMedia ? window.matchMedia(DESKTOP_QUERY).matches : true),
    () => false,
  );
}

// Editor của tab Bài tập đổi theo từng node; mỗi editor giữ bản nháp của riêng nó và tự đổ
// preview vào ô của workbench qua portal, để không phải nhấc state nháp lên tab cha.
const PreviewSlotContext = createContext<HTMLElement | null>(null);

export function WorkbenchPreview({ children }: { children: ReactNode }) {
  const slot = useContext(PreviewSlotContext);
  return slot ? createPortal(children, slot) : null;
}

interface AuthoringWorkbenchProps {
  label: string;
  list: ReactNode;
  editor: ReactNode;
  emptyEditor: ReactNode;
  preview?: ReactNode;
  // `true`: editor tự render preview bằng `WorkbenchPreview`.
  usePreviewSlot?: boolean;
  isEditorOpen: boolean;
  // Tab bị ẩn vẫn giữ editor (không mất dữ liệu) nhưng không được mở sheet modal che tab đang xem.
  isActive?: boolean;
  editorTitle: string;
  onRequestClose: () => void;
}

export function PreviewPane({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label="Bản xem trước cho học viên"
      className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4"
    >
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-slate-600 uppercase">
        <Eye className="size-4 text-recall" aria-hidden="true" />
        Học viên sẽ thấy
      </p>
      {children}
    </section>
  );
}

// Bố cục chung của ba tab nội dung: danh sách bên trái, editor + preview bên phải từ `lg`;
// dưới `lg` danh sách chiếm màn hình và editor mở thành sheet toàn màn hình (Decision 46.3).
export default function AuthoringWorkbench({
  label,
  list,
  editor,
  emptyEditor,
  preview,
  usePreviewSlot = false,
  isEditorOpen,
  isActive = true,
  editorTitle,
  onRequestClose,
}: AuthoringWorkbenchProps) {
  const isDesktop = useIsDesktopWorkbench();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [previewSlot, setPreviewSlot] = useState<HTMLElement | null>(null);
  const previewContent = usePreviewSlot ? <div ref={setPreviewSlot} data-preview-slot className="space-y-3" /> : preview;

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    onRequestClose();
    listRef.current?.focus();
  };

  return (
    <PreviewSlotContext.Provider value={previewSlot}>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:gap-5">
      <div
        ref={listRef}
        tabIndex={-1}
        aria-label={`Danh sách ${label}`}
        role="region"
        className="min-w-0 outline-none"
      >
        {list}
      </div>

      {isDesktop ? (
        <div className="hidden min-w-0 lg:block" onKeyDown={handleEditorKeyDown}>
          {isEditorOpen ? (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] xl:items-start">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-200">
                {editor}
              </div>
              {previewContent ? (
                <div className="min-w-0 xl:sticky xl:top-4 has-[[data-preview-slot]:empty]:hidden">
                  <PreviewPane>{previewContent}</PreviewPane>
                </div>
              ) : null}
            </div>
          ) : (
            emptyEditor
          )}
        </div>
      ) : (
        <Sheet
          open={isEditorOpen && isActive}
          onOpenChange={(open) => {
            if (!open) onRequestClose();
          }}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none motion-reduce:animate-none"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={onRequestClose}
                aria-label={`Quay lại danh sách ${label}`}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <SheetTitle className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
                {editorTitle}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Sửa nội dung và xem trước cách học viên nhìn thấy.
              </SheetDescription>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
              <div className="bg-white">{editor}</div>
              {previewContent ? (
                <div className="p-4 has-[[data-preview-slot]:empty]:hidden">
                  <PreviewPane>{previewContent}</PreviewPane>
                </div>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
    </PreviewSlotContext.Provider>
  );
}
