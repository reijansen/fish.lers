# Chat Phase 6: Reliability & Safety

## Reconnect + resync (client)
- On socket connect/reconnect, the client refetches `GET /api/chat/conversations` and uses the returned `unreadCounts` as the source of truth.
- If a conversation is currently open, the client re-joins it (`conversation:join`) and refetches message history.

## Idempotency + dedup
- Client sends a stable `clientMessageID` (UUID) with `message:send`.
- Server treats `clientMessageID` as an idempotency key and returns the existing message if it already exists.
- Client dedupes incoming `message:new` events by `messageID` and `clientMessageID`.

## Rate limits (env configurable)
Environment variables (server):
- `CHAT_MAX_MESSAGE_LENGTH` (default `2000`)
- `CHAT_RATE_MESSAGE_MAX` / `CHAT_RATE_MESSAGE_WINDOW_MS` (default `10` per `10000ms`)
- `CHAT_RATE_TYPING_MAX` / `CHAT_RATE_TYPING_WINDOW_MS` (default `30` per `10000ms`)
- `CHAT_RATE_READ_MAX` / `CHAT_RATE_READ_WINDOW_MS` (default `60` per `10000ms`)

Rate limiting is in-memory (per server instance).

## Socket ack error shape
All socket acks follow:
- Success: `{ ok: true, ... }`
- Error: `{ ok: false, code, error }`

