# ProjectY

Zoho Projects clone: Angular frontend (`frontend/`), Angular admin console (`admin-console/`) and Spring Boot services (`platform-service/`, more later). `frontend/`, `admin-console/` and `platform-service/` are separate git repos; this root repo holds docs, `compose.yaml` and infra.

## Backend architecture (mandatory for every new feature)

Every backend feature, module or service MUST follow the architecture below. Before writing code for a new feature:
1. Decide which module owns it (new or existing), and what goes in `api/` versus `internal/`.
2. Use the exact package layout and naming: `{Entity}LookUpService`/`WriteService`, `{Entity}Service` + `impl/`, `{Entity}CreateDTO`, `{Module}Constants`, and so on.
3. Communicate across modules only through `api/`, inject only through constructors, and put constants only in `{Module}Constants`.
4. Before finishing, grep for violations: no `modules.X.internal` imports inside `modules/Y`, no `@Service`/`@Component` in `api/`, no `@Autowired` fields or `@RequiredArgsConstructor`.

### Package by feature: one feature, one module

Every feature keeps all of its code in its own module: controllers (every endpoint of the feature), services, entities, repositories, DTOs, mappers, config and constants.

- **Endpoints stay with their feature, whatever their URL.** For example, an endpoint under `/api/auth/...` that belongs to feature X lives in X's controller. Don't put it in the module that "owns" that URL area.
- **Other modules are used only through their `api/` ports** (`{Entity}LookUpService`, `{Entity}WriteService`, `api/dto`). If the feature needs something that port doesn't offer, add the method to that module's `api/` and implement it in that module's `internal/`. Never move the feature's code into the other module.
- **Avoid dependency cycles.** If module A calls B's `api/`, B must not call A's `api/`. For the reverse direction, publish an event from `api/event/` and listen to it, as `UserPasswordResetEvent` does. Or keep the data the other side needs on your own side.
- **Shared infrastructure** (HTTP cookie helpers, security plumbing) goes in `common/`, so feature modules don't have to reach into each other for it.
- **Before writing a feature, list its endpoints and confirm they all land in the feature's module.** If one seems to belong elsewhere, stop and ask.
- **Portal-owned data:**
  - every portal-owned table has `portal_id`, and every repository method on it takes `portalId`
  - the id comes only from `RequestPortalContext.requirePortalId()` (verified from `X-Portal-Id`), never from the request body
  - another portal's record is "not found" (404)
- **Events:**
  - every create, update or delete of portal data publishes through `OutboxWriteService` in the same transaction; never call Kafka directly
  - a new aggregate adds its topic to `projecty.broker.topics`; rules and envelope are in [docs/07-events.md](docs/07-events.md)
- **Permissions:**
  - put `@RequirePermission(PermissionConstants.X)` on every portal endpoint that changes or reveals data beyond the caller's own
  - add new permission names to `PermissionConstants`, and grant them in `MemberConstants.SYSTEM_PROFILES` (plus a Flyway insert for existing portals)

Reference example: `impersonation` owns all of its endpoints, including `/api/auth/impersonation/*`. It opens and ends sessions through `session/api` (`SessionWriteService.openSupportSession` / `endSupportSession`), and session reports expiry back through `SupportSessionExpiredEvent`.

@ARCHITECTURE.md

Each service repo carries its own copy of `ARCHITECTURE.md`, imported from its `CLAUDE.md` (see `platform-service/CLAUDE.md`, section 5). The root copy is the template for new services: copy it plus section 5 into each new service repo. If the architecture changes, update every copy.

ProjectY-specific additions (the `AppResponse` envelope, events in `api/event/`, the extra `internal/` folders, the Platform module map) are in @docs/06-backend-architecture.md.

## Working agreement

- Current plan and slice status: [docs/05-implementation-plan.md](docs/05-implementation-plan.md). Requirements are in `docs/requirements/`.
- Explain a new step and wait for a go-ahead before implementing it.
- Run locally: `docker compose up -d`, then `cd platform-service && ./mvnw spring-boot:run`. Tests: `./mvnw test` (needs Docker for Testcontainers).
