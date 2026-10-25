# @podverse/api

Data API and backend services for the Podverse ecosystem.

## Overview

The Podverse API provides RESTful endpoints for all client applications, handling authentication, podcast data, user management, and premium membership features.

## Quick Start

### Prerequisites

- Node.js v24+
- PostgreSQL database
- Redis (key-value store)
- RabbitMQ (message queue)
- Podcast Index API credentials

### Setup

1. Install dependencies from the monorepo root:

```bash
npm install
```

2. Copy the environment example file:

```bash
cp .env.example .env
```

3. Configure your `.env` file. See [ENV.md](ENV.md) for detailed documentation.

**Important**: The `AUTH_JWT_SECRET` must be a valid UUID:

```bash
# Generate a UUID
uuidgen
```

4. Build the packages (from monorepo root):

```bash
npm run build:packages
```

### Running

Development mode:

```bash
npm run dev:api
```

Development mode with hot reload:

```bash
npm run dev:watch -w apps/api
```

Build for production:

```bash
npm run build:prod -w apps/api
```

## Docker

Build Docker image:

```bash
# From monorepo root
make local_build_api

# Or directly
docker build -f apps/api/Dockerfile -t podverse-api:latest .
```

Test with docker-compose (requires infrastructure running):

```bash
make local_infra_up
make local_test_api
```

## API Endpoints

The API exposes endpoints at `{host}:{port}/api/v2/`:

- OpenAPI UI: `/api/v2/docs`
- OpenAPI YAML: `/api/v2/docs.yaml`

- `/auth/*` - Authentication
- `/user/*` - User management
- `/podcast/*` - Podcast data
- `/episode/*` - Episode data
- `/clip/*` - Media clips
- `/playlist/*` - User playlists
- And more...

### Account event stream

`GET /api/v2/account/events` is the account's one server-sent events stream, with cookie or bearer
auth. Event names are namespaced: `notification.*` and `session.*` are in use, and `playback.*` is
reserved for cross-device playback state and control commands, which carry no SSE id. Only events
that carry an SSE id replay from `Last-Event-ID`. API pods receive account changes from the Redis
channel `podverse:account-events` and fan them out to the streams they hold.

Ending a session from anywhere closes that session's streams on every pod at once, through a
`session.ended` event on `podverse:account-events`. The stream sends `session.ended` with the
signed-out notice and then ends. Streams still end after 30 minutes; that is the backstop when the
event is lost (a Redis outage) and when an account is deleted. A session-ended 401 on this route
keeps the `jwt` cookie, because `EventSource` cannot read the body.

A proxy in front of the API must:

- Not buffer `text/event-stream` responses.
- Allow idle connections longer than 25 seconds, the heartbeat interval.
- Serve HTTP/2 to browsers where possible, so open tabs do not use up the per-origin connection
  limit.

## Environment Configuration

See [ENV.md](ENV.md) for complete documentation of all environment variables.

Key configuration:

- `ACCOUNT_SIGNUP_MODE` - `'admin_only_username'`, `'admin_only_email'`, or `'user_signup_email'`
- `AUTH_JWT_SECRET` - Must be a valid UUID
- Database, Redis, and RabbitMQ connections

## License

AGPLv3
