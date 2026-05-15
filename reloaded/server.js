const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || process.argv[2] || 8080);
const rooms = new Map();
const clients = new Set();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  let pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname.startsWith("/share/") && /^\/share\/(css|gfx|js|matcaps)\//.test(pathname)) {
    pathname = pathname.replace(/^\/share/, "");
  }

  if (pathname === "/" || pathname.startsWith("/share/")) {
    pathname = "/index.html";
  }

  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.on("upgrade", (request, socket) => {
  if (request.headers.upgrade.toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }

  const key = request.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n"));

  const client = { socket, buffer: Buffer.alloc(0), roomId: null, role: null };
  clients.add(client);

  socket.on("data", (chunk) => handleSocketData(client, chunk));
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

server.listen(port, () => {
  console.log(`SliceDrop Reloaded sharing server running at http://localhost:${port}`);
});

function handleSocketData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);

  while (true) {
    const frame = readFrame(client.buffer);
    if (!frame) {
      return;
    }

    client.buffer = client.buffer.slice(frame.bytesRead);

    if (frame.opcode === 0x8) {
      removeClient(client);
      client.socket.end();
      return;
    }

    if (frame.opcode !== 0x1) {
      continue;
    }

    try {
      handleMessage(client, JSON.parse(frame.payload.toString("utf8")));
    } catch (error) {
      sendJson(client, { type: "error", message: "Invalid signaling message." });
    }
  }
}

function handleMessage(client, message) {
  if (message.type === "create") {
    const roomId = createRoomId();
    rooms.set(roomId, { host: client, guest: null });
    client.roomId = roomId;
    client.role = "host";
    sendJson(client, { type: "created", roomId });
    return;
  }

  if (message.type === "join") {
    const room = rooms.get(message.roomId);
    if (!room || !room.host) {
      sendJson(client, { type: "error", message: "Share room was not found." });
      return;
    }

    if (room.guest && room.guest !== client) {
      sendJson(client, { type: "error", message: "Share room already has a receiver." });
      return;
    }

    room.guest = client;
    client.roomId = message.roomId;
    client.role = "guest";
    sendJson(client, { type: "joined", roomId: message.roomId });
    sendJson(room.host, { type: "peer-joined" });
    return;
  }

  if (message.type === "signal") {
    const room = rooms.get(message.roomId || client.roomId);
    const peer = getPeer(client, room);
    if (peer) {
      sendJson(peer, { type: "signal", payload: message.payload });
    }
  }
}

function getPeer(client, room) {
  if (!room) {
    return null;
  }

  if (room.host === client) {
    return room.guest;
  }

  if (room.guest === client) {
    return room.host;
  }

  return null;
}

function removeClient(client) {
  if (!clients.has(client)) {
    return;
  }

  clients.delete(client);

  if (client.roomId) {
    const room = rooms.get(client.roomId);
    const peer = getPeer(client, room);
    if (peer) {
      sendJson(peer, { type: "peer-left" });
    }

    if (room) {
      if (room.host === client) {
        rooms.delete(client.roomId);
      } else if (room.guest === client) {
        room.guest = null;
      }
    }
  }
}

function createRoomId() {
  let roomId = "";
  do {
    roomId = crypto.randomBytes(6).toString("base64url");
  } while (rooms.has(roomId));

  return roomId;
}

function sendJson(client, payload) {
  if (!client || client.socket.destroyed) {
    return;
  }

  client.socket.write(writeFrame(Buffer.from(JSON.stringify(payload))));
}

function readFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }

  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  const masked = Boolean(second & 0x80);
  let length = second & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const bigLength = buffer.readBigUInt64BE(offset);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Frame too large");
    }
    length = Number(bigLength);
    offset += 8;
  }

  if (!masked) {
    throw new Error("Client frames must be masked");
  }

  if (buffer.length < offset + 4 + length) {
    return null;
  }

  const mask = buffer.slice(offset, offset + 4);
  offset += 4;

  const payload = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    payload[i] = buffer[offset + i] ^ mask[i % 4];
  }

  return {
    opcode,
    payload,
    bytesRead: offset + length,
  };
}

function writeFrame(payload) {
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}
