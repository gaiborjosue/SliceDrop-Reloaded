import crypto from "node:crypto";
import http from "node:http";
import { WebSocketServer } from "ws";

const config = {
  port: numberFromEnv("PORT", 8080),
  maxMessageBytes: numberFromEnv("MAX_MESSAGE_BYTES", 64 * 1024),
  roomTtlMs: numberFromEnv("ROOM_TTL_MS", 30 * 60 * 1000),
  cleanupIntervalMs: numberFromEnv("CLEANUP_INTERVAL_MS", 60 * 1000),
  maxConnections: numberFromEnv("MAX_CONNECTIONS", 2000),
  maxRooms: numberFromEnv("MAX_ROOMS", 1000),
  maxRoomsPerIp: numberFromEnv("MAX_ROOMS_PER_IP", 20),
  maxConnectionsPerIp: numberFromEnv("MAX_CONNECTIONS_PER_IP", 50),
  maxMessagesPerMinutePerIp: numberFromEnv("MAX_MESSAGES_PER_MINUTE_PER_IP", 240),
  allowedOrigins: csvFromEnv("ALLOWED_ORIGINS"),
};

const rooms = new Map();
const clients = new Set();
const ipStats = new Map();

const server = http.createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      connections: clients.size,
      rooms: rooms.size,
    }));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("Not found");
});

const wss = new WebSocketServer({
  server,
  maxPayload: config.maxMessageBytes,
  verifyClient: ({ origin, req }, done) => {
    if (!isAllowedOrigin(origin)) {
      done(false, 403, "Forbidden origin");
      return;
    }

    const ip = getIp(req);
    const stats = statsForIp(ip);

    if (clients.size >= config.maxConnections || stats.connections >= config.maxConnectionsPerIp) {
      done(false, 429, "Too many connections");
      return;
    }

    done(true);
  },
});

