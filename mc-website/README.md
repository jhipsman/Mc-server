# mc-website

A static website for the Minecraft server, built with plain HTML, CSS and JavaScript. There's no framework and no build step.

| Page | File |
|---|---|
| Landing page: server name, click-to-copy IP, description, live player count | `index.html` |
| Rules | `rules.html` |
| How to Join (step by step) | `join.html` |
| Vote (links to server list sites) | `vote.html` |
| Store link (Tebex/BuyCraft) | in the nav bar on every page |

It uses a dark theme, it's mobile responsive (with a hamburger menu under 820px), and it respects `prefers-reduced-motion`.

## Customising

Almost everything lives in **`assets/js/config.js`**:

```js
serverName: "My Survival Server",
serverAddress: "play.example.com",
discordUrl: "https://discord.gg/your-invite",
storeUrl: "https://your-store.tebex.io",
statusApi: "mcsrvstat",
voteSites: [ { name, url, note }, ... ]
```

Elements marked with `data-server-name`, `data-server-ip`, `data-store-link`, `data-discord-link` and similar attributes are filled in from the config when the page loads. You should **also** change the placeholder name in each page's `<title>` and the `<h1>` text, so search engines and link previews see the real name.

- **Rules:** edit the `.rule` blocks in `rules.html`.
- **Perk table:** the table on `index.html` matches the default SurvivalPlus `config.yml`. Update it if you change the tiers.
- **Colours:** change the CSS variables at the top of `assets/css/style.css` (`--accent`, `--gold`, `--bg` ...).
- **Vote links:** after you list your server on each site, replace the generic URLs with your server's own vote pages.

### Live player count

Browsers can't speak the Minecraft query protocol (it runs over UDP), so the page asks an HTTP service that queries the server:

| `statusApi` | What it does |
|---|---|
| `"mcsrvstat"` *(default)* | Uses the free public API at [api.mcsrvstat.us](https://api.mcsrvstat.us). It uses the query protocol when `enable-query=true` (already on in `server.properties`), so the player list works too. No setup needed, but results are cached for about 1 minute. |
| `"https://your-dashboard/api/public/status"` | Uses the **mc-admin-dashboard** public endpoint. The dashboard queries the server directly over the query protocol. It's live with no third party, but the dashboard must be reachable from the internet over HTTPS (see that README). |

Both return the same JSON shape, so you can switch by changing that one line.

### Store

Create a webstore at https://tebex.io (formerly BuyCraft), connect it to the server with the Tebex plugin, and put the store URL in `storeUrl`.

## Previewing locally

Open `index.html` in a browser, or serve the folder (some browsers restrict `fetch` from `file://`):

```bat
cd mc-website
npx serve .
```

## Deploying

### Option A: GitHub Pages (free)

The site lives in the `mc-website/` subfolder of this repo, so publish it with a GitHub Actions workflow:

1. Create `.github/workflows/pages.yml` in the **repo root**:

   ```yaml
   name: Deploy website
   on:
     push:
       branches: [main]
       paths: ["mc-website/**"]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with:
             path: mc-website
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

2. On GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.
4. *(Optional)* custom domain: add it under Settings → Pages, then create a `CNAME` DNS record pointing to `<user>.github.io`.

If you'd rather keep the website in its own repo, copy the contents of `mc-website/` into the root of a new repo, then go to **Settings → Pages → Deploy from a branch → main / (root)**. The `.nojekyll` file is already included.

### Option B: Netlify (free)

**Drag and drop:** log in at https://app.netlify.com → **Add new site → Deploy manually** → drag the `mc-website` folder in. Done.

**From Git (auto-deploys on push):**

1. **Add new site → Import an existing project** → pick this repo.
2. **Base directory:** `mc-website`. **Build command:** *(leave empty)*. **Publish directory:** `mc-website`.
3. Deploy. `netlify.toml` already sets the caching and security headers.
4. *(Optional)* go to **Domain management → Add a domain** to use your own domain. Netlify provides HTTPS automatically.

### Point your Minecraft domain at the server

If you own `example.com`, you can use `play.example.com` for players and `example.com` for the website:

| Record | Name | Value |
|---|---|---|
| `A` | `play` | your server's public IP |
| `SRV` *(only if you don't use port 25565)* | `_minecraft._tcp.play` | `0 5 <port> play.example.com` |
| `CNAME` / `A` | `@` / `www` | as instructed by GitHub Pages or Netlify |

## Files

```
index.html  rules.html  join.html  vote.html
assets/css/style.css      theme + responsive layout
assets/js/config.js       ← edit this
assets/js/main.js         copy-to-clipboard, mobile nav, live status, vote list
assets/favicon.svg
netlify.toml  .nojekyll
```
