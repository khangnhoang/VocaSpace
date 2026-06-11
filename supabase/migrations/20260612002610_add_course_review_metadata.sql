alter table public.courses
add column reject_message text,
add column submitted_at timestamp with time zone,
add column reviewed_by uuid,
add column reviewed_at timestamp with time zone;

alter table only public.courses
add constraint courses_reviewed_by_fkey
foreign key (reviewed_by) references public.profiles(id);
