# Architecture

## Top-Level Structure

```
src/main/java/com/{org}/{app}/
├── modules/        ← Business feature modules
├── common/         ← Shared infrastructure
├── external/       ← Third-party integrations
└── {App}Application.java
```

### `modules/`
Self-contained business feature modules. Each module owns its data, logic, and public API surface. No module reaches into another module's internals.

### `common/`
Shared infrastructure used by every module. Contains security, config, DTOs, exceptions, and utilities. Nothing business-specific lives here.

### `external/`
Anti-corruption layer for third-party systems (email, SMS, push notifications, payment gateways, etc.). Isolates vendor-specific code from domain logic. Modules depend on `external/` interfaces, never on vendor SDKs directly.

---

## Module Structure

Every module (and sub-module) is split into exactly two top-level packages:

```
modules/{module}/
├── api/            ← PUBLIC — other modules may import these
│   ├── {Entity}LookUpService.java
│   ├── {Entity}WriteService.java       ← only if other modules need to write
│   └── dto/
│       └── {Entity}ResponseDTO.java
└── internal/       ← PRIVATE — must not be imported outside this module
    ├── controller/
    │   └── {Entity}Controller.java
    ├── service/
    │   ├── {Entity}Service.java         ← full interface; extends LookUp + Write
    │   └── impl/
    │       └── {Entity}ServiceImpl.java
    ├── repository/
    │   └── {Entity}Repository.java
    ├── entity/
    │   └── {Entity}.java
    ├── dto/
    │   ├── {Entity}CreateDTO.java
    │   ├── {Entity}UpdateDTO.java
    │   └── {Entity}IdResponseDTO.java
    ├── mapper/
    │   └── {Entity}Mapper.java
    └── constants/
        └── {Entity}Constants.java
```

### Module with Sub-Modules

```
modules/{module}/
├── {submodule}/
│   ├── api/
│   └── internal/
└── {submodule}/
    ├── api/
    └── internal/
```

---

## `api/` — The Port (Public Contract)

`api/` contains **interfaces and DTOs only**. No implementation, no entity, no repository, no mapper ever lives here.

| File | Purpose |
|---|---|
| `{Entity}LookUpService.java` | Read-only methods (`find*`, `get*`, `exists*`, `count*`) |
| `{Entity}WriteService.java` | Mutation methods (`create*`, `update*`, `delete*`) — only when another module needs them |
| `api/dto/{Entity}ResponseDTO.java` | Shared response DTO — safe to import anywhere |

```
✅ api/ contains only interfaces and DTOs
❌ api/ never contains @Service, @Component, @Repository, or any implementation class
```

Only create `WriteService` when an external module actually needs to write. If no peer module mutates the entity, mutations stay in `internal/`.

---

## `internal/` — The Adapter (Private Implementation)

Everything not meant to be consumed by another module lives here.

| File | Accessible by |
|---|---|
| `{Entity}Service.java` | Own module only |
| `{Entity}ServiceImpl.java` | Own module only |
| `{Entity}Repository.java` | Own module only |
| `{Entity}.java` (entity) | Own module only |
| `{Entity}CreateDTO.java` | Own module only |
| `{Entity}UpdateDTO.java` | Own module only |
| `{Entity}Constants.java` | Own module only |

---

## The `shared` Module

When an artifact is genuinely used by two or more modules and is not naturally owned by any single module, it belongs in `modules/shared/`.

```
modules/shared/
├── constants/      ← cross-module constants
├── enums/          ← cross-module enums
├── helper/         ← stateless utility classes
├── valueobject/    ← immutable value types
└── dto/            ← shared DTOs not owned by any one module (rare)
```

### Rules

| Rule | Detail |
|---|---|
| No entity | `shared` never contains a persistence entity |
| No repository | `shared` never contains a repository |
| No business logic | Helpers are stateless utilities; no module-specific rules |
| No module imports | `shared` depends on nothing inside `modules/` |
| Two-consumer rule | Only promote to `shared` when two modules use it today, not "might" |

---

## Inter-Module Communication

Modules communicate **only** through the `api/` package of the target module. Direct access to another module's `internal/` is forbidden.

```
✅ com.{org}.{app}.modules.attachment.api.AttachmentLookUpService
✅ com.{org}.{app}.modules.attachment.api.AttachmentWriteService
✅ com.{org}.{app}.modules.attachment.api.dto.AttachmentResponseDTO

❌ com.{org}.{app}.modules.attachment.internal.repository.AttachmentRepository
❌ com.{org}.{app}.modules.attachment.internal.service.impl.AttachmentServiceImpl
❌ com.{org}.{app}.modules.attachment.internal.entity.Attachment
```

