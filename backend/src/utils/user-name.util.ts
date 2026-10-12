import type { PrismaService } from '../../prisma/prisma.service';

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giv;

/**
 * Replaces user IDs embedded in history `action_performed` text with the user's display name.
 *
 * Older history rows (and rows written when the auth-service lookup failed) store the raw
 * Keycloak user ID, e.g. "Assigned task 12 to user 8958bbd1-...". Names come from the
 * cms_usernames table, which is populated on every login. Unknown IDs are left as they are.
 */
export async function replaceUserIdsWithNames<T extends { action_performed: string }>(prisma: PrismaService, rows: T[]): Promise<T[]> {
  const userIds = new Set<string>();
  for (const row of rows) {
    for (const match of row.action_performed.match(UUID_PATTERN) ?? []) {
      userIds.add(match.toLowerCase());
    }
  }
  if (userIds.size === 0) return rows;

  let users: Array<{ user_id: string; name: string }>;
  try {
    users = await prisma.cms_usernames.findMany({
      where: { user_id: { in: [...userIds] } },
      select: { user_id: true, name: true },
    });
  } catch {
    // Names are cosmetic; never fail the history request because of them.
    return rows;
  }
  if (users.length === 0) return rows;

  const nameById = new Map(users.map((u) => [u.user_id.toLowerCase(), u.name]));
  return rows.map((row) => ({
    ...row,
    action_performed: row.action_performed.replace(UUID_PATTERN, (id) => nameById.get(id.toLowerCase()) ?? id),
  }));
}
