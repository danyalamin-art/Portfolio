/**
 * Freeze Vimeo embeds on the last frame so the "More from…" end screen never opens.
 * Used for hero showreel + portfolio video modal.
 */
(function () {
  var controllers = Object.create(null);
  var playerApiLoading = false;
  var playerApiReady = !!(window.Vimeo && window.Vimeo.Player);
  var readyQueue = [];

  function whenPlayerApiReady(cb) {
    if (playerApiReady || (window.Vimeo && window.Vimeo.Player)) {
      playerApiReady = true;
      cb();
      return;
    }
    readyQueue.push(cb);
    if (playerApiLoading) return;
    playerApiLoading = true;
    var s = document.createElement('script');
    s.src = 'https://player.vimeo.com/api/player.js';
    s.async = true;
    s.onload = function () {
      playerApiReady = true;
      playerApiLoading = false;
      readyQueue.splice(0).forEach(function (fn) {
        try { fn(); } catch (e) { /* ignore */ }
      });
    };
    s.onerror = function () {
      playerApiLoading = false;
      readyQueue.length = 0;
    };
    document.head.appendChild(s);
  }

  function wantsLoop(url) {
    return /[?&]loop=1(?:&|$)/i.test(String(url || ''));
  }

  function isVimeoUrl(url) {
    return /player\.vimeo\.com\/video\//i.test(String(url || ''));
  }

  /** Ensure embed URL prefers freeze (loop=0) unless loop=1 is explicit. */
  window.prepareVimeoEmbedUrl = function prepareVimeoEmbedUrl(url) {
    var u = String(url || '').trim();
    if (!u || !isVimeoUrl(u)) return u;
    u = u.replace(/&amp;/gi, '&');
    if (!/[?&]loop=/i.test(u)) {
      u += (u.indexOf('?') >= 0 ? '&' : '?') + 'loop=0';
    }
    // Hide chrome that often accompanies end screens
    if (!/[?&]title=/i.test(u)) u += '&title=0';
    if (!/[?&]byline=/i.test(u)) u += '&byline=0';
    if (!/[?&]portrait=/i.test(u)) u += '&portrait=0';
    return u;
  };

  function destroyController(key) {
    var c = controllers[key];
    if (!c) return;
    try {
      if (c.player && c.player.unload) c.player.unload();
    } catch (e) { /* ignore */ }
    delete controllers[key];
  }

  /**
   * Bind freeze-on-last-frame to an iframe (by element or id).
   * Re-binds when src changes.
   */
  window.bindVimeoFreeze = function bindVimeoFreeze(iframeOrId) {
    var iframe =
      typeof iframeOrId === 'string'
        ? document.getElementById(iframeOrId)
        : iframeOrId;
    if (!iframe || !iframe.tagName) return;

    var key = iframe.id || iframe.getAttribute('data-vimeo-key') || 'vimeo-' + Math.random().toString(36).slice(2);
    if (!iframe.id && !iframe.getAttribute('data-vimeo-key')) {
      iframe.setAttribute('data-vimeo-key', key);
    } else if (iframe.id) {
      key = iframe.id;
    }

    var src = iframe.getAttribute('src') || iframe.src || '';
    if (!src || src === 'about:blank' || !isVimeoUrl(src)) {
      destroyController(key);
      return;
    }
    if (wantsLoop(src)) {
      destroyController(key);
      return;
    }

    var existing = controllers[key];
    if (existing && existing.src === src && existing.player) return;

    destroyController(key);

    whenPlayerApiReady(function () {
      // Element may have been cleared before API loaded
      var el =
        typeof iframeOrId === 'string'
          ? document.getElementById(iframeOrId)
          : iframeOrId;
      if (!el) return;
      var currentSrc = el.getAttribute('src') || el.src || '';
      if (!isVimeoUrl(currentSrc) || wantsLoop(currentSrc)) return;

      var player;
      try {
        player = new Vimeo.Player(el);
      } catch (e) {
        return;
      }

      var freezing = false;
      var lastDuration = 0;

      var controller = {
        player: player,
        src: currentSrc,
        iframe: el
      };
      controllers[key] = controller;

      player.getDuration().then(function (d) {
        lastDuration = d || 0;
      }).catch(function () {});

      player.on('timeupdate', function (data) {
        if (freezing || controllers[key] !== controller) return;
        var check = function (duration) {
          lastDuration = duration || lastDuration;
          if (!lastDuration || freezing) return;
          if (data.seconds >= lastDuration - 0.3) {
            freezing = true;
            var t = Math.max(0, lastDuration - 0.08);
            player.pause().then(function () {
              return player.setCurrentTime(t);
            }).catch(function () {
              freezing = false;
            });
          }
        };
        if (lastDuration) check(lastDuration);
        else player.getDuration().then(check).catch(function () {});
      });

      player.on('ended', function () {
        if (controllers[key] !== controller) return;
        freezing = true;
        player.getDuration().then(function (duration) {
          var t = Math.max(0, (duration || lastDuration) - 0.08);
          return player.setCurrentTime(t).then(function () {
            return player.pause();
          });
        }).catch(function () {});
      });

      player.on('play', function () {
        if (controllers[key] !== controller) return;
        if (!freezing) return;
        freezing = false;
        // If user replays while stuck on last frame, restart from beginning
        player.getCurrentTime().then(function (t) {
          player.getDuration().then(function (d) {
            if (d && t >= d - 0.5) {
              player.setCurrentTime(0).catch(function () {});
            }
          });
        }).catch(function () {});
      });
    });
  };

  window.unbindVimeoFreeze = function unbindVimeoFreeze(iframeOrId) {
    var iframe =
      typeof iframeOrId === 'string'
        ? document.getElementById(iframeOrId)
        : iframeOrId;
    if (!iframe) return;
    var key = iframe.id || iframe.getAttribute('data-vimeo-key');
    if (key) destroyController(key);
  };

  /** Hero convenience alias */
  window.setupHeroShowreel = function setupHeroShowreel() {
    var iframe = document.getElementById('heroShowreelFrame');
    if (!iframe) return;
    var src = iframe.getAttribute('src') || iframe.src || '';
    if (src && isVimeoUrl(src)) {
      var prepared = window.prepareVimeoEmbedUrl(src);
      if (prepared !== src && prepared !== iframe.src) {
        iframe.src = prepared;
      }
    }
    window.bindVimeoFreeze(iframe);
  };

  function bootHero() {
    if (document.getElementById('heroShowreelFrame')) {
      window.setupHeroShowreel();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootHero);
  } else {
    bootHero();
  }
  window.addEventListener('load', function () {
    setTimeout(bootHero, 400);
  });
})();
