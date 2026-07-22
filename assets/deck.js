(() => {
  "use strict";

  if (new URLSearchParams(location.search).get("qa") === "1") {
    document.documentElement.classList.add("qa-mode");
  }

  const stage = document.getElementById("stage");
  const slides = [...document.querySelectorAll(".slide")];
  const currentLabel = document.getElementById("current-slide");
  const totalLabel = document.getElementById("total-slides");
  const progressBar = document.getElementById("progress-bar");
  const sectionLabel = document.getElementById("section-label");
  const notesPanel = document.getElementById("notes-panel");
  const notesBody = notesPanel.querySelector(".notes-panel-body");
  const helpPanel = document.getElementById("help-panel");
  const overview = document.getElementById("overview");
  const skipLink = document.querySelector(".skip-link");
  const notesButton = document.querySelector('[data-action="notes"]');
  const fullscreenButton = document.querySelector('[data-action="fullscreen"]');
  const helpButton = document.querySelector('[data-action="help"]');

  const state = {
    index: 0,
    build: 1,
    notes: false,
    help: false,
    overview: false,
    touchX: 0,
    touchY: 0
  };

  const pad = (value) => String(value).padStart(2, "0");
  const maxBuild = (slide = slides[state.index]) => {
    const levels = [...slide.querySelectorAll(".fragment")]
      .map((el) => Number(el.dataset.step || 1));
    return Math.max(1, ...levels);
  };

  function readHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const requestedSlide = Number(params.get("s"));
    const requestedBuild = Number(params.get("b"));
    if (Number.isFinite(requestedSlide) && requestedSlide >= 1 && requestedSlide <= slides.length) {
      state.index = requestedSlide - 1;
    }
    state.build = Number.isFinite(requestedBuild) && requestedBuild >= 1 ? requestedBuild : 1;
    state.build = Math.min(state.build, maxBuild(slides[state.index]));
  }

  function writeHash() {
    const next = `#s=${state.index + 1}&b=${state.build}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function scaleStage() {
    const margin = 0;
    const width = Math.max(320, window.innerWidth - margin);
    const height = Math.max(240, window.innerHeight - margin);
    const scale = Math.min(width / 1920, height / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function syncFragments(slide) {
    slide.querySelectorAll(".fragment").forEach((fragment) => {
      const visible = Number(fragment.dataset.step || 1) <= state.build;
      fragment.classList.toggle("is-visible", visible);
      fragment.setAttribute("aria-hidden", String(!visible));
    });
  }

  function updateNotes() {
    const notes = slides[state.index].querySelector(".notes");
    notesBody.innerHTML = notes ? notes.innerHTML : "<p>Sem notas para este slide.</p>";
  }

  function render({ announce = false } = {}) {
    slides.forEach((slide, index) => {
      const active = index === state.index;
      slide.classList.toggle("is-active", active);
      slide.classList.toggle("was-active", index < state.index);
      slide.setAttribute("aria-hidden", String(!active));
      if (active) syncFragments(slide);
    });

    const activeSlide = slides[state.index];
    const totalBuilds = maxBuild(activeSlide);
    const slideProgress = (state.index + Math.min(state.build / totalBuilds, 1)) / slides.length;
    currentLabel.textContent = pad(state.index + 1);
    totalLabel.textContent = pad(slides.length);
    progressBar.style.width = `${Math.max(1.5, slideProgress * 100)}%`;
    sectionLabel.textContent = activeSlide.dataset.section || "";
    document.title = `${pad(state.index + 1)} · ${activeSlide.dataset.title} — Transplante Hepático`;
    updateNotes();
    writeHash();
    updateOverviewCurrent();

    if (announce) {
      const title = activeSlide.querySelector("h1,h2");
      activeSlide.setAttribute("aria-label", `Slide ${state.index + 1} de ${slides.length}: ${title ? title.textContent.trim() : activeSlide.dataset.title}`);
    }
  }

  function next() {
    closeHelp();
    if (state.overview) return closeOverview();
    const max = maxBuild();
    if (state.build < max) {
      state.build += 1;
    } else if (state.index < slides.length - 1) {
      state.index += 1;
      state.build = 1;
    }
    render({ announce: true });
  }

  function previous() {
    closeHelp();
    if (state.overview) return closeOverview();
    if (state.build > 1) {
      state.build -= 1;
    } else if (state.index > 0) {
      state.index -= 1;
      state.build = maxBuild(slides[state.index]);
    }
    render({ announce: true });
  }

  function goTo(index, build = 1) {
    state.index = Math.max(0, Math.min(slides.length - 1, index));
    state.build = Math.max(1, Math.min(maxBuild(slides[state.index]), build));
    render({ announce: true });
  }

  function restartBuilds() {
    state.build = 1;
    render();
  }

  function toggleNotes(force) {
    state.notes = typeof force === "boolean" ? force : !state.notes;
    notesPanel.classList.toggle("is-open", state.notes);
    notesPanel.setAttribute("aria-hidden", String(!state.notes));
    notesButton?.setAttribute("aria-expanded", String(state.notes));
    notesButton?.setAttribute("aria-label", state.notes ? "Ocultar notas" : "Mostrar notas");
  }

  function toggleHelp(force) {
    state.help = typeof force === "boolean" ? force : !state.help;
    helpPanel.classList.toggle("is-open", state.help);
    helpPanel.setAttribute("aria-hidden", String(!state.help));
    helpButton?.setAttribute("aria-expanded", String(state.help));
    if (state.help) helpPanel.querySelector(".panel-close").focus();
  }
  const closeHelp = () => { if (state.help) toggleHelp(false); };

  function buildOverview() {
    overview.innerHTML = "";
    slides.forEach((slide, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "overview-card";
      card.dataset.index = index;
      card.innerHTML = `<span>${pad(index + 1)}</span><h3>${slide.dataset.title || `Slide ${index + 1}`}</h3>`;
      card.addEventListener("click", (event) => {
        const targetIndex = Number(event.currentTarget.dataset.index);
        closeOverview();
        goTo(targetIndex, 1);
      });
      overview.appendChild(card);
    });
  }

  function updateOverviewCurrent() {
    overview.querySelectorAll(".overview-card").forEach((card, index) => {
      card.classList.toggle("is-current", index === state.index);
    });
  }

  function toggleOverview(force) {
    state.overview = typeof force === "boolean" ? force : !state.overview;
    overview.classList.toggle("is-open", state.overview);
    overview.setAttribute("aria-hidden", String(!state.overview));
    if (state.overview) {
      updateOverviewCurrent();
      const current = overview.children[state.index];
      current?.focus();
      current?.scrollIntoView({ block: "center", inline: "center" });
    }
  }
  const closeOverview = () => { if (state.overview) toggleOverview(false); };

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {
      // Fullscreen may be denied inside an embedded browser; the deck remains usable.
    }
  }

  function handleKey(event) {
    const key = event.key;
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable || target.closest("input, textarea, select")) return;
      if (["Enter", " "].includes(key) && target.closest("button, a, [role='button']")) return;
    }

    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(key)) {
      event.preventDefault(); next(); return;
    }
    if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(key)) {
      event.preventDefault(); previous(); return;
    }
    if (key === "Home") { event.preventDefault(); goTo(0, 1); return; }
    if (key === "End") { event.preventDefault(); goTo(slides.length - 1, maxBuild(slides.at(-1))); return; }
    if (key.toLowerCase() === "f") { event.preventDefault(); toggleFullscreen(); return; }
    if (key.toLowerCase() === "n") { event.preventDefault(); toggleNotes(); return; }
    if (key.toLowerCase() === "o") { event.preventDefault(); toggleOverview(); return; }
    if (key.toLowerCase() === "r") { event.preventDefault(); restartBuilds(); return; }
    if (key === "?" || key === "/") { event.preventDefault(); toggleHelp(); return; }
    if (key === "Escape") { closeHelp(); closeOverview(); toggleNotes(false); }
  }

  document.addEventListener("keydown", handleKey);
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton?.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
  });
  skipLink?.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("deck")?.focus({ preventScroll: true });
  });
  window.addEventListener("resize", scaleStage, { passive: true });
  window.addEventListener("orientationchange", scaleStage, { passive: true });
  window.addEventListener("hashchange", () => { readHash(); render(); });

  document.querySelectorAll(".deck-controls button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.action;
      if (action === "next") next();
      if (action === "prev") previous();
      if (action === "notes") toggleNotes();
      if (action === "fullscreen") toggleFullscreen();
      if (action === "help") toggleHelp();
    });
  });
  helpPanel.querySelector(".panel-close").addEventListener("click", () => toggleHelp(false));

  stage.addEventListener("click", (event) => {
    const interactive = event.target.closest("a,button,.notes-panel,.help-panel,.overview");
    if (!interactive) next();
  });
  stage.addEventListener("contextmenu", (event) => {
    const interactive = event.target.closest("a,button,.notes-panel,.help-panel,.overview");
    if (!interactive) { event.preventDefault(); previous(); }
  });

  document.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => event.stopPropagation());
  });

  stage.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    state.touchX = touch.clientX;
    state.touchY = touch.clientY;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - state.touchX;
    const dy = touch.clientY - state.touchY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      dx < 0 ? next() : previous();
    }
  }, { passive: true });

  totalLabel.textContent = pad(slides.length);
  buildOverview();
  readHash();
  scaleStage();
  render();
})();
