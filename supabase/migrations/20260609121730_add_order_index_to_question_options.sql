-- Add base ordering support for question options.
-- order_index is zero-based:
-- A -> 0, B -> 1, C -> 2, D -> 3, E -> 4, ...

alter table public.question_options
add column order_index integer;

with ranked_options as (
  select
    id,
    row_number() over (
      partition by question_id
      order by
        case
          when upper(coalesce(label, '')) ~ '^[A-Z]$'
            then ascii(upper(label)) - ascii('A')
          else 999
        end,
        created_at,
        id
    ) - 1 as new_order_index
  from public.question_options
)
update public.question_options qo
set order_index = ranked_options.new_order_index
from ranked_options
where qo.id = ranked_options.id;

create index question_options_question_id_order_index_idx
on public.question_options (question_id, order_index)
where removed_at is null;