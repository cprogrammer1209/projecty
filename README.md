# ProjectY

A personal, production-grade project management application modeled on **Zoho Projects** (including the 2026 "Infinity" release).

**Goals, in priority order:**
1. **Finish it.** Ship a complete, usable product, not a pile of half-built modules.
2. **Learn along the way:** multi-tenancy, microservices, event-driven design, Angular, and Spring Boot at production depth.

**Stack:** Angular (frontend) and Spring Boot microservices (backend). Four services: Platform, Work, Notification, and Automation. See [Architecture Overview](docs/04-architecture-overview.md).

---

## Get the code

The app repos (`frontend`, `admin-console`, `platform-service`) are git submodules, so clone with `--recurse-submodules`:

```bash
git clone --recurse-submodules https://github.com/cprogrammer1209/projecty.git
cd projecty
```

Already cloned without it? Run `git submodule update --init --recursive`. To pull the latest of everything later: `git pull --recurse-submodules && git submodule update --remote` (the second command moves each app to its newest `master`).

---

## Run locally

Prerequisites: Docker, Java 21, Node 22.

```bash
docker compose up -d                              # Postgres :5432, Mailpit :8025, Kafka :9092, Kafka UI :8088
cd platform-service && ./mvnw spring-boot:run     # Platform service :8081
cd frontend && npm start                          # Angular :4200
cd admin-console && npm start                     # Admin console :4300
```

| What | URL | Login |
|---|---|---|
| App | http://localhost:4200 | — |
| Admin console | http://localhost:4300 | `admin@projecty.local` / `projecty-admin-dev` (created at first start) |
| Platform health | http://localhost:8081/actuator/health | — |
| API docs (Swagger UI) | http://localhost:8081/swagger-ui.html | Authorize with a token from `/api/auth/login` |
| Mailpit (local inbox) | http://localhost:8025 | — |
| Kafka (events, see [docs/07-events.md](docs/07-events.md)) | localhost:9092 | — |
| Redpanda Console (browse topics and messages) | http://localhost:8088 | — |

Local credentials are for development only. To reset all data: `docker compose down -v`.

## Documentation map

Read these in order. Business requirements come first; technical design starts once they are agreed.

| # | Document | What it answers |
|---|---|---|
| 1 | [Product Vision & Scope](docs/01-product-vision.md) | Why we're building this, for whom, and what "complete" means |
| 2 | [Glossary](docs/02-glossary.md) | Shared domain vocabulary (portal, phase, layout, blueprint, etc.) |
| 3 | [Roadmap & Build Order](docs/03-roadmap.md) | 24 modules, 7 phases, release milestones, progress tracker |
| 4 | [Architecture Overview](docs/04-architecture-overview.md) | The 4-service decision and module-to-service mapping (technical detail comes later) |
| 5 | [Business Requirements](docs/requirements/README.md) | One requirements document per module: user stories, rules, acceptance criteria |
| 6 | [Implementation Plan: M0](docs/05-implementation-plan.md) | Decisions taken and the vertical slices to build M0 |
| 7 | [Architecture](ARCHITECTURE.md) + [ProjectY additions](docs/06-backend-architecture.md) | Mandatory code structure for every Spring service and new feature |

## Current status

- [x] Feature map collected (Zoho Projects feature set)
- [x] Build order agreed (24 steps, 7 phases)
- [x] Service decomposition agreed (4 services)
- [ ] Business requirements reviewed and signed off (Phase 0 continues alongside implementation)
- [x] Identity: own auth in Platform (Keycloak considered and dropped)
- [x] Scaffolded: `frontend/` (Angular 20), `platform-service/` (Spring Boot 4.1, Java 21)
- [x] Slice 0: dev environment (Docker Compose with Postgres, Mailpit)
- [x] Slice 1: backend auth (signup, verify, login, refresh, logout, reset) and first portal
- [x] Slice 2: Angular auth screens (sign in, sign up, verify, reset, create portal, portal picker)
- [x] Slice 2b: Admin console (`admin-console/`) with audited support impersonation
- [x] Slice 3: Tenant isolation, portal settings, personal time zone, app shell with portal switcher
- [x] Slice 4: Users and profiles (invites, 4 system profiles, permissions, deactivation)
- [ ] **Slice 5: Audit and events** (audit everything, outbox) ← *next*. See the [Implementation Plan](docs/05-implementation-plan.md)

## Working agreement

- **Requirements before code.** Each module's requirements doc is reviewed before its technical design starts.
- **Tiers keep scope honest.** Every feature is tagged `MVP`, `V1`, or `LATER`. Build `MVP` across Phases 0–1 first; see the [roadmap](docs/03-roadmap.md#release-milestones).
- **Cross-cutting definition of done** applies to every module after Phase 0: permission-checked, emits domain events, writes audit entries, triggers notifications where relevant, and is searchable where relevant.
