#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
用法：npm run deploy:pages -- [--project 项目名] [--branch 分支]

环境变量：
  CLOUDFLARE_PAGES_PROJECT  Cloudflare Pages 项目名（必填，可被 --project 覆盖）
  CLOUDFLARE_ACCOUNT_ID     Cloudflare 账户 ID（可选）
EOF
  exit 0
fi

project="${CLOUDFLARE_PAGES_PROJECT:-}"
branch=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) project="${2:-}"; shift 2 ;;
    --branch) branch="${2:-}"; shift 2 ;;
    *) echo "未知参数：$1（使用 --help 查看用法）" >&2; exit 2 ;;
  esac
done

if [[ -z "$project" ]]; then
  echo "缺少 Pages 项目名，请设置 CLOUDFLARE_PAGES_PROJECT 或传入 --project 项目名" >&2
  exit 2
fi
command -v npm >/dev/null 2>&1 || { echo "未找到 npm" >&2; exit 127; }
npx --yes wrangler --version >/dev/null 2>&1 || { echo "无法使用 Wrangler，请检查网络或先运行 npm install" >&2; exit 127; }
npm run build
[[ -f dist/index.html ]] || { echo "构建完成但缺少 dist/index.html" >&2; exit 1; }

args=(pages deploy dist --project-name "$project")
[[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] && args+=(--account-id "$CLOUDFLARE_ACCOUNT_ID")
[[ -n "$branch" ]] && args+=(--branch "$branch")
exec npx --yes wrangler "${args[@]}"
