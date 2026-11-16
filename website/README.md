# CRT-TV website

Static Astro product site for CRT-TV. Started with `npm create astro@latest -- --template blog`; sample blog content was replaced with Home, Download, Docs, and Contact. Website branding does not change the desktop app.

## Local development

Use Node 24 and pnpm 11.22.0. From the repository root:

```sh
pnpm --dir website install --frozen-lockfile
cp website/.env.example website/.env
pnpm --dir website dev --background
```

Open **http://localhost:4321/shader-video-player/**. Manage the server with `pnpm --dir website dev status`, `dev logs`, or `dev stop`. Restart after changing environment variables. This folder has its own pnpm workspace and lockfile; desktop dependencies are separate.

```sh
pnpm --dir website check
pnpm --dir website build
pnpm --dir website preview
```

The static output is `website/dist`. No application server is required.

## Web3Forms setup

Create an access key at [Web3Forms](https://web3forms.com/) for the inbox that should receive submissions. Set `PUBLIC_WEB3FORMS_ACCESS_KEY` in `website/.env` for local work, or in the build environment. Rebuild after changing it.

This key is deliberately public and is embedded in HTML. Never use a private API secret. Empty configuration disables forms with a visible explanation. No key is checked into this repository.

Signup requires explicit launch-update consent. Inquiries do not subscribe the sender. Both are sent to the configured inbox under distinct subjects. This is email capture, not an automatic mailing-list integration; manage launch messages and removal requests separately. A real delivery check still requires your key and inbox. Restrict allowed domains in Web3Forms if supported by your account.

## GitHub Pages

The workflow `.github/workflows/website-pages.yml` only runs when manually dispatched. Nothing is deployed by local development or pushes alone.

1. In repository Settings → Pages, choose **GitHub Actions** as the source.
2. Add the Actions secret `PUBLIC_WEB3FORMS_ACCESS_KEY` for the receiving inbox.
3. Defaults are `SITE_URL=https://areimel.github.io` and `SITE_BASE=/shader-video-player`. Override them with repository Actions variables if the destination changes. For a custom domain, use its HTTPS origin and `SITE_BASE=/`, and configure the domain in Pages settings.
4. Run **Deploy CRT-TV website** in Actions when ready to publish.

The workflow installs only website dependencies, checks Astro types, builds, and deploys `website/dist`. Navigation, screenshots, scripts, fonts, canonical URLs, and social images all respect the configured base. `SITE_URL` is the origin; keep the project path in `SITE_BASE`.

For local origin/base changes, edit `website/.env`. Shell environment values take precedence. Node loads this local file for Astro config; Astro exposes only `PUBLIC_` variables to browser code.

## Editing

- Shared layout and components: `src/layouts/` and `src/components/`.
- Colors, typography and spacing: `src/styles/global.css`.
- Shared site settings, navigation and features: `src/lib/`.
- Starter manual: `src/content/guide.md`.
- Screenshot provenance: `public/images/README.md`.

Keep repeated UI in shared components and files under roughly 300 lines. App screenshots use generated test footage, and still show the existing desktop branding. The Download command is intentionally a nonfunctional `example.com` placeholder.