wss.on("connection", (socket, request) => {
  const client = {
    id: crypto.randomUUID(),
    ip: getIp(request),
    socket,
    roomId: null,
    role: null,
  };

  clients.add(client);
  statsForIp(client.ip).connections += 1;

  socket.on("message", (raw) => handleRawMessage(client, raw));
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

setInterval(expireRooms, config.cleanupIntervalMs).unref();

server.listen(config.port, () => {
  console.log(`SliceDrop signaling server listening on :${config.port}`);
});

function handleRawMessage(client, raw) {
  if (!consumeMessageBudget(client.ip)) {
    closeWithError(client, "Rate limit exceeded", 1008);
    return;
  }

  let message;
  try {
    message = JSON.parse(raw.toString("utf8"));
  } catch {
    closeWithError(client, "Invalid JSON", 1003);
    return;
  }

  if (!message || typeof message.type !== "string") {
    closeWithError(client, "Invalid message", 1003);
    return;
  }

  if (message.type === "create") {
    handleCreate(client);
    return;
  }

  if (message.type === "join") {
    handleJoin(client, message);
    return;
  }

  if (message.type === "signal") {
    handleSignal(client, message);
    return;
  }

  closeWithError(client, "Unknown message type", 1003);
}

function handleCreate(client) {
  if (client.roomId) {
    sendJson(client, { type: "error", message: "Client is already in a room." });
    return;
  }

  if (rooms.size >= config.maxRooms) {
    sendJson(client, { type: "error", message: "Server room limit reached." });
    return;
  }

  const stats = statsForIp(client.ip);
  if (stats.rooms >= config.maxRoomsPerIp) {
    sendJson(client, { type: "error", message: "Too many active rooms from this network." });
    return;
  }

  const roomId = createRoomId();
  const room = {
    id: roomId,
    host: client,
    guests: new Map(),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  rooms.set(roomId, room);
  stats.rooms += 1;
  client.roomId = roomId;
  client.role = "host";
  sendJson(client, { type: "created", roomId });
}

function handleJoin(client, message) {
  if (client.roomId) {
    sendJson(client, { type: "error", message: "Client is already in a room." });
    return;
  }

  const roomId = normalizeRoomId(message.roomId);
  const room = roomId ? rooms.get(roomId) : null;

  if (!room || !room.host) {
    sendJson(client, { type: "error", message: "Share room was not found." });
    return;
  }

  if (room.host === client) {
    sendJson(client, { type: "error", message: "Sender cannot join its own room." });
    return;
  }

  room.guests.set(client.id, client);
  room.lastSeenAt = Date.now();
  client.roomId = roomId;
  client.role = "guest";

  sendJson(client, { type: "joined", roomId, clientId: client.id, hostId: room.host.id });
  sendJson(room.host, { type: "peer-joined", peerId: client.id });
}

function handleSignal(client, message) {
  const roomId = normalizeRoomId(message.roomId || client.roomId);
  const room = roomId ? rooms.get(roomId) : null;
  const peer = getSignalPeer(client, room, message.targetId);

  if (!peer) {
    sendJson(client, { type: "error", message: "Peer is not connected." });
    return;
  }

  if (!isValidSignalPayload(message.payload)) {
    closeWithError(client, "Invalid signal payload", 1003);
    return;
  }

  room.lastSeenAt = Date.now();
  sendJson(peer, {
    type: "signal",
    payload: message.payload,
    senderId: client.id,
    targetId: peer.id,
  });
}

function getSignalPeer(client, room, targetId) {
  if (!room) {
    return null;
  }

  if (room.host === client) {
    return typeof targetId === "string" ? room.guests.get(targetId) : null;
  }

  if (room.guests.get(client.id) === client) {
    return room.host;
  }

  return null;
}

function removeClient(client) {
  if (!clients.has(client)) {
    return;
  }

  clients.delete(client);
  const stats = statsForIp(client.ip);
  stats.connections = Math.max(0, stats.connections - 1);

  if (!client.roomId) {
    return;
  }

  const room = rooms.get(client.roomId);
  if (!room) {
    return;
  }

  if (room.host === client) {
    rooms.delete(room.id);
    stats.rooms = Math.max(0, stats.rooms - 1);

    for (const guest of room.guests.values()) {
      sendJson(guest, { type: "peer-left", peerId: client.id });
      guest.roomId = null;
      guest.role = null;
    }
  } else if (room.guests.get(client.id) === client) {
    room.guests.delete(client.id);
    sendJson(room.host, { type: "peer-left", peerId: client.id });
  }
}

function expireRooms() {
  const now = Date.now();

  for (const room of rooms.values()) {
    if (now - room.lastSeenAt <= config.roomTtlMs) {
      continue;
    }

    sendJson(room.host, { type: "error", message: "Share room expired." });

    for (const guest of room.guests.values()) {
      sendJson(guest, { type: "error", message: "Share room expired." });
      guest.roomId = null;
      guest.role = null;
    }

    if (room.host) {
      room.host.roomId = null;
      room.host.role = null;
      statsForIp(room.host.ip).rooms = Math.max(0, statsForIp(room.host.ip).rooms - 1);
    }

    rooms.delete(room.id);
  }
}

function sendJson(client, payload) {
  if (!client || client.socket.readyState !== client.socket.OPEN) {
    return;
  }

  client.socket.send(JSON.stringify(payload));
}

function closeWithError(client, message, code) {
  sendJson(client, { type: "error", message });
  client.socket.close(code, message.slice(0, 120));
}

function createRoomId() {
  let roomId = "";
  do {
    roomId = crypto.randomBytes(16).toString("base64url");
  } while (rooms.has(roomId));

  return roomId;
}

function normalizeRoomId(value) {
  if (typeof value !== "string" || value.length > 64) {
    return "";
  }

  return value;
}

function isValidSignalPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  if ("description" in payload) {
    const description = payload.description;
    if (!description || typeof description !== "object") {
      return false;
    }
    if (!["offer", "answer", "rollback", "pranswer"].includes(description.type)) {
      return false;
    }
    if (typeof description.sdp !== "string") {
      return false;
    }
  }

  if ("candidate" in payload) {
    const candidate = payload.candidate;
    if (!candidate || typeof candidate !== "object") {
      return false;
    }
    if (typeof candidate.candidate !== "string") {
      return false;
    }
  }

  return "description" in payload || "candidate" in payload;
}

function isAllowedOrigin(origin) {
  if (config.allowedOrigins.length === 0) {
    return true;
  }

  return origin && config.allowedOrigins.includes(origin);
}

function getIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return request.socket.remoteAddress || "unknown";
}

function statsForIp(ip) {
  const now = Date.now();
  let stats = ipStats.get(ip);

  if (!stats) {
    stats = {
      connections: 0,
      rooms: 0,
      messageWindowStartedAt: now,
      messageCount: 0,
    };
    ipStats.set(ip, stats);
  }

  if (now - stats.messageWindowStartedAt >= 60 * 1000) {
    stats.messageWindowStartedAt = now;
    stats.messageCount = 0;
  }

  return stats;
}

function consumeMessageBudget(ip) {
  const stats = statsForIp(ip);
  stats.messageCount += 1;
  return stats.messageCount <= config.maxMessagesPerMinutePerIp;
}

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function csvFromEnv(name) {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
