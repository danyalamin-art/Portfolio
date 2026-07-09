/**
 * Shared portfolio video modal (Home + All Projects).
 * // ponytail: one copy instead of ~150 lines duplicated per page
 */
(function () {
  var TAG_CLASS_MAP = {
    'Nursery Rhymes': 'tag-nursery',
    'Educational Animation': 'tag-edu',
    'Character Animation': 'tag-character',
    'Motion Graphics': 'tag-motion'
  };
  var TOOL_DEFS = {
    illustrator: { name: 'Illustrator', file: 'Illustrator.svg' },
    aftereffects: { name: 'After Effects', file: 'After effects.svg' },
    photoshop: { name: 'Photoshop', file: 'Photoshop.svg' },
    animate: { name: 'Adobe Animate', file: 'animate.svg' },
    premiere: { name: 'Premiere Pro', file: 'Premier Pro.svg' }
  };
  var CATEGORY_TOOLS = {
    'Nursery Rhymes': ['illustrator', 'aftereffects'],
    'Educational Animation': ['photoshop', 'illustrator', 'aftereffects'],
    'Character Animation': ['animate', 'aftereffects', 'illustrator'],
    'Motion Graphics': ['aftereffects', 'illustrator', 'premiere', 'photoshop']
  };
  var TOOL_ORDER = ['illustrator', 'photoshop', 'animate', 'aftereffects', 'premiere'];
  var CATEGORY_PROCESS = {
    'Nursery Rhymes': ['Concept', 'Character design', 'Song-synced animation', 'Polish'],
    'Educational Animation': ['Learning goal', 'Clear visuals', 'Animate & teach', 'Final polish'],
    'Character Animation': ['Character design', 'Acting & timing', 'Animation', 'Polish'],
    'Motion Graphics': ['Concept', 'Design assets', 'Motion design', 'Edit & deliver']
  };
  var CATEGORY_CASE_FALLBACK = {
    'Nursery Rhymes': {
      goal: 'Create a fun, musical kids animation that is easy to sing and watch again.',
      result: 'A hand-picked highlight from the complete nursery rhyme, made for a quick portfolio look.'
    },
    'Educational Animation': {
      goal: 'Explain an idea simply so children learn while staying entertained.',
      result: 'A teaching-focused cut from the longer educational film — clear, friendly, and memorable.'
    },
    'Character Animation': {
      goal: 'Bring a character to life with personality, timing, and expressive motion.',
      result: 'A performance-led extract from the full character film, where acting and timing do the talking.'
    },
    'Motion Graphics': {
      goal: 'Communicate the message with dynamic design, motion, and visual clarity.',
      result: 'A design-forward beat from the complete motion graphics video — clean craft in a quick view.'
    }
  };

  function toolBase() {
    // pages/all-projects/ is two levels deep; home is root
    return document.body && document.body.dataset.page === 'all' ? '../../Assets/' : 'Assets/';
  }

  function toolsForCategories(categories) {
    var keys = {};
    categories.forEach(function (cat) {
      (CATEGORY_TOOLS[cat] || []).forEach(function (k) {
        keys[k] = true;
      });
    });
    return TOOL_ORDER.filter(function (k) {
      return keys[k];
    }).map(function (k) {
      return TOOL_DEFS[k];
    });
  }

  function primaryCategory(categories) {
    return categories[0] || 'Nursery Rhymes';
  }

  function processForCategories(categories) {
    return CATEGORY_PROCESS[primaryCategory(categories)] || CATEGORY_PROCESS['Nursery Rhymes'];
  }

  function renderProcessSteps(steps) {
    var wrap = document.getElementById('videoModalProcess');
    if (!wrap) return;
    wrap.innerHTML = '';
    steps.forEach(function (step, i) {
      if (i > 0) {
        var arrow = document.createElement('span');
        arrow.className = 'video-modal-process-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        wrap.appendChild(arrow);
      }
      var pill = document.createElement('span');
      pill.className = 'video-modal-process-step';
      pill.innerHTML = '<b>' + (i + 1) + '</b>' + step;
      wrap.appendChild(pill);
    });
  }

  window.openVideoModal = function openVideoModal(el) {
    if (window.__cmsIgnoreClick) return;
    var url = el.dataset.video || '';
    var projectTitle =
      el.dataset.title ||
      (el.querySelector('.portfolio-title, .ptitle') &&
        el.querySelector('.portfolio-title, .ptitle').textContent.trim()) ||
      '';
    var cat = el.dataset.cat || '';
    var desc = el.dataset.desc || '';
    var goal = el.dataset.goal || '';
    var result = el.dataset.result || '';
    var categories = cat
      .split('|')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);

    var frame = document.getElementById('videoModalFrame');
    if (!frame) return;
    var embedUrl =
      typeof window.prepareVimeoEmbedUrl === 'function' ? window.prepareVimeoEmbedUrl(url) : url;
    frame.src = embedUrl;
    document.getElementById('videoModalTitle').textContent = projectTitle;
    frame.title = projectTitle || 'Project video';
    if (typeof window.bindVimeoFreeze === 'function') {
      setTimeout(function () {
        window.bindVimeoFreeze(frame);
      }, 80);
    }

    var tagsEl = document.getElementById('videoModalTags');
    tagsEl.innerHTML = '';
    var tagPrefix = document.body.dataset.page === 'all' ? 'ptag' : 'portfolio-tag';
    categories.forEach(function (name) {
      var span = document.createElement('span');
      span.className = tagPrefix + ' ' + (TAG_CLASS_MAP[name] || 'tag-character');
      span.textContent = name;
      tagsEl.appendChild(span);
    });

    var descEl = document.getElementById('videoModalDesc');
    descEl.textContent = desc;
    descEl.style.display = desc ? 'block' : 'none';

    var fb = CATEGORY_CASE_FALLBACK[primaryCategory(categories)] || CATEGORY_CASE_FALLBACK['Nursery Rhymes'];
    document.getElementById('videoModalGoal').textContent = goal || fb.goal;
    document.getElementById('videoModalResult').textContent = result || fb.result;
    renderProcessSteps(processForCategories(categories));

    var toolsWrap = document.getElementById('videoModalTools');
    var toolsList = document.getElementById('videoModalToolsList');
    var tools = toolsForCategories(categories);
    var base = toolBase();
    toolsList.innerHTML = '';
    if (tools.length) {
      tools.forEach(function (tool) {
        var item = document.createElement('span');
        item.className = 'video-modal-tool';
        item.innerHTML =
          '<img src="' +
          base +
          tool.file +
          '" alt="' +
          tool.name +
          '" width="28" height="28"><span>' +
          tool.name +
          '</span>';
        toolsList.appendChild(item);
      });
      toolsWrap.hidden = false;
    } else {
      toolsWrap.hidden = true;
    }
    document.getElementById('videoModalOverlay').classList.add('open');
    document.body.classList.add('modal-open');
  };

  window.closeVideoModal = function closeVideoModal() {
    var overlay = document.getElementById('videoModalOverlay');
    if (overlay) overlay.classList.remove('open');
    var frame = document.getElementById('videoModalFrame');
    if (frame) {
      if (typeof window.unbindVimeoFreeze === 'function') window.unbindVimeoFreeze(frame);
      frame.src = '';
    }
    document.body.classList.remove('modal-open');
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.closeVideoModal();
  });
})();
