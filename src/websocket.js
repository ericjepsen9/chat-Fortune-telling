/**
 * 缘合 WebSocket — 实时消息 + 在线状态
 *
 * 协议: JSON messages over ws
 * 认证: 连接时发 { type:'auth', token:'Bearer xxx' }
 * 消息类型:
 *   C→S: auth, message, typing, read, ping
 *   S→C: auth_ok, auth_fail, message, typing, read, online, pong, error
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

// Online connections: { userId: Set<ws> }
const connections = new Map();
// Typing indicators: { `${from}-${to}`: timeout }
const typingTimers = {};

function init(server, auth) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.userId = null;
    ws.authed = false;

    // 10秒内必须认证，否则断开
    const authTimeout = setTimeout(() => {
      if (!ws.authed) {
        send(ws, { type: 'auth_fail', error: '认证超时' });
        ws.close();
      }
    }, 10000);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }

      switch (msg.type) {
        case 'auth':
          handleAuth(ws, msg, auth, authTimeout);
          break;
        case 'message':
          if (ws.authed) handleMessage(ws, msg, auth);
          break;
        case 'typing':
          if (ws.authed) handleTyping(ws, msg);
          break;
        case 'read':
          if (ws.authed) handleRead(ws, msg);
          break;
        case 'ping':
          send(ws, { type: 'pong', ts: Date.now() });
          break;
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (ws.userId) {
        const userConns = connections.get(ws.userId);
        if (userConns) {
          userConns.delete(ws);
          if (userConns.size === 0) {
            connections.delete(ws.userId);
            broadcastOnlineStatus(ws.userId, false);
          }
        }
      }
    });

    ws.on('pong', () => { ws.isAlive = true; });
  });

  // 心跳检测 — 30秒ping一次
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  console.log('🔌 WebSocket 服务已启动 (path: /ws)');
  return wss;
}

// ============ Handlers ============

function handleAuth(ws, msg, auth, authTimeout) {
  const token = (msg.token || '').replace('Bearer ', '');
  if (!token) {
    send(ws, { type: 'auth_fail', error: '缺少token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, auth.JWT_SECRET);
    const user = auth.getProfile(decoded.uid);
    if (!user) {
      send(ws, { type: 'auth_fail', error: '用户不存在' });
      return;
    }

    ws.userId = decoded.uid;
    ws.authed = true;
    clearTimeout(authTimeout);

    // 记录连接
    if (!connections.has(ws.userId)) connections.set(ws.userId, new Set());
    connections.get(ws.userId).add(ws);

    // 广播上线
    broadcastOnlineStatus(ws.userId, true);

    // 返回在线用户列表
    const onlineIds = Array.from(connections.keys());
    send(ws, { type: 'auth_ok', userId: ws.userId, online: onlineIds });

  } catch (e) {
    send(ws, { type: 'auth_fail', error: 'Token无效' });
  }
}

function handleMessage(ws, msg, auth) {
  const { to, text, msgType, mediaUrl, voiceDuration } = msg;
  if (!to || !text?.trim()) return;

  const message = {
    id: require('crypto').randomUUID(),
    from: ws.userId,
    to,
    text: text.substring(0, 2000),
    msgType: msgType || 'text',
    mediaUrl: mediaUrl || null,
    voiceDuration: voiceDuration || null,
    createdAt: new Date().toISOString(),
  };

  // 持久化消息
  auth.saveMessage(ws.userId, to, message);

  // 发送给接收方(如果在线)
  sendToUser(to, { type: 'message', message });

  // 确认给发送方
  send(ws, { type: 'message_ack', id: message.id, createdAt: message.createdAt });
}

function handleTyping(ws, msg) {
  const { to } = msg;
  if (!to) return;

  const key = `${ws.userId}-${to}`;
  // 清除之前的typing timer
  if (typingTimers[key]) clearTimeout(typingTimers[key]);

  // 通知对方
  sendToUser(to, { type: 'typing', from: ws.userId });

  // 3秒后自动清除
  typingTimers[key] = setTimeout(() => { delete typingTimers[key]; }, 3000);
}

function handleRead(ws, msg) {
  const { conversationWith, lastReadAt } = msg;
  if (!conversationWith) return;

  // 通知对方消息已读
  sendToUser(conversationWith, {
    type: 'read',
    from: ws.userId,
    lastReadAt: lastReadAt || new Date().toISOString(),
  });
}

// ============ Helpers ============

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function sendToUser(userId, data) {
  const userConns = connections.get(userId);
  if (userConns) {
    for (const ws of userConns) {
      send(ws, data);
    }
  }
}

function broadcastOnlineStatus(userId, online) {
  // 通知所有已认证的连接
  for (const [uid, conns] of connections) {
    if (uid === userId) continue;
    for (const ws of conns) {
      send(ws, { type: 'online', userId, online });
    }
  }
}

function isOnline(userId) {
  return connections.has(userId) && connections.get(userId).size > 0;
}

function getOnlineUsers() {
  return Array.from(connections.keys());
}

module.exports = { init, isOnline, getOnlineUsers, sendToUser };
