# 07 — Events (Kafka)

Every change to portal data is published as an event, so other services (Work, Notification, Automation, search) can react without calling Platform. This page is the contract for producers and consumers.

## How an event travels

```
service method ──(same DB transaction)──▶ outbox_event row
                                              │  OutboxRelay polls every 1 s
                                              ▼
                              BrokerPublisher (Kafka, acks=all) ──▶ topic projecty.<aggregate>
                                              │ broker confirmed
                                              ▼
                                  outbox_event.published_at set
```

- **Same transaction.** `OutboxWriteService.publish` only works inside the transaction of the change it describes (`MANDATORY`). A rollback removes the event, so nothing is published for a change that didn't happen. The 409 on a duplicate invite leaves no event.
- **After commit.** The relay reads the oldest unpublished rows (`ORDER BY created_at, id`, `FOR UPDATE SKIP LOCKED`), sends each, and marks it published only after Kafka acknowledges it. If Kafka is down the API keeps working, rows wait, and they are sent when it returns.
- **Delivery is at least once** (SEC-BR-07). A crash between the broker's ack and the commit of `published_at` sends the event again with the same `eventId`. **Consumers must drop duplicates by `eventId`.**
- **Order is per aggregate.** The message key is the aggregate id and the topic has several partitions, so events of one item arrive in order; events of different items may not.
- **Audit is separate.** `audit_event` is the synchronous, append-only security record (SEC-BR-06). It is not built from these events.

## Envelope

Every message value is JSON with these fields:

| Field | Meaning |
|---|---|
| `eventId` | Unique id (the outbox row id). The deduplication key. |
| `type` | `{Aggregate}{PastTenseVerb}`, for example `UserDeactivated` |
| `version` | Payload version of this event type, currently `1` |
| `occurredAt` | When the change was committed (UTC, ISO-8601) |
| `portalId` | The tenant, or null for platform-level events |
| `aggregateType`, `aggregateId` | What changed (`PORTAL`, `MEMBER`, `INVITATION`) and its id |
| `actor` | `{userId, name}` of who caused it; missing when the system did |
| `payload` | The event's own data: ids and before/after values, never emails, tokens or free text |

Kafka headers repeat `eventId`, `eventType`, `version` and `portalId`, so a consumer can filter without parsing the body.

**Topics:** one per aggregate type, `projecty.` plus the lower-cased type: `projecty.portal`, `projecty.member`, `projecty.invitation`. Kafka does not create topics on its own (auto-create is off), so a new aggregate must be added to `projecty.broker.topics` in `application.yml`.

## Events today

| Event | Topic | Raised when | Payload |
|---|---|---|---|
| `PortalCreated` | portal | A portal is created | `portalId`, `slug`, `ownerUserId` |
| `PortalSettingsChanged` | portal | Portal settings change | `portalId`, `changes` (readable before → after text) |
| `UserInvited` | invitation | An invitation is sent | `portalId`, `invitationId`, `profileId`, `invitedByUserId` |
| `InvitationRevoked` | invitation | A pending invitation is revoked | `portalId`, `invitationId`, `revokedByUserId` |
| `UserActivated` | member | A user joins (invitation accepted) or is reactivated | `portalId`, `userId`, `profileId` (+ `actorUserId` on reactivation) |
| `UserProfileChanged` | member | A member's profile changes | `portalId`, `userId`, `actorUserId`, `fromProfileId`, `toProfileId` |
| `UserDeactivated` | member | A member is deactivated | `portalId`, `userId`, `actorUserId` |

The owner is announced by `PortalCreated` only; there is no `UserActivated` for them.

## Rules for producers

1. Every service method that creates, updates or deletes portal data publishes in the same transaction through `OutboxWriteService` (`modules/outbox/api`). Never call Kafka directly.
2. Name events for what happened, in the past tense: `TaskAssigned`, not `TaskUpdate`. Where search, the activity stream or sync need it, also publish the generic `{Aggregate}Created`, `{Aggregate}Updated`, `{Aggregate}Deleted`; Updated carries only the changed fields as before/after, Deleted carries ids only.
3. Put the event and aggregate names in `modules/shared/constants/OutboxEventConstants` (the constants are used by more than one module).
4. A new aggregate type needs its topic in `projecty.broker.topics`.
5. A breaking payload change adds a new `version` for that event type (and a new constant); don't change `version 1` in place. Adding a field is not breaking.
6. Keep PII out of payloads. Consumers fetch details through the owning service's API.

## Rules for consumers

- Deduplicate by `eventId`; handlers must be safe to run twice.
- Use your own consumer group, so each service reads every event.
- Ignore unknown fields and unknown `type`s.
- Filter by `portalId` for tenant-specific work; never act on another tenant's event.

## Replay and backfill

Migration `V7` prepared the first delivery:
- Events written while the broker seam only logged were marked published but never delivered, so they were reset and sent again (same `eventId`).
- Data created before the outbox existed (Slices 1–4) was announced once as a snapshot: `PortalCreated`, `UserActivated`, `UserDeactivated`, `UserInvited`, `InvitationRevoked`. These carry `"backfill": true` in the payload and their original timestamps. Profile-change history from before the outbox can't be recovered, so `UserActivated` carries the member's current profile.

Published rows are deleted after `projecty.outbox.retention` (default 7 days). Kafka keeps messages for 7 days locally; a consumer that needs older history has to be started within that window or fed by a new backfill.

## Known limits

- An event that can never be published (a topic missing from the list, a message over 1 MB) stays at the head of the queue and the relay logs a warning on every poll, so later events wait. A dead-letter table is future work.
- Ordering by `created_at` is per aggregate in practice. Two concurrent transactions touching the same aggregate are serialized by the database, but a different aggregate can commit slightly out of order. Consumers must not assume a global order.
- Local Kafka is one node with replication factor 1. Replication, TLS and authentication come with deployment.
