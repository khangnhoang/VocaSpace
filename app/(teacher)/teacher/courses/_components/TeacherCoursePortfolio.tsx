"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowLeft, ArrowRight, BookOpen, BookOpenCheck, CircleAlert, Clock3, Crown, Eye, FilePenLine, ListFilter, Loader2, PencilLine, Plus, Search, Settings, ShieldCheck, Trash2, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteCourse, updateCourse } from "@/app/actions/course";
import { courseSchema, type CourseFormValues, type TeacherCourse } from "@/lib/schemas/course";
import type { TeacherCoursePortfolioResult } from "@/lib/schemas/teacher-course-portfolio";
import { attentionPath, courseRoleLabels, courseStatusLabels, getContinuation } from "@/lib/course-authoring/portfolio";
import { getCourseOverviewPath, getTeacherCourseCreatePath } from "@/lib/course-authoring/routes";
import CourseForm from "./CourseForm";
import CourseList from "./CourseList";
import DeleteCourseModal from "./DeleteCourseModal";
import CollaboratorInvitationPanel from "./CollaboratorInvitationPanel";
import PortfolioAttention from "./PortfolioAttention";
import PortfolioFilterSelect from "./PortfolioFilterSelect";

const statusOptions = [
  { value: 'all', label: 'Tất cả trạng thái', icon: ListFilter },
  { value: 'draft', label: courseStatusLabels.draft, icon: FilePenLine },
  { value: 'pending', label: courseStatusLabels.pending, icon: Clock3 },
  { value: 'published', label: courseStatusLabels.published, icon: BookOpenCheck },
];
const roleOptions = [
  { value: 'all', label: 'Tất cả vai trò', icon: Users },
  { value: 'owner', label: courseRoleLabels.owner, icon: Crown },
  { value: 'co_owner', label: courseRoleLabels.co_owner, icon: ShieldCheck },
  { value: 'editor', label: courseRoleLabels.editor, icon: PencilLine },
  { value: 'previewer', label: courseRoleLabels.previewer, icon: Eye },
];
const sortOptions = [
  { value: 'membership', label: 'Tham gia gần nhất', icon: Clock3 },
  { value: 'title', label: 'Tên A–Z', icon: ArrowDownAZ },
];

