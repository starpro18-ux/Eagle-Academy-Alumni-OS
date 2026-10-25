# Secure onboarding

The first signed-in user can bootstrap one Eagle organization through the authenticated RPC:

```js
const { data, error } = await supabase.rpc("bootstrap_organization", {
  org_name: "Eagle Academy Alumni Association",
  org_slug: "eagle-academy-alumni",
});
```

The RPC:

- requires a valid Supabase Auth session;
- allows a user with no existing organization membership to create one organization;
- creates that user as the `owner`;
- validates the name and slug;
- serializes concurrent bootstrap attempts per user;
- rejects a second organization bootstrap for the same user;
- keeps the privileged implementation in the private schema.

Use the publishable Supabase key in the browser. Never put a service-role or secret key in frontend code.
