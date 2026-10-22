#!/bin/bash
# ============================================
# 辅导员工作站 · 本地版（MVC + SQLite）启动脚本
# 双击本文件即可启动服务，并自动打开浏览器。
# 停止：关闭弹出的终端窗口，或按 Ctrl+C。
# ============================================
cd "$(dirname "$0")"

# 优先使用 macOS 系统自带 Python3（标准库已包含 sqlite3，无需安装任何依赖）
PY=""
if [ -x /usr/bin/python3 ]; then
  PY=/usr/bin/python3
elif command -v python3 >/dev/null 2>&1; then
  PY=$(command -v python3)
fi

if [ -z "$PY" ]; then
  echo "未找到 python3。macOS 系统通常自带，若缺失请先安装 Python 3。"
  echo "安装后重新双击本文件即可。"
  read -n 1 -s -r -p "按任意键关闭窗口…"
  exit 1
fi

echo "正在启动辅导员工作站…"
"$PY" server.py
