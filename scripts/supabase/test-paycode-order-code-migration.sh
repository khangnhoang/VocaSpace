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
# Quy tắc kết quả: mọi lệnh psql chạy với ON_ERROR_STOP=1 và được kiểm exit status. Scenario thành công chỉ tính đạt khi
# psql exit 0 VÀ in dấu SCENARIO_COMPLETE sau assertion cuối; scenario kỳ vọng lỗi chỉ chấp nhận đúng một lỗi có thông điệp
# mong đợi, rồi kiểm trạng thái ở một lần gọi nghiêm ngặt riêng. Có scenario nào hỏng thì script thoát khác 0.
set -u
shopt -s lastpipe  # phần tử cuối của pipeline chạy trong shell hiện tại để giữ OUT
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="$REPO/supabase/migrations/20261021100000_paycode_payos_order_code.sql"
DOWN="$REPO/supabase/rollbacks/20261021100000_paycode_payos_order_code.down.sql"
DB=supabase_db_voca_space_e2e
SEQ=public.payos_order_code_seq
DONE="SCENARIO_COMPLETE"
RANGE_ERR="vượt khoảng 13 chữ số"
MAXDEF=9223372036854775807

# Chặn chạy nhầm: chỉ runtime cô lập (API 45441) và chỉ khi migration PAYCODE chưa được áp.
if ! grep -q '^API_URL="http://127.0.0.1:45441"$' "$REPO/.e2e-runtime/supabase.env" 2>/dev/null; then
  echo "Refusing: $REPO/.e2e-runtime/supabase.env must exist and point at the isolated API http://127.0.0.1:45441." >&2; exit 2
fi
if [ "$(docker exec -i $DB psql -U postgres -Atc "select to_regprocedure('public.next_payos_order_code()') is null" 2>/dev/null)" != "t" ]; then
  echo "Refusing: $DB is unreachable or already has next_payos_order_code(); run 'supabase --workdir .e2e-runtime db reset --version 20261021090000' first." >&2; exit 2
fi

FAILED=0
# Chạy SQL từ stdin; output vào OUT, trả exit status của psql.
psql_strict() { OUT=$(docker exec -i $DB psql -U postgres -X -q -v ON_ERROR_STOP=1 2>&1); return $?; }
# setval/nextval không rollback được nên mỗi scenario tự đặt sequence trước; lỗi ở đây làm scenario hỏng.
reset_seq() {
  echo "select setval('$SEQ', $1, $2);" | psql_strict && return 0
  echo "$OUT"; echo "FAIL could not reset sequence"; return 1
}
fixture_row() { # gateway code
  echo "insert into public.payments (id, course_id, amount_original, amount_final, status, gateway, gateway_order_id)"
  echo "values (gen_random_uuid(), (select id from public.courses limit 1), 1, 1, 'failed', '$1', '$2');"
}
assert_next() { # expected next value
  echo "do \$a\$ declare v bigint; begin v := nextval('$SEQ');"
  echo "  if v <> $1 then raise exception 'FAIL next value % <> $1', v; end if; raise notice 'PASS next value = %', v; end \$a\$;"
}
# Scenario thành công: bắt buộc exit 0 và có dấu hoàn tất.
expect_complete() { # name status
  echo "$OUT"
  if [ "$2" -eq 0 ] && grep -q "^$DONE\$" <<<"$OUT" && ! grep -q "FAIL" <<<"$OUT"; then
    echo "RESULT $1: ok"
  else
    echo "RESULT $1: FAIL (psql exit $2, markers $(grep -c "^$DONE\$" <<<"$OUT"))"; FAILED=1
  fi
}
# Scenario kỳ vọng lỗi: psql thất bại, đúng một dòng ERROR có thông điệp mong đợi, không có dấu hoàn tất.
expect_error() { # name status message
  echo "$OUT"
  if [ "$2" -ne 0 ] && [ "$(grep -c '^ERROR:' <<<"$OUT")" -eq 1 ] && grep -q "^ERROR:.*$3" <<<"$OUT" && ! grep -q "^$DONE\$" <<<"$OUT"; then
    echo "RESULT $1 (expected error): ok"
  else
    echo "RESULT $1 (expected error): FAIL (psql exit $2)"; FAILED=1
  fi
}
# Kiểm trạng thái sau lỗi bằng một lần gọi nghiêm ngặt riêng.
check_state() { # name last is_called maxvalue fn_exists
  {
    echo "do \$a\$ declare l bigint; c boolean; m bigint; f boolean; begin"
    echo "  select last_value,is_called into l,c from $SEQ; select seqmax into m from pg_sequence where seqrelid='$SEQ'::regclass;"
    echo "  select to_regprocedure('public.next_payos_order_code()') is not null into f;"
    echo "  if l<>$2 or c<>$3 or m<>$4 or f<>$5 then raise exception 'FAIL state: l=% c=% m=% f=%', l,c,m,f; end if;"
    echo "  raise notice 'PASS state ($2, is_called=$3, maxvalue=$4, function exists=$5)'; end \$a\$;"
    echo "\\echo $DONE"
  } | psql_strict
  expect_complete "$1 state" $?
}
# Bọc SQL của một scenario: begin; <thân>; dấu hoàn tất; rollback. Thân đọc từ stdin.
in_txn() { { echo "begin;"; cat; echo "\\echo $DONE"; echo "rollback;"; } | psql_strict; }

