'use strict';

/* ══════════════════════════════════════════════
   Wedding Site — Arun & Janani — script.js
══════════════════════════════════════════════ */

/* ── 1. AUDIO ENGINE (mobile-safe) ──────────────── */
var WeddingAudio = (function () {
  var audio = document.getElementById('bgAudio');
  var userPaused = false;   // user explicitly paused -> never auto-resume
  var retries    = 0;
  var MAX_RETRY  = 3;
  var unlockBound = false;
  var UNLOCK_EVENTS = ['touchend', 'pointerup', 'click', 'keydown'];

  function log(msg, err) {
    if (window.console) console.warn('[audio] ' + msg, err || '');
  }

  function setVolume(v) {
    // iOS Safari ignores/locks audio.volume — never let that throw
    try { audio.volume = v; } catch (e) {}
  }

  function fadeIn() {
    var target = 0.6, step = 0.03;
    setVolume(0);
    var iv = setInterval(function () {
      if (audio.paused) { clearInterval(iv); return; }
      if (audio.volume < target - step) setVolume(audio.volume + step);
      else { setVolume(target); clearInterval(iv); }
    }, 100);
  }

  /* Error handling by name */
  function handleError(err) {
    var name = err && err.name;
    updateMusicBtn(false);

    if (name === 'NotAllowedError') {
      // Autoplay blocked -> start on first tap / click / key
      waitForGesture();
    } else if (name === 'NotSupportedError') {
      // Bad format / bad src -> reload once, otherwise give up quietly
      log('Unsupported audio source', err);
      if (retries++ < 1) { try { audio.load(); } catch (e) {} }
      else disableButton();
    } else if (name === 'AbortError') {
      // Interrupted (load() called, tab switched, call came in) -> retry
      if (retries++ < MAX_RETRY) setTimeout(play, 400);
      else waitForGesture();
    } else if (name === 'NotFoundError') {
      log('Audio file not found', err);
      disableButton();
    } else {
      log('Unknown playback error', err);
      waitForGesture();
    }
  }

  function play() {
    if (!audio || userPaused) return;
    var p;
    try { p = audio.play(); } catch (e) { handleError(e); return; }
    if (p && typeof p.then === 'function') {
      p.then(function () {
        retries = 0;
        unbindUnlock();
        updateMusicBtn(true);
        fadeIn();
      }).catch(handleError);
    } else {
      updateMusicBtn(!audio.paused);   // very old browsers
    }
  }

  /* One-time unlock on first real user gesture */
  function onGesture() { play(); }
  function waitForGesture() {
    if (unlockBound) return;
    unlockBound = true;
    UNLOCK_EVENTS.forEach(function (ev) {
      document.addEventListener(ev, onGesture, { passive: true });
    });
  }
  function unbindUnlock() {
    if (!unlockBound) return;
    unlockBound = false;
    UNLOCK_EVENTS.forEach(function (ev) {
      document.removeEventListener(ev, onGesture);
    });
  }

  function disableButton() {
    var btn = document.getElementById('musicBtn');
    if (btn) { btn.style.opacity = '.35'; btn.style.pointerEvents = 'none'; }
  }

  function toggle() {
    if (!audio) return;
    if (audio.paused) { userPaused = false; play(); }
    else { userPaused = true; audio.pause(); updateMusicBtn(false); }
  }

  if (audio) {
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.loop = true;

    // Media element level errors (404, decode, unsupported)
    audio.addEventListener('error', function () {
      var c = audio.error && audio.error.code;   // 2 network, 3 decode, 4 src not supported
      log('Media error code ' + c);
      if (c === 4 || c === 3) disableButton();
    });

    // Keep the button icon in sync with the real state (calls, lock screen, etc.)
    audio.addEventListener('play',  function () { updateMusicBtn(true);  });
    audio.addEventListener('pause', function () { updateMusicBtn(false); });

    // Pause when app/tab goes to background, resume when back (unless user paused)
    var wasPlaying = false;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { wasPlaying = !audio.paused; if (wasPlaying) audio.pause(); }
      else if (wasPlaying && !userPaused) play();
    });
  }

  return { play: play, toggle: toggle, waitForGesture: waitForGesture };
})();


