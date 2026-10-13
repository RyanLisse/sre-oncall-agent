# D01: chat mutations are buttons, not text
- **Decision:** mutation requests in chat are refused by a grammar in
  `routeMessage` before any model call; approve/execute/resolve are HTTP
  endpoints behind named buttons.
- **Why:** a model that interprets "roll back now" can be fooled by phrasing;
  a regex cannot.
- **Rejected:** routing mutations through the agent with a "confirm first"
  instruction — instructions inside user text are data, not policy.
- **Evidence:** `src/chat.ts` MUTATION + `test/workshop/chat.test.ts`
- **Status:** accepted — 2026-10-12
