import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Activity,
  Sparkles,
  GraduationCap,
  Facebook,
  Instagram,
  Youtube,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// Khuôn dữ liệu chuẩn theo bảng courses của Supabase
type Course = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string;
  price: number;
};

// Dữ liệu giả lập (Mock Data)
const mockCourses: Course[] = [
  {
    id: "1",
    title: "Chinh phục TOEIC 800+ (Lộ trình cấp tốc)",
    slug: "chinh-phuc-toeic-800",
    thumbnail_url:
      "https://images.sftcdn.net/images/t_app-icon-m/p/4faf3a69-ddbf-46ea-82a1-361b93b38039/1523908730/toeic-new-format-toeic-test-logo",
    price: 500000,
  },
  {
    id: "2",
    title: "Bứt phá IELTS 7.0+ Kỹ năng Speaking & Writing",
    slug: "but-pha-ielts-7-0",
    thumbnail_url:
      "https://thumbs.dreamstime.com/z/toeic-test-english-international-communication-word-cloud-french-language-toeic-test-english-international-200096486.jpg?ct=jpeg",
    price: 850000,
  },
  {
    id: "3",
    title: "Tiếng Anh Giao Tiếp Chuyên Ngành IT",
    slug: "tieng-anh-giao-tiep-it",
    thumbnail_url:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop",
    price: 0, // Miễn phí
  },
  {
    id: "4",
    title: "Làm Chủ Ngữ Pháp Tiếng Anh Nền Tảng",
    slug: "ngu-phap-neng-tang",
    thumbnail_url:
      "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1000&auto=format&fit=crop",
    price: 299000,
  },
];

