#!/usr/bin/env bash
# Dựng runtime Supabase cô lập (API 45441, workdir .e2e-runtime) trong phiên Claude Code cloud.
# Chỉ chạy khi phiên cloud cần DB local; máy local đã có runtime riêng nên script từ chối chạy ở đó.
# Chạy lại an toàn: runtime đang chạy thì giữ nguyên, chỉ ghi lại file env.
set -euo pipefail

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  echo "Script này chỉ dành cho phiên Claude Code cloud (CLAUDE_CODE_REMOTE=true)." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
workdir=".e2e-runtime"
log_dir="${TMPDIR:-/tmp}/vocaspace-cloud-db"
mkdir -p "$log_dir"

# Container cloud không tự bật Docker daemon.
if ! docker info >/dev/null 2>&1; then
  nohup dockerd >"$log_dir/dockerd.log" 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  docker info >/dev/null 2>&1 || { echo "Docker daemon không lên; xem $log_dir/dockerd.log" >&2; exit 1; }
fi

if [[ ! -x node_modules/.bin/supabase ]]; then
  npm ci
fi

if ! npx supabase --workdir "$workdir" status >/dev/null 2>&1; then
  node --input-type=module -e "import { prepareSupabaseWorkdir } from './scripts/e2e/prepare-supabase-workdir.mjs'; prepareSupabaseWorkdir(process.cwd());"
  # Proxy cloud chặn CDN của public.ecr.aws nên kéo image từ Docker Hub; Docker Hub có thể trả 429, khi đó chờ rồi chạy lại.
  # Bỏ cùng các service như job learner-integrity trong CI, dùng tên container mà CLI 2.106 chấp nhận.
  SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase --workdir "$workdir" start \
    -x studio,imgproxy,realtime,mailpit,edge-runtime,logflare,vector,postgres-meta
fi

# Ghi qua file tạm để script bị ngắt giữa chừng không để lại supabase.env rỗng.
npx supabase --workdir "$workdir" status -o env >"$workdir/supabase.env.tmp"
mv "$workdir/supabase.env.tmp" "$workdir/supabase.env"
# shellcheck disable=SC1091
source "$workdir/supabase.env"
if [[ "${API_URL:-}" != "http://127.0.0.1:45441" ]]; then
  echo "Runtime cô lập phải ở API 45441, đang là '${API_URL:-}'." >&2
  exit 1
fi

cat <<EOF
Runtime cô lập đã sẵn sàng ở $API_URL. Chạy integration test với:
  set -a && source $workdir/supabase.env && set +a
  ALLOW_DB_INTEGRATION_TESTS=true NEXT_PUBLIC_SUPABASE_URL="\$API_URL" \\
    NEXT_PUBLIC_SUPABASE_ANON_KEY="\${ANON_KEY:-\$PUBLISHABLE_KEY}" \\
    SUPABASE_SERVICE_ROLE_KEY="\${SERVICE_ROLE_KEY:-\$SECRET_KEY}" \\
    E2E_SUPABASE_WORKDIR=$workdir npm run test:integration -- <file>
EOF
