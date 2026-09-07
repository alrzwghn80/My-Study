-- Data integrity: a user can have at most one session that is ACTIVE or
-- PAUSED at any time. This is the server-side backstop against double
-- starts and multi-tab races described in docs/architecture.md.
-- Not expressible in schema.prisma (Prisma has no partial-unique-index
-- syntax), so it is hand-written here. Keep this file if the schema is
-- ever regenerated from the database.
CREATE UNIQUE INDEX "one_active_or_paused_session_per_user"
  ON "StudySession" ("userId")
  WHERE "status" IN ('ACTIVE', 'PAUSED');
