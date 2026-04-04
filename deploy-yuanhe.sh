#!/bin/bash
# 缘合 YuanHe 一键部署脚本
# 服务器: Ubuntu 22.04 (Oracle Cloud)

set -e
echo "========================================="
echo "  缘合 YuanHe 部署脚本"
echo "========================================="

# 1. 安装 Node.js 18 (如果没有)
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    echo "📦 安装 Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "✅ Node.js: $(node -v)"

# 2. 安装 PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    sudo npm install -g pm2
fi
echo "✅ PM2: $(pm2 -v)"

# 3. 安装 Nginx (如果没有)
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi
echo "✅ Nginx: $(nginx -v 2>&1)"

# 4. 克隆/更新项目
PROJECT_DIR="/home/ubuntu/projects/yuanhe"
if [ -d "$PROJECT_DIR" ]; then
    echo "🔄 更新项目..."
    cd $PROJECT_DIR
    git fetch origin && git reset --hard origin/main
else
    echo "📥 克隆项目..."
    cd /home/ubuntu/projects
    git clone https://github.com/ericjepsen9/chat-Fortune-telling.git yuanhe
    cd $PROJECT_DIR
fi

# 5. 安装依赖
echo "📦 安装依赖..."
npm install

# 6. 创建 .env
echo "⚙️ 配置环境变量..."
cat > .env << 'EOF'
LLM_BASE_URL=https://api.minimax.io/v1
LLM_API_KEY=sk-cp-8cqZD3bXGG6NBNOIRKjnM3kKw94yUTtybEHUWIiCuudopE-OoGJOTFvWUUJBOSikZe9FbsIYNonfLVB5WnVwSepSCuRApMwkfoW53vuSQUchFnoAwrw0X2c
LLM_MODEL=MiniMax-M2.7
SERVER_PORT=3000
EOF

# 7. PM2 启动
echo "🚀 启动应用..."
pm2 delete yuanhe 2>/dev/null || true
pm2 start server.js --name yuanhe
pm2 save

# 8. PM2 开机自启
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

# 9. 配置 Nginx
echo "🌐 配置 Nginx..."
sudo tee /etc/nginx/sites-available/yuanhe > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    # 缘合 App
    location /app {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    # SSE streaming
    location /api/divine-stream {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding off;
    }
}
NGINX

# 启用站点
sudo ln -sf /etc/nginx/sites-available/yuanhe /etc/nginx/sites-enabled/yuanhe
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# 测试并重启 Nginx
sudo nginx -t && sudo systemctl restart nginx

# 10. 开放防火墙
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true

# 获取公网IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "YOUR_IP")

echo ""
echo "========================================="
echo "  ✅ 部署完成！"
echo "========================================="
echo ""
echo "  访问地址: http://${PUBLIC_IP}/app"
echo ""
echo "  管理命令:"
echo "    pm2 logs yuanhe    # 查看日志"
echo "    pm2 restart yuanhe # 重启"
echo "    pm2 status         # 状态"
echo ""
echo "  更新部署:"
echo "    cd $PROJECT_DIR"
echo "    git pull origin main"
echo "    pm2 restart yuanhe"
echo ""
echo "========================================="
