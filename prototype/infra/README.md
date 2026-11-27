# ProjectY infrastructure map

A static page that shows how ProjectY's services fit together and which tools can be added next, for learning event-driven microservices by building them. Plain HTML, CSS and JS: no build, no backend, no dependencies.

Open `index.html` in a browser (double-click is fine). The page has five sections:

- **Architecture**: today (Platform, Work, Kafka, Redis, Postgres, Mailpit) and a target picture.
- **Flows**: flowcharts of the paths that matter, with the failure branches: publishing an event (outbox), consuming one (idempotent consumer), validating a token, retry and dead-letter, outbox vs CDC, a saga, read models.
- **Tools**: a searchable catalogue (what it is, what it would do in ProjectY, what to practise), filtered by status and category.
- **Roadmap**: ten steps in a suggested order, with a progress tick per step (kept in this browser).

Click a box in any diagram for a short explanation and a link to its tool card. Light and dark themes follow the system and can be toggled.

```
infra/
  index.html
  css/infra.css
  js/tools.js      tool catalogue, categories, roadmap (edit this to change the content)
  js/diagrams.js   every diagram as data: nodes, edges, notes
  js/diagram.js    turns a diagram definition into SVG
  js/app.js        tabs, filters, progress
```

Keep it true to the code: when a tool is built, set its `status` to `have` in `js/tools.js`, and redraw the matching box in `js/diagrams.js`. Redis is the first one done (membership cache, rate limits, token denylist, definition cache).