export default function TeacherCoursePortfolio({ result }: { result: TeacherCoursePortfolioResult }) {
  const router = useRouter();
  const [isRefreshing, refreshTransition] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<TeacherCourse | null>(null);
  const [deleting, setDeleting] = useState<TeacherCourse | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("membership");
  const heading = useRef<HTMLHeadingElement>(null);
  const mutationLock = useRef(false);
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: "", slug: "", description: "", price: "", thumbnail_file: null },
  });
  const refresh = () => {
    refreshTransition(() => router.refresh());
    requestAnimationFrame(() => heading.current?.focus());
  };
  const busy = isPending || isRefreshing;

  function closeEditor() {
    setPreview(null);
    setEditing(null);
    form.reset();
    requestAnimationFrame(() => heading.current?.focus());
  }

  function editCourse(course: TeacherCourse) {
    setEditing(course);
    setPreview(course.thumbnail_url);
    form.reset({ title: course.title, slug: course.slug, description: course.description ?? "", price: String(course.price), thumbnail_file: null });
    requestAnimationFrame(() => form.setFocus("title"));
  }

  function submit(values: CourseFormValues) {
    if (!editing || mutationLock.current) return;
    const courseId = editing.id;
    mutationLock.current = true;
    startTransition(async () => {
      try {
        const payload = new FormData();
        payload.append("title", values.title);
        payload.append("slug", values.slug);
        payload.append("description", values.description);
        payload.append("price", values.price || "0");
        if (values.thumbnail_file) payload.append("thumbnail_file", values.thumbnail_file);
        const response = await updateCourse(courseId, payload);
        if (response.error) toast.error(response.error);
        else { toast.success(response.message); closeEditor(); refresh(); }
      } catch { toast.error("Chưa lưu được khóa học. Dữ liệu bạn nhập vẫn được giữ lại, vui lòng thử lại."); }
      finally { mutationLock.current = false; }
    });
  }

  function confirmDelete() {
    if (!deleting || mutationLock.current) return;
    const courseId = deleting.id;
    mutationLock.current = true;
    startTransition(async () => {
      try {
        const response = await deleteCourse(courseId);
        if (response.error) toast.error(response.error);
        else { toast.success(response.message); setDeleting(null); refresh(); }
      } catch { toast.error("Chưa đưa được khóa học vào thùng rác. Vui lòng thử lại."); }
      finally { mutationLock.current = false; }
    });
  }

  if (editing) return <CourseForm form={form} onSubmit={submit} isPending={isPending} previewUrl={preview} setPreviewUrl={setPreview} onCancel={() => { if (!isPending) closeEditor(); }} isEditMode />;

  const data = result.success ? result.data : null;
  const continuation = data ? getContinuation(data) : null;
  const dense = (data?.courses.length ?? 0) >= 5;
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const courses = [...(data?.courses ?? [])].filter((course) =>
    (!dense || ((!normalizedQuery || `${course.title} ${course.description ?? ""}`.toLocaleLowerCase("vi").includes(normalizedQuery)) &&
      (status === "all" || course.status === status) && (role === "all" || course.my_role === role))),
  ).sort((a, b) => sort === "title"
    ? a.title.localeCompare(b.title, "vi") || a.id.localeCompare(b.id, "en")
    : Date.parse(b.membership_created_at) - Date.parse(a.membership_created_at) || a.id.localeCompare(b.id, "en"));
  const visibleCourses = dense ? courses : courses.filter((course) => course.id !== continuation?.course?.id);

  // html đã giữ scrollbar-gutter; bù lại phần margin mà scroll lock của Radix cộng lần hai.
  return <div className="min-h-screen w-[calc(100%+var(--removed-body-scroll-bar-size,0px))] bg-slate-50 px-4 py-6 font-sans text-slate-900 sm:px-8 sm:py-9 lg:px-12">
    <div className="mx-auto max-w-310">
      <header className="mb-8 flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-end">
        <div><Button asChild variant="link" className="mb-4 h-9 px-0 coarse-input:h-11"><Link href="/"><ArrowLeft aria-hidden="true" />Trang chủ</Link></Button><h1 ref={heading} tabIndex={-1} className="text-3xl font-extrabold leading-10 tracking-tight outline-none sm:text-[32px]">Khóa học của tôi</h1><p className="mt-2 text-sm leading-6 text-slate-600">Tiếp tục xây dựng, cộng tác và hoàn thiện bài học của bạn.</p></div>
        {data ? <div className="flex flex-wrap items-center gap-4 lg:gap-6"><div><p className="text-xs font-medium text-slate-600">Khóa học đang cộng tác</p><p className="mt-1 text-sm font-semibold">{data.courses.length} khóa học</p></div>{data.can_create_course ? <Button asChild className="coarse-input:h-11 coarse-input:px-5"><Link href={getTeacherCourseCreatePath()}><Plus className="size-4.5 coarse-input:size-5" aria-hidden="true" />Tạo khóa học</Link></Button> : null}</div> : null}
      </header>
      {!result.success ? <section role="alert" className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-8"><CircleAlert className="text-correction" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold">{result.errorCode === "AUTH_REQUIRED" ? 'Phiên đăng nhập đã kết thúc' : result.errorCode === 'FORBIDDEN' ? 'Không thể truy cập portfolio' : 'Chưa tải được khóa học'}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{result.error}</p>{result.errorCode === 'AUTH_REQUIRED' ? <Button asChild className="mt-5 coarse-input:h-11 coarse-input:px-5"><Link href="/login">Đăng nhập</Link></Button> : result.errorCode === 'UNAVAILABLE' ? <Button variant="outline" className="mt-5 coarse-input:h-11 coarse-input:px-5" disabled={isRefreshing} onClick={refresh}>{isRefreshing ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : null}{isRefreshing ? 'Đang tải lại…' : 'Thử lại'}</Button> : <Button asChild variant="link" className="mt-4 px-0"><Link href="/">Về trang chủ</Link></Button>}</section> : <>
        <CollaboratorInvitationPanel onAccepted={refresh} />
        {isRefreshing ? <p role="status" className="mb-4 text-sm text-slate-600">Đang cập nhật danh sách khóa học…</p> : null}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)] xl:gap-8" aria-busy={isRefreshing}>
          <div className="order-1 min-w-0 xl:order-2"><PortfolioAttention items={data?.attention ?? []} /></div>
          <div className="order-2 min-w-0 space-y-5 xl:order-1">
            {continuation?.course ? <section aria-labelledby="continuation-heading" className="rounded-2xl border border-route-line bg-white p-5 sm:p-7">
              <p className="flex items-center gap-2 text-xs font-semibold text-route"><BookOpen size={16} aria-hidden="true" />{continuation.attention ? 'Tiếp tục công việc' : 'Tiếp tục với khóa học'}</p>
              <h2 id="continuation-heading" className="mt-4 text-2xl font-bold leading-8 tracking-tight [overflow-wrap:anywhere]">{continuation.course.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{courseRoleLabels[continuation.course.my_role]} <span aria-hidden="true">·</span> {courseStatusLabels[continuation.course.status]}</p>
              {continuation.attention?.kind === 'topic_correction' ? <p className="mt-4 text-sm font-semibold text-correction [overflow-wrap:anywhere]">Bài học “{continuation.attention.topic_title}” cần chỉnh sửa</p> : null}
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{continuation.attention ? continuation.attention.kind === 'topic_review' ? `Bài học “${continuation.attention.topic_title}” đang chờ bạn duyệt.` : continuation.attention.reason : 'Khóa học bạn tham gia gần nhất. Mở tổng quan để tiếp tục công việc.'}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2"><Button asChild className="coarse-input:h-11 coarse-input:px-5"><Link href={continuation.attention ? attentionPath(continuation.attention) : getCourseOverviewPath(continuation.course.id)}>{continuation.attention?.kind === 'topic_review' ? 'Duyệt bài học' : continuation.attention ? 'Xem và chỉnh sửa' : 'Mở khóa học'}<ArrowRight className="size-4.5 coarse-input:size-5" aria-hidden="true" /></Link></Button>{continuation.attention ? <Button asChild variant="link" className="px-0 coarse-input:h-11 coarse-input:border-slate-500 coarse-input:bg-white coarse-input:px-5 coarse-input:text-slate-900 coarse-input:hover:no-underline"><Link href={getCourseOverviewPath(continuation.course.id)}>Tổng quan khóa học</Link></Button> : null}</div>
              {!dense && continuation.course.my_role !== 'previewer' ? <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4"><Button variant="ghost" disabled={busy} onClick={() => editCourse(continuation.course)} className="coarse-input:h-11 coarse-input:px-5"><Settings className="size-4.5 coarse-input:size-5" aria-hidden="true" />Cài đặt thông tin</Button><Button variant="destructive-quiet" disabled={busy} onClick={() => setDeleting(continuation.course)} className="coarse-input:h-11 coarse-input:px-5"><Trash2 className="size-4.5 coarse-input:size-5" aria-hidden="true" />Đưa vào thùng rác</Button></div> : null}
            </section> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 sm:p-9"><BookOpen className="text-route" size={28} aria-hidden="true" /><h2 className="mt-5 text-xl font-bold">Chưa có khóa học đang cộng tác</h2><p className="mt-3 max-w-md text-sm leading-6 text-slate-600">{data?.can_create_course ? 'Bắt đầu khóa học đầu tiên của bạn, hoặc chấp nhận lời mời cộng tác khi nhận được.' : 'Khi được mời cộng tác, hãy chấp nhận lời mời để khóa học xuất hiện tại đây.'}</p>{data?.can_create_course ? <Button asChild className="mt-6 coarse-input:h-11 coarse-input:px-5"><Link href={getTeacherCourseCreatePath()}><Plus className="size-4.5 coarse-input:size-5" aria-hidden="true" />Tạo khóa học đầu tiên</Link></Button> : null}</section>}
            {dense ? <div className="space-y-4" aria-label="Công cụ tìm khóa học"><div className="relative"><Search aria-hidden="true" size={18} className="absolute top-3.5 left-3 text-slate-600" /><Input aria-label="Tìm khóa học" placeholder="Tìm theo tên hoặc mô tả khóa học…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 border-slate-500 bg-white pl-10" /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PortfolioFilterSelect label="Trạng thái" value={status} onValueChange={setStatus} options={statusOptions} />
              <PortfolioFilterSelect label="Vai trò" value={role} onValueChange={setRole} options={roleOptions} />
              <div className="sm:col-span-2 lg:col-span-1"><PortfolioFilterSelect label="Sắp xếp" value={sort} onValueChange={setSort} options={sortOptions} /></div>
            </div><p role="status" className="text-xs leading-5 text-slate-600">Hiển thị {courses.length} / {data?.courses.length} khóa học</p></div> : null}
            {dense && !courses.length ? <div className="rounded-2xl border border-slate-300 bg-white p-6"><p className="font-semibold">Không tìm thấy khóa học phù hợp</p><Button variant="link" className="mt-2 px-0 coarse-input:h-11 coarse-input:bg-action coarse-input:px-5 coarse-input:text-action-foreground coarse-input:hover:no-underline" onClick={() => { setQuery(''); setStatus('all'); setRole('all'); }}>Xóa bộ lọc</Button></div> : null}
            <CourseList key={`${normalizedQuery}:${status}:${role}:${sort}`} coursesList={visibleCourses} isLoadingData={false} isPending={busy} courseToDelete={deleting} setCourseToDelete={setDeleting} onEditCourse={editCourse} />
          </div>
        </div>
      </>}
      <DeleteCourseModal courseToDelete={deleting} setCourseToDelete={setDeleting} handleConfirmDelete={confirmDelete} isPending={isPending} />
    </div>
  </div>;
}
