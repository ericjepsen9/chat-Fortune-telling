#!/bin/bash
# 缘合 YuanHe — 每日数据备份脚本
# 用法: crontab -e → 0 3 * * * /path/to/scripts/backup.sh
# 保留最近7天的备份

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"
BACKUP_DIR="$SCRIPT_DIR/../backups"
KEEP_DAYS=7

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份日期标记
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/yuanhe_data_$DATE.tar.gz"

# 打包data目录
if [ -d "$DATA_DIR" ]; then
  tar -czf "$BACKUP_FILE" -C "$SCRIPT_DIR/.." data/
  echo "[$(date)] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  echo "[$(date)] ERROR: Data directory not found: $DATA_DIR"
  exit 1
fi

# 清理超过KEEP_DAYS天的旧备份
find "$BACKUP_DIR" -name "yuanhe_data_*.tar.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Old backups cleaned (keeping ${KEEP_DAYS} days)"