### Exposing a Read to Another Module

1. Add the method to `{module}/api/{Entity}LookUpService.java`
2. Implement it in `{module}/internal/service/impl/{Entity}ServiceImpl.java`
3. The consumer injects `{Entity}LookUpService` — never the impl

### Exposing a Write to Another Module

1. Add the method to `{module}/api/{Entity}WriteService.java` (create if it doesn't exist)
2. Implement it in `{module}/internal/service/impl/{Entity}ServiceImpl.java`
3. The consumer injects `{Entity}WriteService` — never the impl

---

## Service Patterns

### Composite Service
A service that **owns an entity and repository**, but calls other modules' services to enrich its response or coordinate writes.

> Rule: has its own repository → Composite Service

### Aggregate Service
A service with **no entity or repository of its own**. Its sole job is assembling responses from multiple modules or coordinating a multi-module workflow.

> Rule: no repository, only assembles/coordinates → Aggregate Service

| | Composite | Aggregate |
|---|---|---|
| Owns entity | ✅ | ❌ |
| Has repository | ✅ | ❌ |
| Calls other modules | ✅ | ✅ |

---

## Dependency Direction

```
module_a.internal   →  module_b.api        ✅
module_a.api        →  shared              ✅
module_a.internal   →  shared              ✅
module_a.internal   →  external/           ✅
module_a.internal   →  common/             ✅

shared              →  any module          ❌
module_a.internal   →  module_b.internal   ❌
module_a.api        →  any impl class      ❌
external/           →  modules/            ❌
```

---

## Constants Convention

Every named constant used within a module lives in `internal/constants/{Module}Constants.java`. Never as a `private static final` field scattered inside a service, controller, or mapper.

```
✅ {Module}Constants.STATUS_ACTIVE = "ACTIVE"
❌ private static final String STATUS_ACTIVE = "ACTIVE"  // inside a service
```

Cross-module constants go in `modules/shared/constants/`.

---

## Injection Convention

Always use **constructor injection**. Never `@Autowired` field injection or Lombok `@RequiredArgsConstructor`.

```java
// ✅ Correct
public class OrderServiceImpl implements OrderService {

    private final OrderRepository repository;
    private final InventoryLookUpService inventoryLookUpService;

    public OrderServiceImpl(
            OrderRepository repository,
            InventoryLookUpService inventoryLookUpService) {
        this.repository = repository;
        this.inventoryLookUpService = inventoryLookUpService;
    }
}

// ❌ Wrong
@RequiredArgsConstructor
public class OrderServiceImpl { ... }

// ❌ Wrong
@Autowired
private OrderRepository repository;
```

---

## `common/` Structure

```
common/
├── config/         ← Spring beans, cache, async, message source
├── security/       ← JWT filter, auth context, security config, CORS
│   ├── config/
│   ├── filter/
│   ├── handler/
│   ├── helper/
│   └── dto/
├── dto/            ← AppResponse<T>, PagedResponse, AppError, CursorPageResponse
├── exception/      ← AppException, GlobalExceptionHandler
├── service/        ← LocaleMessageService, RequestContextService
│   └── impl/
├── constants/      ← app-wide constants
└── utils/          ← stateless utility classes
```

---

## `external/` Structure

```
external/
├── {provider}/
│   ├── config/
│   ├── service/
│   │   ├── {Provider}Service.java      ← interface
│   │   └── impl/
│   │       └── {Provider}ServiceImpl.java
│   ├── dto/
│   └── constants/
```

Each external integration exposes an interface. Modules depend on the interface; the implementation is swappable (e.g., stub for tests, real client for prod).

---

## Pattern Names

This architecture is a **Modular Monolith** implementing:

| Layer | Pattern |
|---|---|
| Top-level split (`modules/`, `common/`, `external/`) | Modular Monolith |
| Feature self-containment | Package by Feature |
| `api/` vs `internal/` boundary | Ports & Adapters (Hexagonal Architecture) |
| Each module = bounded domain area | Strategic DDD (Bounded Contexts) |
| `common/` shared by all | Shared Kernel |
| `external/` isolating vendors | Anti-Corruption Layer |

The monolith is explicitly structured so any module can be extracted into a microservice later: the `api/` interfaces become the service contract, and `internal/` becomes the service implementation.
