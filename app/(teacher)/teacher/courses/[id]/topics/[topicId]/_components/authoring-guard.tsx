"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Mỗi editor đang mở tự giữ trạng thái dirty của nó (G4); guard chỉ hỏi qua các hàm này
// chứ không giữ thêm cờ song song, nên không thể lệch với form thật.
export interface AuthoringEditorHandle {
  isDirty: () => boolean;
  // Trả `false` khi lưu thất bại hoặc bị hủy ở hộp thoại ảnh hưởng học viên: hành động đang chờ không được chạy.
  save: () => Promise<boolean>;
  discard: () => void;
  // Lần lưu đang chạy (nếu có). Rời editor lúc đang lưu thì chờ đúng lần đó thay vì hỏi và gửi lưu lần hai.
  pendingSave?: () => Promise<boolean> | null;
  label?: string;
}

type LeaveChoice = "save" | "discard" | "stay";

interface PendingLeave {
  editor: AuthoringEditorHandle;
  resolve: (proceed: boolean) => void;
}

interface AuthoringGuardValue {
  register: (id: string, handle: AuthoringEditorHandle) => () => void;
  confirmLeave: () => Promise<boolean>;
  hasDirtyEditor: () => boolean;
  refresh: () => void;
  // Điều hướng khỏi trang (sau khi xóa, target dashboard đã cũ) cũng phải xếp hàng sau refresh.
  navigate: (href: string, mode?: "push" | "replace") => Promise<void>;
  // Ghi URL bằng restore của Next; `isCurrent` cho phép bỏ một lần ghi đã bị lần sau thay thế.
  replaceUrl: (href: string, isCurrent?: () => boolean) => Promise<void>;
}

const AuthoringGuardContext = createContext<AuthoringGuardValue | null>(null);

// ACTION-QUEUE-001 (G8): hai thao tác router chạy chồng nhau thì một bên bị mất. Đã quan sát trên
// production build: navigate/restore khi server action còn chờ làm mất action (Next 16.2.6); refresh
// đang chờ commit đè lên điều hướng hoặc lần ghi URL đến sau; refresh phát ra ngay sau một restore
// làm Next tải lại cả trang. Vì vậy mọi thao tác router của trang (refresh, ghi URL, điều hướng bằng
// link) xếp vào một hàng nối tiếp: mỗi thao tác chạy trong transition và chỉ bắt đầu khi thao tác
// trước đã commit xong và không còn server action nào chờ. Server action luôn đi qua `fetch` với
// header `Next-Action`, nên đếm các request đó để biết cả action của component dùng chung.
let pendingActionCount = 0;
let refreshPending = false;
let fetchPatchOwners = 0;
let originalFetch: typeof fetch | null = null;
const idleListeners = new Set<() => void>();

function notifyPendingChange() {
  if (pendingActionCount !== 0) return;
  const listeners = [...idleListeners];
  idleListeners.clear();
  listeners.forEach((listener) => listener());
}

function isRouterIdle() {
  return pendingActionCount === 0 && !refreshPending;
}

function isServerActionRequest(init?: RequestInit) {
  const headers = init?.headers;
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has("next-action");
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === "next-action");
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === "next-action");
}

function installServerActionTracker() {
  fetchPatchOwners += 1;
  if (fetchPatchOwners > 1 || typeof window === "undefined") return;
  originalFetch = window.fetch;
  const baseFetch = originalFetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isServerActionRequest(init)) return baseFetch(input, init);
    pendingActionCount += 1;
    notifyPendingChange();
    return baseFetch(input, init).finally(() => {
      pendingActionCount = Math.max(0, pendingActionCount - 1);
      notifyPendingChange();
    });
  }) as typeof fetch;
}

function uninstallServerActionTracker() {
  fetchPatchOwners = Math.max(0, fetchPatchOwners - 1);
  if (fetchPatchOwners > 0 || typeof window === "undefined") return;
  if (originalFetch) window.fetch = originalFetch;
  originalFetch = null;
}

// Promise của server action resolve trước khi Next đưa mục đó ra khỏi hàng đợi router (reducer còn
// áp dữ liệu revalidate sau đó), nên luôn nhường một macrotask rồi kiểm tra lại trước khi báo rảnh.
// Một action treo không được khóa vĩnh viễn việc ghi URL và điều hướng: quá hạn thì chạy tiếp.
const ROUTER_IDLE_TIMEOUT_MS = 10_000;

function whenIdle(isIdle: () => boolean) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      idleListeners.delete(check);
      resolve();
    }, ROUTER_IDLE_TIMEOUT_MS);
    const check = () => {
      if (!isIdle()) {
        idleListeners.add(check);
        return;
      }
      setTimeout(() => {
        if (!isIdle()) {
          idleListeners.add(check);
          return;
        }
        clearTimeout(timeout);
        resolve();
      }, 0);
    };
    check();
  });
}

