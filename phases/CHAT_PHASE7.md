# Chat Phase 7: Scale & Ops

## Multi-instance Socket.IO (Redis adapter)
Enable by setting either:
- `REDIS_URL` (preferred), e.g. `redis://localhost:6379`
- or `REDIS_HOST` and optional `REDIS_PORT` (default `6379`)

Behavior:
- If no Redis env vars are set, the server runs in single-instance mode (default in-memory adapter).
- If Redis is configured but connection fails, the server logs a warning and continues in single-instance mode.

## Local Redis via Docker
From the `server/` directory:
- `docker compose -f docker-compose.redis.yml up -d`

## Reverse proxy / load balancer requirements
- Must support `Upgrade: websocket`
- Increase idle timeouts (WebSockets are long-lived)
- With Redis adapter enabled, sticky sessions are not required for broadcasts, but are still recommended in some LB setups.

## Production Socket.IO options (env)
- `SOCKET_PING_INTERVAL_MS` (default `25000`)
- `SOCKET_PING_TIMEOUT_MS` (default `20000`)
- `SOCKET_MAX_HTTP_BUFFER_BYTES` (default `1000000`)

## Rate limiting note
Current limits are in-memory per server instance.
In multi-instance mode, this effectively becomes per-instance rate limiting unless you replace it with a Redis-backed limiter.

