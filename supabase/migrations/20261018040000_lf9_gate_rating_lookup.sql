-- LF9: tra rating theo khóa user/card để bulk trigger không bị generic plan quét lặp.
create or replace function private.lf9_capture_memory_gate(p_user_id uuid, p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cleared uuid[];
  v_active uuid[];
  v_good uuid[];
  v_all_good boolean;
begin
  -- Khi xóa cả topic, cascade không được tạo lại progress của topic đang bị xóa.
  if not exists (select 1 from public.topics t where t.id = p_topic_id) then return; end if;
  insert into public.user_topic_progress (user_id, topic_id)
  values (p_user_id, p_topic_id)
  on conflict (user_id, topic_id) do nothing;

  select p.memory_gate_card_ids into v_cleared
  from public.user_topic_progress p
  where p.user_id = p_user_id and p.topic_id = p_topic_id
  for update;

  -- Tập thẻ và điều kiện đạt phải cùng snapshot: thẻ mới chen vào không được coi là đã đạt.
  select coalesce(array_agg(c.id order by c.id), '{}'::uuid[]),
         coalesce(array_agg(c.id order by c.id) filter (where uf.last_rating >= 3), '{}'::uuid[]),
         coalesce(bool_and(coalesce(uf.last_rating >= 3, false)), true)
  into v_active, v_good, v_all_good
  from public.cards c
  -- LIMIT 1 giữ lookup theo cặp khóa duy nhất, tránh generic plan quét rating của user lại cho từng thẻ.
  left join lateral (
    select r.last_rating from public.user_flashcards r
    where r.user_id = p_user_id and r.card_id = c.id
    limit 1
  ) uf on true
  where c.topic_id = p_topic_id and c.removed_at is null;

  if v_cleared is null then
    if not v_all_good then return; end if;
    v_cleared := v_active;
  else
    v_cleared := array(select distinct id from unnest(v_cleared || v_good) id order by id);
  end if;

  update public.user_topic_progress p set memory_gate_card_ids = v_cleared
  where p.user_id = p_user_id and p.topic_id = p_topic_id
    and p.memory_gate_card_ids is distinct from v_cleared;
end;
$$;
revoke all on function private.lf9_capture_memory_gate(uuid, uuid) from public, anon, authenticated, service_role;
