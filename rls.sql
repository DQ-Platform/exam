-- DQ Platform: Supabase RLS (server tərəfində qorunma)
-- DİQQƏT: əvvəlcə TEST layihəsində yoxlayın. Tətbiq etməzdən əvvəl bazanın ehtiyat nüsxəsini götürün.
-- Admin = Supabase Auth ilə təsdiqlənmiş dqplatform7@gmail.com (JWT içindəki e-poçt).

create or replace function public.dq_is_admin() returns boolean
language sql stable as $$ select coalesce(lower(auth.jwt()->>'email'),'') = 'dqplatform7@gmail.com' $$;

-- ===== dq_v2_store =====
alter table dq_v2_store enable row level security;
drop policy if exists "v2 all" on dq_v2_store;
drop policy if exists v2_read on dq_v2_store;
drop policy if exists v2_admin_write on dq_v2_store;
drop policy if exists v2_public_insert on dq_v2_store;

create policy v2_read on dq_v2_store for select using (true);
create policy v2_admin_write on dq_v2_store for all
  using (public.dq_is_admin()) with check (public.dq_is_admin());
-- adi istifadəçi YALNIZ bu kolleksiyalara yeni qeyd əlavə edə bilər (dəyişə/silə bilməz)
create policy v2_public_insert on dq_v2_store for insert
  with check (collection in ('regs','feedback','lxreg','lxpay','sessions','testres','quizres','qm_res','bookorders','push_subs','shotlog','profreq'));

-- ===== imtahan cədvəlləri =====
alter table exam_questions enable row level security;
alter table allowed_students enable row level security;
alter table exam_results enable row level security;
drop policy if exists eq_read on exam_questions;  drop policy if exists eq_admin on exam_questions;
drop policy if exists as_read on allowed_students; drop policy if exists as_admin on allowed_students;
drop policy if exists er_read on exam_results;    drop policy if exists er_ins on exam_results; drop policy if exists er_admin on exam_results;

create policy eq_read on exam_questions for select using (true);
create policy eq_admin on exam_questions for all using (public.dq_is_admin()) with check (public.dq_is_admin());
create policy as_read on allowed_students for select using (true);
create policy as_admin on allowed_students for all using (public.dq_is_admin()) with check (public.dq_is_admin());
create policy er_read on exam_results for select using (true);
create policy er_ins on exam_results for insert with check (true);
create policy er_admin on exam_results for all using (public.dq_is_admin()) with check (public.dq_is_admin());

-- GERİ QAYTARMAQ üçün (problem olsa):
-- create policy "v2 all" on dq_v2_store for all using (true) with check (true);
