# BoardKit Basic Example

Minimal example demonstrating BoardKit server and client setup.

## Server

`src/server.ts` shows how to register `BoardModule` with in-memory adapters:

```bash
bun run dev:server
```

## Client

`src/App.tsx` shows how to wrap your React app with `BoardKitProvider`:

```bash
bun run dev:client
```

## Production

In a real application, replace the in-memory adapters with your own implementations of:

- `BoardStorage` — board/page/element CRUD (e.g. Prisma)
- `AssetStorage` — file upload/download (e.g. S3)
- `EventLogStorage` — mutation log for replay/audit
- `BoardAuthGuard` — JWT or session-based authentication
