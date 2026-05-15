# SliceDrop WebSocket Signaling

Standalone WebSocket signaling service for SliceDrop Reloaded peer-to-peer sharing.

This service does not store or relay NIfTI file bytes. It only relays WebRTC setup messages between one sender and one receiver in a temporary room.

## Deploy

Build and run:

```bash
docker build -t slicedrop-signaling .
docker run --rm -p 8080:8080 --env-file .env slicedrop-signaling
```

Dokploy can build this folder directly from the `Dockerfile`.

## Environment

Copy `.env.example` to `.env` and adjust:

```bash
PORT=8080
ALLOWED_ORIGINS=https://slicedrop.github.io,https://your-viewer-domain.example
ROOM_TTL_MS=1800000
MAX_MESSAGE_BYTES=65536
MAX_CONNECTIONS_PER_IP=50
MAX_ROOMS_PER_IP=20
MAX_MESSAGES_PER_MINUTE_PER_IP=240
```

If `ALLOWED_ORIGINS` is empty, all origins are accepted. For a public deployment, set it.

## Viewer Config

Point SliceDrop Reloaded at this service with a WebSocket URL:

```txt
https://slicedrop.github.io/reloaded/?signal=wss://signal.example.com
```

The current viewer can also be configured by setting:

```js
window.SLICEDROP_SIGNALING_URL = "wss://signal.example.com";
```

## API

Health check:

```txt
GET /healthz
```

Create room:

```json
{ "type": "create" }
```

Join room:

```json
{ "type": "join", "roomId": "..." }
```

Relay WebRTC signal:

```json
{
  "type": "signal",
  "roomId": "...",
  "payload": {
    "description": { "type": "offer", "sdp": "..." }
  }
}
```

or:

```json
{
  "type": "signal",
  "roomId": "...",
  "payload": {
    "candidate": { "candidate": "...", "sdpMid": "0", "sdpMLineIndex": 0 }
  }
}
```

## Abuse Controls

- 128-bit random room IDs
- one sender and one receiver per room
- room TTL cleanup
- max WebSocket message size
- per-IP connection limit
- per-IP active room limit
- per-IP message rate limit
- optional origin allowlist
- strict signaling message validation
- no long-term SDP logging
