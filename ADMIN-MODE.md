# Content Manager (Admin Mode)

Edit your portfolio in the browser and **Publish Live** so changes update GitHub and every visitor sees them on **https://danyalamin.art**.

## Open admin

Append **`?admin`** to the site URL:

- Live: `https://danyalamin.art/?admin`
- Local: `http://localhost:3000/?admin`

## First-time setup (GitHub token)

Publishing needs a **Personal Access Token** so the site can write only `js/site-data.js` in your repo. The token is stored **in your browser only** — never in website files.

1. Open [GitHub → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. **Generate new token**
3. Repository access → **Only select** `danyalamin-art/Portfolio`
4. Permissions → **Contents: Read and write**
5. Generate and **copy** the token
6. On the site with `?admin`, unlock Content Manager, click **🔑 GitHub Token**, paste the token  
   (or click **🚀 Publish Live** — it will ask for the token)

Optional: check **Remember token on this browser**.

## Everyday workflow

1. Open `https://danyalamin.art/?admin` → hard-refresh (**Ctrl+F5**)
2. Click **Content Manager** → passcode: **`danyaladmin`**
3. Edit texts, showreel, or portfolio projects
4. If a token is saved, edits **auto-publish** to GitHub  
   Otherwise click **🚀 Publish Live**
5. Wait **1–2 minutes** for GitHub Pages to rebuild — then everyone sees the update

## Banner tools

| Button | What it does |
|--------|----------------|
| **Publish Live** | Commits current content to `js/site-data.js` on GitHub |
| **Edit Site Texts & Showreel** | Hero, about, contact, showreel URL, etc. |
| **GitHub Token** | Connect / change your PAT |
| **Copy Code** | Backup of full `site-data.js` to clipboard |
| **Reset Defaults** | Restore built-in defaults (then publish to go live) |
| **Exit Admin Mode** | Leave admin UI |

## Passcode

Default: `danyaladmin`  
Change in `js/site-data.js` → `window.ADMIN_PASSCODE`.

## How it works

1. Edits are drafted in your browser (`localStorage`)
2. **Publish Live** uses the GitHub Contents API to update `js/site-data.js` on branch `main`
3. GitHub Pages rebuilds → visitors load the new data on **danyalamin.art**

Repo target:

- Owner: `danyalamin-art`
- Repo: `Portfolio`
- Branch: `main`
- File: `js/site-data.js`
- Domain: `danyalamin.art` (via `CNAME`)

## Security notes

- Do **not** put your GitHub token in any file you commit
- Use a **fine-grained** token limited to this one repo (`Portfolio`)
- Anyone with the admin passcode can open the UI; only someone with a write token can change the live site
- Revoke the token anytime in GitHub settings if it leaks

## Files

- `CNAME` — custom domain (`danyalamin.art`) — **do not delete**
- `js/site-data.js` — live site content (updated by Publish)
- `js/admin-cms.js` — admin + GitHub publish logic
- `css/admin-cms.css` — admin UI styles
