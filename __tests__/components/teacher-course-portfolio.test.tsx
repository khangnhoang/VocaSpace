// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherCoursePortfolio from "@/app/(teacher)/teacher/courses/_components/TeacherCoursePortfolio";
import CourseThumbnail from "@/app/(teacher)/teacher/courses/_components/CourseThumbnail";
import { getContinuation, sortAttention } from "@/lib/course-authoring/portfolio";
import type { TeacherAttentionItem, TeacherCoursePortfolio as Portfolio, TeacherPortfolioCourse } from "@/lib/schemas/teacher-course-portfolio";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), update: vi.fn(), remove: vi.fn(), invitations: vi.fn(), accept: vi.fn(), reject: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/course", () => ({ updateCourse: mocks.update, deleteCourse: mocks.remove }));
vi.mock("@/app/actions/course-collaborator", () => ({ getMyPendingCourseCollaboratorInvitations: mocks.invitations, acceptCourseCollaboratorInvitation: mocks.accept, rejectCourseCollaboratorInvitation: mocks.reject }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

// Test plan:
// - Mục tiêu: portfolio dùng contract CP1, phân cấp tiếp tục/queue, lọc và refresh theo kết quả thật.
// - Loại test: component interaction và logic thứ tự; action giả chỉ kiểm tra UI, không chứng minh RLS/persistence.
// - Đối tượng: TeacherCoursePortfolio, PortfolioAttention, CourseList, fallback ảnh, lời mời và form hiện có.
// - Case thành công: empty/sparse/dense, ngưỡng 4/5, Select thật, toàn bộ khóa trong vùng cuộn, lọc/sort đưa vùng cuộn về đầu.
// - Case thất bại: load retry/auth/forbidden, bộ lọc rỗng, mutation lỗi giữ form/dialog, không refresh giả.
// - Bảo mật/phân quyền: previewer không có sửa/xóa course nhưng giữ entry topic do CP1 trả về.
// - Ổn định/resilience: pending khóa thao tác, submit lặp không tạo action thứ hai; dữ liệu sau refresh lấy từ server props.
// - Invariant: lọc queue không thay continuation; correction trước review, mốc cũ trước, tie-break ổn định.
// - Kết quả verify gần nhất: passed trong lượt 75 tests / 6 files của checkpoint cuối.
// - Lệnh: `npm run test:run -- __tests__/actions/teacher-course-portfolio.test.ts __tests__/schemas/teacher-course-portfolio.test.ts __tests__/components/teacher-course-portfolio.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/utils/teacher-portfolio-demo.test.ts __tests__/actions/course.test.ts`.

function course(index = 1, overrides: Partial<TeacherPortfolioCourse> = {}): TeacherPortfolioCourse {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12,'0')}`, title: `Khóa học ${index}`, slug: `khoa-hoc-${index}`, description: 'Mô tả khóa học kiểm thử', price: 0, thumbnail_url: null, status: 'draft', order_index: index, my_role: 'owner', reject_message: null, reviewed_at: null, membership_created_at: `2026-10-${String(index).padStart(2,'0')}T00:00:00Z`, ...overrides };
}
function attention(overrides: Partial<TeacherAttentionItem> = {}): TeacherAttentionItem {
  return { kind:'topic_correction', course_id:course().id, course_title:course().title, topic_id:'10000000-0000-4000-8000-000000000001', topic_title:'Bài học cần bổ sung', reason:'Bổ sung ví dụ giao tiếp.', ordering_at:'2026-10-10T00:00:00Z', ...overrides };
}
function portfolio(courses = [course()], items: TeacherAttentionItem[] = [], create = true): Portfolio { return { courses, attention:items, can_create_course:create }; }
function show(data = portfolio()) { return render(<TeacherCoursePortfolio result={{success:true,data}} />); }
beforeEach(() => {
  vi.clearAllMocks();
  // jsdom không có đo/scroll hoặc Pointer Capture cho Radix Select; không giả logic chọn option.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mocks.invitations.mockResolvedValue({data:[]}); mocks.update.mockResolvedValue({message:'Đã cập nhật'}); mocks.remove.mockResolvedValue({message:'Đã đưa vào thùng rác'}); mocks.accept.mockResolvedValue({success:true}); mocks.reject.mockResolvedValue({success:true});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function choose(label: string, option: string) {
  fireEvent.pointerDown(screen.getByRole('combobox', { name: label }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('teacher course portfolio', () => {
  it('keeps all twenty work items available, with complete category counts and independent continuation', async () => {
    const items = Array.from({length:16},(_,index) => attention({
      kind:index < 10 ? 'topic_review' : 'topic_correction',
      reason:index < 10 ? null : 'Bổ sung ví dụ thực hành.',
      course_id:course(index % 8 + 1).id,
      topic_id:`10000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
      topic_title:`Bài học ${index+1}`,
    }));
    items.push(...Array.from({length:4},(_,index) => attention({kind:'course_rejection',course_id:course(index+1).id,topic_id:null,topic_title:null})));
    show(portfolio(Array.from({length:8},(_,index)=>course(index+1)),items));
    const queue=()=>screen.getByRole('region',{name:'Kết quả việc cần xử lý'});
    expect(within(queue()).getAllByRole('link')).toHaveLength(20);
    const continuation=document.querySelector('#continuation-heading')?.textContent;
    queue().scrollTop=300;
    fireEvent.click(screen.getByRole('button',{name:'Chờ duyệt 10'}));
    expect(queue().scrollTop).toBe(0);
    expect(within(queue()).getAllByRole('link')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button',{name:'Cần sửa 10'}));
    expect(within(queue()).getAllByRole('link')).toHaveLength(10);
    expect(document.querySelector('#continuation-heading')?.textContent).toBe(continuation);
    fireEvent.click(screen.getByRole('button',{name:'Tất cả 20'}));
    expect(within(queue()).getAllByRole('link')).toHaveLength(20);
    await waitFor(()=>expect(mocks.invitations).toHaveBeenCalled());
  });
  it('exposes eight invitations with a total, full object names and no technical slug copy', async () => {
    mocks.invitations.mockResolvedValue({data:Array.from({length:8},(_,index)=>({id:`invite-${index}`,courseTitle:`Khóa mời ${index}`,courseSlug:`slug-${index}`,role:'editor',canReviewTopics:false}))});
    show();
    const region=await screen.findByRole('region',{name:'Danh sách lời mời cộng tác'});
    expect(within(region).getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByLabelText('8 lời mời')).toBeTruthy();
    expect(within(region).queryByText(/slug-/)).toBeNull();
  });
  it('locks invitation responses while pending and keeps the invitation after a denied response', async () => {
    let finish!: (value:{error:string})=>void;
    mocks.accept.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    mocks.invitations.mockResolvedValue({data:[{id:'invite-1',courseTitle:'Khóa được mời',role:'editor',canReviewTopics:false}]});
    show();
    fireEvent.click(await screen.findByRole('button',{name:'Chấp nhận'}));
    await waitFor(()=>expect(mocks.accept).toHaveBeenCalledTimes(1));
    expect((screen.getByRole('button',{name:'Đang nhận…'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button',{name:'Từ chối'}) as HTMLButtonElement).disabled).toBe(true);
    await act(async()=>finish({error:'Không thể chấp nhận.'}));
    expect(screen.getByText('Khóa được mời')).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect((screen.getByRole('button',{name:'Chấp nhận'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it('does not report a confirmed invitation response as failed when the following list refresh throws', async () => {
    mocks.invitations.mockResolvedValueOnce({data:[{id:'invite-1',courseTitle:'Khóa được mời',role:'editor',canReviewTopics:false}]}).mockRejectedValueOnce(new Error('network'));
    show();
    fireEvent.click(await screen.findByRole('button',{name:'Chấp nhận'}));
    await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith('Lời mời đã được xử lý nhưng chưa tải lại được danh sách. Vui lòng tải lại trang.'));
    expect(mocks.success).toHaveBeenCalledWith('Đã chấp nhận lời mời cộng tác.');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it('falls back from a broken thumbnail and can display a replacement URL without stock imagery', () => {
    const view = render(<div><CourseThumbnail src="http://127.0.0.1:45321/missing.png" sizes="56px" /></div>);
    const image = screen.getByAltText('');
    expect(image.getAttribute('src')).toBe('http://127.0.0.1:45321/missing.png');
    fireEvent.error(image);
    expect(screen.queryByAltText('')).toBeNull();
    view.rerender(<div><CourseThumbnail src="http://127.0.0.1:45321/new.png" sizes="56px" /></div>);
    expect(screen.getByAltText('').getAttribute('src')).toBe('http://127.0.0.1:45321/new.png');
  });
  it('selects correction before review, oldest timestamps and stable identities without mutating input', () => {
    const review = attention({kind:'topic_review', reason:null, ordering_at:'2026-01-01T00:00:00Z'});
    const newer = attention({course_id:course(2).id, ordering_at:'2026-10-11T00:00:00Z'});
    const older = attention({course_id:course(3).id});
    expect(sortAttention([review,newer,older])).toEqual([older,newer,review]);
    const tie = attention({topic_id:'10000000-0000-4000-8000-000000000002'});
    expect(sortAttention([tie,attention()])).toEqual([attention(),tie]);
    expect(getContinuation(portfolio([course(),course(2),course(3)],[review,newer,older])).course?.id).toBe(course(3).id);
    expect(getContinuation(portfolio([course(),course(2)])).course?.id).toBe(course(2).id);
    expect(getContinuation(portfolio([course(2,{membership_created_at:course().membership_created_at}),course()])).course?.id).toBe(course().id);
  });
  it('shows an actionable empty state without search or fake course counts', async () => {
    show(portfolio([]));
    expect(screen.getByRole('heading',{name:'Chưa có khóa học đang cộng tác'})).toBeTruthy();
    expect(screen.getByRole('link',{name:'Tạo khóa học đầu tiên'}).getAttribute('href')).toBe('/teacher/courses/new');
    expect(screen.queryByRole('textbox',{name:'Tìm khóa học'})).toBeNull();
    await waitFor(() => expect(mocks.invitations).toHaveBeenCalled());
  });
  it('renders four sparse courses once each and keeps queue filters independent from continuation', async () => {
    show(portfolio([course(),course(2),course(3),course(4)],[attention(), attention({kind:'topic_review',reason:null,topic_id:'10000000-0000-4000-8000-000000000002',topic_title:'Bài cần duyệt'})]));
    expect(screen.queryByRole('textbox',{name:'Tìm khóa học'})).toBeNull();
    expect(screen.getAllByText('Khóa học 4')).toHaveLength(1);
    const queue = ()=>screen.getByRole('region',{name:'Kết quả việc cần xử lý'});
    expect(within(queue()).getAllByRole('link')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button',{name:'Chờ duyệt 1'}));
    expect(within(queue()).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('heading',{name:'Khóa học 1'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'Chờ duyệt 1'}).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(mocks.invitations).toHaveBeenCalled());
  });
  it('enables dense search, lifecycle/role filters, deterministic sort and clear without changing architecture', async () => {
    show(portfolio([course(),course(2,{my_role:'previewer',status:'published'}),course(3),course(4),course(5)]));
    const rows = () => within(screen.getByRole('list',{name:'Danh sách khóa học'})).getAllByRole('listitem');
    expect(rows()).toHaveLength(5);
    await choose('Sắp xếp', 'Tên A–Z');
    expect(rows()[0].textContent).toContain('Khóa học 1');
    await choose('Vai trò', 'Chỉ xem trước');
    expect(rows()).toHaveLength(1);
    await choose('Trạng thái', 'Bản nháp');
    expect(screen.getByText('Không tìm thấy khóa học phù hợp')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Xóa bộ lọc'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Tìm khóa học'}),{target:{value:'Khóa học 3'}});
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('textbox',{name:'Tìm khóa học'})).toBeTruthy();
    await waitFor(() => expect(mocks.invitations).toHaveBeenCalled());
  });
  it.each([10,12])('keeps all %s courses in an accessible scroll region without pagination or changing continuation', async (count) => {
    show(portfolio(Array.from({length:count},(_,index)=>course(index+1))));
    const rows=()=>within(screen.getByRole('list',{name:'Danh sách khóa học'})).getAllByRole('listitem');
    const continuation=document.querySelector('#continuation-heading')?.textContent;
    const region=screen.getByRole('region',{name:'Kết quả khóa học'});
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(rows()).toHaveLength(count);
    const seen=rows().map(row=>within(row).getByRole('link',{name:/^Khóa học/}).getAttribute('href'));
    expect(new Set(seen).size).toBe(count);
    expect(screen.queryByRole('navigation',{name:'Phân trang khóa học'})).toBeNull();
    expect(screen.getByText('Cuộn trong danh sách để xem các khóa học còn lại.')).toBeTruthy();
    expect(document.querySelector('#continuation-heading')?.textContent).toBe(continuation);
    await waitFor(()=>expect(mocks.invitations).toHaveBeenCalled());
  });
  it('searches and filters the complete list, resets scroll on sort/filter and displays refreshed server results', async () => {
    const courses=Array.from({length:12},(_,index)=>course(index+1,index===0?{my_role:'previewer',status:'published'}:{}));
    const view=show(portfolio(courses));
    const rows=()=>within(screen.getByRole('list',{name:'Danh sách khóa học'})).getAllByRole('listitem');
    const region=()=>screen.getByRole('region',{name:'Kết quả khóa học'});
    region().scrollTop=300;
    fireEvent.change(screen.getByRole('textbox',{name:'Tìm khóa học'}),{target:{value:'Khóa học 1'}});
    expect(rows()).toHaveLength(4);
    expect(region().scrollTop).toBe(0);
    expect(screen.getByText('Hiển thị 4 / 12 khóa học')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox',{name:'Tìm khóa học'}),{target:{value:''}});
    region().scrollTop=300;
    await choose('Sắp xếp','Tên A–Z');
    expect(region().scrollTop).toBe(0);
    expect(rows()).toHaveLength(12);
    expect(rows()[0].textContent).toContain('Khóa học 1');
    region().scrollTop=300;
    await choose('Vai trò','Chỉ xem trước');
    expect(region().scrollTop).toBe(0);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Khóa học 1');
    await choose('Trạng thái','Bản nháp');
    expect(screen.getByText('Không tìm thấy khóa học phù hợp')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Xóa bộ lọc'}));
    view.rerender(<TeacherCoursePortfolio result={{success:true,data:portfolio(courses.slice(0,6))}} />);
    expect(screen.getByText('Hiển thị 6 / 6 khóa học')).toBeTruthy();
    expect(rows()).toHaveLength(6);
    await waitFor(()=>expect(mocks.invitations).toHaveBeenCalled());
  });
  it('keeps global create and authorized topic work for previewers without course mutations', async () => {
    show(portfolio([course(1,{my_role:'previewer'})],[attention()]));
    expect(screen.getByRole('link',{name:'Tạo khóa học'})).toBeTruthy();
    expect(screen.getByRole('link',{name:'Sửa: Bài học cần bổ sung'}).getAttribute('href')).toContain('/topics/');
    expect(screen.queryByRole('button',{name:/Cài đặt/})).toBeNull();
    expect(screen.queryByRole('button',{name:/thùng rác/})).toBeNull();
    await waitFor(() => expect(mocks.invitations).toHaveBeenCalled());
  });
  it('does not suggest creation for a read-only empty portfolio', async () => {
    show(portfolio([],[],false));
    expect(screen.queryByRole('link',{name:/Tạo khóa học/})).toBeNull();
    expect(screen.getByText(/Khi được mời cộng tác/)).toBeTruthy();
    await waitFor(() => expect(mocks.invitations).toHaveBeenCalled());
  });
  it('renders safe load failures and retries only recoverable errors', () => {
    const view=render(<TeacherCoursePortfolio result={{success:false,errorCode:'UNAVAILABLE',error:'Thử lại sau.'}} />);
    fireEvent.click(screen.getByRole('button',{name:'Thử lại'}));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    view.rerender(<TeacherCoursePortfolio result={{success:false,errorCode:'AUTH_REQUIRED',error:'Đăng nhập lại.'}} />);
    expect(screen.getByRole('link',{name:'Đăng nhập'}).getAttribute('href')).toBe('/login');
    view.rerender(<TeacherCoursePortfolio result={{success:false,errorCode:'FORBIDDEN',error:'Không có quyền.'}} />);
    expect(screen.queryByRole('button',{name:'Thử lại'})).toBeNull();
  });
  it('preserves failed edits, prevents repeat submit and refreshes only after confirmed success', async () => {
    let finish!: (value: {error:string})=>void;
    mocks.update.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    show();
    fireEvent.click(screen.getByRole('button',{name:'Cài đặt thông tin'}));
    fireEvent.change(screen.getByLabelText('Tên khóa học'),{target:{value:'Tên khóa học đã sửa'}});
    const save = screen.getByRole('button',{name:/Lưu|Cập nhật/});
    fireEvent.click(save);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    fireEvent.click(save);
    await act(async () => finish({error:'Không thể lưu.'}));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Tên khóa học') as HTMLInputElement).value).toBe('Tên khóa học đã sửa');
    fireEvent.click(screen.getByRole('button',{name:/Lưu|Cập nhật/}));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[1][1] as FormData;
    expect(payload.get('title')).toBe('Tên khóa học đã sửa');
  });
  it('opens the image chooser through a keyboard-accessible button without submitting the edit', async () => {
    show();
    fireEvent.click(screen.getByRole('button',{name:'Cài đặt thông tin'}));
    const input=document.getElementById('file-upload') as HTMLInputElement;
    const choose=vi.spyOn(input,'click').mockImplementation(()=>{});
    fireEvent.click(screen.getByRole('button',{name:'Tải ảnh lên'}));
    expect(choose).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
    choose.mockRestore();
    await waitFor(()=>expect(mocks.invitations).toHaveBeenCalled());
  });
  it('keeps delete confirmation on error and refreshes after a confirmed soft-delete', async () => {
    mocks.remove.mockResolvedValueOnce({error:'Chưa thể xóa.'});
    show();
    fireEvent.click(screen.getByRole('button',{name:'Đưa vào thùng rác'}));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Khóa học 1');
    fireEvent.click(within(dialog).getByRole('button',{name:'Đưa vào thùng rác'}));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Chưa thể xóa.'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button',{name:'Đưa vào thùng rác'}));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
  it.each([true,false])('responds to an invitation and refreshes authoritative portfolio (accept=%s)', async (accept) => {
    mocks.invitations.mockResolvedValueOnce({data:[{id:'invite-1',courseTitle:'Khóa được mời',courseSlug:'khoa-moi',role:'editor',canReviewTopics:false}]}).mockResolvedValue({data:[]});
    const view=show(portfolio([]));
    fireEvent.click(await screen.findByRole('button',{name:accept ? 'Chấp nhận' : 'Từ chối'}));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(accept ? mocks.accept : mocks.reject).toHaveBeenCalledWith({invitationId:'invite-1'});
    view.rerender(<TeacherCoursePortfolio result={{success:true,data:portfolio(accept ? [course()] : [])}} />);
    expect(screen.queryByText('Khóa được mời')).toBeNull();
    if (accept) expect(screen.getByRole('heading',{name:'Khóa học 1'})).toBeTruthy();
  });
});
