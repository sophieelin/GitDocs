import { createRouter, createWebHistory } from "vue-router";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import RepositoriesPage from "./pages/RepositoriesPage.vue";
import RepositoryHomePage from "./pages/RepositoryHomePage.vue";
import SignInPage from "./pages/SignInPage.vue";
import { restoreSession, useSession } from "./session.ts";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    /** The plan step that builds this screen. */
    step?: string;
    /** Open without signing in. Every other route requires a session. */
    public?: boolean;
  }
}

/** Every page about a repository lives in its workspace, under this path. */
const workspace = "/repositories/:owner/:name";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/repositories" },
    { path: "/sign-in", component: SignInPage, meta: { title: "Sign in", public: true } },
    { path: "/repositories", component: RepositoriesPage, meta: { title: "Repositories" } },
    { path: workspace, component: RepositoryHomePage, meta: { title: "Home" } },
    // Commit and tree pages were replaced by Home and investigations (plan step 4.5).
    { path: `${workspace}/commits/:rest(.*)*`, redirect: (to) => `/repositories/${to.params.owner}/${to.params.name}` },
    {
      path: `${workspace}/investigations`,
      component: PlaceholderPage,
      meta: { title: "Investigations", step: "4.9" },
    },
    {
      path: `${workspace}/investigations/:investigation`,
      component: PlaceholderPage,
      meta: { title: "Investigation", step: "4.9" },
    },
    { path: `${workspace}/proposals`, component: PlaceholderPage, meta: { title: "Proposals", step: "5.8" } },
    {
      path: `${workspace}/proposals/:proposal`,
      component: PlaceholderPage,
      meta: { title: "Proposal", step: "5.8" },
    },
    {
      path: `${workspace}/proposals/:proposal/edit`,
      component: PlaceholderPage,
      meta: { title: "Edit proposal", step: "5.7" },
    },
    { path: `${workspace}/reviews`, component: PlaceholderPage, meta: { title: "Reviews", step: "6.7" } },
    { path: `${workspace}/reviews/:review`, component: PlaceholderPage, meta: { title: "Review", step: "6.7" } },
    { path: "/:path(.*)*", component: PlaceholderPage, meta: { title: "Page not found" } },
  ],
});

// Signed-out users go to sign-in, and come back to the page they asked for afterwards.
router.beforeEach(async (to) => {
  await restoreSession();
  const signedIn = useSession().session !== null;
  if (!to.meta.public && !signedIn) return { path: "/sign-in", query: { redirect: to.fullPath } };
  if (to.path === "/sign-in" && signedIn) return "/repositories";
  return true;
});
