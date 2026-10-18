import { createRouter, createWebHistory } from "vue-router";
import CommitPage from "./pages/CommitPage.vue";
import InvestigationPage from "./pages/InvestigationPage.vue";
import InvestigationsPage from "./pages/InvestigationsPage.vue";
import NewInvestigationPage from "./pages/NewInvestigationPage.vue";
import PlaceholderPage from "./pages/PlaceholderPage.vue";
import ProposalEditPage from "./pages/ProposalEditPage.vue";
import ProposalPage from "./pages/ProposalPage.vue";
import ProposalsPage from "./pages/ProposalsPage.vue";
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
    // A commit's own page, with its changes and the Investigate button (plan step 4.10).
    { path: `${workspace}/commits/:sha`, component: CommitPage, meta: { title: "Commit" } },
    {
      path: `${workspace}/commits/:sha/investigations/new`,
      component: NewInvestigationPage,
      meta: { title: "New investigation" },
    },
    { path: `${workspace}/commits`, redirect: (to) => `/repositories/${to.params.owner}/${to.params.name}` },
    { path: `${workspace}/investigations`, component: InvestigationsPage, meta: { title: "Investigations" } },
    {
      path: `${workspace}/investigations/:investigation`,
      component: InvestigationPage,
      meta: { title: "Investigation" },
    },
    { path: `${workspace}/proposals`, component: ProposalsPage, meta: { title: "Proposals" } },
    { path: `${workspace}/proposals/:proposal`, component: ProposalPage, meta: { title: "Proposal" } },
    { path: `${workspace}/proposals/:proposal/edit`, component: ProposalEditPage, meta: { title: "Edit proposal" } },
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
