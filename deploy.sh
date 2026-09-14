#!/usr/bin/env bash
# 从本地源目录同步内容到本仓库并推送到 GitHub（Pages 会自动重新构建）
#
# 用法：
#   ./deploy.sh                  # 使用默认提交信息
#   ./deploy.sh "修复 xxx"        # 自定义提交信息
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_AGENT="$HOME/Desktop/agent-explainer"
SRC_RAG="$HOME/Desktop/rag-explainer"
MSG="${1:-sync: 同步两个站点的最新内容}"

echo "==> 仓库: $REPO_DIR"

for pair in "agent:$SRC_AGENT" "rag:$SRC_RAG"; do
  name="${pair%%:*}"
  src="${pair#*:}"
  dst="$REPO_DIR/$name-explainer"

  if [ ! -f "$src/index.html" ]; then
    echo "!! 跳过 $name：源目录不存在 $src" >&2
    continue
  fi

  cp "$src/index.html" "$dst/index.html"
  cp "$src/styles.css" "$dst/styles.css"
  cp "$src/app.js"     "$dst/app.js"
  echo "   已同步 $name-explainer/  (index.html / styles.css / app.js)"
done

cd "$REPO_DIR"
git add -A

if git diff --cached --quiet; then
  echo "==> 内容无变化，无需提交"
  exit 0
fi

git commit -m "$MSG"
git push origin main

echo "==> 已推送。线上地址（构建约 1 分钟后生效）："
echo "    https://cain0624.github.io/ai-explainer/"
