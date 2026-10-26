<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Eagle Academy Alumni OS
- The product UI is the original static pages in `web/` (served as Vite `publicDir` at their original `/*.html` paths); keep their routes and style intact and edit them in place rather than rewriting in React.
- Browser Supabase config comes from the `/config.js` server route and must only ever expose the publishable key.
- `npm test` runs the original repo's node security-contract tests (CI depends on it); `npm run test:app` runs vitest.
- Never add migration files by hand; the existing ones in the GitHub repo are already applied to the connected Supabase project.
