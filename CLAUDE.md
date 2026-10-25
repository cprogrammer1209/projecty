# ProjectY

Zoho Projects clone: Angular frontend (`frontend/`, built by the user) and Spring Boot services (`platform-service/`, more later). `frontend/` and `platform-service/` are separate git repos; this root repo holds docs, `compose.yaml` and infra.

## Backend architecture (mandatory for every new feature)

Every backend feature, module or service MUST follow the architecture below. Before writing code for a new feature:
1. Decide which module owns it (new or existing), and what goes in `api/` versus `internal/`.
2. Use the exact package layout and naming: `{Entity}LookUpService`/`WriteService`, `{Entity}Service` + `impl/`, `{Entity}CreateDTO`, `{Module}Constants`, and so on.
3. Communicate across modules only through `api/`, inject only through constructors, and put constants only in `{Module}Constants`.
4. Before finishing, grep for violations: no `modules.X.internal` imports inside `modules/Y`, no `@Service`/`@Component` in `api/`, no `@Autowired` fields or `@RequiredArgsConstructor`.

@ARCHITECTURE.md

Each service repo carries its own copy of `ARCHITECTURE.md`, imported from its `CLAUDE.md` (see `platform-service/CLAUDE.md`, section 5). The root copy is the template for new services: copy it plus section 5 into each new service repo. If the architecture changes, update every copy.

ProjectY-specific additions (the `AppResponse` envelope, events in `api/event/`, the extra `internal/` folders, the Platform module map) are in @docs/06-backend-architecture.md.

## Working agreement

- Current plan and slice status: [docs/05-implementation-plan.md](docs/05-implementation-plan.md). Requirements are in `docs/requirements/`.
- Explain a new step and wait for a go-ahead before implementing it.
- Run locally: `docker compose up -d`, then `cd platform-service && ./mvnw spring-boot:run`. Tests: `./mvnw test` (needs Docker for Testcontainers).
