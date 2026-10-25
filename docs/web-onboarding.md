# Web onboarding

The demo workspace remains demo-backed. The new `web/onboarding.html` page is the first connected surface.

## Configure it

1. Copy `web/config.example.js` to `web/config.js`.
2. Set the project URL and publishable key.
3. Serve the `web/` directory over HTTP.
4. Open `/onboarding.html`.
5. Configure the onboarding URL as an allowed redirect URL in Supabase Auth.

The page uses a pinned browser import of `@supabase/supabase-js`, sends a magic link, and calls the authenticated `bootstrap_organization` RPC. It never needs or accepts a service-role key.
