/* CAIN interactive exorcist sheet — state & widgets.
   Fan-made; CAIN is by Tom Bloom. Slash rendering adapted from talismans.html. */
(() => {
  "use strict";
  const LS = "cain-exorcist-sheet-v1";

  /* ---------------- state ---------------- */
  let state = {};
  try { state = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) {}
  let saveT = null;
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {}
    }, 200);
  };
  const get = (k) => state[k];
  const set = (k, v) => {
    if (v === "" || v == null || v === false || v === 0) delete state[k];
    else state[k] = v;
    save();
  };

  /* ---------------- tiny seeded rng (stable scribbles) ---------------- */
  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFor(seedStr) {
    let s = (hash(seedStr) % 2147483646) + 1;
    return () => ((s = Math.imul(48271, s) % 2147483647) / 2147483647);
  }

  /* ---------------- fills ----------------
     Dots fill solid black via CSS .on. Ticks (hooks, passive) get one carved slash, the
     same red slash as the execution strip; a crossed-out sin box gets two. Slashes are
     seeded by key, so each keeps its shape across reloads. */
  function carve(el, key, rots, anim) {
    const w = el.offsetWidth, h = el.offsetHeight, r = rngFor(key);
    const len = Math.hypot(w, h) * 0.8;
    rots.forEach((rot, i) => {
      const core = makeSlash(len, r);
      const data = { ...core, left: w / 2, top: h / 2, rot: rot + (r() * 10 - 5), seed: hash(key) + i };
      el.appendChild(buildSlash(data, anim, false));
    });
  }

  /* ---------------- dots & ticks ---------------- */
  function renderToggle(el, anim) {
    const k = el.dataset.key;
    const on = !!get(k);
    el.classList.toggle("on", on);
    el.innerHTML = "";
    if (on && el.classList.contains("tick")) carve(el, k, [48], anim);
  }
  function initToggles(root) {
    root.querySelectorAll(".dot[data-key], .tick[data-key]").forEach((el) => {
      renderToggle(el);
      el.addEventListener("click", () => {
        if (el.classList.contains("crossed")) return;
        set(el.dataset.key, !get(el.dataset.key)); renderToggle(el, true);
      });
    });
  }

  /* sin boxes: right-click crosses one out for good (sin overflow, a new blasphemy);
     right-click again to undo a mistake. Stored beside the box as <key>.x */
  function renderSin(el, anim) {
    const x = !!get(el.dataset.key + ".x");
    el.classList.toggle("crossed", x);
    el.innerHTML = "";
    if (x) carve(el, el.dataset.key + ".x", [45, 135], anim);
  }
  function initSins(root) {
    root.querySelectorAll(".sindot[data-key]").forEach((el) => {
      el.title = "Click to fill · right-click to cross out for good";
      renderSin(el);
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const k = el.dataset.key + ".x";
        set(k, !get(k));
        renderSin(el, true);
      });
    });
  }

  /* dotrow: data-key + data-count (+ data-dashed-from, 1-based). value = filled count */
  function initDotrows(root) {
    root.querySelectorAll(".dotrow[data-count]").forEach((row) => {
      const k = row.dataset.key, n = +row.dataset.count;
      const dashedFrom = row.dataset.dashedFrom ? +row.dataset.dashedFrom : Infinity;
      const bare = row.classList.contains("baredots");
      // data-xs: each dot's centre x on the sheet, so dots land on irregularly spaced print
      const xs = row.dataset.xs ? row.dataset.xs.split(",").map(Number) : null;
      row.innerHTML = "";
      const dots = [];
      for (let i = 0; i < n; i++) {
        const d = document.createElement("span");
        d.className = "dot" + (i + 1 >= dashedFrom ? " dashed" : "") + (bare ? " bare" : "");
        if (xs) d.style.left = `calc(${xs[i]}px - var(--dot) / 2)`;
        row.appendChild(d);
        dots.push(d);
      }
      const render = () => {
        const v = +get(k) || 0;
        dots.forEach((d, i) => d.classList.toggle("on", i < v));
      };
      dots.forEach((d, i) => d.addEventListener("click", () => {
        const v = +get(k) || 0;
        set(k, v === i + 1 ? i : i + 1);
        render();
      }));
      render();
    });
  }

  /* ---------------- editable text ---------------- */
  function initEditables(root) {
    root.querySelectorAll(".ce[data-key], .ac[data-key]").forEach((el) => {
      el.setAttribute("contenteditable", "plaintext-only");
      if (!el.isContentEditable) el.setAttribute("contenteditable", "true");
      if (el.getAttribute("contenteditable") !== "plaintext-only") {
        el.addEventListener("paste", (ev) => {
          ev.preventDefault();
          document.execCommand("insertText", false, (ev.clipboardData || window.clipboardData).getData("text"));
        });
      }
      const k = el.dataset.key;
      const stored = get(k);
      el.textContent = stored != null ? stored : (el.dataset.default || "");
      if (el.classList.contains("line") || el.classList.contains("ac")) {
        el.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); el.blur(); } });
      }
      el.addEventListener("input", () => set(k, el.textContent));
    });
  }

  /* ---------------- CAT selection ---------------- */
  const ROMAN = ["", "I", "II", "III", "IV", "V"];
  function drawCatRing(hot) {
    document.querySelectorAll(".cat-ring").forEach((e) => e.remove());
    if (!hot) return;
    const r = rngFor("cat" + hot.dataset.cat);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "cat-ring");
    // a pen loop around the triangle: just over one turn, so the ends overlap a little
    // the way a hand-drawn circle does, with a slight wobble and tilt
    // centred low, near the triangle's centroid, so it takes in the corners and the number
    const w = hot.offsetWidth, h = hot.offsetHeight, cx = w / 2, cy = h * 0.6;
    const rx = w * 0.68, ry = h * 0.68, tilt = (r() * 10 - 5) * Math.PI / 180;
    const start = -2.2 + r() * 0.5, turn = Math.PI * 2 * (1.08 + r() * 0.05);
    const ph = r() * 6, pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = start + turn * i / 64;
      const k = 1 + 0.035 * Math.sin(t * 2 + ph) + 0.03 * i / 64;   // wobble, spiral out a touch
      const x = Math.cos(t) * rx * k, y = Math.sin(t) * ry * k;
      pts.push(`${(cx + x * Math.cos(tilt) - y * Math.sin(tilt)).toFixed(1)},${(cy + x * Math.sin(tilt) + y * Math.cos(tilt)).toFixed(1)}`);
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;";
    svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="#b8160c" stroke-width="2.6"
      stroke-linecap="round" stroke-linejoin="round" opacity=".88"/>`;
    hot.appendChild(svg);
  }
  function renderCat() {
    const v = +get("x.cat") || 0;
    const hots = document.querySelectorAll(".cat-hot");
    let sel = null;
    hots.forEach((h) => { if (+h.dataset.cat === v) sel = h; });
    drawCatRing(sel);
    const mark = document.getElementById("idcat-mark");
    if (mark) mark.textContent = ROMAN[v] || "";
    const pick = document.getElementById("idcat-pick");
    if (pick) pick.value = String(v);
    // page 4's chart: columns are CAT 0..VII, 85px wide, CAT 0's left edge at x 125.8
    const col = document.getElementById("cat-col");
    if (col) {
      col.style.display = v ? "block" : "none";
      col.style.left = 125.8 + 85 * v + "px";
    }
  }
  function initCat() {
    // the ID card's CATEGORY RATING SYSTEM circle is a drop-down for the same x.cat
    const idcat = document.getElementById("idcat");
    if (idcat) {
      idcat.innerHTML = `<span id="idcat-mark"></span><select id="idcat-pick" title="Category rating" aria-label="Category rating">
        ${ROMAN.map((n, i) => `<option value="${i}">${i ? "CAT " + n : "No CAT yet"}</option>`).join("")}</select>`;
      idcat.querySelector("select").addEventListener("change", (e) => { set("x.cat", +e.target.value); renderCat(); });
    }
    document.querySelectorAll(".cat-hot").forEach((h) => {
      h.addEventListener("click", () => {
        set("x.cat", +get("x.cat") === +h.dataset.cat ? 0 : +h.dataset.cat);
        renderCat();
      });
    });
    renderCat();
  }

  /* ---------------- ID photo ---------------- */
  function initPhoto() {
    const zone = document.getElementById("idphoto");
    if (!zone) return;
    zone.classList.add("photo-zone");
    zone.title = "Click to affix photo · right-click to remove";
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.style.display = "none";
    document.body.appendChild(inp);
    const render = () => {
      const d = get("p1.photo");
      zone.classList.toggle("has-photo", !!d);
      zone.style.backgroundImage = d ? `url(${d})` : "";
    };
    zone.addEventListener("click", () => inp.click());
    zone.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (get("p1.photo") && confirm("Remove affixed photo?")) { set("p1.photo", ""); render(); }
    });
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        const MAX = 700;
        const sc = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        set("p1.photo", c.toDataURL("image/jpeg", 0.88));
        URL.revokeObjectURL(url);
        render();
        inp.value = "";
      };
      img.src = url;
    });
    render();
  }

  /* ---------------- blasphemy / agenda autocomplete ---------------- */
  const BLASPHEMIES = ["TENSION","ARDENCE","FLUX","VECTOR","GATE","SMOTHER","WHISPER","EDIT","BIND","PALACE","JAUNT","SYMPATHY",
    "TONGUE","TRACK","WIRE","MOTHER"];                               // GFF issue 3.1
  const AGENDAS = ["BEAST","DOOMED","GUARDIAN","FIREBUG","LONER","HARDLINE","MACHINE","TORCH","MOTH","TEMPERANCE","SHADOW","SORCERER","SONGBIRD","DEMON",
    "DOLL","CRADLE","BROKEN"];                                       // GFF issue 3.1
  // each known name shows its title art from the book (assets/names/, cut from CAIN 1.4.5
  // and Games for Freaks 3.1.5) while the field isn't being edited
  const ART = (name) => `url("assets/names/${name.toLowerCase()}.webp")`;

  function initAutocomplete() {
    const chip = document.createElement("div");
    chip.id = "ac-chip";
    document.body.appendChild(chip);
    let chipFor = null, chipName = "";
    const hideChip = () => { chip.style.display = "none"; chipFor = null; };

    document.querySelectorAll(".ac[data-ac]").forEach((el) => {
      const list = el.dataset.ac === "blasphemy" ? BLASPHEMIES : AGENDAS;
      // names, not words: a spellcheck squiggle would also show through the title art
      el.spellcheck = false;
      const applyStyle = () => {
        const t = el.textContent.trim().toUpperCase();
        el.classList.remove("ac-art");
        const hit = list.find((n) => n === t);
        if (hit) {
          if (el.textContent.trim() !== hit) el.textContent = hit;
          // .ac-plain (ID-card fields): autocomplete only, the art is too small to read there
          if (!el.classList.contains("ac-plain")) {
            el.classList.add("ac-art");
            el.style.setProperty("--art", ART(hit));
          }
          if (el.dataset.key) set(el.dataset.key, hit);
        }
      };
      const accept = () => {
        if (chipFor === el && chipName) {
          el.textContent = chipName;
          if (el.dataset.key) set(el.dataset.key, chipName);
          hideChip();
          applyStyle();
          // caret to end
          const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        }
      };
      el.addEventListener("input", () => {
        el.classList.remove("ac-art");
        const q = el.textContent.trim().toUpperCase();
        const m = q.length >= 2 ? list.filter((n) => n.startsWith(q) && n !== q) : [];
        if (m.length === 1) {
          chipFor = el; chipName = m[0];
          chip.innerHTML = `<b>${m[0]}</b><span> tab ⇥</span>`;
          const rct = el.getBoundingClientRect();
          chip.style.display = "block";
          chip.style.left = rct.left + window.scrollX + "px";
          chip.style.top = rct.bottom + window.scrollY + 4 + "px";
        } else hideChip();
        if (q.length && list.includes(q)) applyStyle();
      });
      el.addEventListener("keydown", (ev) => {
        if ((ev.key === "Tab" || ev.key === "Enter") && chipFor === el) { ev.preventDefault(); accept(); }
      });
      el.addEventListener("blur", () => { setTimeout(() => { if (chipFor === el) hideChip(); }, 150); applyStyle(); });
      chip.addEventListener("mousedown", (ev) => { ev.preventDefault(); accept(); });
      applyStyle();
    });
  }

  /* ---------------- execution talisman (adapted from talismans.html) ---------------- */
  const FILTER_VARIANTS = 6;
  (function injectFilters() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;";
    let defs = "";
    for (let i = 0; i < FILTER_VARIANTS; i++) {
      defs += `
      <filter id="sltex${i}" x="-15%" y="-180%" width="130%" height="460%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="${(0.018 + 0.004 * i).toFixed(3)} ${(0.42 + 0.04 * i).toFixed(3)}" numOctaves="2" seed="${i * 7 + 3}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -0.45" result="m"/>
        <feComposite in="SourceGraphic" in2="m" operator="in" result="tx"/>
        <feDisplacementMap in="tx" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="slsharp${i}" x="-15%" y="-180%" width="130%" height="460%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="${(0.05 + 0.006 * i).toFixed(3)} 0.18" numOctaves="2" seed="${i * 5 + 1}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.35 0 0 0 -0.18" result="m"/>
        <feComposite in="SourceGraphic" in2="m" operator="in" result="tx"/>
        <feDisplacementMap in="tx" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    }
    svg.innerHTML = `<defs>${defs}</defs>`;
    document.addEventListener("DOMContentLoaded", () => document.body.appendChild(svg));
  })();

  function spindlePath(len, x0, cy, amp, phase, drift, maxHalf, taperPow, plateauK = 1) {
    const segs = 16, pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push([x0 + t * len, cy + Math.sin(t * Math.PI * 1.15 + phase) * amp + drift * (t - 0.5) * 2, t]);
    }
    const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const half = (t) => maxHalf * Math.pow(Math.min(1, Math.sin(Math.PI * c01(t)) * plateauK), taperPow);
    const top = [], bot = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, y, t] = pts[i];
      const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
      let tx = q[0] - p[0], ty = q[1] - p[1];
      const m = Math.hypot(tx, ty) || 1;
      tx /= m; ty /= m;
      const nx = -ty, ny = tx, hw = half(t);
      top.push([x + nx * hw, y + ny * hw]);
      bot.push([x - nx * hw, y - ny * hw]);
    }
    const ring = top.concat(bot.reverse());
    let d = `M ${ring[0][0].toFixed(1)} ${ring[0][1].toFixed(1)}`;
    for (let i = 1; i < ring.length; i++) d += ` L ${ring[i][0].toFixed(1)} ${ring[i][1].toFixed(1)}`;
    return d + " Z";
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const REDS = ["#e60a02", "#ff2a16", "#d40600", "#f5160a", "#c50400"];
  function makeSlash(len, rand = Math.random) {
    const rnd = (a, b) => a + rand() * (b - a);
    const H = 46, cy = H / 2;
    const hairLen = len * rnd(1.3, 1.55);
    const w = Math.ceil(hairLen) + 24, cx = w / 2;
    const phase = rnd(-0.5, 0.5), drift = rnd(-1.6, 1.6), amp = rnd(0.9, 2.0);
    const baseOff = rnd(-1.2, 1.2);
    const thick = [], hair = [];
    const nThick = 1 + (rand() < 0.35 ? 1 : 0);
    for (let k = 0; k < nThick; k++) {
      const L = len * rnd(0.8, 0.97);
      thick.push({
        d: spindlePath(L, cx - L / 2 + rnd(-len * 0.07, len * 0.07), cy + baseOff + rnd(-1.0, 1.0),
          amp * rnd(0.85, 1.1), phase + rnd(-0.2, 0.2), drift, len * rnd(0.05, 0.062), 0.8, 2.4),
        fill: REDS[[0, 2][k % 2]],
        opacity: k === 0 ? rnd(0.96, 1) : rnd(0.85, 0.92),
      });
    }
    hair.push({
      d: spindlePath(hairLen, cx - hairLen / 2, cy + baseOff + rnd(-1.1, 1.1), amp * rnd(0.95, 1.1),
        phase + rnd(-0.15, 0.15), drift * rnd(1.0, 1.3), rnd(0.55, 0.9), 0.55),
      fill: REDS[1],
      opacity: rnd(0.9, 0.98),
    });
    return { thick, hair, w, h: H };
  }
  function buildSlash(data, anim, textured = true) {
    const { thick, hair, w, h, left, top, rot, seed } = data;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "slash");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.width = w + "px"; svg.style.height = h + "px";
    svg.style.left = left + "px"; svg.style.top = top + "px";
    svg.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
    const v = (seed || 0) % FILTER_VARIANTS;
    const tp = (thick || []).map((s) => `<path d="${s.d}" fill="${s.fill}" fill-opacity="${s.opacity}"/>`).join("");
    const hp = (hair || []).map((s) => `<path d="${s.d}" fill="${s.fill}" fill-opacity="${s.opacity}"/>`).join("");
    // the paper-grain filters are sized for long talisman slashes; on a small box they'd
    // eat most of the stroke, so short slashes draw plain
    svg.innerHTML = textured
      ? `<g filter="url(#sltex${v})">${tp}</g><g filter="url(#slsharp${v})">${hp}</g>`
      : `<g>${tp}</g><g>${hp}</g>`;
    if (anim) {
      svg.style.clipPath = "inset(-90% 102% -90% -8%)";
      svg.classList.add("fresh");
      svg.getBoundingClientRect();
      requestAnimationFrame(() => {
        svg.style.transition = "clip-path .13s cubic-bezier(.3,.1,.2,1)";
        svg.style.clipPath = "inset(-90% -8% -90% -8%)";
      });
    }
    return svg;
  }

  function initExecTalisman() {
    const zone = document.getElementById("exec-hit");        // whole paper strip = talisman
    const counter = document.getElementById("exec-talisman"); // printed circle = slash count
    if (!zone || !counter) return;
    const bar = zone.parentElement;
    zone.title = "Execution talisman — click anywhere on the strip to carve a slash, right-click to remove one. Starts at 6, −1 per injury.";
    const layer = document.createElement("div");
    layer.className = "slashes";
    bar.appendChild(layer);
    const zx = zone.offsetLeft, zy = zone.offsetTop, zw = zone.offsetWidth, zh = zone.offsetHeight;
    let slashes = Array.isArray(get("p1.exec")) ? get("p1.exec") : [];
    const renderCount = () => { counter.textContent = slashes.length || ""; };
    const redraw = () => {
      layer.innerHTML = "";
      slashes.forEach((s) => layer.appendChild(buildSlash(s, false)));
      renderCount();
    };
    zone.addEventListener("click", (e) => {
      const rect = zone.getBoundingClientRect();
      // slash lands where you click, kept on the paper strip
      const px = zx + Math.max(12, Math.min(zw - 12, e.clientX - rect.left)) + rnd(-2, 2);
      const py = zy + Math.max(8, Math.min(zh - 8, e.clientY - rect.top)) + rnd(-2, 2);
      // strip is horizontal, so slashes run near-vertical (≈90° vs talismans.html's ≈0°),
      // long enough to cross the 46px paper with a little overshoot. Always tilted
      // 90−θ so every slash cuts top-left → bottom-right, never the other way.
      const core = makeSlash(rnd(42, 58));
      const rot = 90 - rnd(9, 26);
      const data = { ...core, left: px, top: py, rot, seed: Math.floor(Math.random() * 1e9) };
      slashes.push(data);
      state["p1.exec"] = slashes; save();
      layer.appendChild(buildSlash(data, true));
      renderCount();
      bar.classList.remove("cut"); void bar.offsetWidth; bar.classList.add("cut");
    });
    zone.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!slashes.length) return;
      slashes.pop();
      if (slashes.length) state["p1.exec"] = slashes; else delete state["p1.exec"];
      save(); redraw();
    });
    redraw();
  }

  /* ---------------- toolbar: export / import / clear ---------------- */
  function initToolbar() {
    const bar = document.createElement("div");
    bar.id = "toolbar";
    bar.innerHTML = `
      <button id="tb-export" title="Download this exorcist as a JSON file">EXPORT</button>
      <button id="tb-import" title="Load an exorcist from a JSON file">IMPORT</button>
      <button id="tb-print"  title="Print the sheet, or save it as a PDF">PRINT</button>
      <button id="tb-clear"  title="Wipe the sheet">CLEAR</button>`;
    document.body.appendChild(bar);
    document.getElementById("tb-print").addEventListener("click", () => window.print());
    document.getElementById("tb-export").addEventListener("click", () => {
      const name = (get("p1.name") || "exorcist").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exorcist";
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cain-${name}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json"; inp.style.display = "none";
    document.body.appendChild(inp);
    document.getElementById("tb-import").addEventListener("click", () => inp.click());
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      f.text().then((txt) => {
        const obj = JSON.parse(txt);
        if (typeof obj !== "object" || !obj) throw new Error("bad file");
        localStorage.setItem(LS, JSON.stringify(obj));
        location.reload();
      }).catch(() => alert("That file doesn't look like an exported exorcist sheet."));
    });
    document.getElementById("tb-clear").addEventListener("click", () => {
      if (confirm("Clear the whole sheet? (Export first if you want a backup.)")) {
        localStorage.removeItem(LS);
        location.reload();
      }
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("toolbar")) return; // idempotent boot
    initEditables(document);
    initToggles(document);
    initSins(document);
    initDotrows(document);
    initCat();
    initPhoto();
    initAutocomplete();
    initExecTalisman();
    initToolbar();
  });
})();
