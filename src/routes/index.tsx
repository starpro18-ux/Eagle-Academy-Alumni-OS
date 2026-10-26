import { createFileRoute, redirect } from "@tanstack/react-router";

// The product lives in the existing static pages under web/. Send visitors to onboarding,
// which handles magic-link sign-in and the organization bootstrap flow.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/onboarding.html" });
  },
  head: () => ({
    meta: [
      { title: "Eagle Academy Alumni OS" },
      { name: "description", content: "Human-controlled operating system for Eagle Academy alumni." },
      { property: "og:title", content: "Eagle Academy Alumni OS" },
      { property: "og:description", content: "Human-controlled operating system for Eagle Academy alumni." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
