import Image from "next/image";

interface Instructor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  experience_years: number | null;
  certifications: string | null;
}

interface TeacherCollabGroupProps {
  owner: Instructor;
  collaborators: Instructor[];
}

export default function TeacherCollabGroup({
  owner,
  collaborators,
}: TeacherCollabGroupProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      {/* Giảng viên chính */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center text-white text-2xl font-bold overflow-hidden shrink-0">
          {owner.avatar_url ? (
            <Image
              src={owner.avatar_url}
              alt={owner.full_name || "Avatar"}
              fill
              sizes="64px" // Vì avatar có kích thước cố định h-16 w-16 (64px)
              className="object-cover"
            />
          ) : (
            owner.full_name?.charAt(0) || "T"
          )}
        </div>
        <div>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
            Giảng viên chính
          </span>
          <h4 className="text-lg font-bold text-slate-800 mt-1">
            {owner.full_name}
          </h4>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {owner.bio}
          </p>
        </div>
      </div>

      {/* Cộng tác viên */}
      {collaborators.length > 0 && (
        <div className="flex items-center gap-3 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
          {/* ĐÃ SỬA: Xóa bỏ 'overflow-hidden' ở đây để Popover có thể tràn ra ngoài */}
          <div className="flex -space-x-3">
            {collaborators.map((collab) => (
              <div key={collab.id} className="relative group">
                {/* Avatar */}
                <div className="inline-flex h-10 w-10 rounded-full bg-slate-300 border-2 border-white shadow-sm items-center justify-center font-bold text-sm text-slate-700 overflow-hidden ring-1 ring-slate-100 cursor-pointer hover:scale-105 transition-transform relative z-10 group-hover:z-20">
                  {collab.avatar_url ? (
                    <Image
                      src={collab.avatar_url}
                      alt={collab.full_name || "Avatar"}
                      fill
                      sizes="64px" // Vì avatar có kích thước cố định h-16 w-16 (64px)
                      className="object-cover"
                    />
                  ) : (
                    collab.full_name?.charAt(0)
                  )}
                </div>

                {/* Popover Box (Chỉ hiện khi hover vào Avatar) */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-slate-900 text-white text-sm rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-4 pointer-events-none">
                  <h5 className="font-bold text-emerald-400 mb-1">
                    {collab.full_name}
                  </h5>
                  {collab.bio && (
                    <p className="text-xs text-slate-300 mb-3 line-clamp-2 leading-relaxed">
                      {collab.bio}
                    </p>
                  )}
                  <div className="flex flex-col gap-1.5 text-[11px] text-slate-300">
                    {collab.experience_years && (
                      <div className="flex justify-between items-center border-b border-slate-700 pb-1.5">
                        <span className="font-medium text-slate-400">
                          Kinh nghiệm:
                        </span>
                        <span className="font-bold text-white">
                          {collab.experience_years} năm
                        </span>
                      </div>
                    )}
                    {collab.certifications && (
                      <div className="flex justify-between items-center pt-0.5">
                        <span className="font-medium text-slate-400">
                          Chứng chỉ:
                        </span>
                        <span
                          className="font-bold text-white text-right max-w-25 truncate"
                          title={collab.certifications}
                        >
                          {collab.certifications}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Mũi tên tam giác trỏ xuống */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900"></div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700">
              +{collaborators.length} Cộng tác viên
            </p>
            <p className="text-[11px] text-slate-400">
              Đồng biên soạn nội dung
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
