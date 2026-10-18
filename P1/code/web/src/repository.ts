import { computed } from "vue";
import { useRoute } from "vue-router";

export interface RepositoryRef {
  owner: string;
  name: string;
}

/** The URL of a page in a repository's workspace, such as `/repositories/sophieelin/PaperNet/investigations`. */
export function repositoryPath({ owner, name }: RepositoryRef, section = ""): string {
  return `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}${section}`;
}

/** The repository whose workspace the current page belongs to, or null on pages outside one. */
export function useCurrentRepository() {
  const route = useRoute();
  return computed<RepositoryRef | null>(() => {
    const { owner, name } = route.params;
    return typeof owner === "string" && typeof name === "string" ? { owner, name } : null;
  });
}
