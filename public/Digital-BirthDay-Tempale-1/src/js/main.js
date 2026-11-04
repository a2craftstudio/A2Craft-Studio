// Birthday template - scaling, photo fitting and all page animations.

(function () {
  "use strict";

  // All sections were designed at this width (px) and are scaled to fit the screen
  var DESIGN_WIDTH = 930;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function updateScale() {
    var width = document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--s", String(width / DESIGN_WIDTH));

    // Pages marked "fit-screen" zoom so their main content (data-focus = "x y width height",
    // in design pixels) fits the window in both directions and sits in the middle
    var page = document.querySelector(".fit-screen .page");
    if (page) {
      var f = (page.dataset.focus || "0 0 930 767").split(" ").map(Number);
      var W = window.innerWidth;
      var H = window.innerHeight;
      var fit = Math.min(W / f[2], H / f[3]) * 0.9;
      var root = document.documentElement.style;
      root.setProperty("--fit", String(fit));
      root.setProperty("--tx", W / 2 - (f[0] + f[2] / 2) * fit + "px");
      root.setProperty("--ty", H / 2 - (f[1] + f[3] / 2) * fit + "px");
    }
  }

  // ---------------------------------------------------------------------------
  // Entrance animations: every item in a section gets an animation type and a
  // staggered delay, and plays when it scrolls into view.
  // ---------------------------------------------------------------------------

  // The items of a section are the children of the first element that has more than one child
  function sectionItems(stage) {
    var el = stage;
    while (el.children.length === 1) el = el.firstElementChild;
    return Array.prototype.slice.call(el.children);
  }

  function setupAnimations() {
    var items = [];

    document.querySelectorAll(".stage").forEach(function (stage) {
      sectionItems(stage).forEach(function (item, i) {
        item.classList.add("anim");
        item.addEventListener("animationend", function (e) {
          if (e.target === item) item.classList.add("done");
        });
        item.style.setProperty("--delay", (i * 0.08).toFixed(2) + "s");
        items.push(item);
      });
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in", "done"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1 });

    items.forEach(function (el) { observer.observe(el); });
  }

  // Round ring (bottom-right) that fills as you scroll; shown only while scrolling
  function setupProgress() {
    if (document.body.classList.contains("fit-screen")) return;
    var bar = document.createElement("div");
    bar.className = "progress";
    document.body.appendChild(bar);
    var hideTimer;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty("--progress", max > 0 ? String(window.scrollY / max) : "0");
      bar.classList.add("show");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { bar.classList.remove("show"); }, 900);
    }
    window.addEventListener("scroll", update, { passive: true });
  }

  // Fade out before moving to another page of the site
  function setupPageTransition() {
    document.querySelectorAll('a[href$=".html"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (reduceMotion) return;
        e.preventDefault();
        document.body.classList.add("leaving");
        setTimeout(function () { window.location.href = link.href; }, 550);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Music: the cassette's YouTube link plays the song right on the page,
  // with a floating button to pause / play. (Needs internet; works once the site is online.)
  // ---------------------------------------------------------------------------
  function setupMusic() {
    var links = document.querySelectorAll('a[href*="youtube.com/watch"]');
    if (!links.length) return;
    var videoId = new URL(links[0].href).searchParams.get("v");
    var player = null;
    var button = null;
    var playing = false;

    function send(command) {
      player.contentWindow.postMessage(JSON.stringify({ event: "command", func: command, args: [] }), "*");
    }

    function setPlaying(value) {
      playing = value;
      button.classList.toggle("playing", playing);
      button.setAttribute("aria-label", playing ? "Pause music" : "Play music");
    }

    function toggle() {
      if (!player) {
        player = document.createElement("iframe");
        player.className = "music-player";
        player.allow = "autoplay";
        player.title = "Music";
        player.src = "https://www.youtube.com/embed/" + videoId +
          "?autoplay=1&loop=1&playlist=" + videoId + "&controls=0&enablejsapi=1";
        document.body.appendChild(player);

        button = document.createElement("button");
        button.className = "music-btn";
        button.textContent = "♫";
        button.addEventListener("click", toggle);
        document.body.appendChild(button);
        setPlaying(true);
        return;
      }
      send(playing ? "pauseVideo" : "playVideo");
      setPlaying(!playing);
    }

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        toggle();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Surprises: blow out the candle, secret note on the age, grand finale
  // ---------------------------------------------------------------------------
  var CONFETTI_COLORS = ["#f2a7b5", "#e0738b", "#fbf3e6", "#ffd36b", "#ffffff"];

  // pieces of confetti (or hearts) flying out from a point on the screen
  function confetti(x, y, count, symbol) {
    for (var i = 0; i < count; i++) {
      var piece = document.createElement("span");
      var angle = Math.random() * Math.PI * 2;
      var distance = 60 + Math.random() * 160;
      piece.className = symbol ? "burst" : "confetti";
      if (symbol) piece.textContent = symbol;
      else piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.left = x + "px";
      piece.style.top = y + "px";
      piece.style.setProperty("--dx", Math.cos(angle) * distance + "px");
      piece.style.setProperty("--dy", Math.sin(angle) * distance + 60 + "px");
      piece.style.animationDuration = 0.9 + Math.random() * 0.8 + "s";
      document.body.appendChild(piece);
      piece.addEventListener("animationend", function () { this.remove(); });
    }
  }

  function setupCandle() {
    var candle = document.querySelector(".candle");
    if (!candle) return;
    var hint = document.querySelector(".wish-hint");
    var toast = document.querySelector(".wish-toast");

    candle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (candle.classList.contains("out")) {          // tap again to light it again
        candle.classList.remove("out");
        return;
      }
      candle.classList.add("out");
      if (hint) hint.classList.add("gone");
      var box = candle.getBoundingClientRect();
      confetti(box.left + box.width / 2, box.top + box.height / 3, 40);
      if (toast) {
        toast.hidden = false;
        toast.style.animation = "none";
        void toast.offsetWidth;                           // restart the animation
        toast.style.animation = "";
        setTimeout(function () { toast.hidden = true; }, 3000);
      }
    });
  }

  function setupSecret() {
    var age = document.querySelector(".age");
    var secret = document.querySelector(".secret");
    if (!age || !secret) return;
    age.addEventListener("click", function () { secret.hidden = false; });
    secret.addEventListener("click", function (e) {
      if (e.target === secret || e.target.classList.contains("secret-close")) secret.hidden = true;
    });
  }

  function setupFinale() {
    var finale = document.querySelector(".finale");
    if (!finale) return;
    var shown = false;
    function show() {
      if (shown) return;
      shown = true;
      finale.classList.add("show");
      var title = finale.querySelector(".finale-title").getBoundingClientRect();
      setTimeout(function () { confetti(title.left + title.width / 2, title.top + title.height / 2, 36, "♥"); }, 700);
    }
    if (!("IntersectionObserver" in window)) { show(); return; }
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) show();
    }, { threshold: 0.5 }).observe(finale);
  }

  // ---------------------------------------------------------------------------
  // Background hearts & sparkles, and a heart burst where you click
  // ---------------------------------------------------------------------------
  var SYMBOLS = ["♥", "♡", "✦", "✧", "♥"];

  function setupFloaters() {
    if (reduceMotion) return;
    var layer = document.createElement("div");
    layer.className = "floaters";
    document.body.appendChild(layer);

    function spawn() {
      var f = document.createElement("span");
      f.className = "floater";
      f.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      f.style.left = Math.random() * 100 + "vw";
      f.style.fontSize = 10 + Math.random() * 16 + "px";
      f.style.animationDuration = 9 + Math.random() * 8 + "s";
      f.style.setProperty("--sway", (Math.random() * 120 - 60).toFixed(0) + "px");
      layer.appendChild(f);
      f.addEventListener("animationend", function () { f.remove(); });
    }

    for (var i = 0; i < 6; i++) setTimeout(spawn, i * 400);
    setInterval(spawn, 1400);
  }

  function setupClickBurst() {
    if (reduceMotion) return;
    document.addEventListener("click", function (e) {
      for (var i = 0; i < 7; i++) {
        var b = document.createElement("span");
        var angle = (Math.PI * 2 * i) / 7;
        b.className = "burst";
        b.textContent = "♥";
        b.style.left = e.clientX - 6 + "px";
        b.style.top = e.clientY - 8 + "px";
        b.style.setProperty("--dx", Math.cos(angle) * 45 + "px");
        b.style.setProperty("--dy", Math.sin(angle) * 45 + "px");
        document.body.appendChild(b);
        b.addEventListener("animationend", function () { this.remove(); });
      }
    });
  }

  function disableImageMenu() {
    document.addEventListener("contextmenu", function (e) {
      if (e.target.tagName === "IMG") e.preventDefault();
    });
  }

  updateScale();
  window.addEventListener("resize", updateScale);

  document.addEventListener("DOMContentLoaded", function () {
    setupAnimations();
    setupProgress();
    setupMusic();
    setupCandle();
    setupSecret();
    setupFinale();
    setupPageTransition();
    setupFloaters();
    setupClickBurst();
    disableImageMenu();
  });
})();