[ $# -eq 0 ] && set -- a b c d d2 e f g1 g2
for s in "$@"; do
echo "== scenario $s"
case $s in
a) reset_seq 100000 false || { FAILED=1; continue; }
   { cat "$MIG"; assert_next 9000000000000; } | in_txn; expect_complete "a no payos rows -> 9000000000000" $?;;
b) reset_seq 100000 false || { FAILED=1; continue; }
   { fixture_row payos 9000000000123; fixture_row payos ABC-1; fixture_row other 12345678901234567890; cat "$MIG"; assert_next 9000000000124; } | in_txn
   expect_complete "b mixed rows -> 9000000000124" $?;;
c) reset_seq 9000000000500 true || { FAILED=1; continue; }
   { fixture_row payos 9000000000100; cat "$MIG"; assert_next 9000000000501; } | in_txn
   expect_complete "c sequence ahead of data not lowered -> 9000000000501" $?;;
d) reset_seq 9000000000500 true || { FAILED=1; continue; }
   { fixture_row payos 12345678901234567890; cat "$MIG"; } | in_txn; expect_error "d 20-digit payos code aborts" $? "$RANGE_ERR"
   check_state d 9000000000500 true $MAXDEF false;;
d2) reset_seq 9999999999999 true || { FAILED=1; continue; }
   cat "$MIG" | in_txn; expect_error "d2 sequence already at upper bound aborts" $? "$RANGE_ERR"
   check_state d2 9999999999999 true $MAXDEF false;;
e) reset_seq 100000 false || { FAILED=1; continue; }
   {
     cat "$MIG"; cat "$DOWN"
     echo "do \$a\$ declare l bigint; c boolean; m bigint; f boolean; begin"
     echo "  select last_value,is_called into l,c from $SEQ; select seqmax into m from pg_sequence where seqrelid='$SEQ'::regclass;"
     echo "  select to_regprocedure('public.next_payos_order_code()') is not null into f;"
     echo "  if f or l<>8999999999999 or not c or m<>$MAXDEF then raise exception 'FAIL rollback state f=% l=% c=% m=%', f,l,c,m; end if;"
     echo "  raise notice 'PASS rollback dropped function, restored maxvalue, left sequence at %', l; end \$a\$;"
   } | in_txn; expect_complete "e rollback file" $?;;
f) reset_seq 100000 false || { FAILED=1; continue; }
   {
     cat "$MIG"
     echo "select setval('$SEQ', 9999999999998, true);"
     echo "do \$a\$ declare v bigint; begin"
     echo "  v := nextval('$SEQ'); if v <> 9999999999999 then raise exception 'FAIL last code %', v; end if;"
     echo "  begin perform nextval('$SEQ'); raise exception 'FAIL no error after last code';"
     echo "  exception when sqlstate '2200H' then raise notice 'PASS last code 9999999999999 then 2200H'; end;"
     echo "end \$a\$;"
   } | in_txn; expect_complete "f upper bound" $?;;
g1|g2) # lỗi sau migration body: ALTER SEQUENCE phải kéo setval vào cùng rollback
   if [ "$s" = g1 ]; then L=100000; C=false; else L=150000; C=true; fi
   reset_seq $L $C || { FAILED=1; continue; }
   { cat "$MIG"; echo "do \$a\$ begin raise exception 'FORCED failure after migration body'; end \$a\$;"; } | in_txn
   expect_error "$s forced error after migration (sequence $L, is_called=$C)" $? "FORCED failure"
   check_state "$s" $L $C $MAXDEF false;;
*) echo "unknown scenario $s"; FAILED=1;;
esac; done
if [ "$FAILED" -ne 0 ]; then echo "OVERALL: FAIL"; exit 1; fi
echo "OVERALL: ok"
