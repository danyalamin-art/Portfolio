# Content Manager (Admin Mode)

Edit your portfolio in the browser and **Publish Live** so changes update GitHub and every visitor sees them on **https://danyalamin.art**.

Works on **Home** and **All Projects**. After you unlock once, **View All Projects** / **Back to Home** keep you in edit mode — same edit ✏️ / delete 🗑 buttons and **+ Add New Portfolio Video** on both pages.

## Open admin (recommended)

1. Scroll to the **bottom** of the site
2. Click the tiny **·** mark centered at the bottom (very light on purpose — only you know it’s there)
3. Enter the passcode: **`danyaladmin`**
4. Content Manager unlocks — edit projects, texts, and Publish Live

Same control works on **Home** and **All Projects**.

## Open admin (optional URL)

You can still append **`?admin`** if you prefer:

- Live home: `https://danyalamin.art/?admin`
- Live all projects: `https://danyalamin.art/pages/all-projects.html?admin`
- Local: `http://localhost:3000/?admin`

With `?admin`, a **Content Manager** button also appears in the nav.

## First-time setup (GitHub token)

Publishing needs a **Personal Access Token** so the site can write only `js/site-data.js` in your repo. The token is stored **in your browser only** — never in website files.

1. Open [GitHub → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. **Generate new token**
3. Repository access → **Only select** `danyalamin-art/Portfolio`
4. Permissions → **Contents: Read and write**
5. Generate and **copy** the token
6. Unlock Content Manager, click **🔑 GitHub Token**, paste the token  
   (or click **🚀 Publish Live** — it will ask for the token)

Optional: check **Remember token on this browser**.

## Everyday workflow

1. Open `https://danyalamin.art/` → hard-refresh (**Ctrl+F5**) if you just deployed
2. Click the subtle **·** at the bottom → passcode: **`danyaladmin`**
3. Edit texts, showreel, or portfolio projects (including on **View All Projects**)
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
2. Unlocking sets an auth flag so **Home ↔ All Projects** stays in edit mode
3. **Publish Live** uses the GitHub Contents API to update `js/site-data.js` on branch `main`
4. GitHub Pages rebuilds → visitors load the new data on **danyalamin.art**

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
- The footer **·** is intentionally hard to notice; change the passcode if it is ever shared

## Files

- `CNAME` — custom domain (`danyalamin.art`) — **do not delete**
- `js/site-data.js` — live site content (updated by Publish)
- `js/admin-cms.js` — admin + GitHub publish logic
- `css/admin-cms.css` — admin UI styles
