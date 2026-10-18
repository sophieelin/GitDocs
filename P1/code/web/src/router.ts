import { createRouter, createWebHistory } from "vue-router";
import PlaceholderPage from "./pages/PlaceholderPage.vue";

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    /** The plan-vue.md step that builds this screen. */
    step?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/repositories" },
    { path: "/sign-in", component: PlaceholderPage, meta: { title: "Sign in", step: "V3.1" } },
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
