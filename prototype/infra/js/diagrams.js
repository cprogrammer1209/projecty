/* Diagram definitions for the ProjectY infrastructure map. Rendered to SVG by js/diagram.js.
 *
 * node kinds: client service db broker tool external gateway process decision terminal bad event
 * node.planned: dashed outline = not built yet
 * node.tool:    id in js/tools.js, "See the tool card" button in the detail panel
 * edge: { f, t, fs, ts, fa, ta, via, label, lx, ly, dash, both, bad }
 *   fs/ts = side to leave/enter (t b l r), fa/ta = absolute x (t/b) or y (l/r) along that side,
 *   via = extra points, dash = dashed line, both = arrow on both ends, bad = red.
 */
(function () {
  const n = (id, kind, x, y, w, h, label, sub, more) => Object.assign({ id, kind, x, y, w, h, label, sub: sub || '' }, more || {});
  const e = (f, t, more) => Object.assign({ f, t }, more || {});

  window.DIAGRAMS = {};

  /* ============================================================ ARCHITECTURE TODAY */
  window.DIAGRAMS.today = {
    title: 'Architecture today',
    lead: 'What runs in ProjectY right now. Two services, one broker, no direct calls between the services.',
    w: 1100, h: 520,
    nodes: [
      n('fe', 'client', 20, 110, 170, 64, 'Angular app', 'frontend · :4200', { info: 'The customer app. Talks only to the proxy, never to a service directly.' }),
      n('ad', 'client', 20, 220, 170, 64, 'Admin console', 'admin-console · :4300', { info: 'Platform-admin app (tenants, audit, support sessions). Only calls Platform.' }),
      n('px', 'gateway', 250, 155, 150, 70, 'Dev proxy / nginx', '/api → :8081\n/api/work → :8082', { info: 'Splits traffic by path. It is plain routing: no auth, rate limit or resilience. An API gateway would replace it (see Target).', tool: 'gateway' }),
      n('mp', 'tool', 500, 5, 160, 46, 'Mailpit', 'SMTP :1025 · UI :8025', { info: 'Local mail catcher. Platform sends signup, verify, reset and invitation mails through MailService (external/mail).' }),
      n('pl', 'service', 480, 90, 200, 80, 'platform-service', 'auth · portals · members\n:8081', { info: 'Modules: account, session, token, portal, member, admin, impersonation, audit, outbox. Signs JWTs and serves the JWKS endpoint.' }),
      n('pdb', 'db', 480, 200, 200, 56, 'Postgres: platform', '', { tool: 'postgres', info: 'Platform\'s own database. Work never reads it.' }),
      n('wk', 'service', 480, 330, 200, 80, 'work-service', 'projects · tasks · fields\n:8082', { info: 'Modules: access, project, customfield, task, outbox. Validates tokens locally and keeps member_access from Platform\'s events.' }),
      n('wdb', 'db', 480, 440, 200, 56, 'Postgres: work', '', { tool: 'postgres', info: 'Work\'s own database, including member_access and processed_event.' }),
      n('kf', 'broker', 780, 90, 140, 406, 'Apache Kafka', 'KRaft · :9092\n \nprojecty.portal\nprojecty.member\nprojecty.invitation\nprojecty.project\nprojecty.task\nprojecty.field\nprojecty.layout\nprojecty.tasklist', { tool: 'kafka', info: 'One topic per aggregate. Auto-create is off, so a new aggregate must be added to projecty.broker.topics.' }),
      n('rp', 'tool', 980, 260, 110, 64, 'Redpanda\nConsole', ':8088', { tool: 'console', info: 'Browse topics, messages and consumer groups.' }),
      n('rd', 'db', 250, 440, 150, 64, 'Redis', ':6379', { tool: 'redis', info: 'Shared by both services behind external/redis. Membership cache, per-IP rate limits (Platform), the access-token denylist (Platform writes, both read) and the field/layout cache (Work). Not a source of truth; if it is down, the services fall back to their databases.' })
    ],
    edges: [
      e('fe', 'px', { fs: 'r', ts: 'l' }),
      e('ad', 'px', { fs: 'r', ts: 'l' }),
      e('px', 'pl', { fs: 'r', ts: 'l', label: '/api/*' }),
      e('px', 'wk', { fs: 'r', ts: 'l', label: '/api/work/*' }),
      e('pl', 'pdb', { fs: 'b', ts: 't' }),
      e('wk', 'wdb', { fs: 'b', ts: 't' }),
      e('pl', 'mp', { fs: 't', ts: 'b', fa: 580, ta: 580, label: 'SMTP' }),
      e('pl', 'kf', { fs: 'r', ts: 'l', fa: 130, ta: 130, label: 'outbox events', lx: 730, ly: 120 }),
      e('wk', 'kf', { fs: 'r', ts: 'l', fa: 355, ta: 355, label: 'work events', lx: 730, ly: 347 }),
      e('kf', 'wk', { fs: 'l', ts: 'r', fa: 392, ta: 392, label: 'member events', lx: 730, ly: 409 }),
      e('wk', 'pl', { fs: 'r', ts: 'r', fa: 325, ta: 160, via: [[725, 325], [725, 160]], dash: true, label: 'JWKS', lx: 725, ly: 245 }),
      e('rp', 'kf', { fs: 'l', ts: 'r', fa: 292, ta: 292 }),
      e('wk', 'rd', { fs: 'l', ts: 'r', fa: 395, ta: 472, dash: true }),
      e('pl', 'rd', { fs: 'l', ts: 'l', fa: 105, ta: 472, via: [[205, 105], [205, 472]], dash: true, label: 'cache · limits · denylist', lx: 110, ly: 462 })
    ],
    notes: [
      '<b>Solid lines</b> are traffic. The dashed <b>JWKS</b> line is the only place Work reaches Platform, and only to fetch public keys (cached). Dashed lines to <b>Redis</b> are optional: both services keep working if it is down.',
      'Platform produces <code>projecty.portal / member / invitation</code>; Work consumes <code>projecty.member</code> and produces <code>projecty.project / task / field / layout / tasklist</code>.',
      'Each service writes its events through its own <b>outbox</b> table, so an event exists only if the change committed.',
      'Click any box for a short explanation.'
    ]
  };

  /* ============================================================ ARCHITECTURE TARGET */
  window.DIAGRAMS.target = {
    title: 'Target architecture',
    lead: 'Where the project can grow. Dashed boxes are not built yet. Synchronous traffic enters through the gateway; everything else is events.',
    w: 1220, h: 890,
    groups: [
      { x: 10, y: 85, w: 1200, h: 590, label: 'Kubernetes cluster (kind → Helm → Argo CD)', planned: true, right: true },
      { x: 10, y: 695, w: 640, h: 180, label: 'Observability: every service exports traces, metrics and logs via OpenTelemetry', planned: true },
      { x: 670, y: 695, w: 540, h: 180, label: 'Build and delivery', planned: true }
    ],
    nodes: [
      n('cl1', 'client', 160, 0, 150, 46, 'Angular app', '', {}),
      n('cl2', 'client', 330, 0, 150, 46, 'Admin console', '', {}),
      n('gw', 'gateway', 160, 110, 320, 56, 'API Gateway', 'routing · rate limit · JWT check · circuit breaker', { planned: true, tool: 'gateway', info: 'One public URL. Search and realtime are also exposed here (not drawn, to keep the picture readable).' }),
      n('rd1', 'db', 520, 110, 120, 56, 'Redis', 'cache · rate limit', { planned: true, tool: 'redis' }),
      n('kc', 'external', 680, 110, 150, 56, 'Keycloak / OIDC', 'optional identity provider', { planned: true, tool: 'keycloak' }),
      n('vt', 'external', 860, 110, 150, 56, 'Vault', 'secrets · DB credentials', { planned: true, tool: 'vault' }),
      n('pgp', 'db', 20, 205, 120, 56, 'Postgres', 'platform', { tool: 'postgres' }),
      n('pl', 'service', 160, 200, 150, 70, 'platform-service', ':8081', { info: 'Built. Publishes member events; signs tokens.' }),
      n('wk', 'service', 330, 200, 150, 70, 'work-service', ':8082', { info: 'Built. Consumes member events; publishes project and task events.' }),
      n('pgw', 'db', 500, 205, 120, 56, 'Postgres', 'work', { tool: 'postgres' }),
      n('dbz', 'tool', 660, 200, 160, 70, 'Debezium', 'CDC replaces outbox poller', { planned: true, tool: 'debezium', info: 'Reads the Postgres WAL and streams outbox rows to Kafka.' }),
      n('sr', 'tool', 860, 200, 160, 70, 'Schema Registry', 'Avro / Protobuf contracts', { planned: true, tool: 'schemareg' }),
      n('kf', 'broker', 20, 340, 1180, 60, 'Apache Kafka', 'topic per aggregate · retry and dead-letter topics · one consumer group per service', { tool: 'kafka' }),
      n('c1', 'service', 20, 470, 150, 70, 'notification', 'email · push · in-app', { planned: true, tool: 'notification' }),
      n('c2', 'service', 190, 470, 150, 70, 'search', 'indexer + query API', { planned: true, tool: 'searchsvc' }),
      n('c3', 'service', 360, 470, 150, 70, 'automation', 'rules · sagas', { planned: true, tool: 'automation' }),
      n('c4', 'service', 530, 470, 150, 70, 'activity', 'portal-wide feed', { planned: true, tool: 'activity' }),
      n('c5', 'service', 700, 470, 150, 70, 'files', 'attachments', { planned: true, tool: 'filesvc' }),
      n('c6', 'service', 870, 470, 150, 70, 'realtime', 'SSE / WebSocket', { planned: true, tool: 'sse' }),
      n('c7', 'service', 1040, 470, 150, 70, 'analytics', 'reports', { planned: true, tool: 'analytics' }),
      n('s1', 'external', 20, 600, 150, 50, 'SMTP / FCM / Slack', '', { planned: true }),
      n('s2', 'db', 190, 600, 150, 50, 'OpenSearch', '', { planned: true, tool: 'opensearch' }),
      n('s3', 'tool', 360, 600, 150, 50, 'Temporal', 'durable workflows', { planned: true, tool: 'temporal' }),
      n('s4', 'db', 530, 600, 150, 50, 'Postgres', 'activity read model', { planned: true }),
      n('s5', 'db', 700, 600, 150, 50, 'MinIO / S3', '', { planned: true, tool: 'minio' }),
      n('s6', 'db', 870, 600, 150, 50, 'Redis', 'pub/sub fan-out', { planned: true, tool: 'redis' }),
      n('s7', 'db', 1040, 600, 150, 50, 'ClickHouse', '', { planned: true, tool: 'clickhouse' }),
      n('ot', 'tool', 30, 770, 140, 50, 'OpenTelemetry\nCollector', '', { planned: true, tool: 'otel' }),
      n('pr', 'tool', 240, 730, 130, 40, 'Prometheus', '', { planned: true, tool: 'prometheus' }),
      n('tp', 'tool', 240, 775, 130, 40, 'Tempo', '', { planned: true, tool: 'tempo' }),
      n('lk', 'tool', 240, 820, 130, 40, 'Loki', '', { planned: true, tool: 'loki' }),
      n('gf', 'tool', 470, 775, 140, 40, 'Grafana', '', { planned: true, tool: 'grafana' }),
      n('ga', 'tool', 690, 745, 130, 50, 'GitHub Actions', 'test · scan · image', { tool: 'gha' }),
      n('ag', 'tool', 880, 745, 120, 50, 'Argo CD', 'GitOps sync', { planned: true, tool: 'argo' }),
      n('k8', 'tool', 1060, 745, 130, 50, 'Kubernetes', 'Helm charts', { planned: true, tool: 'k8s' }),
      n('tf', 'tool', 880, 815, 120, 40, 'Terraform', '', { planned: true, tool: 'terraform' })
    ],
    edges: [
      e('cl1', 'gw', { fs: 'b', ts: 't', fa: 235, ta: 235 }),
      e('cl2', 'gw', { fs: 'b', ts: 't', fa: 405, ta: 405 }),
      e('gw', 'rd1', { fs: 'r', ts: 'l' }),
      e('gw', 'pl', { fs: 'b', ts: 't', fa: 235, ta: 235 }),
      e('gw', 'wk', { fs: 'b', ts: 't', fa: 405, ta: 405 }),
      e('pl', 'pgp', { fs: 'l', ts: 'r' }),
      e('wk', 'pgw', { fs: 'r', ts: 'l' }),
      e('pgw', 'dbz', { fs: 'r', ts: 'l', dash: true, label: 'WAL' }),
      e('dbz', 'kf', { fs: 'b', ts: 't', fa: 740, ta: 740 }),
      e('sr', 'kf', { fs: 'b', ts: 't', fa: 940, ta: 940, dash: true, label: 'schemas', lx: 975, ly: 315 }),
      e('pl', 'kf', { fs: 'b', ts: 't', fa: 235, ta: 235, both: true }),
      e('wk', 'kf', { fs: 'b', ts: 't', fa: 405, ta: 405, both: true }),
      e('kf', 'c1', { fs: 'b', ts: 't', fa: 95, ta: 95 }),
      e('kf', 'c2', { fs: 'b', ts: 't', fa: 265, ta: 265 }),
      e('kf', 'c3', { fs: 'b', ts: 't', fa: 435, ta: 435 }),
      e('kf', 'c4', { fs: 'b', ts: 't', fa: 605, ta: 605 }),
      e('kf', 'c5', { fs: 'b', ts: 't', fa: 775, ta: 775 }),
      e('kf', 'c6', { fs: 'b', ts: 't', fa: 945, ta: 945 }),
      e('kf', 'c7', { fs: 'b', ts: 't', fa: 1115, ta: 1115 }),
      e('c1', 's1', { fs: 'b', ts: 't' }),
      e('c2', 's2', { fs: 'b', ts: 't' }),
      e('c3', 's3', { fs: 'b', ts: 't' }),
      e('c4', 's4', { fs: 'b', ts: 't' }),
      e('c5', 's5', { fs: 'b', ts: 't' }),
      e('c6', 's6', { fs: 'b', ts: 't' }),
      e('c7', 's7', { fs: 'b', ts: 't' }),
      e('ot', 'pr', { fs: 'r', ts: 'l' }),
      e('ot', 'tp', { fs: 'r', ts: 'l' }),
      e('ot', 'lk', { fs: 'r', ts: 'l' }),
      e('pr', 'gf', { fs: 'r', ts: 'l' }),
      e('tp', 'gf', { fs: 'r', ts: 'l' }),
      e('lk', 'gf', { fs: 'r', ts: 'l' }),
      e('ga', 'ag', { fs: 'r', ts: 'l', label: 'image' }),
      e('ag', 'k8', { fs: 'r', ts: 'l', label: 'sync' }),
      e('tf', 'k8', { fs: 'r', ts: 'b', fa: 835, ta: 1125, via: [[1125, 835]] })
    ],
    notes: [
      '<b>Producers</b> (platform, work) write to Kafka; <b>consumers</b> (notification, search, automation, activity, files, realtime, analytics) have no synchronous input. Adding one never changes the producers.',
      'Each service owns its store: OpenSearch for search, Temporal for workflows, MinIO for files, ClickHouse for reports.',
      'The gateway is the only synchronous entry point. Redis backs its rate limits and caches.',
      'Click any box with a tool behind it, then use "See the tool card".'
    ]
  };

  /* ============================================================ FLOW: PUBLISH */
  window.DIAGRAMS.publish = {
    title: 'Publishing an event (outbox)',
    lead: 'How a change and its event are saved together, and why an event is never lost or sent for a change that did not happen.',
    w: 760, h: 840,
    nodes: [
      n('s1', 'terminal', 150, 10, 200, 50, 'HTTP request', 'create / update / delete'),
      n('p1', 'process', 130, 85, 240, 54, 'Service method', '@Transactional'),
      n('p2', 'process', 130, 165, 240, 60, 'Write business row\n+ outbox_event row', 'same database transaction', { tool: 'outbox', info: 'OutboxWriteService.publish only works inside the transaction of the change (propagation MANDATORY). If there is no transaction it throws.' }),
      n('d1', 'decision', 140, 255, 220, 90, 'Commit OK?'),
      n('bad', 'bad', 460, 270, 200, 60, 'Rollback', 'the event disappears too', { info: 'A duplicate invitation returns 409 and leaves no event, for example.' }),
      n('p3', 'process', 130, 375, 240, 60, 'OutboxRelay polls every 1 s', 'FOR UPDATE SKIP LOCKED', { info: 'Reads the oldest unpublished rows (ORDER BY created_at, id). SKIP LOCKED lets several relays run without double-sending.', tool: 'debezium' }),
      n('p4', 'process', 130, 465, 240, 60, 'BrokerPublisher.send()', 'acks=all · key = aggregateId', { tool: 'kafka', info: 'The message key is the aggregate id, so events about one item stay in order on one partition.' }),
      n('d2', 'decision', 140, 555, 220, 90, 'Kafka acked?'),
      n('rt', 'process', 460, 570, 200, 60, 'Row stays unpublished', 'retried on the next poll', { info: 'If Kafka is down the API keeps working; rows wait and are sent when it returns.' }),
      n('p5', 'process', 130, 675, 240, 54, 'Set published_at', 'only after the ack'),
      n('k', 'terminal', 130, 755, 240, 56, 'Event is in the topic', 'projecty.<aggregate>')
    ],
    edges: [
      e('s1', 'p1', { fs: 'b', ts: 't' }),
      e('p1', 'p2', { fs: 'b', ts: 't' }),
      e('p2', 'd1', { fs: 'b', ts: 't' }),
      e('d1', 'p3', { fs: 'b', ts: 't', label: 'yes' }),
      e('d1', 'bad', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('p3', 'p4', { fs: 'b', ts: 't' }),
      e('p4', 'd2', { fs: 'b', ts: 't' }),
      e('d2', 'p5', { fs: 'b', ts: 't', label: 'yes' }),
      e('d2', 'rt', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('rt', 'p3', { fs: 't', ts: 'r', fa: 560, via: [[560, 405]], label: 'retry', lx: 575, ly: 490, dash: true }),
      e('p5', 'k', { fs: 'b', ts: 't' })
    ],
    notes: [
      '<b>Delivery is at least once.</b> A crash between the broker ack and the commit of <code>published_at</code> sends the event again with the same <code>eventId</code>. Consumers must drop duplicates (see the next flow).',
      '<b>Order is per aggregate:</b> events of one task arrive in order; events of two different tasks may not.',
      '<b>Next step:</b> Debezium can replace the polling steps (see "CDC").'
    ]
  };

  /* ============================================================ FLOW: CONSUME */
  window.DIAGRAMS.consume = {
    title: 'Consuming an event (idempotent consumer)',
    lead: 'What Work does with a member event. The same shape applies to every new consumer you add.',
    w: 760, h: 870,
    nodes: [
      n('s1', 'terminal', 150, 10, 200, 50, 'Kafka delivers a message', 'at least once'),
      n('p1', 'process', 130, 85, 240, 54, 'Read the headers', 'eventId · type · version · portalId'),
      n('d1', 'decision', 140, 165, 220, 90, 'Known type?'),
      n('sk', 'terminal', 460, 180, 200, 60, 'Ignore, commit offset', 'unknown types are skipped', { info: 'Consumers must ignore unknown fields and unknown types so producers can add events safely.' }),
      n('d2', 'decision', 140, 285, 220, 90, 'eventId already in\nprocessed_event?'),
      n('dup', 'terminal', 460, 300, 200, 60, 'Drop the duplicate', 'commit offset', { tool: 'inbox' }),
      n('p2', 'process', 130, 405, 240, 60, 'BEGIN transaction', 'apply the change, e.g. member_access'),
      n('d3', 'decision', 140, 495, 220, 90, 'Applied OK?'),
      n('fail', 'bad', 460, 510, 200, 60, 'Roll back', 'retry, then dead-letter', { tool: 'dlq', info: 'See the Retry and DLQ flow.' }),
      n('p3', 'process', 130, 615, 240, 60, 'Insert processed_event', 'COMMIT (same transaction)', { info: 'The change and the "seen" marker commit together, so a crash cannot apply without recording or record without applying.' }),
      n('p4', 'process', 130, 705, 240, 54, 'Commit the Kafka offset'),
      n('ok', 'terminal', 150, 785, 200, 50, 'Done')
    ],
    edges: [
      e('s1', 'p1', { fs: 'b', ts: 't' }),
      e('p1', 'd1', { fs: 'b', ts: 't' }),
      e('d1', 'd2', { fs: 'b', ts: 't', label: 'yes' }),
      e('d1', 'sk', { fs: 'r', ts: 'l', label: 'no' }),
      e('d2', 'p2', { fs: 'b', ts: 't', label: 'no' }),
      e('d2', 'dup', { fs: 'r', ts: 'l', label: 'yes' }),
      e('p2', 'd3', { fs: 'b', ts: 't' }),
      e('d3', 'p3', { fs: 'b', ts: 't', label: 'yes' }),
      e('d3', 'fail', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('p3', 'p4', { fs: 'b', ts: 't' }),
      e('p4', 'ok', { fs: 'b', ts: 't' })
    ],
    notes: [
      'Work reads <code>projecty.member</code> from the start (<code>auto-offset-reset: earliest</code>), so a brand new Work database rebuilds <code>member_access</code> by replay.',
      'Flyway migrations in Platform re-announce every active member with a <code>"backfill": true</code> flag. That works only because consumers are idempotent.'
    ]
  };

  /* ============================================================ FLOW: AUTH */
  window.DIAGRAMS.auth = {
    title: 'Validating a request in work-service',
    lead: 'No call to Platform per request: the token proves who you are, a local copy of Platform\'s events decides what you may do.',
    w: 800, h: 1200,
    nodes: [
      n('s1', 'terminal', 200, 10, 200, 44, 'Request', 'Authorization: Bearer JWT'),
      n('p1', 'process', 170, 80, 260, 50, 'Parse the JWT header', 'alg · kid', { tool: 'jwks' }),
      n('d1', 'decision', 170, 155, 260, 90, 'kid in the\ncached JWKS?'),
      n('fx', 'process', 520, 172, 240, 56, 'Fetch jwks.json', 'from Platform, once', { info: 'This is the only time Work contacts Platform. It makes key rotation automatic.', tool: 'jwks' }),
      n('p2', 'process', 170, 270, 260, 50, 'Verify the RS256 signature', 'with the public key'),
      n('d2', 'decision', 170, 345, 260, 90, 'Signature valid?'),
      n('e1', 'bad', 520, 362, 200, 56, '401 Unauthorized'),
      n('d3', 'decision', 170, 460, 260, 90, 'exp, iss, aud\nvalid?', '', { info: 'Issuer must equal projecty.token.issuer and the audience must contain projecty-api. Admin console tokens have another audience and are refused.' }),
      n('e2', 'bad', 520, 477, 200, 56, '401 Unauthorized'),
      n('p3', 'process', 170, 575, 260, 50, 'Authenticated', 'role USER · sub = userId'),
      n('d4', 'decision', 170, 650, 260, 90, 'X-Portal-Id is\na valid UUID?', '', { info: 'No header at all simply means no portal context; endpoints that need one ask for it and fail.' }),
      n('e3', 'bad', 520, 667, 200, 56, '400 Bad Request'),
      n('d5', 'decision', 170, 765, 260, 90, 'In token.portals AND\nactive member?', '', { info: 'The token lists the portals the user had when it was issued. Membership is re-checked against member_access, which Platform\'s events keep current, so a deactivation takes effect at once.' }),
      n('e4', 'bad', 520, 782, 200, 56, '403 Forbidden'),
      n('d6', 'decision', 170, 880, 260, 90, '@RequirePermission\non the endpoint?'),
      n('d7', 'decision', 170, 995, 260, 90, 'Permission in\nmember_access?'),
      n('e5', 'bad', 520, 1012, 200, 56, '403 Forbidden'),
      n('ct', 'terminal', 200, 1110, 200, 50, 'Controller runs', 'portalId from RequestPortalContext')
    ],
    edges: [
      e('s1', 'p1', { fs: 'b', ts: 't' }),
      e('p1', 'd1', { fs: 'b', ts: 't' }),
      e('d1', 'p2', { fs: 'b', ts: 't', label: 'yes' }),
      e('d1', 'fx', { fs: 'r', ts: 'l', label: 'no' }),
      e('fx', 'p2', { fs: 'b', ts: 'r', fa: 640, via: [[640, 295]], dash: true }),
      e('p2', 'd2', { fs: 'b', ts: 't' }),
      e('d2', 'd3', { fs: 'b', ts: 't', label: 'yes' }),
      e('d2', 'e1', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('d3', 'p3', { fs: 'b', ts: 't', label: 'yes' }),
      e('d3', 'e2', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('p3', 'd4', { fs: 'b', ts: 't' }),
      e('d4', 'd5', { fs: 'b', ts: 't', label: 'yes' }),
      e('d4', 'e3', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('d5', 'd6', { fs: 'b', ts: 't', label: 'yes' }),
      e('d5', 'e4', { fs: 'r', ts: 'l', label: 'no', bad: true }),
      e('d6', 'd7', { fs: 'b', ts: 't', label: 'yes' }),
      e('d6', 'ct', { fs: 'l', ts: 'l', fa: 925, ta: 1135, via: [[120, 925], [120, 1135]], label: 'no', lx: 135, ly: 918 }),
      e('d7', 'ct', { fs: 'b', ts: 't', label: 'yes' }),
      e('d7', 'e5', { fs: 'r', ts: 'l', label: 'no', bad: true })
    ],
    notes: [
      '<b>Two sources of truth.</b> Platform\'s keys prove identity; Platform\'s Kafka events (kept in <code>member_access</code>) decide access. If the consumer is behind, valid tokens still get 403 because Work has no membership row yet.',
      '<b>Not revocable by itself.</b> A token stays valid until <code>exp</code>; the live membership check is what makes deactivation immediate. A Redis denylist would cover logout.',
      'The same pattern (verify locally, decide locally) is what makes a new service cheap to add: it needs the JWKS URL and a Kafka consumer, nothing else.'
    ]
  };

  /* ============================================================ FLOW: RETRY / DLQ */
  window.DIAGRAMS.retry = {
    title: 'Failure handling: retry and dead-letter',
    lead: 'Planned. One poisoned message must never stop a topic or be silently lost.',
    w: 860, h: 560,
    nodes: [
      n('tp', 'broker', 20, 200, 130, 64, 'Kafka topic', 'projecty.task', { tool: 'kafka' }),
      n('co', 'process', 190, 195, 150, 74, 'Consumer\nhandler', '', { info: 'Idempotent, so it is safe to run the same message twice.', tool: 'inbox' }),
      n('d1', 'decision', 390, 185, 120, 94, 'Handled?'),
      n('ok', 'terminal', 380, 70, 140, 50, 'Commit offset'),
      n('d2', 'decision', 390, 330, 120, 94, 'Retries\nleft?'),
      n('bo', 'process', 570, 352, 190, 50, 'Wait 1 s → 2 s → 4 s', 'exponential backoff', { info: 'Non-blocking retries use separate retry topics so other messages on the main topic keep flowing (@RetryableTopic).', tool: 'dlq' }),
      n('dl', 'broker', 190, 345, 150, 64, 'Dead-letter topic', 'projecty.task.DLT', { tool: 'dlq' }),
      n('al', 'process', 190, 455, 150, 56, 'Alert and inspect', 'Console · Grafana', { tool: 'console' }),
      n('fx', 'terminal', 390, 455, 150, 56, 'Fix and replay', 'to the main topic')
    ],
    edges: [
      e('tp', 'co', { fs: 'r', ts: 'l' }),
      e('co', 'd1', { fs: 'r', ts: 'l' }),
      e('d1', 'ok', { fs: 't', ts: 'b', label: 'yes' }),
      e('d1', 'd2', { fs: 'b', ts: 't', label: 'no', bad: true }),
      e('d2', 'bo', { fs: 'r', ts: 'l', label: 'yes' }),
      e('bo', 'co', { fs: 'r', ts: 't', fa: 377, ta: 265, via: [[800, 377], [800, 20], [265, 20]], label: 'try again', lx: 800, ly: 200, dash: true }),
      e('d2', 'dl', { fs: 'l', ts: 'r', label: 'no', bad: true }),
      e('dl', 'al', { fs: 'b', ts: 't' }),
      e('al', 'fx', { fs: 'r', ts: 'l' })
    ],
    notes: [
      'Separate <b>retryable</b> failures (database timeout) from <b>non-retryable</b> ones (invalid payload): the second kind should go straight to the dead-letter topic.',
      'Alert on <b>dead-letter depth</b> and on <b>consumer lag</b>. A message in the DLT is a bug report from production.'
    ]
  };

  /* ============================================================ FLOW: CDC */
  window.DIAGRAMS.cdc = {
    title: 'Polling outbox vs change data capture',
    lead: 'Same guarantee (the event commits with the change), different way of getting it to Kafka.',
    w: 940, h: 390,
    groups: [
      { x: 10, y: 10, w: 920, h: 150, label: 'Today: polling relay (built)' },
      { x: 10, y: 200, w: 920, h: 170, label: 'Target: Debezium reads the WAL', planned: true }
    ],
    nodes: [
      n('a1', 'service', 30, 60, 140, 64, 'Service method', '@Transactional'),
      n('a2', 'db', 230, 60, 190, 64, 'Postgres', 'business row + outbox_event'),
      n('a3', 'process', 480, 60, 170, 64, 'OutboxRelay', 'polls every 1 s'),
      n('a4', 'broker', 710, 60, 140, 64, 'Kafka', ''),
      n('b1', 'service', 30, 250, 140, 64, 'Service method', '@Transactional'),
      n('b2', 'db', 230, 250, 190, 64, 'Postgres', 'outbox_event (insert only)'),
      n('b3', 'tool', 480, 250, 170, 64, 'Debezium', 'reads WAL · EventRouter', { planned: true, tool: 'debezium' }),
      n('b4', 'broker', 710, 250, 140, 64, 'Kafka', '')
    ],
    edges: [
      e('a1', 'a2', { fs: 'r', ts: 'l', label: '1 tx' }),
      e('a2', 'a3', { fs: 'r', ts: 'l', label: 'poll' }),
      e('a3', 'a4', { fs: 'r', ts: 'l', label: 'send' }),
      e('b1', 'b2', { fs: 'r', ts: 'l', label: '1 tx' }),
      e('b2', 'b3', { fs: 'r', ts: 'l', dash: true, label: 'WAL' }),
      e('b3', 'b4', { fs: 'r', ts: 'l', label: 'stream' })
    ],
    notes: [
      '<b>Polling:</b> simple, no extra infrastructure, but adds up to a second of latency and a constant query on the database.',
      '<b>CDC:</b> lower latency and no polling load, but needs logical replication enabled, a replication slot to monitor, and Kafka Connect to operate.',
      'The envelope (<code>eventId</code>, <code>type</code>, <code>portalId</code>) must stay identical so consumers do not notice the switch.'
    ]
  };

  /* ============================================================ FLOW: SAGA */
  window.DIAGRAMS.saga = {
    title: 'Saga by choreography: create a project from a template',
    lead: 'Planned example. No distributed transaction: each service reacts to events, and a failure is undone by a compensating event.',
    w: 1000, h: 400,
    nodes: [
      n('w1', 'service', 20, 55, 170, 76, 'work-service', 'create project\nstatus = CREATING'),
      n('v1', 'event', 250, 75, 140, 40, 'ProjectCreated'),
      n('au', 'service', 450, 55, 170, 76, 'automation', 'apply the template', { planned: true, tool: 'automation' }),
      n('d', 'decision', 680, 50, 110, 86, 'OK?'),
      n('v2', 'event', 850, 75, 130, 40, 'TemplateApplied'),
      n('nt', 'service', 830, 190, 160, 66, 'notification', 'email the owner', { planned: true, tool: 'notification' }),
      n('v3', 'event', 660, 190, 150, 40, 'TemplateFailed'),
      n('cp', 'service', 630, 300, 210, 76, 'work-service', 'compensate:\nstatus = FAILED')
    ],
    edges: [
      e('w1', 'v1', { fs: 'r', ts: 'l' }),
      e('v1', 'au', { fs: 'r', ts: 'l' }),
      e('au', 'd', { fs: 'r', ts: 'l' }),
      e('d', 'v2', { fs: 'r', ts: 'l', label: 'yes' }),
      e('v2', 'nt', { fs: 'b', ts: 't', fa: 915, ta: 915 }),
      e('d', 'v3', { fs: 'b', ts: 't', fa: 735, ta: 735, label: 'no', bad: true }),
      e('v3', 'cp', { fs: 'b', ts: 't', fa: 735, ta: 735, bad: true })
    ],
    notes: [
      '<b>Choreography</b> has no coordinator and is easy to start with. The price is that the whole process is only visible by following events (tracing helps).',
      '<b>Orchestration</b> (Temporal or Camunda) puts the process in one place with timers and retries built in. Compare both on this same example.',
      'Every step must be <b>idempotent</b> and every failure needs a defined compensation, otherwise a project can sit in CREATING forever. Add a timeout.'
    ]
  };

  /* ============================================================ FLOW: READ MODEL */
  window.DIAGRAMS.readmodel = {
    title: 'Read models: search and live updates',
    lead: 'Planned. The Work database is not queried for search or pushed to the browser; consumers build their own views from events.',
    w: 1000, h: 340,
    nodes: [
      n('wk', 'service', 20, 150, 140, 64, 'work-service', 'task changed'),
      n('kf', 'broker', 220, 150, 130, 64, 'Kafka', 'projecty.task', { tool: 'kafka' }),
      n('ix', 'service', 410, 60, 160, 64, 'search', 'indexer', { planned: true, tool: 'searchsvc' }),
      n('os', 'db', 640, 60, 150, 64, 'OpenSearch', '', { planned: true, tool: 'opensearch' }),
      n('rt', 'service', 410, 250, 160, 64, 'realtime', 'SSE / WebSocket', { planned: true, tool: 'sse' }),
      n('ng', 'client', 860, 150, 130, 64, 'Angular app', '')
    ],
    edges: [
      e('wk', 'kf', { fs: 'r', ts: 'l', label: 'TaskUpdated' }),
      e('kf', 'ix', { fs: 'r', ts: 'l' }),
      e('kf', 'rt', { fs: 'r', ts: 'l' }),
      e('ix', 'os', { fs: 'r', ts: 'l', label: 'index' }),
      e('ng', 'os', { fs: 't', ts: 't', fa: 925, ta: 715, via: [[925, 24], [715, 24]], dash: true, label: 'search via gateway', lx: 820, ly: 16 }),
      e('rt', 'ng', { fs: 'r', ts: 'b', fa: 282, ta: 925, via: [[925, 282]], label: 'live updates', lx: 750, ly: 274 })
    ],
    notes: [
      'Both consumers are <b>eventually consistent</b>: a search result may lag the write by a second. Show the user the write immediately and let the index catch up.',
      'Because the topic is retained, an index can be rebuilt from scratch by replaying it (a new consumer group reading from the beginning).'
    ]
  };
})();
