# ProjectY

A personal, production-grade project management application modeled on **Zoho Projects** (including the 2026 "Infinity" release).

**Goals, in priority order:**
1. **Finish it.** Ship a complete, usable product, not a pile of half-built modules.
2. **Learn along the way:** multi-tenancy, microservices, event-driven design, Angular, and Spring Boot at production depth.

**Stack:** Angular (frontend) and Spring Boot microservices (backend). Four services: Platform, Work, Notification, and Automation. See [Architecture Overview](docs/04-architecture-overview.md).

---

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

## Current status

- [x] Feature map collected (Zoho Projects feature set)
- [x] Build order agreed (24 steps, 7 phases)
- [x] Service decomposition agreed (4 services)
- [ ] Business requirements reviewed and signed off (Phase 0 continues alongside implementation)
- [x] Identity provider chosen: Keycloak
- [x] Scaffolded: `frontend/` (Angular 20), `platform-service/` (Spring Boot 4.1, Java 21)
- [ ] **Phase 0 implementation: Slice 0** ← *we are here*. See the [Implementation Plan](docs/05-implementation-plan.md)

## Working agreement

- **Requirements before code.** Each module's requirements doc is reviewed before its technical design starts.
- **Tiers keep scope honest.** Every feature is tagged `MVP`, `V1`, or `LATER`. Build `MVP` across Phases 0–1 first; see the [roadmap](docs/03-roadmap.md#release-milestones).
- **Cross-cutting definition of done** applies to every module after Phase 0: permission-checked, emits domain events, writes audit entries, triggers notifications where relevant, and is searchable where relevant.