function whenRouterIdle() {
  return whenIdle(isRouterIdle);
}

function isPlainLeftClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function AuthoringGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const editorsRef = useRef(new Map<string, AuthoringEditorHandle>());
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const pendingRef = useRef<PendingLeave | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isRouterBusy, startRouterTransition] = useTransition();
  const routerOpsRef = useRef<Promise<void>>(Promise.resolve());

  const findDirtyEditor = useCallback((settled?: Set<AuthoringEditorHandle>) => {
    for (const editor of editorsRef.current.values()) {
      if (!settled?.has(editor) && editor.isDirty()) return editor;
    }
    return null;
  }, []);

  const register = useCallback((id: string, handle: AuthoringEditorHandle) => {
    editorsRef.current.set(id, handle);
    return () => {
      if (editorsRef.current.get(id) === handle) editorsRef.current.delete(id);
    };
  }, []);

  const confirmLeave = useCallback(async () => {
    // Tên bài học và editor nội dung có thể cùng dở, nên xử lý lần lượt tới khi hết. `settled` giữ các
    // editor đã lưu hoặc đã bỏ trong lượt này: cờ dirty của chúng chỉ đổi sau lần render tới, nếu không
    // bỏ qua thì sẽ hỏi lại đúng editor vừa xử lý.
    const settled = new Set<AuthoringEditorHandle>();
    for (let editor = findDirtyEditor(settled); editor; editor = findDirtyEditor(settled)) {
      const inFlight = editor.pendingSave?.();
      // Lưu thành công nghĩa là dữ liệu đã ở server; chỉ hỏi khi lần lưu đó thất bại.
      if (!(inFlight && (await inFlight))) {
        pendingRef.current?.resolve(false);
        const current = editor;
        const proceed = await new Promise<boolean>((resolve) => {
          const next = { editor: current, resolve };
          pendingRef.current = next;
          setSaveFailed(false);
          setPending(next);
        });
        if (!proceed) return false;
      }
      settled.add(editor);
    }
    return true;
  }, [findDirtyEditor]);

  const settle = useCallback((proceed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(proceed);
  }, []);

  const choose = useCallback(
    async (choice: LeaveChoice) => {
      const current = pendingRef.current;
      if (!current) return;
      if (choice === "stay") {
        settle(false);
        return;
      }
      if (choice === "discard") {
        current.editor.discard();
        settle(true);
        return;
      }
      setIsSaving(true);
      // Đóng hộp thoại trước khi lưu: lưu có thể mở hộp thoại ảnh hưởng học viên của editor,
      // và hai modal chồng nhau sẽ tranh focus.
      setPending(null);
      const saved = await current.editor.save();
      setIsSaving(false);
      if (pendingRef.current !== current) return;
      pendingRef.current = null;
      if (!saved) setSaveFailed(true);
      current.resolve(saved);
    },
    [settle],
  );

  // Transition chỉ hết pending khi kết quả thao tác router đã commit, tức mục đó đã rời hàng đợi.
  useEffect(() => {
    refreshPending = isRouterBusy;
    notifyPendingChange();
  }, [isRouterBusy]);

  const enqueueRouterOp = useCallback((run: () => void, isCurrent?: () => boolean) => {
    // Lần ghi đã bị lần sau thay thế thì bỏ ngay, không phải chờ hàng đợi rảnh.
    const op = routerOpsRef.current
      .then(() => (isCurrent && !isCurrent() ? undefined : whenRouterIdle()))
      .then(() => {
        if (isCurrent && !isCurrent()) return;
        refreshPending = true;
        notifyPendingChange();
        startRouterTransition(run);
      });
    routerOpsRef.current = op.catch(() => undefined);
    return op;
  }, []);
  const refresh = useCallback(() => {
    void enqueueRouterOp(() => router.refresh());
  }, [enqueueRouterOp, router]);
  const navigate = useCallback(
    (href: string, mode: "push" | "replace" = "push") =>
      enqueueRouterOp(() =>
        mode === "replace" ? router.replace(href) : router.push(href),
      ),
    [enqueueRouterOp, router],
  );
  const replaceUrl = useCallback(
    (href: string, isCurrent?: () => boolean) =>
      enqueueRouterOp(() => window.history.replaceState(null, "", href), isCurrent),
    [enqueueRouterOp],
  );

  useEffect(() => {
    installServerActionTracker();
    return () => {
      uninstallServerActionTracker();
      refreshPending = false;
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!findDirtyEditor()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [findDirtyEditor]);

  useEffect(() => {
    // Link trong trang (kể cả link của component dùng chung) được chặn ở pha capture để hỏi
    // trước khi rời một editor dirty, và để không điều hướng khi server action còn chờ (G8).
    const handleClick = (event: MouseEvent) => {
      if (!isPlainLeftClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const samePage =
        url.pathname === window.location.pathname &&
        url.search === window.location.search;
      if (samePage) return;

      const isDirty = Boolean(findDirtyEditor());
      if (!isDirty && isRouterIdle()) return;

      event.preventDefault();
      event.stopPropagation();
      const href = `${url.pathname}${url.search}${url.hash}`;
      void (async () => {
        const proceed = await confirmLeave();
        if (!proceed) return;
        await enqueueRouterOp(() => router.push(href));
      })();
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [confirmLeave, enqueueRouterOp, findDirtyEditor, router]);

  const value = useMemo<AuthoringGuardValue>(
    () => ({
      register,
      confirmLeave,
      hasDirtyEditor: () => Boolean(findDirtyEditor()),
      refresh,
      navigate,
      replaceUrl,
    }),
    [confirmLeave, findDirtyEditor, navigate, refresh, register, replaceUrl],
  );

  return (
    <AuthoringGuardContext.Provider value={value}>
      {children}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) void choose("stay");
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Lưu thay đổi trước khi rời đi?</DialogTitle>
            <DialogDescription>
              {pending?.editor.label
                ? `${pending.editor.label} có thay đổi chưa lưu.`
                : "Nội dung đang sửa có thay đổi chưa lưu."}{" "}
              Lưu để giữ lại, hoặc bỏ thay đổi để quay về bản đã lưu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void choose("stay")}>
              Tiếp tục sửa
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="destructive-quiet"
                onClick={() => void choose("discard")}
              >
                Bỏ thay đổi
              </Button>
              <Button type="button" onClick={() => void choose("save")} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Lưu
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="sr-only" role="status" aria-live="polite">
        {isSaving
          ? "Đang lưu thay đổi…"
          : saveFailed
            ? "Chưa lưu được. Nội dung vẫn đang mở để bạn sửa tiếp."
            : ""}
      </p>
    </AuthoringGuardContext.Provider>
  );
}

export function useAuthoringGuard() {
  const value = useContext(AuthoringGuardContext);
  if (!value) {
    // Cho phép component dùng riêng (test, màn khác) mà không có provider: không có gì để hỏi.
    return {
      register: () => () => undefined,
      confirmLeave: () => Promise.resolve(true),
      hasDirtyEditor: () => false,
      refresh: () => undefined,
      navigate: () => Promise.resolve(),
      replaceUrl: (href: string) => {
        window.history.replaceState(null, "", href);
        return Promise.resolve();
      },
    } satisfies AuthoringGuardValue;
  }
  return value;
}

// Điều hướng khỏi trang; trong topic builder xếp hàng sau các thao tác router đang chờ.
export function useAuthoringNavigate() {
  const value = useContext(AuthoringGuardContext);
  const router = useRouter();
  const fallback = useCallback(
    (href: string, mode: "push" | "replace" = "push") => {
      if (mode === "replace") router.replace(href);
      else router.push(href);
      return Promise.resolve();
    },
    [router],
  );
  return value ? value.navigate : fallback;
}

// Refresh dữ liệu server của trang; trong topic builder đi qua guard để biết khi nào refresh xong.
export function useAuthoringRefresh() {
  const value = useContext(AuthoringGuardContext);
  const router = useRouter();
  return value ? value.refresh : () => router.refresh();
}

// Editor gọi hook này với handle mới mỗi render; registry chỉ đọc qua ref nên luôn thấy giá trị mới nhất.
export function useRegisterAuthoringEditor(handle: AuthoringEditorHandle | null) {
  const { register } = useAuthoringGuard();
  const id = useId();
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  });
  const isActive = handle !== null;
  useEffect(() => {
    if (!isActive) return;
    return register(id, {
      isDirty: () => handleRef.current?.isDirty() ?? false,
      save: () => handleRef.current?.save() ?? Promise.resolve(true),
      discard: () => handleRef.current?.discard(),
      pendingSave: () => handleRef.current?.pendingSave?.() ?? null,
      get label() {
        return handleRef.current?.label;
      },
    });
  }, [id, isActive, register]);
}

// Gộp các lần gọi lưu chồng nhau (nút Lưu, Ctrl+S, hộp thoại rời trang) thành một request duy nhất.
export function useSingleFlightSave() {
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const run = useCallback((save: () => Promise<boolean>) => {
    if (inFlightRef.current) return inFlightRef.current;
    const promise = save().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  }, []);
  const pending = useCallback(() => inFlightRef.current, []);
  return { run, pending };
}
