#!/usr/bin/env bash
# Kịch bản migration PAYCODE (plan §3) trên runtime Supabase cô lập (API 45441, .e2e-runtime).
# Cách dùng, từ Git Bash ở thư mục gốc repo:
#   node --input-type=module -e "import { prepareSupabaseWorkdir } from './scripts/e2e/prepare-supabase-workdir.mjs'; prepareSupabaseWorkdir(process.cwd());"
#   npx supabase --workdir .e2e-runtime start -x studio,imgproxy,realtime,inbucket,edge-runtime,functions,analytics,vector,meta
#   npx supabase --workdir .e2e-runtime status -o env > .e2e-runtime/supabase.env
#   npx supabase --workdir .e2e-runtime db reset --version 20261021090000
#   bash scripts/supabase/test-paycode-order-code-migration.sh [scenario ...]   # mặc định: a b c d d2 e f g1 g2; thứ tự = thứ tự đối số
# Mỗi scenario chạy trong begin; ...; rollback; nên không để lại DDL hay dữ liệu. setval/nextval thì KHÔNG rollback,
# vì vậy mỗi scenario tự đặt sequence về trạng thái đầu (ngoài transaction) trước khi chạy. Sau khi chạy, `db reset` đầy đủ để dọn sequence.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="$REPO/supabase/migrations/20261021100000_paycode_payos_order_code.sql"
DOWN="$REPO/supabase/rollbacks/20261021100000_paycode_payos_order_code.down.sql"
DB=supabase_db_voca_space_e2e
SEQ=public.payos_order_code_seq

# Chặn chạy nhầm: chỉ runtime cô lập (API 45441) và chỉ khi migration PAYCODE chưa được áp.
if ! grep -q '^API_URL="http://127.0.0.1:45441"$' "$REPO/.e2e-runtime/supabase.env" 2>/dev/null; then
  echo "Refusing: $REPO/.e2e-runtime/supabase.env must exist and point at the isolated API http://127.0.0.1:45441." >&2; exit 2
fi
if [ "$(docker exec -i $DB psql -U postgres -Atc "select to_regprocedure('public.next_payos_order_code()') is null" 2>/dev/null)" != "t" ]; then
  echo "Refusing: $DB is unreachable or already has next_payos_order_code(); run 'supabase --workdir .e2e-runtime db reset --version 20261021090000' first." >&2; exit 2
fi
psqlx() { docker exec -i $DB psql -U postgres -X -q -v ON_ERROR_STOP=0 2>&1; }
reset_seq() { echo "select setval('$SEQ', $1, $2);" | psqlx >/dev/null; }
fixture_row() { # gateway code
cat <<EOF
insert into public.payments (id, course_id, amount_original, amount_final, status, gateway, gateway_order_id)
values (gen_random_uuid(), (select id from public.courses limit 1), 1, 1, 'failed', '$1', '$2');
EOF
}
assert_next() { # expected
cat <<EOF
do \$a\$ declare v bigint; begin v := nextval('$SEQ');
  if v <> $1 then raise exception 'FAIL next value % <> $1', v; end if; raise notice 'PASS next value = %', v; end \$a\$;
EOF
}
run() { # name; stdin = sql
  echo "== scenario $1"; out=$(psqlx); echo "$out"; if echo "$out" | grep -q "FAIL"; then echo "RESULT $1: FAIL"; fail; else echo "RESULT $1: ok"; fi; }
# run/check chạy trong pipe (subshell) nên ghi thất bại qua file cờ thay vì biến.
FAILFLAG="$(mktemp -u)"; rm -f "$FAILFLAG"; fail() { touch "$FAILFLAG"; }
check() { out=$(psqlx); echo "$out"; if echo "$out" | grep -qE "FAIL|ERROR"; then echo "RESULT: FAIL"; fail; else echo "RESULT: ok"; fi; }
[ $# -eq 0 ] && set -- a b c d d2 e f g1 g2
for s in "$@"; do
case $s in
a) reset_seq 100000 false
   { echo "begin;"; cat "$MIG"; assert_next 9000000000000; echo "rollback;"; } | run "a no payos rows -> 9000000000000";;
b) reset_seq 100000 false
   { echo "begin;"; fixture_row payos 9000000000123; fixture_row payos ABC-1; fixture_row other 12345678901234567890; cat "$MIG"; assert_next 9000000000124; echo "rollback;"; } | run "b mixed rows -> 9000000000124";;
