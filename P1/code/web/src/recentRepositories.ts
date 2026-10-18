/**
 * The repositories a user opened recently, kept in this browser's localStorage
 * under their username (decision of 2026-10-17). Nothing is stored on the server,
 * so the list lasts on this browser but does not follow the user to another one.
 */
export interface RecentRepository {
  owner: string;
  name: string;
}

const LIMIT = 10;

function key(username: string): string {
  return `gitdocs.recentRepositories.${username}`;
}

export function recentRepositories(username: string): RecentRepository[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(username)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((r): r is RecentRepository => typeof r?.owner === "string" && typeof r?.name === "string")
      : [];
  } catch {
    return [];
  }
}

function save(username: string, list: RecentRepository[]): void {
  try {
    localStorage.setItem(key(username), JSON.stringify(list));
  } catch {
    // Storage is blocked; the list just is not remembered.
  }
}

function same(a: RecentRepository, b: RecentRepository): boolean {
  // GitHub names are not case-sensitive.
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.name.toLowerCase() === b.name.toLowerCase();
}

/** Moves the repository to the top of the list, adding it if it is new. */
export function rememberRepository(username: string, repository: RecentRepository): RecentRepository[] {
  const list = [repository, ...recentRepositories(username).filter((r) => !same(r, repository))].slice(0, LIMIT);
  save(username, list);
  return list;
}

export function forgetRepository(username: string, repository: RecentRepository): RecentRepository[] {
  const list = recentRepositories(username).filter((r) => !same(r, repository));
  save(username, list);
  return list;
}