/* ── 1b. LOADER ─────────────────────────────────── */
(function () {
  var loader    = document.getElementById('loader');
  var MIN_MS    = 2600;
  var startTime = Date.now();
  var done      = false;

  function dismissLoader() {
    if (done) return;
    done = true;
    var wait = Math.max(0, MIN_MS - (Date.now() - startTime));

    setTimeout(function () {
      loader.classList.add('hiding');
      setTimeout(function () {
        loader.style.display = 'none';
        document.body.classList.add('loaded');
        WeddingAudio.play();            // works on desktop; on mobile falls back to first tap
      }, 1200);
    }, wait);
  }

  // Mobile: arm the first-tap unlock immediately, so a tap during the loader also starts music
  WeddingAudio.waitForGesture();

  if (document.readyState === 'complete') dismissLoader();
  else window.addEventListener('load', dismissLoader);
  setTimeout(dismissLoader, 8000);      // failsafe if 'load' stalls on slow mobile data
})();


/* ── 2. MUSIC TOGGLE BUTTON ─────────────────────── */
function updateMusicBtn(playing) {
  var iconPlay  = document.getElementById('iconPlay');
  var iconPause = document.getElementById('iconPause');
  if (!iconPlay || !iconPause) return;
  iconPlay.classList.toggle('hidden', playing);
  iconPause.classList.toggle('hidden', !playing);
}

(function () {
  var btn = document.getElementById('musicBtn');
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();                // don't double-fire the global unlock handler
    WeddingAudio.toggle();
  });
})();


/* ── 3. NAV SCROLL SHRINK ───────────────────────── */
(function () {
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 60) nav.classList.add('scrolled');
    else                     nav.classList.remove('scrolled');
  }, { passive: true });
})();


/* ── 4. COUNTDOWN TIMER ─────────────────────────── */
(function () {
  var target = new Date('2026-12-14T06:45:00+05:30').getTime();
  var elD = document.getElementById('cd-days');
  var elH = document.getElementById('cd-hours');
  var elM = document.getElementById('cd-mins');
  var elS = document.getElementById('cd-secs');
  var prevS = -1;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function tick() {
    var diff = target - Date.now();
    if (diff <= 0) {
      document.getElementById('cdWrap').innerHTML =
        '<div class="cd-block" style="min-width:260px"><span class="cd-num" style="font-size:1.5rem">The day is here!</span></div>';
      return;
    }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000)  / 60000);
    var s = Math.floor((diff % 60000)    / 1000);

    if (s !== prevS) {
      bump(elS);
      if (s === 59) bump(elM);
      if (s === 59 && m === 59) bump(elH);
      prevS = s;
    }
    elD.textContent = pad(d);
    elH.textContent = pad(h);
    elM.textContent = pad(m);
    elS.textContent = pad(s);
  }

  tick();
  setInterval(tick, 1000);
})();


/* ── 5. SCROLL REVEAL ───────────────────────────── */
(function () {
  var items = document.querySelectorAll('.reveal');
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var delay = parseInt(el.dataset.delay || '0', 10);
      setTimeout(function () { el.classList.add('visible'); }, delay);
      obs.unobserve(el);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  items.forEach(function (el) { obs.observe(el); });
})();


/* ── 6. HERO PARALLAX ───────────────────────────── */
(function () {
  var heroBg = document.querySelector('.hero-bg');
  if (!heroBg) return;
  window.addEventListener('scroll', function () {
    heroBg.style.transform = 'scale(1.1) translateY(' + (window.scrollY * 0.18) + 'px)';
  }, { passive: true });
})();


/* ── 7. SMOOTH SCROLL ───────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener('click', function (e) {
    var id = link.getAttribute('href').slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});


/* ── 8. LIGHTBOX ────────────────────────────────── */
function openLightbox(src) {
  var lb = document.getElementById('lightbox');
  document.getElementById('lbImg').src = src;
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  var lb = document.getElementById('lightbox');
  if (e && e.type === 'click') {
    if (e.target !== lb && !e.target.closest('#lbClose')) return;
  }
  lb.classList.remove('active');
  document.getElementById('lbImg').src = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var lb = document.getElementById('lightbox');
    if (lb.classList.contains('active')) {
      lb.classList.remove('active');
      document.getElementById('lbImg').src = '';
      document.body.style.overflow = '';
    }
  }
});

window.openLightbox  = openLightbox;
window.closeLightbox = closeLightbox;
