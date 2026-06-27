# Threat Model

## Project Overview

This project is a Kanban-style task board with AI-assisted column processing, chat, file attachments, workflow generation, and Zapier MCP integration. The backend is a TypeScript Express server (`server/index.ts`, `server/routes.ts`) with PostgreSQL storage via Drizzle, and the frontend is a React/Vite app. The owner has clarified this is intended as a fun public app without end-user accounts, so future scans should not treat the absence of normal user login as a vulnerability by itself. Instead, the main production risk is whether internet users can trigger paid integrations, expose secrets, vandalize or delete the owner’s data, or cause harmful third-party side effects. Separately, if the repository is made public, tracked helper scripts and fixtures are also in scope because any committed credentials or secret-bearing endpoints can be abused even when the app is never deployed.

## Assets

- **Owner-controlled board, column, card, and chat data** — even if public viewing is acceptable, unauthorized edits or deletion can vandalize the app and destroy the owner’s content.
- **Attachments** — arbitrary uploaded file contents are stored in the database and may include private owner documents or generated assets.
- **AI configuration and prompts** — global prompts, workflow prompts, and per-column instructions affect system behavior and can be changed to force harmful outputs or expensive processing.
- **Secrets and integration credentials** — server-side `OPENAI_API_KEY`, `ZAPIER_MCP_KEY`, database credentials, and any per-column custom OpenAI API keys stored in the database. Exposure would permit external service abuse and direct financial impact.
- **MCP request/response logs and external IDs** — may contain third-party payloads, URLs, and action results that should not be public if they reveal secrets or enable abuse.

## Trust Boundaries

- **Browser to Express API** — every `/api/*` route crosses the main trust boundary; clients are untrusted even if the app is meant to be public.
- **Express to PostgreSQL** — the server can read and write all application data including attachments, prompts, and stored API keys.
- **Express to OpenAI** — server-side requests can incur cost, process sensitive prompt context, and act on either environment or user-supplied API keys.
- **Express to Zapier MCP** — outbound actions can publish or transmit card data to third parties; inbound hooks can create new cards and attachments.
- **Public content vs owner-only control surfaces** — public viewing may be acceptable, but settings, destructive actions, paid actions, and secret-bearing responses still need protection.
- **Development/testing vs production** — many routes are labeled as tests or debugging helpers, but because they are registered unconditionally they remain in production scope unless separately gated.
- **Private workspace vs public source repository** — tracked scripts, sample files, and test helpers become readable to everyone when the repo is public, so they must not embed live credentials or credentialized URLs.

## Scan Anchors

- Production entry points: `server/index.ts`, `server/routes.ts`, `server/routes/mcp.ts`, `server/routes/workflow.ts`.
- Highest-risk areas: board/card/attachment mutation in `server/routes.ts`, OpenAI usage in `server/openai.ts`, image generation in `server/image-generation.ts`, MCP webhook/action handling in `server/routes/mcp.ts` and `server/mcpClient.ts`.
- Public/authenticated/admin boundaries: lack of end-user auth is acceptable for intended public viewing, but owner-only and cost-bearing routes still need separate protection.
- Dev-only areas usually worth ignoring only if gated: `test-*` files in repo root are not production entry points, but test/debug HTTP routes inside `server/routes.ts` are production-reachable and in scope.
- Public-repo secret exposure anchors: root-level helper/test scripts and any files embedding `actions.zapier.com/mcp/` or other integration endpoints with inline secrets.

## Threat Categories

### Spoofing

Even without end-user accounts, the app still needs a notion of “trusted owner/admin action” versus “random internet visitor.” If all callers are treated as equally trusted, attackers can impersonate the owner for destructive or cost-bearing operations. Inbound webhooks also need strong origin verification; signature validation must be mandatory whenever the endpoint is internet-reachable.

Required guarantees:
- Routes that change settings, mutate content, download non-public attachments, trigger paid AI usage, or publish to third parties MUST require a trusted server-side control separate from anonymous public browsing.
- Webhook endpoints MUST reject unsigned or incorrectly signed requests when webhook-triggered actions are enabled.

### Tampering

Attackers must not be able to create, modify, reorder, delete, or externally publish content without authorization. Because the server can trigger GPT and MCP actions, unauthorized write access can lead to both vandalism and unwanted third-party side effects.

Required guarantees:
- Board, column, card, attachment, prompt, and MCP configuration changes MUST be protected from anonymous public mutation.
- Client-supplied identifiers such as board IDs, card IDs, column IDs, and attachment IDs MUST not grant destructive control by themselves.
- Debug/test routes that invoke external services MUST be disabled or access-controlled in production.

### Information Disclosure

Public viewing is not automatically a problem for this app, but secrets, API keys, private attachments, logs, and owner-only configuration still are. If those responses are exposed through normal board or admin endpoints, publishing the app can directly compromise the owner.

Required guarantees:
- API responses MUST exclude secrets such as stored per-column API keys unless there is a narrow owner-only need.
- Non-public attachments, settings, and MCP logs MUST not be disclosed anonymously if they reveal secrets, prompts, or operational details.
- Error and debug responses MUST NOT expose stack traces, request logs, or operational details that aid abuse.

### Denial of Service

Several public routes can trigger expensive operations: GPT processing, image generation, workflow generation, file upload/storage, and outbound integration calls. Without gating or abuse controls, an attacker can consume credits, fill storage, or degrade service.

Required guarantees:
- Publicly reachable AI, upload, and integration-triggering routes MUST have practical abuse controls and SHOULD be owner-only unless intentionally exposed.
- File uploads MUST enforce conservative count, size, and type restrictions that match the product’s real needs.
- Expensive external-service calls MUST not be callable anonymously in production.

### Elevation of Privilege

The key privilege boundary in this project is between harmless public interaction and owner-level control over settings, secrets, paid integrations, and destructive actions. If anonymous callers can reach those surfaces, they effectively gain administrative power.

Required guarantees:
- Administrative or configuration routes MUST be separated from harmless public viewing routes and protected server-side.
- Stored API keys and external publishing capabilities MUST never be exposed through normal board or column retrieval paths.
- Future hardening MUST assume the client is fully attacker-controlled and enforce authorization on the server for owner-impacting operations.