c) reset_seq 9000000000500 true
   { echo "begin;"; fixture_row payos 9000000000100; cat "$MIG"; assert_next 9000000000501; echo "rollback;"; } | run "c sequence ahead of data not lowered -> 9000000000501";;
d) reset_seq 9000000000500 true
   out=$({ echo "begin;"; fixture_row payos 12345678901234567890; cat "$MIG"; echo "rollback;"; } | psqlx); echo "== scenario d 20-digit payos code aborts"; echo "$out"
   echo "$out" | grep -q "vượt khoảng 13 chữ số" || { echo "FAIL expected range exception"; fail; }
   echo "do \$a\$ declare l bigint; c boolean; f boolean; begin select last_value,is_called into l,c from $SEQ; select to_regprocedure('public.next_payos_order_code()') is not null into f;
     if l<>9000000000500 or not c or f then raise exception 'FAIL sequence/function changed: % % %', l,c,f; end if; raise notice 'PASS sequence unchanged and function absent'; end \$a\$;" | check
   ;;
d2) reset_seq 9999999999999 true
   out=$({ echo "begin;"; cat "$MIG"; echo "rollback;"; } | psqlx); echo "== scenario d2 sequence already at upper bound aborts"; echo "$out"
   echo "$out" | grep -q "vượt khoảng 13 chữ số" || { echo "FAIL expected range exception"; fail; }
   echo "do \$a\$ declare l bigint; c boolean; begin select last_value,is_called into l,c from $SEQ; if l<>9999999999999 or not c then raise exception 'FAIL sequence changed'; end if; raise notice 'PASS sequence unchanged'; end \$a\$;" | check
   ;;
e) reset_seq 100000 false
   { echo "begin;"; cat "$MIG"; cat "$DOWN"; cat <<EOF
do \$a\$ declare l bigint; c boolean; m bigint; f boolean; begin
  select last_value,is_called into l,c from $SEQ; select seqmax into m from pg_sequence where seqrelid='$SEQ'::regclass;
  select to_regprocedure('public.next_payos_order_code()') is not null into f;
  if f or l<>8999999999999 or not c or m<>9223372036854775807 then raise exception 'FAIL rollback state f=% l=% c=% m=%', f,l,c,m; end if;
  raise notice 'PASS rollback dropped function, restored maxvalue, left sequence at %', l; end \$a\$;
rollback;
EOF
   } | run "e rollback file";;
f) reset_seq 100000 false
   { echo "begin;"; cat "$MIG"; cat <<EOF
select setval('$SEQ', 9999999999998, true);
do \$a\$ declare v bigint; begin
  v := nextval('$SEQ'); if v <> 9999999999999 then raise exception 'FAIL last code %', v; end if;
  begin perform nextval('$SEQ'); raise exception 'FAIL no error after last code';
  exception when sqlstate '2200H' then raise notice 'PASS last code 9999999999999 then 2200H'; end;
end \$a\$;
rollback;
EOF
   } | run "f upper bound";;
g1|g2) # lỗi sau migration body: ALTER SEQUENCE phải kéo setval vào cùng rollback
   if [ $s = g1 ]; then L=100000; C=false; else L=150000; C=true; fi
   reset_seq $L $C
   out=$({ echo "begin;"; cat "$MIG"; echo "do \$a\$ begin raise exception 'FORCED failure after migration body'; end \$a\$;"; echo "rollback;"; } | psqlx)
   echo "== scenario $s forced error after migration (sequence $L, is_called=$C)"; echo "$out"
   echo "$out" | grep -q "FORCED failure" || { echo "FAIL expected forced error"; fail; }
   echo "do \$a\$ declare l bigint; c boolean; m bigint; f boolean; begin select last_value,is_called into l,c from $SEQ; select seqmax into m from pg_sequence where seqrelid='$SEQ'::regclass;
     select to_regprocedure('public.next_payos_order_code()') is not null into f;
     if l<>$L or c<>$C or m<>9223372036854775807 or f then raise exception 'FAIL not restored: l=% c=% m=% f=%', l,c,m,f; end if;
     raise notice 'PASS sequence back to ($L, is_called=$C), maxvalue default, function absent'; end \$a\$;" | check;;
esac; done
if [ -e "$FAILFLAG" ]; then rm -f "$FAILFLAG"; echo "OVERALL: FAIL"; exit 1; fi
echo "OVERALL: ok"
