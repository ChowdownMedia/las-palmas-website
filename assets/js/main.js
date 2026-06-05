/* Las Palmas — shared page behavior (vanilla JS, no deps).
   Ports the interactive behavior of Glenn's LocationPageV2.5 prototypes:
   theme toggle, drawer nav, welcome intro, specials expand + Daily/Lunch
   tabs + today highlighting, click-to-load map. */
(function () {
  "use strict";
  var d = document;
  var page = d.querySelector(".lp-page");
  d.documentElement.classList.remove("no-js");

  /* ── Theme: init from saved preference, else prefers-color-scheme ── */
  var THEME_KEY = "lp-theme";
  function applyTheme(t) {
    d.documentElement.setAttribute("data-theme", t);
    var btn = d.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.querySelector(".icon-sun").style.display = t === "dark" ? "" : "none";
      btn.querySelector(".icon-moon").style.display = t === "dark" ? "none" : "";
    }
  }
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  var theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
  var themeBtn = d.querySelector("[data-theme-toggle]");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  });

  /* ── Welcome intro: remove after its animation completes ── */
  var intro = d.querySelector(".lps-intro");
  if (intro) {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dur = reduced ? 800 : (parseInt(intro.getAttribute("data-duration"), 10) || 1650);
    setTimeout(function () { intro.classList.add("is-done"); }, dur + 60);
  }

  /* ── Drawer nav ── */
  var drawer = d.querySelector(".lp-drawer");
  var openBtn = d.querySelector("[data-nav-open]");
  var closeBtn = d.querySelector("[data-nav-close]");
  var scrim = d.querySelector(".lp-scrim");
  var firstLink = drawer ? drawer.querySelector(".lp-drawer-nav a") : null;
  function setNav(open) {
    if (!page || !drawer) return;
    page.classList.toggle("nav-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    drawer.inert = !open; /* keeps closed-drawer links out of tab order */
    d.body.style.overflow = open ? "hidden" : "";
    if (open && firstLink) setTimeout(function () { firstLink.focus(); }, 90);
    else if (!open && openBtn) openBtn.focus();
  }
  if (openBtn) openBtn.addEventListener("click", function () { setNav(true); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setNav(false); });
  if (scrim) scrim.addEventListener("click", function () { setNav(false); });
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && page && page.classList.contains("nav-open")) setNav(false);
  });
  if (drawer) drawer.querySelectorAll(".lp-drawer-nav a").forEach(function (a) {
    a.addEventListener("click", function () { setNav(false); });
  });

  /* ── Specials: expand/collapse ── */
  var expandBtn = d.querySelector("[data-specials-toggle]");
  var panel = d.querySelector("[data-specials-panel]");
  if (expandBtn && panel) {
    var showLabel = expandBtn.getAttribute("data-label-show");
    var hideLabel = expandBtn.getAttribute("data-label-hide");
    expandBtn.addEventListener("click", function () {
      var open = panel.classList.toggle("is-open");
      expandBtn.setAttribute("aria-expanded", String(open));
      expandBtn.querySelector(".lbl").textContent = open ? hideLabel : showLabel;
    });
  }

  /* ── Specials: Daily / Lunch tabs ── */
  var tabs = d.querySelectorAll(".lp-seg-tabs [role='tab']");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        var p = d.getElementById(t.getAttribute("aria-controls"));
        if (p) p.hidden = !on;
      });
    });
  });

  /* ── Specials: highlight + promote today's card ── */
  var daysWrap = d.querySelector("[data-days]");
  if (daysWrap) {
    var today = new Date().getDay(); /* 0 = Sunday */
    var card = daysWrap.querySelector('[data-day="' + today + '"]');
    var featured = d.querySelector("[data-today-slot]");
    if (card && featured) {
      card.classList.add("is-today", "pulse-glow");
      featured.appendChild(card);
    }
  }

  /* ── Click-to-load map (zero map JS/iframe until tapped) ── */
  var mapBtn = d.querySelector("[data-map-load]");
  if (mapBtn) {
    mapBtn.addEventListener("click", function () {
      var holder = mapBtn.parentElement;
      var iframe = d.createElement("iframe");
      iframe.src = mapBtn.getAttribute("data-map-src");
      iframe.title = mapBtn.getAttribute("data-map-title") || "Map";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.allowFullscreen = true;
      holder.appendChild(iframe);
      mapBtn.remove();
    });
  }

  /* ── Footer year ── */
  var yr = d.querySelector("[data-year]");
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
