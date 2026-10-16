(function () {
  var C = window.SpyColor, E = window.SpyExtract, S = window.SpySheet;
  function $(s) { return document.querySelector(s); }
  var brand = null, imgData = null, imgName = "", imgURL = "";

  // tabs
  document.querySelectorAll("#tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#tabs button").forEach(function (x) { x.className = x === b ? "on" : ""; });
      $("#pane-image").hidden = b.dataset.t !== "image"; $("#pane-site").hidden = b.dataset.t !== "site";
    });
  });
  function msg(t, bad) { var m = $("#msg"); m.hidden = !t; m.textContent = t || ""; m.className = "msg" + (bad ? " bad" : ""); }

  // ---- image ----
  function pickFile(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { msg("That file is not an image.", true); return; }
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || 300, h = img.naturalHeight || 300, k = Math.min(1, 260 / Math.max(w, h)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      var ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, cv.width, cv.height);
      imgData = ctx.getImageData(0, 0, cv.width, cv.height); imgName = f.name || "pasted image"; imgURL = url; fromImage();
    };
    img.onerror = function () { msg("Could not read that image.", true); };
    img.src = url;
  }
  function fromImage() {
    if (!imgData) return;
    var d = new Uint8ClampedArray(imgData.data), w = imgData.width, h = imgData.height, i;
    if ($("#bg").checked) {   // flat background: all four corners opaque and the same colour
      var cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(function (p) { var i2 = (p[1] * w + p[0]) * 4; return [d[i2], d[i2 + 1], d[i2 + 2], d[i2 + 3]]; });
      if (cs.every(function (c) { return c[3] > 200 && C.deltaE(c.slice(0, 3), cs[0].slice(0, 3)) < 6; })) {
        for (i = 0; i < d.length; i += 4) if (C.deltaE([d[i], d[i + 1], d[i + 2]], cs[0].slice(0, 3)) < 9) d[i + 3] = 0;
      }
    }
    // anti-aliased edges blend two colours into a third that is not in the logo: ignore pixels that sit on a hard edge
    var e = new Uint8Array(w * h), x, y, n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var p = (y * w + x) * 4; if (d[p + 3] < 128) continue; n4.forEach(function (o) { var q2 = ((y + o[1]) * w + x + o[0]) * 4; if (d[q2 + 3] >= 128 && C.deltaE([d[p], d[p + 1], d[p + 2]], [d[q2], d[q2 + 1], d[q2 + 2]]) > 14) e[y * w + x] = 1; }); }
    var kept = 0; for (i = 0; i < w * h; i++) if (!e[i] && d[i * 4 + 3] >= 128) kept++;
    if (kept > 200) for (i = 0; i < w * h; i++) if (e[i]) d[i * 4 + 3] = 0;
    var q = C.quantize(d, +$("#count").value + 2, { merge: 16 }).filter(function (c) { return c.share >= 0.015; }).slice(0, +$("#count").value), br = [], ne = [];
    q.forEach(function (c) { var x = C.describe(c.rgb); x.share = Math.round(c.share * 100); if (C.chroma(c.rgb) < 12) ne.push(x); else br.push(x); });
    brand = { title: imgName.replace(/\.[a-z0-9]+$/i, ""), url: "", description: "", colors: { brand: br, neutrals: ne }, fonts: [], source: "image" };
    show();
  }
  var drop = $("#drop"), file = $("#file");
  drop.addEventListener("click", function () { file.click(); });
  drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
  file.addEventListener("change", function () { pickFile(file.files[0]); });
  ["dragenter", "dragover"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
  drop.addEventListener("drop", function (e) { pickFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", function (e) { var it = e.clipboardData && e.clipboardData.files; if (it && it[0] && /^image\//.test(it[0].type)) pickFile(it[0]); });
  $("#bg").addEventListener("change", fromImage); $("#count").addEventListener("input", fromImage);

  // ---- website ----
  var HELPER = "https://brand-palette-spy.krishnaprasadofficial29.workers.dev/";
  function helper(q) { return fetch(HELPER + "?" + q).then(function (r) { return r.json().catch(function () { return { error: "The helper sent something unexpected." }; }); }); }
  function goSite() {
    var u = $("#siteurl").value.trim(); if (!u) { msg("Type a website address first.", true); return; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    var btn = $("#go"); btn.disabled = true; btn.textContent = "Reading..."; msg("");
    helper("url=" + encodeURIComponent(u)).then(function (d) {
      if (d.error) throw new Error(d.error);
      var sheets = d.sheets || []; var b = E.extract(d.html || "", sheets.map(function (x) { return x.css; }), d.url || u); b.faceFiles = E.fontFaces(sheets.concat([{ url: d.url || u, css: (d.html || "").match(/<style\b[\s\S]*?<\/style>/gi) ? (d.html.match(/<style\b[\s\S]*?<\/style>/gi) || []).join("\n") : "" }]));
      if (!b.title) b.title = (d.url || u).replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
      b.source = "site"; brand = b; imgURL = "";
      if (!b.colors.brand.length && !b.colors.neutrals.length) msg("No colours found. This site may draw everything with JavaScript or block bots. Try pasting its source under Other ways in.", true);
      show();
      var cand = [b.icon, b.logo, b.ogImage].filter(Boolean); var i = 0;
      (function next() { if (i >= cand.length) return; var c = cand[i++]; helper("img=" + encodeURIComponent(c)).then(function (g) { if (g && g.dataUri && brand === b) { b.logoData = g.dataUri; imgURL = g.dataUri; var pv = $("#preview"); pv.src = g.dataUri; pv.hidden = false; } else next(); }).catch(next); })();
    }).catch(function (e) { msg(/fetch|network/i.test(e.message) ? "Could not reach the helper. Check your connection and try again." : e.message, true); })
      .then(function () { btn.disabled = false; btn.textContent = "Read site"; });
  }
  $("#go").addEventListener("click", goSite);
  $("#siteurl").addEventListener("keydown", function (e) { if (e.key === "Enter") goSite(); });
  $("#read").addEventListener("click", function () {
    var html = $("#src").value; if (html.trim().length < 20) { msg("Paste the page source first.", true); return; }
    var u = $("#srcurl").value.trim(), base = ""; if (u) { if (!/^https?:\/\//i.test(u)) u = "https://" + u; base = u; }
    var css = []; (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []);
    // pasted text may be plain CSS rather than HTML
    if (!/<\w+[^>]*>/.test(html)) { css.push(html); html = ""; }
    brand = E.extract(html, css, base); if (!brand.title && base) brand.title = base.replace(/^https?:\/\/(www\.)?/, ""); brand.source = "source";
    if (!brand.colors.brand.length && !brand.colors.neutrals.length) msg("No colours found. Linked stylesheets are not included in the page source, so paste the CSS too, or use the command line tool.", true); else msg("");
    imgURL = ""; show();
  });
  function loadJson(f) {
    if (!f) return; var r = new FileReader();
    r.onload = function () { try { var j = JSON.parse(r.result); if (!j.colors) throw 0; brand = j; imgURL = ""; msg(""); show(); } catch (e) { msg("That is not a brand.json from this tool.", true); } };
    r.readAsText(f);
  }
  $("#jsonfile").addEventListener("change", function () { loadJson(this.files[0]); });
  var dj = $("#dropjson"); dj.addEventListener("click", function () { $("#jsonfile").click(); });
  ["dragenter", "dragover"].forEach(function (n) { dj.addEventListener(n, function (e) { e.preventDefault(); dj.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (n) { dj.addEventListener(n, function (e) { e.preventDefault(); dj.classList.remove("over"); }); });
  dj.addEventListener("drop", function (e) { loadJson(e.dataTransfer.files[0]); });

  // ---- result ----
  function chip(c) {
    var d = document.createElement("button"); d.className = "sw"; d.title = "Click to copy " + c.hex;
    d.innerHTML = '<span class="chip" style="background:' + S.esc(c.hex) + ';color:' + S.esc(c.text) + '"><b>' + S.esc(c.name) + '</b><i>' + S.esc(c.hex) + (c.share ? " &middot; " + c.share + "%" : "") + '</i></span>' +
      '<span class="meta">RGB ' + c.rgb.join(", ") + '<br>HSL ' + c.hsl[0] + ", " + c.hsl[1] + "%, " + c.hsl[2] + '%<br>White text ' + c.onWhite + ':1<br>Black text ' + c.onBlack + ':1' + (c.uses && c.uses.length ? '<br><em class="use">Found in CSS for ' + S.esc(c.uses.join(", ")) + '</em>' : '') + '</span>';
    d.addEventListener("click", function () { copy(c.hex, "Copied " + c.hex); });
    return d;
  }
  function copy(t, note) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { msg(note); }, function () { msg("Copy was blocked by the browser.", true); }); else msg("Copy is not available here.", true); }
  // Only openly licensed fonts get a download. Anything else shows its name and source, no files.
  var OPEN = /^(OFL|Apache|MIT|Ubuntu|CC0|CC-BY|ISC|BSD)/i;
  function fontIds(name) {
    var k = function (t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
    var ids = [k(name), k(name.replace(/([a-z])([A-Z])/g, "$1 $2"))]; return ids.filter(function (v, i) { return v && ids.indexOf(v) === i; });
  }
  function guides(b) {
    var box = $("#guideBox"); if (!box) return; var g = $("#guides"); g.innerHTML = ""; box.hidden = b.source !== "site"; if (b.source !== "site") return;
    g.innerHTML = '<p class="note">Looking for a brand guideline...</p>';
    var host = (b.url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
    var q = "guide=" + encodeURIComponent(b.url) + (b.brandLinks || []).map(function (l) { return "&l=" + encodeURIComponent(l.url); }).join("");
    helper(q).then(function (d) {
      if (brand !== b) return;
      var f = (d && d.found) || []; g.innerHTML = "";
      if (!f.length) { g.innerHTML = '<p class="note">' + (d && d.error ? "Could not check this site for a brand guideline." : "No brand guideline found on " + S.esc(host) + ". I checked the homepage links, the sitemap and the usual pages like /brand and /press. It may still exist behind a link I can't see.") + "</p>"; return; }
      var gl = f.filter(function (x) { return x.guide; });
      g.innerHTML = (gl.length ? "" : '<p class="note">No full brand guideline, but the site has these brand or press pages:</p>') + f.map(function (x) { return '<a class="btn sm" target="_blank" rel="noopener" href="' + S.esc(x.url) + '">' + S.esc((x.guide ? "Brand guideline: " : "") + (x.label || "Brand page")) + (x.pdf ? " (PDF)" : "") + "</a>"; }).join(" ");
    }).catch(function () { g.innerHTML = '<p class="note">Could not check this site for a brand guideline.</p>'; });
  }
  function fontOffer(name, el, b) {
    var ids = fontIds(name), i = 0;
    (function tryNext() {
      if (i >= ids.length) { el.innerHTML = '<small>Not on the free font lists, so it may be licensed: <a target="_blank" rel="noopener" href="https://www.google.com/search?q=' + encodeURIComponent(name + " font licence") + '">check the licence</a>.</small>'; return; }
      var id = ids[i++];
      fetch("https://api.fontsource.org/v1/fonts/" + id).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (m) {
        if (b !== brand) return;
        if (!OPEN.test(m.license || "")) { el.innerHTML = "<small>Licence: " + S.esc(m.license || "unknown") + ".</small>"; return; }
        var h = '<small>' + S.esc(m.license) + '</small> <a class="btn sm" href="https://api.fontsource.org/v1/download/' + S.esc(m.id) + '">Download zip (web files)</a>';
        if (m.type === "google") h += ' <a class="btn sm" target="_blank" rel="noopener" href="https://fonts.google.com/specimen/' + encodeURIComponent(m.family).replace(/%20/g, "+") + '">Get TTF on Google Fonts</a>';
        el.innerHTML = h;
      }).catch(tryNext);
    })();
  }
  // Files the site itself serves for this font. The visitor's browser fetches them (through the helper, because other sites block direct downloads) and saves them. Nothing is stored on our side.
  function fontFiles(name, row, b) {
    var list = (b.faceFiles || {})[name.toLowerCase()];
    var box = document.createElement("div"); box.className = "ffiles"; row.appendChild(box);
    if (!list || !list.length) { box.innerHTML = "<small>The site does not serve a file for this one (likely a system font), so there is nothing to download.</small>"; return; }
    var seen = {};
    list.slice(0, 8).forEach(function (f) {
      var label = (f.weight && f.weight !== "400" ? f.weight + " " : "") + (/italic|oblique/i.test(f.style) ? "italic " : "") + "." + f.ext;
      var fn = name.replace(/[^\w-]+/g, "") + "-" + (f.weight || "400").replace(/\s+/g, "-") + (/italic|oblique/i.test(f.style) ? "-italic" : "") + "." + f.ext; if (seen[fn]) return; seen[fn] = 1;
      var a = document.createElement("button"); a.className = "btn sm"; a.textContent = "Download " + label.trim();
      a.addEventListener("click", function () {
        a.disabled = true; var old = a.textContent; a.textContent = "Fetching...";
        fetch(HELPER + "?font=" + encodeURIComponent(f.url)).then(function (r) { if (!r.ok) throw new Error("The helper could not get that file."); return r.blob(); }).then(function (bl) {
          var url = URL.createObjectURL(bl), l = document.createElement("a"); l.href = url; l.download = fn; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); a.textContent = old; msg("Saved " + fn);
        }).catch(function (e) { a.textContent = old; msg(e.message || "Download failed.", true); }).then(function () { a.disabled = false; });
      });
      box.appendChild(a);
    });
    var n = document.createElement("small"); n.className = "lic"; n.textContent = "Check the font's licence before you use it. A font on a website is not always free to use."; box.appendChild(n);
    if (list.length && list.every(function (f) { return f.ext === "woff2" || f.ext === "woff"; })) { var w = document.createElement("small"); w.textContent = "Web format. Convert it to install it on a computer."; box.appendChild(w); }
  }
  function show() {
    $("#result").hidden = false; $("#rtitle").textContent = brand.title || "Result";
    var pv = $("#preview"); if (imgURL) { pv.src = imgURL; pv.hidden = false; } else pv.hidden = true;
    var bg = $("#brandGrid"), ng = $("#neutralGrid"); bg.innerHTML = ""; ng.innerHTML = "";
    brand.colors.brand.forEach(function (c) { bg.appendChild(chip(c)); }); brand.colors.neutrals.forEach(function (c) { ng.appendChild(chip(c)); });
    if (!brand.colors.brand.length) bg.innerHTML = '<p class="note">No strong colours found.</p>';
    $("#nh").hidden = ng.hidden = !brand.colors.neutrals.length;
    var fb = $("#fonts"); fb.innerHTML = ""; $("#fontBox").hidden = brand.source === "image";
    if (brand.source !== "image") {
      if (!(brand.fonts || []).length) fb.innerHTML = '<p class="note">No named fonts found. They may be set in a stylesheet that was not included.</p>';
      (brand.fonts || []).slice(0, 5).forEach(function (f) {
        var d = document.createElement("div"); d.className = "font";
        d.innerHTML = "<b>" + S.esc(f.family) + "</b><small>" + S.esc(f.source === "google" ? "Google Fonts" : f.source === "font-face" ? "Custom font on the site" : "Used in the site CSS") + '</small><span class="fget"><small>Checking if it is free to download...</small></span>';
        fb.appendChild(d); fontOffer(f.family, d.querySelector(".fget"), brand); fontFiles(f.family, d, brand);
      });
    }
    guides(brand);
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function save(name, type, data) { var a = document.createElement("a"), b = new Blob([data], { type: type }); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); }
  function slug() { return (brand.title || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "brand"; }
  $("#dlSheet").addEventListener("click", function () { if (brand) save(slug() + "-brand-sheet.html", "text/html", S.sheetHtml(brand, { logoData: brand.source === "image" ? imgThumb() : (brand.logoData || "") })); });
  $("#dlJson").addEventListener("click", function () { if (brand) save(slug() + "-brand.json", "application/json", JSON.stringify(brand, function (k, v) { return k === "logoData" ? undefined : v; }, 2)); });
  $("#cpCss").addEventListener("click", function () { if (brand) copy(S.cssVars(brand), "CSS variables copied"); });
  function imgThumb() { if (!imgData) return ""; var cv = document.createElement("canvas"); cv.width = imgData.width; cv.height = imgData.height; cv.getContext("2d").putImageData(imgData, 0, 0); return cv.toDataURL("image/png"); }
  $("#dlPng").addEventListener("click", function () {
    if (!brand) return; var cols = brand.colors.brand.concat(brand.colors.neutrals).slice(0, 10), W = 1200, H = 360, cv = document.createElement("canvas"); cv.width = W; cv.height = H; var x = cv.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H); var cw = (W - 40) / Math.max(1, cols.length);
    cols.forEach(function (c, i) { x.fillStyle = c.hex; x.fillRect(20 + i * cw, 20, cw - 6, 240); x.fillStyle = "#f2f2f2"; x.font = "600 18px system-ui,Arial"; x.fillText(c.hex, 24 + i * cw, 292); x.fillStyle = "#8a8a8a"; x.font = "14px system-ui,Arial"; x.fillText(c.name, 24 + i * cw, 316); });
    cv.toBlob(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = slug() + "-palette.png"; document.body.appendChild(a); a.click(); a.remove(); });
  });
  window.BrandSpy = { load: pickFile, state: function () { return brand; } };
})();
