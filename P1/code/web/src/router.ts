import { createRouter, createWebHistory } from "vue-router";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import SignInPage from "./pages/SignInPage.vue";
import { restoreSession, useSession } from "./session.ts";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    /** The plan-vue.md step that builds this screen. */
    step?: string;
    /** Open without signing in. Every other route requires a session. */
    public?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/repositories" },
    { path: "/sign-in", component: SignInPage, meta: { title: "Sign in", public: true } },
    { path: "/repositories", component: PlaceholderPage, meta: { title: "Repositories", step: "V4.1" } },
    {
      path: "/repositories/:repository/commits",
      component: PlaceholderPage,
      meta: { title: "Commits", step: "V4.2" },
    },
    {
      path: "/repositories/:repository/commits/:sha",
      component: PlaceholderPage,
      meta: { title: "Documentation at a commit", step: "V4.3" },
    },
    { path: "/proposals", component: PlaceholderPage, meta: { title: "My proposals", step: "V6.1" } },
    { path: "/proposals/:proposal", component: PlaceholderPage, meta: { title: "Proposal", step: "V6.2" } },
    { path: "/proposals/:proposal/edit", component: PlaceholderPage, meta: { title: "Edit proposal", step: "V5.2" } },
    { path: "/reviews", component: PlaceholderPage, meta: { title: "Review queue", step: "V7.1" } },
    { path: "/reviews/:review", component: PlaceholderPage, meta: { title: "Review", step: "V7.3" } },
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
