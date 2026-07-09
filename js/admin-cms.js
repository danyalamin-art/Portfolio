/**
 * Content Manager — modeled after the interactive portfolio admin system.
 * Access:
 *   1) Subtle footer · button → passcode (preferred; no URL change)
 *   2) Or append ?admin to the URL → nav Content Manager → passcode
 * Works on Home and All Projects. Auth session keeps edit mode across pages.
 * Publish Live: writes js/site-data.js to GitHub so every visitor sees updates.
 * Theme: forest green portfolio.
 */
(function () {
  const KEYS = {
    projects: 'portfolio_projects_v2',
    texts: 'portfolio_site_texts_v2',
    auth: 'admin_authorized_v2',
    ghToken: 'cms_github_token_v2'
  };
  /** Target repo for live publishes (GitHub Pages site). */
  const GH = Object.assign(
    {
      owner: 'danyalamin-art',
      repo: 'Portfolio',
      branch: 'main',
      path: 'js/site-data.js'
    },
    window.GITHUB_CMS || {}
  );
  const TAG = {
    'Nursery Rhymes': 'tag-nursery',
    'Educational Animation': 'tag-edu',
    'Character Animation': 'tag-character',
    'Motion Graphics': 'tag-motion'
  };

  let projects = [];
  let siteTexts = {};
  let isAdminMode = false;
  let showAdminButton = false;
  let editingProject = null;
  let publishing = false;

  function defaults() {
    return window.SITE_DATA_DEFAULTS || { projects: [], siteTexts: {} };
  }

  function loadState() {
    const d = defaults();
    try {
      const p = localStorage.getItem(KEYS.projects);
      projects = p ? JSON.parse(p) : JSON.parse(JSON.stringify(d.projects || []));
    } catch (e) {
      projects = JSON.parse(JSON.stringify(d.projects || []));
    }
    try {
      const t = localStorage.getItem(KEYS.texts);
      siteTexts = t ? Object.assign({}, d.siteTexts, JSON.parse(t)) : Object.assign({}, d.siteTexts);
    } catch (e) {
      siteTexts = Object.assign({}, d.siteTexts);
    }
  }

  function saveProjects() {
    localStorage.setItem(KEYS.projects, JSON.stringify(projects));
  }
  function saveTexts() {
    localStorage.setItem(KEYS.texts, JSON.stringify(siteTexts));
  }

  function toast(msg, ms) {
    let el = document.getElementById('cmsToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cmsToast';
      el.className = 'cms-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms || 4200);
  }

  function getGhToken() {
    try {
      return sessionStorage.getItem(KEYS.ghToken) || localStorage.getItem(KEYS.ghToken) || '';
    } catch (e) {
      return '';
    }
  }

  function setGhToken(token, remember) {
    try {
      sessionStorage.setItem(KEYS.ghToken, token);
      if (remember) localStorage.setItem(KEYS.ghToken, token);
      else localStorage.removeItem(KEYS.ghToken);
    } catch (e) { /* ignore */ }
  }

  function clearGhToken() {
    try {
      sessionStorage.removeItem(KEYS.ghToken);
      localStorage.removeItem(KEYS.ghToken);
    } catch (e) { /* ignore */ }
  }

  function toBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  function buildSiteDataFile() {
    const pass = window.ADMIN_PASSCODE || 'danyaladmin';
    const data = { projects, siteTexts };
    return (
      '/**\n' +
      ' * Central site data (defaults). Updated by Content Manager → Publish Live.\n' +
      ' * Do not put secrets in this file except the admin passcode below.\n' +
      ' */\n' +
      'window.SITE_DATA_DEFAULTS = ' +
      JSON.stringify(data, null, 2) +
      ';\n\n' +
      'window.ADMIN_PASSCODE = ' +
      JSON.stringify(pass) +
      ';\n\n' +
      '/* Optional override for publish target */\n' +
      'window.GITHUB_CMS = window.GITHUB_CMS || ' +
      JSON.stringify(
        {
          owner: GH.owner,
          repo: GH.repo,
          branch: GH.branch,
          path: GH.path
        },
        null,
        2
      ) +
      ';\n'
    );
  }

  async function ghHeaders(token) {
    return {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  /**
   * Commit js/site-data.js to GitHub so GitHub Pages serves it to everyone.
   */
  async function publishToGitHub(opts) {
    const options = opts || {};
    const token = options.token || getGhToken();
    if (!token) {
      openTokenModal(true);
      return { ok: false, reason: 'no-token' };
    }
    if (publishing) {
      toast('⏳ Publish already in progress…');
      return { ok: false, reason: 'busy' };
    }

    publishing = true;
    setPublishBtnState(true);
    toast('🚀 Publishing to GitHub…', 8000);

    try {
      const api =
        'https://api.github.com/repos/' +
        encodeURIComponent(GH.owner) +
        '/' +
        encodeURIComponent(GH.repo) +
        '/contents/' +
        GH.path.split('/').map(encodeURIComponent).join('/');

      const headers = await ghHeaders(token);
      const getRes = await fetch(api + '?ref=' + encodeURIComponent(GH.branch), {
        headers: headers
      });

      if (getRes.status === 401 || getRes.status === 403) {
        clearGhToken();
        throw new Error('GitHub token rejected (401/403). Create a new token with Contents: Read and write.');
      }
      if (!getRes.ok && getRes.status !== 404) {
        const errBody = await getRes.text();
        throw new Error('Could not read file on GitHub (' + getRes.status + '): ' + errBody.slice(0, 180));
      }

      let sha;
      if (getRes.ok) {
        const file = await getRes.json();
        sha = file.sha;
      }

      const body = {
        message: 'Content Manager: update site content for all visitors',
        content: toBase64Utf8(buildSiteDataFile()),
        branch: GH.branch
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(api, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify(body)
      });

      if (!putRes.ok) {
        const errBody = await putRes.text();
        if (putRes.status === 401 || putRes.status === 403) {
          clearGhToken();
          throw new Error('Permission denied. Token needs Contents: Read and write on this repo.');
        }
        if (putRes.status === 409 || putRes.status === 422) {
          throw new Error('Conflict updating file — refresh the page and try Publish again.');
        }
        throw new Error('Publish failed (' + putRes.status + '): ' + errBody.slice(0, 200));
      }

      // Keep local draft in sync with what was published
      saveProjects();
      saveTexts();

      toast('✅ Live! GitHub updated. Site refreshes for everyone in ~1–2 minutes.');
      return { ok: true };
    } catch (err) {
      console.error(err);
      toast('❌ ' + (err && err.message ? err.message : 'Publish failed'));
      return { ok: false, reason: 'error', error: err };
    } finally {
      publishing = false;
      setPublishBtnState(false);
    }
  }

  function setPublishBtnState(busy) {
    const btn = document.getElementById('cmsPublish');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = busy ? '⏳ Publishing…' : '🚀 Publish Live';
  }

  function openTokenModal(thenPublish) {
    const overlay = document.getElementById('cmsTokenOverlay');
    if (!overlay) return;
    overlay.dataset.thenPublish = thenPublish ? '1' : '0';
    const input = document.getElementById('cmsGhToken');
    if (input) input.value = getGhToken();
    const err = document.getElementById('cmsTokenError');
    if (err) err.classList.remove('show');
    open('cmsTokenOverlay');
  }

  function onTokenSubmit(e) {
    e.preventDefault();
    const token = (document.getElementById('cmsGhToken').value || '').trim();
    const remember = !!document.getElementById('cmsRememberToken')?.checked;
    const err = document.getElementById('cmsTokenError');
    if (!token || token.length < 10) {
      if (err) {
        err.textContent = 'Paste a valid GitHub Personal Access Token.';
        err.classList.add('show');
      }
      return;
    }
    setGhToken(token, remember);
    close('cmsTokenOverlay');
    toast('🔑 GitHub connected');
    const thenPublish = document.getElementById('cmsTokenOverlay')?.dataset.thenPublish === '1';
    if (thenPublish) publishToGitHub({ token: token });
  }

  /** After local edit: remind or auto-publish if token already saved. */
  function afterLocalSave(msg) {
    saveProjects();
    saveTexts();
    if (getGhToken()) {
      toast((msg || 'Saved') + ' — publishing live…');
      publishToGitHub();
    } else {
      toast((msg || 'Saved locally') + ' — click 🚀 Publish Live for everyone');
    }
  }

  function isAdminUrl() {
    const s = window.location.search || '';
    const h = window.location.hash || '';
    return /[?&]admin(?:[=&#]|$)/i.test(s + '&') || /(?:^|[?&#])admin(?:[=&#]|$)/i.test(s + h);
  }

  /** Auth is stored in both localStorage + sessionStorage so Home ↔ All Projects stays unlocked. */
  function isAuthorized() {
    try {
      return (
        localStorage.getItem(KEYS.auth) === 'true' ||
        sessionStorage.getItem(KEYS.auth) === 'true'
      );
    } catch (e) {
      return false;
    }
  }

  function setAuthorized(on) {
    try {
      if (on) {
        localStorage.setItem(KEYS.auth, 'true');
        sessionStorage.setItem(KEYS.auth, 'true');
      } else {
        localStorage.removeItem(KEYS.auth);
        sessionStorage.removeItem(KEYS.auth);
      }
    } catch (e) { /* ignore */ }
  }

  /** Keep ?admin in the address bar so a hard refresh / shared link still opens Content Manager. */
  function ensureAdminInUrl() {
    if (isAdminUrl()) return;
    try {
      const u = new URL(window.location.href);
      const newSearch = u.search ? u.search + ( /[?&]$/.test(u.search) ? '' : '&' ) + 'admin' : '?admin';
      history.replaceState(null, '', u.pathname + newSearch + u.hash);
    } catch (e) { /* ignore */ }
  }

  /** Append ?admin (or &admin) so Content Manager survives page navigation. */
  function withAdminParam(href) {
    if (!href || typeof href !== 'string') return href;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return href;
    if (/[?&]admin(?:[=&#]|$)/i.test(href)) return href;

    // Absolute same-site URLs (e.g. full danyalamin.art links) still need ?admin
    if (/^https?:\/\//i.test(href)) {
      try {
        const abs = new URL(href);
        if (abs.origin !== window.location.origin) return href;
        if (abs.searchParams.has('admin')) return href;
        abs.searchParams.append('admin', '');
        // Prefer clean ?admin (empty value still matches isAdminUrl)
        return abs.pathname + (abs.search || '?admin') + abs.hash;
      } catch (e) {
        return href;
      }
    }

    const hashIdx = href.indexOf('#');
    const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
    const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
    // Keep pure in-page anchors as-is (home #portfolio etc.)
    if (!base || base === '#' || base.charAt(0) === '#') return href;

    const joiner = base.indexOf('?') >= 0 ? '&' : '?';
    return base + joiner + 'admin' + hash;
  }

  function isInternalSiteLink(href) {
    if (!href || typeof href !== 'string') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
    if (href.charAt(0) === '#') return false;
    if (/^https?:\/\//i.test(href)) {
      try {
        return new URL(href).origin === window.location.origin;
      } catch (e) {
        return false;
      }
    }
    // Home, all-projects, relative paths in this static site
    return (
      /all-projects\.html/i.test(href) ||
      /index\.html/i.test(href) ||
      href === '/' ||
      href === './' ||
      href === '../' ||
      /^\.\.\/($|\?|#|index\.html)/i.test(href) ||
      /^pages\//i.test(href) ||
      // any relative .html in this portfolio
      /\.html(?:\?|#|$)/i.test(href)
    );
  }

  /** Rewrite View All / Home / Back links so ?admin is not lost. */
  function preserveAdminLinks() {
    if (!isAdminUrl() && !isAuthorized() && !isAdminMode) return;
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!isInternalSiteLink(href)) return;
      const next = withAdminParam(href);
      if (next !== href) a.setAttribute('href', next);
    });
  }

  /**
   * Click-time guard: even if a link was re-rendered without ?admin,
   * keep admin mode when navigating Home ↔ All Projects.
   * Auth in storage is the real session; ?admin is a backup signal.
   */
  function bindAdminNavGuard() {
    if (document.documentElement.dataset.cmsNavGuard === '1') return;
    document.documentElement.dataset.cmsNavGuard = '1';
    document.addEventListener(
      'click',
      (e) => {
        if (!isAdminMode && !isAuthorized()) return;
        const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a || a.target === '_blank') return;
        const href = a.getAttribute('href');
        if (!isInternalSiteLink(href)) return;
        const next = withAdminParam(href);
        if (next !== href) a.setAttribute('href', next);
      },
      true
    );
  }

  /**
   * Capture-phase edit/delete on Home + All Projects.
   * Survives re-renders and beats the card's inline openVideoModal handler.
   */
  function bindGlobalCardAdminControls() {
    if (document.documentElement.dataset.cmsCardGuard === '1') return;
    document.documentElement.dataset.cmsCardGuard = '1';
    document.addEventListener(
      'click',
      (e) => {
        if (!isAdminMode) return;
        const t = e.target && e.target.closest ? e.target : null;
        if (!t || !t.closest) return;

        const editBtn = t.closest('[data-edit]');
        if (editBtn && editBtn.closest('.cms-card-controls')) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          window.__cmsIgnoreClick = true;
          openProjectForm(editBtn.getAttribute('data-edit'));
          setTimeout(() => (window.__cmsIgnoreClick = false), 250);
          return;
        }

        const delBtn = t.closest('[data-del]');
        if (delBtn && delBtn.closest('.cms-card-controls')) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          window.__cmsIgnoreClick = true;
          const id = delBtn.getAttribute('data-del');
          if (!confirm('Delete this project?')) {
            window.__cmsIgnoreClick = false;
            return;
          }
          projects = projects.filter((p) => p.id !== id);
          refreshProjects();
          afterLocalSave('🗑️ Project deleted');
          setTimeout(() => (window.__cmsIgnoreClick = false), 250);
        }
      },
      true
    );
  }

  /** Full admin chrome: banner, nav button, card controls, link rewrite. */
  function enableAdminChrome() {
    document.body.classList.add('cms-admin-url');
    ensureShell();
    injectNavButton();
    injectAddProjectButton();
    injectHeroEdit();
    preserveAdminLinks();
    updateStealthEntryVisibility();
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setText(sel, val) {
    const el = document.querySelector(sel);
    if (el && val != null) el.textContent = val;
  }

  function setTextKeepSvg(sel, val) {
    const el = document.querySelector(sel);
    if (!el || val == null) return;
    const svgs = Array.from(el.querySelectorAll('svg'));
    el.textContent = val;
    if (svgs[0]) el.insertBefore(svgs[0], el.firstChild);
    if (svgs[1]) el.appendChild(svgs[1]);
  }

  /* ---------- Apply content to page ---------- */
  function applyTexts() {
    const t = siteTexts;
    setText('.brand-name', t.navBrandName);
    setText('.brand-tag', t.navBrandTag);

    const eyebrow = document.querySelector('.hero-text-panel .eyebrow');
    if (eyebrow) {
      const svg = eyebrow.querySelector('svg');
      eyebrow.textContent = ' ' + (t.heroEyebrow || '');
      if (svg) eyebrow.insertBefore(svg, eyebrow.firstChild);
    }
    const name = document.querySelector('.hero-name');
    if (name) {
      name.innerHTML = esc(t.heroNameFirst) + ' <span class="accent">' + esc(t.heroNameLast) + '</span>';
    }
    setText('.hero-role', t.heroRole);
    setText('.hero-desc', t.heroDesc);
    const cta = document.querySelector('.hero-text-panel .cta-btn');
    if (cta) {
      const svg = cta.querySelector('svg');
      cta.textContent = (t.heroCta || '') + ' ';
      if (svg) cta.appendChild(svg);
    }
    setText('.hero-profile-name', t.heroProfileName);
    const loc = document.querySelector('.hero-profile-location');
    if (loc) {
      const svg = loc.querySelector('svg');
      loc.textContent = ' ' + (t.heroLocation || '');
      if (svg) loc.insertBefore(svg, loc.firstChild);
    }

    const badge = document.querySelector('.showreel-badge');
    if (badge) {
      const svg = badge.querySelector('svg');
      badge.textContent = ' ' + (t.showreelBadge || 'Showreel');
      if (svg) badge.insertBefore(svg, badge.firstChild);
    }
    const iframe = document.querySelector('.hero-video iframe, #heroShowreelFrame');
    if (iframe && t.showreelUrl) {
      let url = String(t.showreelUrl);
      if (typeof window.prepareVimeoEmbedUrl === 'function') {
        url = window.prepareVimeoEmbedUrl(url);
      } else if (/player\.vimeo\.com/i.test(url) && !/[?&]loop=/i.test(url)) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'loop=0';
      }
      if (iframe.src !== url && iframe.getAttribute('src') !== url) {
        iframe.src = url;
      }
      iframe.title = t.showreelTitle || 'Showreel';
      if (typeof window.setupHeroShowreel === 'function') {
        setTimeout(function () {
          try { window.setupHeroShowreel(); } catch (e) { /* ignore */ }
        }, 200);
      } else if (typeof window.bindVimeoFreeze === 'function') {
        setTimeout(function () {
          try { window.bindVimeoFreeze(iframe); } catch (e) { /* ignore */ }
        }, 200);
      }
    }

    setTextKeepSvg('#portfolio .section-title', t.portTitle);
    setText('.portfolio-subtitle', t.portSub);
    const viewAll = document.querySelector('.view-more-wrap .cta-btn, a.cta-btn[href*="all-projects"]');
    if (viewAll) {
      const svg = viewAll.querySelector('svg');
      viewAll.textContent = (t.portViewAll || 'View All Projects') + ' ';
      if (svg) viewAll.appendChild(svg);
      // Keep admin query on this critical link after text rewrites
      if (isAdminMode || isAuthorized() || isAdminUrl()) {
        const href = viewAll.getAttribute('href');
        if (href) viewAll.setAttribute('href', withAdminParam(href));
      }
    }

    setText('.about-eyebrow', t.aboutEyebrow);
    setTextKeepSvg('.about-title', t.aboutTitle);
    const pill = document.querySelector('.about-pill span:last-child, .about-pill span');
    if (pill) pill.textContent = t.aboutPill || pill.textContent;
    setText('.about-headline', t.aboutHeadline);
    const aboutLabel = document.querySelector('.about-portrait-label span:last-child');
    if (aboutLabel) aboutLabel.textContent = t.aboutPortraitLabel || aboutLabel.textContent;
    const aboutTexts = document.querySelectorAll('.about-text');
    if (aboutTexts[0]) aboutTexts[0].textContent = t.aboutText1 || '';
    if (aboutTexts[1]) aboutTexts[1].textContent = t.aboutText2 || '';
    const stats = document.querySelectorAll('.about-stat');
    if (stats[0]) {
      const h = stats[0].querySelector('h4');
      const p = stats[0].querySelector('p');
      if (h) h.textContent = t.aboutStat1Value;
      if (p) p.textContent = t.aboutStat1Label;
    }
    if (stats[1]) {
      const h = stats[1].querySelector('h4');
      const p = stats[1].querySelector('p');
      if (h) h.textContent = t.aboutStat2Value;
      if (p) p.textContent = t.aboutStat2Label;
    }
    if (stats[2]) {
      const h = stats[2].querySelector('h4');
      const p = stats[2].querySelector('p');
      if (h) h.textContent = t.aboutStat3Value;
      if (p) p.textContent = t.aboutStat3Label;
    }

    setTextKeepSvg('#testimonials .section-title, .section#testimonials .section-title', t.testimonialsTitle);
    const stw = document.querySelector('.section .section-title');
    // skills title is second section after portfolio - better query
    const titles = document.querySelectorAll('.section-title');
    titles.forEach((el) => {
      if (el.textContent.includes('Skills') || el.closest('.section')?.querySelector('.stw-card')) {
        // only set if about skills
      }
    });
    const skillsHeader = document.querySelector('.stw-card')?.closest('.section')?.querySelector('.section-title');
    if (skillsHeader && t.skillsTitle) setTextKeepSvgEl(skillsHeader, t.skillsTitle);

    setText('.contact-heading', t.contactHeading);
    const colTitles = document.querySelectorAll('.contact-column-title');
    if (colTitles[0]) colTitles[0].textContent = t.contactDirectTitle;
    if (colTitles[1]) colTitles[1].textContent = t.contactFormTitle;
    const emailVal = document.querySelector('.contact-highlight-value');
    const emailLink = document.querySelector('a.contact-highlight-card[href^="mailto"]');
    if (emailVal && t.contactEmail) emailVal.textContent = t.contactEmail;
    if (emailLink && t.contactEmail) emailLink.href = 'mailto:' + t.contactEmail;
    const phoneVal = document.querySelectorAll('.contact-highlight-value')[1];
    const phoneLink = document.querySelector('a.contact-highlight-card[href^="tel"]');
    if (phoneVal && t.contactPhone) phoneVal.textContent = t.contactPhone;
    if (phoneLink && t.contactPhone) phoneLink.href = 'tel:' + t.contactPhone.replace(/[^\d+]/g, '');
    const locItem = document.querySelector('.contact-info-item');
    if (locItem && t.contactLocation) {
      const svg = locItem.querySelector('svg');
      locItem.textContent = ' ' + t.contactLocation;
      if (svg) locItem.insertBefore(svg, locItem.firstChild);
    }

    const footerLogo = document.querySelector('.footer-logo');
    if (footerLogo && t.footerBrand) {
      const svg = footerLogo.querySelector('svg');
      footerLogo.innerHTML = '';
      footerLogo.appendChild(document.createTextNode(t.footerBrand + ' '));
      if (svg) footerLogo.appendChild(svg);
    }
    const footerCopy = document.querySelector('.footer-copy');
    if (footerCopy) {
      footerCopy.innerHTML = esc(t.footerCopyright) + '<br>' + esc(t.footerTagline);
    }
  }

  function setTextKeepSvgEl(el, val) {
    if (!el || val == null) return;
    const svgs = Array.from(el.querySelectorAll('svg'));
    el.textContent = ' ' + val + ' ';
    if (svgs[0]) el.insertBefore(svgs[0], el.firstChild);
    if (svgs[1]) el.appendChild(svgs[1]);
  }

  function tagClass(c) {
    return TAG[c] || 'tag-character';
  }

  function renderTags(cats, prefix) {
    prefix = prefix || 'portfolio-tag';
    cats = cats || [];
    if (cats.length <= 1) {
      const c = cats[0] || '';
      return `<span class="${prefix} ${tagClass(c)}">${esc(c)}</span>`;
    }
    const wrap = prefix === 'ptag' ? 'ptags' : 'portfolio-tags';
    return `<div class="${wrap}">${cats.map((c) => `<span class="${prefix} ${tagClass(c)}">${esc(c)}</span>`).join('')}</div>`;
  }

  function renderHomeCards() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    grid.innerHTML = projects
      .map((p) => {
        const cats = p.categories || [];
        const catStr = cats.join('|');
        const feat = p.featured ? ' data-featured="true"' : '';
        return `
      <div class="portfolio-card" data-id="${esc(p.id)}" data-cat="${esc(catStr)}"${feat}
           data-video="${esc(p.videoUrl)}" data-title="${esc(p.title)}" data-desc="${esc(p.description)}"
           data-goal="${esc(p.goal || '')}" data-result="${esc(p.result || '')}"
           onclick="if(!window.__cmsIgnoreClick)openVideoModal(this)">
        <div class="cms-card-controls">
          <button type="button" class="cms-edit" title="Edit" data-edit="${esc(p.id)}">✏️</button>
          <button type="button" class="cms-del" title="Delete" data-del="${esc(p.id)}">🗑</button>
        </div>
        <div class="portfolio-thumb">
          <img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" loading="lazy">
          <span class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        </div>
        <div class="portfolio-info">
          <h3 class="portfolio-title">${esc(p.title)}</h3>
          ${renderTags(cats, 'portfolio-tag')}
        </div>
      </div>`;
      })
      .join('');

    if (typeof window.rebindPortfolioFilters === 'function') window.rebindPortfolioFilters();
    else if (typeof applyPortfolioFilter === 'function') applyPortfolioFilter('All');
  }

  function renderAllCards() {
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    grid.innerHTML = projects
      .map((p) => {
        const cats = p.categories || [];
        const catStr = cats.join('|');
        const summary = p.cardSummary || p.description || '';
        return `
      <div class="pcard" data-id="${esc(p.id)}" data-cat="${esc(catStr)}"
           data-video="${esc(p.videoUrl)}" data-title="${esc(p.title)}" data-desc="${esc(p.description)}"
           data-goal="${esc(p.goal || '')}" data-result="${esc(p.result || '')}"
           onclick="if(!window.__cmsIgnoreClick)openVideoModal(this)">
        <div class="cms-card-controls">
          <button type="button" class="cms-edit" title="Edit project" data-edit="${esc(p.id)}">✏️</button>
          <button type="button" class="cms-del" title="Delete project" data-del="${esc(p.id)}">🗑</button>
        </div>
        <div class="pthumb"><img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" loading="lazy"><span class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></div>
        <div class="pinfo"><h3 class="ptitle">${esc(p.title)}</h3>${renderTags(cats, 'ptag')}<p class="pdesc">${esc(summary)}</p></div>
      </div>`;
      })
      .join('');
    if (typeof window.rebindAllProjectsFilters === 'function') window.rebindAllProjectsFilters();
  }

  function refreshProjects() {
    const page = document.body.dataset.page || 'home';
    if (page === 'all') renderAllCards();
    else renderHomeCards();
    // Re-attach add-project control if the grid was re-created after navigation/render
    if (isAdminMode) injectAddProjectButton();
  }

  function applyAll() {
    applyTexts();
    refreshProjects();
    if (isAdminMode || isAuthorized() || isAdminUrl()) preserveAdminLinks();
  }

  /* ---------- Admin UI shell ---------- */
  function ensureShell() {
    if (document.getElementById('cmsRoot')) return;
    const root = document.createElement('div');
    root.id = 'cmsRoot';
    root.innerHTML = `
      <div class="cms-banner" id="cmsBanner">
        <div>🛠️ <strong>CONTENT MANAGER ACTIVE:</strong> Edit content, then <strong>Publish Live</strong> so every visitor sees it (updates GitHub).</div>
        <div class="cms-banner-actions">
          <button type="button" class="cms-btn-publish" id="cmsPublish">🚀 Publish Live</button>
          <button type="button" class="cms-btn-edit" id="cmsEditTexts">✏️ Edit Site Texts &amp; Showreel</button>
          <button type="button" class="cms-btn-token" id="cmsGhConnect">🔑 GitHub Token</button>
          <button type="button" class="cms-btn-export" id="cmsExport">📋 Copy Code</button>
          <button type="button" class="cms-btn-reset" id="cmsReset">🔄 Reset Defaults</button>
          <button type="button" class="cms-btn-exit" id="cmsExitMode">Exit Admin Mode</button>
        </div>
      </div>
      <div class="cms-overlay" id="cmsAuthOverlay">
        <div class="cms-modal" style="max-width:380px;text-align:center">
          <div style="width:64px;height:64px;border-radius:50%;background:#E3F0E4;border:3px solid #146945;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:1.6rem">🔐</div>
          <h3>Content Manager</h3>
          <p class="cms-sub">Enter the admin passcode to unlock visual editing.</p>
          <form id="cmsAuthForm">
            <div class="cms-field"><input type="password" id="cmsPass" placeholder="••••••••" required autocomplete="current-password" style="text-align:center;font-size:1.1rem;letter-spacing:0.15em"/></div>
            <div class="cms-auth-error" id="cmsAuthError">Incorrect passcode.</div>
            <div class="cms-modal-actions" style="justify-content:center">
              <button type="button" class="cms-cancel" id="cmsAuthCancel">Cancel</button>
              <button type="submit" class="cms-save">Verify</button>
            </div>
          </form>
        </div>
      </div>
      <div class="cms-overlay" id="cmsTokenOverlay">
        <div class="cms-modal" style="max-width:480px">
          <h3>🔑 Connect GitHub (one-time)</h3>
          <p class="cms-sub">Publish Live writes <code>js/site-data.js</code> to your repo so GitHub Pages updates for everyone. The token stays in <strong>your browser only</strong> — never in the website files.</p>
          <ol class="cms-token-steps">
            <li>Open <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">GitHub → Fine-grained tokens</a></li>
            <li>Generate new token → only repo <strong>${esc(GH.owner)}/${esc(GH.repo)}</strong></li>
            <li>Permissions → <strong>Contents: Read and write</strong></li>
            <li>Generate, copy the token, paste below</li>
          </ol>
          <form id="cmsTokenForm">
            <div class="cms-field">
              <label>Personal Access Token</label>
              <input type="password" id="cmsGhToken" placeholder="github_pat_…" required autocomplete="off" spellcheck="false"/>
            </div>
            <label class="cms-check-row"><input type="checkbox" id="cmsRememberToken" checked/> Remember token on this browser</label>
            <div class="cms-auth-error" id="cmsTokenError">Token invalid.</div>
            <div class="cms-modal-actions">
              <button type="button" class="cms-cancel" id="cmsTokenCancel">Cancel</button>
              <button type="submit" class="cms-save">Save &amp; Continue</button>
            </div>
          </form>
        </div>
      </div>
      <div class="cms-overlay" id="cmsTextsOverlay">
        <div class="cms-modal wide" id="cmsTextsModal"></div>
      </div>
      <div class="cms-overlay" id="cmsProjectOverlay">
        <div class="cms-modal" id="cmsProjectModal"></div>
      </div>
      <div class="cms-toast" id="cmsToast"></div>
    `;
    document.body.appendChild(root);

    document.getElementById('cmsAuthCancel').onclick = () => close('cmsAuthOverlay');
    document.getElementById('cmsAuthForm').onsubmit = onAuth;
    document.getElementById('cmsEditTexts').onclick = openTextsForm;
    document.getElementById('cmsPublish').onclick = () => publishToGitHub();
    document.getElementById('cmsGhConnect').onclick = () => openTokenModal(false);
    document.getElementById('cmsExport').onclick = exportCode;
    document.getElementById('cmsReset').onclick = resetData;
    document.getElementById('cmsExitMode').onclick = exitAdminMode;
    document.getElementById('cmsTokenCancel').onclick = () => close('cmsTokenOverlay');
    document.getElementById('cmsTokenForm').onsubmit = onTokenSubmit;
    ['cmsTextsOverlay', 'cmsProjectOverlay', 'cmsAuthOverlay', 'cmsTokenOverlay'].forEach((id) => {
      document.getElementById(id).addEventListener('click', (e) => {
        if (e.target.id === id) close(id);
      });
    });
  }

  function close(id) {
    document.getElementById(id)?.classList.remove('open');
  }
  function open(id) {
    document.getElementById(id)?.classList.add('open');
  }

  function injectNavButton() {
    const nav = document.querySelector('.navbar');
    if (!nav || document.getElementById('cmsManagerBtn')) return;
    const contact = nav.querySelector('.contact-btn');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cmsManagerBtn';
    btn.className = 'cms-manager-btn';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> Content Manager';
    btn.addEventListener('click', () => {
      if (isAdminMode) exitAdminMode();
      else {
        ensureShell();
        open('cmsAuthOverlay');
        const pass = document.getElementById('cmsPass');
        if (pass) setTimeout(() => pass.focus(), 50);
      }
    });
    if (contact) {
      contact.classList.add('cms-hide-on-admin');
      contact.parentNode.insertBefore(btn, contact);
    } else {
      nav.appendChild(btn);
    }
  }

  /**
   * Very light entry control at the bottom of every page.
   * Looks like a tiny decorative mark — only you know to click it.
   */
  function injectStealthEntry() {
    if (document.getElementById('cmsStealthEntry')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cmsStealthEntry';
    btn.className = 'cms-stealth-entry';
    btn.setAttribute('aria-label', 'Site tools');
    btn.title = '';
    btn.textContent = '·';
    btn.addEventListener('click', () => {
      ensureShell();
      if (isAdminMode) {
        exitAdminMode();
        return;
      }
      if (isAuthorized()) {
        enableAdminChrome();
        setAdminMode(true);
        toast('🔓 Content Manager active');
        return;
      }
      open('cmsAuthOverlay');
      const pass = document.getElementById('cmsPass');
      if (pass) {
        pass.value = '';
        setTimeout(() => pass.focus(), 50);
      }
      document.getElementById('cmsAuthError')?.classList.remove('show');
    });
    document.body.appendChild(btn);
    updateStealthEntryVisibility();
  }

  function updateStealthEntryVisibility() {
    const btn = document.getElementById('cmsStealthEntry');
    if (!btn) return;
    // Hide the mark while full admin chrome is active (banner + nav button)
    btn.classList.toggle('cms-stealth-hidden', isAdminMode);
  }

  function injectAddProjectButton() {
    const grid = document.getElementById('portfolioGrid') || document.getElementById('cardGrid');
    if (!grid || !grid.parentNode) return;
    let wrap = document.querySelector('.cms-add-project-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cms-add-project-wrap';
      wrap.innerHTML =
        '<button type="button" class="cms-add-project-btn" id="cmsAddProject">+ Add New Portfolio Video</button>';
      grid.parentNode.insertBefore(wrap, grid);
    } else if (wrap.nextElementSibling !== grid) {
      // Keep the button directly above the project grid (Home + All Projects)
      grid.parentNode.insertBefore(wrap, grid);
    }
    const btn = document.getElementById('cmsAddProject');
    if (btn) btn.onclick = () => openProjectForm(null);
  }

  function injectHeroEdit() {
    const heroVideo = document.querySelector('.hero-video');
    if (!heroVideo || heroVideo.querySelector('.cms-float-edit')) return;
    heroVideo.style.position = 'relative';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cms-float-edit';
    b.style.top = '8px';
    b.style.right = '8px';
    b.textContent = '✏️ Edit Showreel';
    b.onclick = openTextsForm;
    heroVideo.appendChild(b);
  }

  function setAdminMode(on) {
    isAdminMode = on;
    document.body.classList.toggle('cms-admin-active', on);
    document.body.classList.toggle('cms-banner-on', on);
    const btn = document.getElementById('cmsManagerBtn');
    if (btn) {
      btn.classList.toggle('is-active', on);
      btn.innerHTML = on
        ? '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg> Exit Admin Mode'
        : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> Content Manager';
    }
    if (on) {
      enableAdminChrome();
      ensureAdminInUrl();
      preserveAdminLinks();
    }
    refreshProjects();
    updateStealthEntryVisibility();
  }

  function onAuth(e) {
    e.preventDefault();
    const pass = document.getElementById('cmsPass').value;
    const correct = window.ADMIN_PASSCODE || 'danyaladmin';
    if (pass === correct) {
      setAuthorized(true);
      close('cmsAuthOverlay');
      enableAdminChrome();
      setAdminMode(true);
      const page = document.body.dataset.page === 'all' ? 'All Projects' : 'Home';
      toast('🔓 Access granted — Content Manager active on ' + page + ' (and View All Projects)');
    } else {
      document.getElementById('cmsAuthError').classList.add('show');
    }
  }

  function exitAdminMode() {
    setAdminMode(false);
    setAuthorized(false);
    toast('🔒 Exited Admin Mode');
    // If user is not on ?admin URL, hide admin chrome after exit
    if (!isAdminUrl()) {
      document.body.classList.remove('cms-admin-url');
    }
    updateStealthEntryVisibility();
  }

  function openTextsForm() {
    if (!isAdminMode) {
      open('cmsAuthOverlay');
      return;
    }
    const t = siteTexts;
    const modal = document.getElementById('cmsTextsModal');
    modal.innerHTML = `
      <h3>✏️ Website Content Manager</h3>
      <p class="cms-sub">Edit any text, heading, button label, or showreel embed URL. Then Publish Live so everyone sees it.</p>
      <form id="cmsTextsForm">
        <div class="cms-section-block">
          <h4>🎥 Showreel video</h4>
          <div class="cms-field"><label>Showreel embed URL</label><input name="showreelUrl" type="url" required value="${esc(t.showreelUrl)}"/></div>
          <div class="cms-grid-2">
            <div class="cms-field"><label>Badge text</label><input name="showreelBadge" required value="${esc(t.showreelBadge)}"/></div>
            <div class="cms-field"><label>Iframe title</label><input name="showreelTitle" value="${esc(t.showreelTitle)}"/></div>
          </div>
        </div>
        <div class="cms-section-block">
          <h4>🏠 Hero</h4>
          <div class="cms-grid-2">
            <div class="cms-field"><label>Eyebrow</label><input name="heroEyebrow" value="${esc(t.heroEyebrow)}"/></div>
            <div class="cms-field"><label>Role</label><input name="heroRole" value="${esc(t.heroRole)}"/></div>
            <div class="cms-field"><label>First name</label><input name="heroNameFirst" value="${esc(t.heroNameFirst)}"/></div>
            <div class="cms-field"><label>Last name</label><input name="heroNameLast" value="${esc(t.heroNameLast)}"/></div>
          </div>
          <div class="cms-field"><label>Description</label><textarea name="heroDesc">${esc(t.heroDesc)}</textarea></div>
          <div class="cms-grid-2">
            <div class="cms-field"><label>CTA button</label><input name="heroCta" value="${esc(t.heroCta)}"/></div>
            <div class="cms-field"><label>Location line</label><input name="heroLocation" value="${esc(t.heroLocation)}"/></div>
          </div>
        </div>
        <div class="cms-section-block">
          <h4>📂 Portfolio section</h4>
          <div class="cms-field"><label>Title</label><input name="portTitle" value="${esc(t.portTitle)}"/></div>
          <div class="cms-field"><label>Subtitle</label><input name="portSub" value="${esc(t.portSub)}"/></div>
          <div class="cms-field"><label>View all label</label><input name="portViewAll" value="${esc(t.portViewAll)}"/></div>
        </div>
        <div class="cms-section-block">
          <h4>👤 About</h4>
          <div class="cms-field"><label>Headline</label><input name="aboutHeadline" value="${esc(t.aboutHeadline)}"/></div>
          <div class="cms-field"><label>Paragraph 1</label><textarea name="aboutText1">${esc(t.aboutText1)}</textarea></div>
          <div class="cms-field"><label>Paragraph 2</label><textarea name="aboutText2">${esc(t.aboutText2)}</textarea></div>
          <div class="cms-grid-2">
            <div class="cms-field"><label>Stat 1 value</label><input name="aboutStat1Value" value="${esc(t.aboutStat1Value)}"/></div>
            <div class="cms-field"><label>Stat 1 label</label><input name="aboutStat1Label" value="${esc(t.aboutStat1Label)}"/></div>
            <div class="cms-field"><label>Stat 2 value</label><input name="aboutStat2Value" value="${esc(t.aboutStat2Value)}"/></div>
            <div class="cms-field"><label>Stat 2 label</label><input name="aboutStat2Label" value="${esc(t.aboutStat2Label)}"/></div>
            <div class="cms-field"><label>Stat 3 value</label><input name="aboutStat3Value" value="${esc(t.aboutStat3Value)}"/></div>
            <div class="cms-field"><label>Stat 3 label</label><input name="aboutStat3Label" value="${esc(t.aboutStat3Label)}"/></div>
          </div>
        </div>
        <div class="cms-section-block">
          <h4>✉️ Contact & footer</h4>
          <div class="cms-field"><label>Contact heading</label><input name="contactHeading" value="${esc(t.contactHeading)}"/></div>
          <div class="cms-grid-2">
            <div class="cms-field"><label>Email</label><input name="contactEmail" value="${esc(t.contactEmail)}"/></div>
            <div class="cms-field"><label>Phone</label><input name="contactPhone" value="${esc(t.contactPhone)}"/></div>
          </div>
          <div class="cms-field"><label>Location</label><input name="contactLocation" value="${esc(t.contactLocation)}"/></div>
          <div class="cms-field"><label>Footer copyright</label><input name="footerCopyright" value="${esc(t.footerCopyright)}"/></div>
          <div class="cms-field"><label>Footer tagline</label><input name="footerTagline" value="${esc(t.footerTagline)}"/></div>
        </div>
        <div class="cms-modal-actions">
          <button type="button" class="cms-cancel" id="cmsTextsCancel">Cancel</button>
          <button type="submit" class="cms-save">Save Changes</button>
        </div>
      </form>
    `;
    document.getElementById('cmsTextsCancel').onclick = () => close('cmsTextsOverlay');
    document.getElementById('cmsTextsForm').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      fd.forEach((v, k) => {
        siteTexts[k] = String(v);
      });
      applyTexts();
      close('cmsTextsOverlay');
      afterLocalSave('✏️ Website text & showreel updated');
    };
    open('cmsTextsOverlay');
  }

  function openProjectForm(id) {
    if (!isAdminMode) {
      open('cmsAuthOverlay');
      return;
    }
    editingProject = id ? projects.find((p) => p.id === id) : null;
    const p = editingProject || {
      title: '',
      categories: ['Nursery Rhymes'],
      description: '',
      videoUrl: '',
      thumbnail: '',
      goal: '',
      result: '',
      featured: true
    };
    const cats = (p.categories || []).join(', ');
    const modal = document.getElementById('cmsProjectModal');
    modal.innerHTML = `
      <h3>${editingProject ? '✏️ Edit Project' : '➕ Add Portfolio Video'}</h3>
      <p class="cms-sub">Video URL should be an embeddable player link (Vimeo/YouTube embed).</p>
      <form id="cmsProjectForm">
        <div class="cms-field"><label>Title</label><input name="title" required value="${esc(p.title)}"/></div>
        <div class="cms-field"><label>Categories (comma-separated)</label><input name="categories" required value="${esc(cats)}" placeholder="Nursery Rhymes, Character Animation"/></div>
        <div class="cms-field"><label>Video embed URL</label><input name="videoUrl" type="url" required value="${esc(p.videoUrl)}"/></div>
        <div class="cms-field"><label>Thumbnail image URL</label><input name="thumbnail" type="url" value="${esc(p.thumbnail)}" placeholder="https://i.vimeocdn.com/..."/></div>
        <div class="cms-field"><label>Description</label><textarea name="description" required>${esc(p.description)}</textarea></div>
        <div class="cms-grid-2">
          <div class="cms-field"><label>Case study goal</label><textarea name="goal">${esc(p.goal || '')}</textarea></div>
          <div class="cms-field"><label>Case study result</label><textarea name="result">${esc(p.result || '')}</textarea></div>
        </div>
        <label class="cms-check"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}/> Featured on homepage</label>
        <div class="cms-modal-actions">
          <button type="button" class="cms-cancel" id="cmsProjectCancel">Cancel</button>
          <button type="submit" class="cms-save">${editingProject ? 'Save Changes' : 'Add Project'}</button>
        </div>
      </form>
    `;
    document.getElementById('cmsProjectCancel').onclick = () => close('cmsProjectOverlay');
    document.getElementById('cmsProjectForm').onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '');
      const saved = {
        id: editingProject ? editingProject.id : 'project-' + Date.now(),
        title,
        categories: String(fd.get('categories') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        videoUrl: String(fd.get('videoUrl') || ''),
        thumbnail: String(fd.get('thumbnail') || ''),
        description: String(fd.get('description') || ''),
        goal: String(fd.get('goal') || ''),
        result: String(fd.get('result') || ''),
        featured: !!fd.get('featured'),
        cardSummary: ''
      };
      const msg = editingProject ? '✏️ Project updated' : '➕ Project added';
      if (editingProject) {
        projects = projects.map((x) => (x.id === editingProject.id ? saved : x));
      } else {
        projects = [saved, ...projects];
      }
      refreshProjects();
      close('cmsProjectOverlay');
      afterLocalSave(msg);
    };
    open('cmsProjectOverlay');
  }

  function resetData() {
    if (!confirm('Reset all content to original defaults (then Publish Live to push to the site)?')) return;
    localStorage.removeItem(KEYS.projects);
    localStorage.removeItem(KEYS.texts);
    loadState();
    applyAll();
    afterLocalSave('🔄 Reset to defaults');
  }

  function exportCode() {
    const code = buildSiteDataFile();
    navigator.clipboard.writeText(code).then(
      () => toast('📋 Full site-data.js copied (backup)'),
      () => {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast('📋 Code copied');
      }
    );
  }

  /* ---------- Boot ---------- */
  function boot() {
    loadState();
    bindAdminNavGuard();
    bindGlobalCardAdminControls();

    // Always available: shell (password modal) + subtle footer entry (Home + All Projects)
    ensureShell();
    injectStealthEntry();

    applyAll();

    const authorized = isAuthorized();
    const fromUrl = isAdminUrl();

    // Authorized session restores full edit mode on BOTH Home and All Projects.
    // ?admin alone shows the Content Manager entry so you can unlock on either page.
    if (fromUrl || authorized) {
      enableAdminChrome();
      if (authorized) {
        setAdminMode(true);
      } else if (fromUrl) {
        // Landed with ?admin but not unlocked yet — prompt so All Projects isn't "read only"
        open('cmsAuthOverlay');
        const pass = document.getElementById('cmsPass');
        if (pass) setTimeout(() => pass.focus(), 50);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
