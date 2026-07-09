# Project agent rules (Ponytail)

This portfolio is maintained with **Ponytail** (lazy senior) coding style via the Grok skill `/ponytail`.

Before writing code, understand the change, then take the first rung that works:

1. YAGNI — skip speculative work  
2. Reuse what already exists in this repo  
3. Prefer stdlib / browser / CSS over new libraries  
4. Prefer already-installed deps over new ones  
5. Prefer one line / smallest correct diff  
6. Only then write the minimum that works  

**Do not cut:** security, accessibility, data-loss prevention, trust-boundary validation, or anything explicitly requested.

**Stack notes for this site:** static HTML/CSS/JS on GitHub Pages. Prefer small edits in `js/admin-cms.js`, `css/admin-cms.css`, `js/site-data.js`, and the HTML pages — not new frameworks.

Mark intentional shortcuts with `// ponytail: ...` when useful.

Source skill: user Grok skill `ponytail` (from https://github.com/DietrichGebert/ponytail).  
Say `stop ponytail` or `normal mode` to turn the style off for a session.