export default function Home() {
  return (
    <div className="w-full flex flex-col">
      <div className="container mx-auto px-4 pt-8 md:pt-12">
        <Carousel opts={{ loop: true }} className="w-full relative">
          <CarouselContent>
            <CarouselItem>
              <section className="grid grid-cols-1 md:grid-cols-2 bg-white border border-gray-100 rounded-2xl items-center gap-6 p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="grid grid-cols-1 justify-center gap-4 p-2 md:p-6 order-2 md:order-1 w-full">
                  <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Hành Trình Không Bao Giờ Kết Thúc
                  </p>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                    Làm chủ TOEIC/IELTS với phương pháp Spaced Repetition
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Kích thích não bộ ghi nhớ sâu từ vựng trọng tâm. Tối ưu thời
                    gian ôn luyện để đạt mục tiêu trong thời gian ngắn nhất.
                  </p>
                  <Button className="bg-[#5FE8EF] hover:bg-[#42d2da] text-white font-bold text-sm h-12 px-8 rounded-md mt-2 transition-colors w-full lg:w-1/2 cursor-pointer">
                    Bắt đầu học ngay
                  </Button>
                </div>

                <div className="w-full h-full order-1 md:order-2 relative min-h-[250px] md:min-h-[300px]">
                  <Image
                    src="https://th.bing.com/th/id/R.09889873d7b7d028493c2d22f3a2796b?rik=IYsqaD%2b3WsoHYA&riu=http%3a%2f%2fanhnguedusa.com%2fwp-content%2fuploads%2f2022%2f10%2fcach-tu-hoc-toeic-950.jpg&ehk=R2Q%2bWri62XWQxq9310nAklX%2bDmuFnQtgXn1zqvwo1Uc%3d&risl=&pid=ImgRaw&r=0"
                    alt="Luyện thi TOEIC"
                    fill
                    className="w-full h-full object-cover rounded-2xl"
                  />
                </div>
              </section>
            </CarouselItem>
            <CarouselItem>
              <section className="grid grid-cols-1 md:grid-cols-2 bg-white border border-gray-100 lg:rounded-2xl items-center gap-6 p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="grid grid-cols-1 justify-center gap-4 p-2 md:p-6 order-2 md:order-1 w-full">
                  <p className="text-xs font-bold tracking-wider text-blue-500 uppercase">
                    Bức phá TOEIC 800+
                  </p>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                    Phá Vỡ Bức Tường Khoảng Cách Cùng Chúng Tôi
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Các phương pháp giảng dạy chuẩn quốc tế mà bạn chỉ có thể
                    biết từ VocaSpace.
                  </p>
                  <Button className="bg-[#5FE8EF] hover:bg-[#42d2da] text-white font-bold text-sm h-12 px-8 rounded-md mt-2 transition-colors w-full lg:w-1/2 cursor-pointer">
                    Khám phá lộ trình
                  </Button>
                </div>
                <div className="h-full order-1 md:order-2 relative min-h-[250px] md:min-h-[300px]">
                  <Image
                    src="https://media.zim.vn/67208412b312991111f96f4b/toeic-bridge.jpg?w=1920&q=75"
                    alt="Toeic"
                    fill
                    className="object-cover rounded-2xl"
                  />
                </div>
              </section>
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 lg:-left-12 border-gray-200" />
          <CarouselNext className="hidden md:flex -right-4 lg:-right-12 border-gray-200" />
        </Carousel>
      </div>

      <div className="p-4 mt-4 lg:mt-8 grid grid-cols-1 gap-4 lg:gap-2 container mx-auto">
        <h1 className="text-xl font-bold">Các Khóa Học Hiện Có</h1>
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-3 gap-4">
            {mockCourses.map((course) => (
              // BẮT BUỘC: Thêm key={course.id} để React phân biệt các thẻ
              <div
                key={course.id}
                className="border p-3 rounded-2xl bg-white flex flex-col gap-3 w-full hover:shadow-lg transition-all duration-300"
              >
                {/* Ảnh khóa học: Chèn course.thumbnail_url */}
                <div className="aspect-video relative rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    fill
                    className="object-cover"
                    src={course.thumbnail_url}
                    alt={course.title}
                  />
                </div>

                <div className="flex flex-col gap-2 flex-1 mt-1">
                  {/* Tên khóa học: Chèn course.title */}
                  <h3 className="font-bold text-gray-900 line-clamp-2 leading-snug">
                    {course.title}
                  </h3>

                  {/* Giá tiền: Format VND, nếu giá bằng 0 thì hiện chữ Miễn phí */}
                  <div className="mt-auto">
                    {course.price === 0 ? (
                      <p className="font-extrabold text-blue-400">Miễn phí</p>
                    ) : (
                      <p className="font-bold text-blue-400">
                        {course.price.toLocaleString("vi-VN")}đ
                      </p>
                    )}
                  </div>

                  <Button className="bg-[#5FE8EF] hover:bg-[#42d2da] text-white rounded-xl w-full mt-2 cursor-pointer">
                    Xem chi tiết
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full flex items-center justify-center">
        <div className="border border-gray-100 lg:mt-2 mb-4 w-2/3 lg:w-full"></div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-center">
          Tại sao chọn VocaSpace?
        </h2>
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 p-4 lg:py-12">
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all duration-300 group">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4 group-hover:-translate-y-1 transition-transform">
              <Activity size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Spaced Repetition
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Ghi nhớ từ vựng vĩnh viễn với thuật toán lặp lại ngắt quãng thông
              minh, tối ưu hóa thời gian ôn tập.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#5FE8EF]/30 hover:shadow-lg transition-all duration-300 group">
            <div className="p-4 bg-[#5FE8EF]/10 text-[#2db2b9] rounded-full mb-4 group-hover:-translate-y-1 transition-transform">
              <Sparkles size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              AI Assistant
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Hỗ trợ giải đáp thắc mắc 24/7.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-gray-100 hover:border-orange-100 hover:shadow-lg transition-all duration-300 group">
            <div className="p-4 bg-orange-50 text-orange-500 rounded-full mb-4 group-hover:-translate-y-1 transition-transform">
              <GraduationCap size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Interactive Exercises
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Bài tập trắc nghiệm và Video tương tác sinh động.
            </p>
          </div>
        </div>
      </div>
      <div className="w-full flex justify-center">
        <div className="border border-gray-100 lg:mt-2 mb-4 w-2/3 lg:w-full"></div>
      </div>
      <div className="container mx-auto p-4 flex flex-col my-8">
        <h2 className="text-2xl md:text-2xl font-extrabold text-gray-900 mb-6">
          Học viên nói gì về VocaSpace?
        </h2>

        {/* CARD ĐÁNH GIÁ ĐÃ ĐƯỢC NÂNG CẤP */}
        <div className="flex flex-col p-6 gap-4 bg-white border border-gray-100 rounded-2xl w-full md:w-1/2 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-default">
          {/* 1. Phần Header Card: Avatar + Tên + Đánh giá Sao xếp ngang */}
          <div className="flex items-center gap-4">
            {/* Vòng sáng nhẹ quanh Avatar */}
            <Avatar className="h-14 w-14 border-2 border-blue-50 ring-2 ring-[#5FE8EF]/20">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CV</AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <p className="font-bold text-gray-900 text-lg">Cao Thế Vinh</p>
              {/* Thêm dòng sao đánh giá cho uy tín */}
              <div className="flex text-yellow-400 text-sm mt-0.5">★★★★★</div>
            </div>
          </div>

          {/* 2. Phần Nội dung: Nằm trọn vẹn ở dưới, in nghiêng, màu xám */}
          <div>
            <p className="text-gray-600 italic leading-relaxed text-sm md:text-base relative">
              <span className="text-3xl text-gray-200 absolute -top-2 -left-2 font-serif"></span>
              &nbsp;&nbsp;&nbsp;Khóa học tinh gọn học rất được. Hệ thống Spaced
              Repetition hoạt động cực kỳ mượt mà, giúp mình tiết kiệm được cả
              đống thời gian học từ vựng.
            </p>
          </div>
        </div>
      </div>
      <div>
        <div className="w-full flex items-center justify-center">
          <div className="border border-gray-100 lg:mt-2 mb-4 w-2/3 lg:w-full"></div>
        </div>
        <footer className="bg-[#1D1F22] text-white py-12">
          {/* Khu vực nội dung chính: Tự động dàn ngang (flex-row) trên màn hình vừa và lớn (md) */}
          <div className="container mx-auto px-4 flex flex-col gap-10 md:flex-row md:justify-between md:items-start">
            {/* Cột 1: Logo & Slogan */}
            <div className="flex flex-col gap-4 items-center md:items-start text-center md:text-left md:w-1/3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#5FE8EF] to-blue-500 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform duration-300">
                VocaSpace
              </h2>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                Hành trình không bao giờ kết thúc. Nền tảng học tập thông minh
                giúp bạn làm chủ ngôn ngữ và công nghệ.
              </p>

              {/* Icon Mạng xã hội: Có hiệu ứng hover sáng đèn và nảy lên */}
              <div className="flex gap-4 mt-2">
                <Link
                  href="https://facebook.com"
                  target="_blank"
                  className="p-2 bg-white/5 rounded-full text-gray-400 hover:bg-blue-600 hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-lg"
                >
                  <Facebook size={20} />
                </Link>
                <Link
                  href="https://instagram.com"
                  target="_blank"
                  className="p-2 bg-white/5 rounded-full text-gray-400 hover:bg-pink-600 hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-lg"
                >
                  <Instagram size={20} />
                </Link>
                <Link
                  href="https://www.youtube.com"
                  target="_blank"
                  className="p-2 bg-white/5 rounded-full text-gray-400 hover:bg-red-600 hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-lg"
                >
                  <Youtube size={20} />
                </Link>
              </div>
            </div>

            {/* Cột 2: Điều hướng (Sử dụng hiệu ứng trượt ngang khi hover) */}
            <div className="flex flex-col gap-3 items-center md:items-start">
              <h3 className="font-semibold text-lg text-gray-200 mb-2">
                Điều hướng
              </h3>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Home
              </Link>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Product
              </Link>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Contact Us
              </Link>
            </div>

            {/* Cột 3: Pháp lý */}
            <div className="flex flex-col gap-3 items-center md:items-start">
              <h3 className="font-semibold text-lg text-gray-200 mb-2">
                Pháp lý
              </h3>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Privacy Policy
              </Link>
              <Link
                href="#"
                className="text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300"
              >
                Terms of Use
              </Link>
            </div>
          </div>

          {/* Đường kẻ phân cách (Dùng border-t thay cho div trắng tốn diện tích) */}
          <div className="container mx-auto px-4 mt-12 pt-8 border-t border-gray-700/50">
            <p className="text-center text-sm text-gray-500">
              Copyright © 2026 VocaSpace. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
