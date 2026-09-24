/* Signal-Chart je Baustein (7.2): Wochenschlüsse, SMA50, beim Bitcoin das 3-%-Band,
   Streifen „investiert/Cash“, Marker für Kauf- und Verkaufssignale, darunter der Abstand zum SMA50.
   Reines SVG ohne Bibliothek. Hover und Tastatur zeigen alle Werte der Woche. */
var CHART = (function () {
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs) {
    var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }

  function niceStep(span, count) {
    var raw = span / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  function niceScale(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    var step = niceStep(max - min, count), lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
    for (var v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { min: lo, max: hi, step: step, ticks: ticks };
  }

  var MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  /* o: {S, R, rule, asset, from, fmt:{y, yAxis, pct, date}, tip (HTMLElement), stateText(i)} */
  function signal(container, o) {
    container.textContent = '';
    var S = o.S, R = o.R, n = S.c.length, from = Math.max(0, Math.min(o.from || 0, n - 2));
    var W = Math.max(280, Math.round(container.clientWidth || 600));
    var narrow = W < 560;
    var m = { l: narrow ? 46 : 58, r: narrow ? 58 : 76, t: 12 };
    var mainH = narrow ? 190 : 250, stripY = m.t + mainH + 10, stripH = 10, distY = stripY + stripH + 16, distH = narrow ? 64 : 84;
    var H = distY + distH + 24, pw = W - m.l - m.r;
    var band = o.rule.type === 'band' ? o.rule.p : 0;

    function X(i) { return m.l + (i - from) / (n - 1 - from) * pw; }

    /* Wertebereiche */
    var lo = Infinity, hi = -Infinity, dlo = 0, dhi = 0, i;
    for (i = from; i < n; i++) {
      lo = Math.min(lo, S.c[i]); hi = Math.max(hi, S.c[i]);
      var M = R.sma[i];
      if (M != null) {
        lo = Math.min(lo, M * (1 - band)); hi = Math.max(hi, M * (1 + band));
        var dd = S.c[i] / M - 1; dlo = Math.min(dlo, dd); dhi = Math.max(dhi, dd);
      }
    }
    if (band) { dlo = Math.min(dlo, -band); dhi = Math.max(dhi, band); }
    var ys = niceScale(lo - (hi - lo) * 0.04, hi + (hi - lo) * 0.04, narrow ? 4 : 5);
    var ds = niceScale(dlo, dhi, 3);
    function Y(v) { return m.t + (1 - (v - ys.min) / (ys.max - ys.min)) * mainH; }
    function DY(v) { return distY + (1 - (v - ds.min) / (ds.max - ds.min)) * distH; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', tabindex: 0,
      'aria-label': o.label || 'Wochenschlüsse und SMA50' }, container);
    var color = 'var(--' + o.asset + ')', wash = 'var(--' + o.asset + '-wash)';

    /* Raster und Achsen */
    var g = el('g', { 'class': 'grid' }, svg);
    ys.ticks.forEach(function (v) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g);
      text(svg, m.l - 8, Y(v) + 4, o.fmt.yAxis(v), { 'text-anchor': 'end' });
    });
    ds.ticks.forEach(function (v) {
      if (Math.abs(v) < 1e-12) return;
      el('line', { x1: m.l, x2: W - m.r, y1: DY(v), y2: DY(v) }, g);
      text(svg, m.l - 8, DY(v) + 4, o.fmt.pct(v, 0), { 'text-anchor': 'end' });
    });
    el('line', { x1: m.l, x2: W - m.r, y1: DY(0), y2: DY(0), 'class': 'baseline' }, svg);
    text(svg, m.l - 8, DY(0) + 4, '0 %', { 'text-anchor': 'end' });
    text(svg, W - m.r + 8, distY + 10, 'Abstand', { 'class': 'lbl-ink' });
    if (!narrow) text(svg, W - m.r + 8, distY + 24, 'zum SMA50', {});
    text(svg, W - m.r + 8, stripY + 9, 'Regel', { 'class': 'lbl-ink' });

    /* Monatsbeschriftung */
    var span = n - 1 - from, every = span > 150 ? 6 : span > 60 ? 3 : span > 26 ? 2 : 1, lastLabelX = -1e9, firstLabel = true;
    for (i = from; i < n; i++) {
      var mo = +S.d[i].slice(5, 7) - 1, prevMo = i > 0 ? +S.d[i - 1].slice(5, 7) - 1 : -1;
      if (mo === prevMo || mo % every !== 0) continue;
      var x = X(i);
      if (x - lastLabelX < (narrow ? 44 : 54) || x > W - m.r - 10) continue;
      lastLabelX = x;
      el('line', { x1: x, x2: x, y1: distY + distH, y2: distY + distH + 4, 'class': 'baseline' }, svg);
      text(svg, x, H - 6, MONTHS[mo] + (mo === 0 || firstLabel ? ' ' + S.d[i].slice(2, 4) : ''), { 'text-anchor': 'middle' });
      firstLabel = false;
    }

    /* Band (Bitcoin) */
    var firstS = Math.max(from, 49);
    if (band && firstS < n) {
      var up = [], dn = [];
      for (i = firstS; i < n; i++) { up.push(X(i) + ',' + Y(R.sma[i] * (1 + band))); dn.unshift(X(i) + ',' + Y(R.sma[i] * (1 - band))); }
      el('polygon', { points: up.concat(dn).join(' '), fill: wash }, svg);
    }

    function path(fn, start) {
      var d = '';
      for (var j = start; j < n; j++) { var v = fn(j); if (v == null) continue; d += (d ? 'L' : 'M') + X(j).toFixed(1) + ',' + v.toFixed(1); }
      return d;
    }
    /* SMA50 und Wochenschlüsse */
    if (firstS < n) el('path', { d: path(function (j) { return R.sma[j] == null ? null : Y(R.sma[j]); }, firstS), fill: 'none', 'class': 'sma', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    el('path', { d: path(function (j) { return Y(S.c[j]); }, from), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    /* Abstand zum SMA50 */
    if (firstS < n) {
      var ad = 'M' + X(firstS).toFixed(1) + ',' + DY(0).toFixed(1);
      for (i = firstS; i < n; i++) ad += 'L' + X(i).toFixed(1) + ',' + DY(S.c[i] / R.sma[i] - 1).toFixed(1);
      ad += 'L' + X(n - 1).toFixed(1) + ',' + DY(0).toFixed(1) + 'Z';
      el('path', { d: ad, fill: wash }, svg);
      el('path', { d: path(function (j) { return R.sma[j] == null ? null : DY(S.c[j] / R.sma[j] - 1); }, firstS), fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, svg);
      if (band) [band, -band].forEach(function (b) {
        el('line', { x1: m.l, x2: W - m.r, y1: DY(b), y2: DY(b), stroke: 'var(--ink-2)', 'stroke-width': 1, opacity: 0.5 }, svg);
        text(svg, W - m.r - 4, DY(b) + (b > 0 ? -4 : 11), (b > 0 ? '+' : '−') + Math.round(band * 100) + ' %', { 'text-anchor': 'end' });
      });
    }

    /* Streifen investiert/Cash: Läufe gleichen Zustands, 2 px Abstand dazwischen */
    var runStart = null;
    for (i = from; i <= n; i++) {
      var s = i < n ? R.st[i] : undefined;
      if (runStart !== null && (i === n || s !== R.st[runStart])) {
        var x0 = runStart === from ? X(runStart) : (X(runStart - 1) + X(runStart)) / 2 + 1;
        var x1 = i === n ? X(n - 1) : (X(i - 1) + X(i)) / 2 - 1;
        if (R.st[runStart] != null) el('rect', { x: x0, y: stripY, width: Math.max(1, x1 - x0), height: stripH, rx: 2,
          fill: R.st[runStart] === 1 ? color : 'var(--cash)' }, svg);
        runStart = null;
      }
      if (runStart === null && i < n) runStart = i;
    }

    /* Signalmarker mit Beschriftung */
    (R.sw || []).forEach(function (sw) {
      if (sw.i < from) return;
      var x = X(sw.i), y = Y(sw.c), buy = sw.to === 1, sz = 7;
      var yy = buy ? y + 12 : y - 12;
      var d = buy ? 'M' + x + ',' + (yy - sz) + 'L' + (x + sz) + ',' + (yy + sz * 0.7) + 'L' + (x - sz) + ',' + (yy + sz * 0.7) + 'Z'
                  : 'M' + x + ',' + (yy + sz) + 'L' + (x + sz) + ',' + (yy - sz * 0.7) + 'L' + (x - sz) + ',' + (yy - sz * 0.7) + 'Z';
      el('path', { d: d, fill: 'var(--ink)', stroke: 'var(--surface)', 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      var ty = buy ? yy + sz + 13 : yy - sz - 5;
      var anchor = x < m.l + 40 ? 'start' : x > W - m.r - 40 ? 'end' : 'middle';
      text(svg, x, ty, (buy ? 'Kauf ' : 'Verkauf ') + o.fmt.dateShort(sw.d), { 'text-anchor': anchor, 'class': 'lbl-ink halo' });
      el('line', { x1: x, x2: x, y1: stripY - 3, y2: stripY + stripH + 3, stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
    });

    /* Endpunkt mit Wert */
    var lx = X(n - 1), ly = Y(S.c[n - 1]);
    el('circle', { cx: lx, cy: ly, r: 4.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    text(svg, lx + 9, ly + 4, o.fmt.yShort(S.c[n - 1]), { 'class': 'lbl-ink halo' });
    if (R.sma[n - 1] != null) {
      var sy = Y(R.sma[n - 1]);
      if (Math.abs(sy - ly) > 13) text(svg, lx + 9, sy + 4, 'SMA ' + o.fmt.yShort(R.sma[n - 1]), {});
    }

    /* Hover-Ebene: Fadenkreuz, Punkte, Tooltip */
    var hover = el('g', { 'pointer-events': 'none', visibility: 'hidden' }, svg);
    var cross = el('line', { y1: m.t, y2: distY + distH, stroke: 'var(--ink-2)', 'stroke-width': 1 }, hover);
    var dotC = el('circle', { r: 4.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, hover);
    var dotS = el('circle', { r: 4, fill: 'var(--ink-2)', stroke: 'var(--surface)', 'stroke-width': 2 }, hover);
    var dotD = el('circle', { r: 3.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, hover);
    var hit = el('rect', { x: m.l - 6, y: 0, width: pw + 12, height: distY + distH + 4, fill: 'transparent' }, svg);
    var cur = null;

    function show(idx, clientX, clientY) {
      idx = Math.max(from, Math.min(n - 1, idx)); cur = idx;
      var x = X(idx), M = R.sma[idx];
      hover.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      dotC.setAttribute('cx', x); dotC.setAttribute('cy', Y(S.c[idx]));
      dotS.setAttribute('visibility', M == null ? 'hidden' : 'visible');
      dotD.setAttribute('visibility', M == null ? 'hidden' : 'visible');
      if (M != null) { dotS.setAttribute('cx', x); dotS.setAttribute('cy', Y(M)); dotD.setAttribute('cx', x); dotD.setAttribute('cy', DY(S.c[idx] / M - 1)); }
      if (o.tip) {
        fillTip(o.tip, idx);
        o.tip.hidden = false;
        var rect = svg.getBoundingClientRect();
        var px = clientX != null ? clientX : rect.left + x * rect.width / W;
        var py = clientY != null ? clientY : rect.top + Y(S.c[idx]) * rect.height / H;
        var tw = o.tip.offsetWidth, th = o.tip.offsetHeight;
        var left = px + 16 + tw > window.innerWidth - 8 ? px - 16 - tw : px + 16;
        var top = Math.min(Math.max(8, py - th / 2), window.innerHeight - th - 8);
        o.tip.style.left = Math.max(8, left) + 'px'; o.tip.style.top = top + 'px';
      }
    }
    function hide() { hover.setAttribute('visibility', 'hidden'); if (o.tip) o.tip.hidden = true; cur = null; }

    function row(tip, keyColor, label, value) {
      var r = document.createElement('div'); r.className = 'tt-row';
      var k = document.createElement('span'); k.className = 'key line'; if (keyColor) k.style.background = keyColor; else k.style.visibility = 'hidden';
      var l = document.createElement('span'); l.className = 'muted'; l.textContent = label;
      var v = document.createElement('b'); v.textContent = value;
      r.appendChild(k); r.appendChild(l); r.appendChild(v); tip.appendChild(r);
    }
    function fillTip(tip, idx) {
      tip.textContent = '';
      var h = document.createElement('div'); h.className = 'tt-date'; h.textContent = 'Wochenschluss ' + o.fmt.date(S.d[idx]); tip.appendChild(h);
      var M = R.sma[idx];
      row(tip, color, 'Schluss', o.fmt.y(S.c[idx]));
      if (M != null) {
        row(tip, 'var(--ink-2)', 'SMA50', o.fmt.y(M));
        row(tip, null, 'Abstand', o.fmt.pct(S.c[idx] / M - 1, 2, true));
        if (band) row(tip, null, 'Band', o.fmt.yShort(M * (1 - band)) + ' – ' + o.fmt.yShort(M * (1 + band)));
      }
      var st = document.createElement('div'); st.className = 'tt-state'; st.textContent = o.stateText(idx); tip.appendChild(st);
    }

    function idxAt(clientX) {
      var rect = svg.getBoundingClientRect(), x = (clientX - rect.left) * W / rect.width;
      return Math.round(from + (x - m.l) / pw * (n - 1 - from));
    }
    hit.addEventListener('pointermove', function (e) { show(idxAt(e.clientX), e.clientX, e.clientY); });
    hit.addEventListener('pointerdown', function (e) { show(idxAt(e.clientX), e.clientX, e.clientY); });
    hit.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', function () { show(cur == null ? n - 1 : cur); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); show((cur == null ? n - 1 : cur) + (e.key === 'ArrowLeft' ? -1 : 1));
      } else if (e.key === 'Home') { e.preventDefault(); show(from); }
      else if (e.key === 'End') { e.preventDefault(); show(n - 1); }
      else if (e.key === 'Escape') hide();
    });
    return svg;
  }

  /* Tooltip neben dem Zeiger (oder am Element) platzieren */
  function placeTip(tip, px, py) {
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = px + 16 + tw > window.innerWidth - 8 ? px - 16 - tw : px + 16;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.min(Math.max(8, py - th / 2), window.innerHeight - th - 8) + 'px';
  }
  function tipRow(tip, keyColor, label, value) {
    var r = document.createElement('div'); r.className = 'tt-row';
    var k = document.createElement('span'); k.className = 'key line'; if (keyColor) k.style.background = keyColor; else k.style.visibility = 'hidden';
    var l = document.createElement('span'); l.className = 'muted'; l.textContent = label;
    var v = document.createElement('b'); v.textContent = value;
    r.appendChild(k); r.appendChild(l); r.appendChild(v); tip.appendChild(r);
  }

  /* Zeitreihe mit mehreren Linien (Portfolio-Performance). o: {d, series:[{label, values, color, width}], fmt:{y, yAxis, date, dateShort}, tip, extra(i) → [[label, text]]} */
  function lines(container, o) {
    container.textContent = '';
    var n = o.d.length;
    var W = Math.max(280, Math.round(container.clientWidth || 600)), narrow = W < 560;
    var m = { l: narrow ? 52 : 64, r: narrow ? 64 : 84, t: 12, b: 26 }, ph = narrow ? 200 : 260, H = m.t + ph + m.b, pw = W - m.l - m.r;
    var lo = Infinity, hi = -Infinity;
    o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    if (!isFinite(lo)) return null;
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.02 || 0.01, ys = niceScale(lo - pad, hi + pad, narrow ? 4 : 5);
    function X(i) { return m.l + (n > 1 ? i / (n - 1) : 0.5) * pw; }
    function Y(v) { return m.t + (1 - (v - ys.min) / (ys.max - ys.min)) * ph; }
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', tabindex: 0, 'aria-label': o.label || 'Verlauf' }, container);
    var g = el('g', { 'class': 'grid' }, svg);
    ys.ticks.forEach(function (v) { el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); text(svg, m.l - 8, Y(v) + 4, o.fmt.yAxis(v), { 'text-anchor': 'end' }); });
    el('line', { x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph, 'class': 'baseline' }, svg);
    if (o.zero) el('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), 'class': 'baseline' }, svg);
    /* Datumsachse: Wochen, Monate oder Quartale je nach Zeitraum */
    var span = n > 1 ? ENGDays(o.d[0], o.d[n - 1]) : 0, lastX = -1e9, i;
    for (i = 0; i < n; i++) {
      var d = o.d[i], prev = i > 0 ? o.d[i - 1] : null, lab = null;
      if (span <= 62) { if (i === 0 || new Date(d + 'T00:00:00Z').getUTCDay() === 1) lab = o.fmt.dateShort(d); }
      else if (!prev || d.slice(5, 7) !== prev.slice(5, 7)) {
        var mo = +d.slice(5, 7) - 1, every = span > 800 ? 6 : span > 300 ? 3 : 1;
        if (mo % every === 0 || i === 0) lab = MONTHS[mo] + (mo === 0 || i === 0 ? ' ' + d.slice(2, 4) : '');
      }
      if (!lab) continue;
      var x = X(i);
      if (x - lastX < (narrow ? 46 : 58) || x > W - m.r + 4) continue;
      lastX = x;
      el('line', { x1: x, x2: x, y1: m.t + ph, y2: m.t + ph + 4, 'class': 'baseline' }, svg);
      text(svg, x, H - 6, lab, { 'text-anchor': 'middle' });
    }
    /* Linien, Lücken (null) unterbrechen die Linie */
    var ends = [];
    o.series.forEach(function (s) {
      var dd = '', pen = false, last = null;
      s.values.forEach(function (v, j) {
        if (v == null) { pen = false; return; }
        dd += (pen ? 'L' : 'M') + X(j).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; last = j;
      });
      if (s.area && dd) {
        var first = s.values.findIndex(function (v) { return v != null; });
        var yb = o.zero ? Y(0) : m.t + ph;
        el('path', { d: dd + 'L' + X(last).toFixed(1) + ',' + yb + 'L' + X(first).toFixed(1) + ',' + yb + 'Z', fill: s.area }, svg);
      }
      el('path', { d: dd, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (last != null) {
        el('circle', { cx: X(last), cy: Y(s.values[last]), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
        ends.push({ y: Y(s.values[last]), x: X(last), t: o.fmt.yShort(s.values[last]) });
      }
    });
    ends.sort(function (a, b) { return a.y - b.y; });
    var prevY = -1e9;
    ends.forEach(function (e) { if (e.y - prevY < 14) return; prevY = e.y; text(svg, e.x + 9, e.y + 4, e.t, { 'class': 'lbl-ink halo' }); });

    /* Hover: Fadenkreuz, ein Tooltip für alle Linien */
    var hover = el('g', { 'pointer-events': 'none', visibility: 'hidden' }, svg);
    var cross = el('line', { y1: m.t, y2: m.t + ph, stroke: 'var(--ink-2)', 'stroke-width': 1 }, hover);
    var dots = o.series.map(function (s) { return el('circle', { r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, hover); });
    var hit = el('rect', { x: m.l - 6, y: 0, width: pw + 12, height: m.t + ph + 4, fill: 'transparent' }, svg), cur = null;
    function show(idx, cx, cy) {
      idx = Math.max(0, Math.min(n - 1, idx)); cur = idx;
      var x = X(idx);
      hover.setAttribute('visibility', 'visible'); cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      o.series.forEach(function (s, j) {
        var v = s.values[idx];
        dots[j].setAttribute('visibility', v == null ? 'hidden' : 'visible');
        if (v != null) { dots[j].setAttribute('cx', x); dots[j].setAttribute('cy', Y(v)); }
      });
      if (!o.tip) return;
      var tip = o.tip; tip.textContent = '';
      var h = document.createElement('div'); h.className = 'tt-date'; h.textContent = o.fmt.date(o.d[idx]); tip.appendChild(h);
      o.series.forEach(function (s) { if (s.values[idx] != null) tipRow(tip, s.color, s.label, o.fmt.y(s.values[idx])); });
      (o.extra ? o.extra(idx) : []).forEach(function (r) { tipRow(tip, null, r[0], r[1]); });
      tip.hidden = false;
      var rect = svg.getBoundingClientRect();
      placeTip(tip, cx != null ? cx : rect.left + x * rect.width / W, cy != null ? cy : rect.top + (m.t + ph / 2) * rect.height / H);
    }
    function hide() { hover.setAttribute('visibility', 'hidden'); if (o.tip) o.tip.hidden = true; cur = null; }
    function idxAt(clientX) { var r = svg.getBoundingClientRect(); return Math.round(((clientX - r.left) * W / r.width - m.l) / pw * (n - 1)); }
    hit.addEventListener('pointermove', function (e) { show(idxAt(e.clientX), e.clientX, e.clientY); });
    hit.addEventListener('pointerdown', function (e) { show(idxAt(e.clientX), e.clientX, e.clientY); });
    hit.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', function () { show(cur == null ? n - 1 : cur); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show((cur == null ? n - 1 : cur) + (e.key === 'ArrowLeft' ? -1 : 1)); }
      else if (e.key === 'Escape') hide();
    });
    return svg;
  }
  function ENGDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }

  /* Kreisdiagramm (Ring). o: {segments:[{label, value, fill}], title, sub, tip, fmt(v, share) → text, size} */
  function donut(container, o) {
    container.textContent = '';
    var S = o.size || 220, R = S / 2 - 4, r = R * 0.62, cx = S / 2, cy = S / 2;
    var total = o.segments.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0);
    var svg = el('svg', { viewBox: '0 0 ' + S + ' ' + S, width: S, height: S, role: 'img', 'aria-label': o.label || o.title }, container);
    svg.style.maxWidth = '100%';
    var a0 = -Math.PI / 2;
    function pt(rad, ang) { return (cx + rad * Math.cos(ang)).toFixed(2) + ',' + (cy + rad * Math.sin(ang)).toFixed(2); }
    o.segments.forEach(function (seg) {
      if (!(seg.value > 0) || !(total > 0)) return;
      var share = seg.value / total, a1 = a0 + share * 2 * Math.PI, large = a1 - a0 > Math.PI ? 1 : 0, p;
      if (share > 0.9999) {
        p = el('path', { d: 'M' + pt(R, a0) + 'A' + R + ',' + R + ' 0 1 1 ' + pt(R, a0 + Math.PI) + 'A' + R + ',' + R + ' 0 1 1 ' + pt(R, a0) +
          'M' + pt(r, a0) + 'A' + r + ',' + r + ' 0 1 0 ' + pt(r, a0 + Math.PI) + 'A' + r + ',' + r + ' 0 1 0 ' + pt(r, a0) + 'Z', 'fill-rule': 'evenodd' }, svg);
      } else {
        p = el('path', { d: 'M' + pt(R, a0) + 'A' + R + ',' + R + ' 0 ' + large + ' 1 ' + pt(R, a1) + 'L' + pt(r, a1) + 'A' + r + ',' + r + ' 0 ' + large + ' 0 ' + pt(r, a0) + 'Z' }, svg);
      }
      p.style.fill = seg.fill; p.setAttribute('stroke', 'var(--surface)'); p.setAttribute('stroke-width', 2); p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('tabindex', 0); p.setAttribute('class', 'donut-seg');
      var label = seg.label + ': ' + o.fmt(seg.value, share);
      p.setAttribute('aria-label', label);
      function show(e) {
        if (!o.tip) return;
        o.tip.textContent = ''; var h = document.createElement('div'); h.className = 'tt-date'; h.textContent = seg.label; o.tip.appendChild(h);
        var v = document.createElement('div'); v.textContent = o.fmt(seg.value, share); o.tip.appendChild(v);
        o.tip.hidden = false;
        var b = p.getBoundingClientRect();
        placeTip(o.tip, e && e.clientX != null ? e.clientX : b.left + b.width / 2, e && e.clientY != null ? e.clientY : b.top + b.height / 2);
      }
      function hide() { if (o.tip) o.tip.hidden = true; }
      p.addEventListener('pointermove', show); p.addEventListener('pointerleave', hide);
      p.addEventListener('focus', function () { show(null); }); p.addEventListener('blur', hide);
      a0 = a1;
    });
    text(svg, cx, cy - 2, o.title, { 'text-anchor': 'middle', 'class': 'donut-title' });
    if (o.sub) text(svg, cx, cy + 16, o.sub, { 'text-anchor': 'middle', 'class': 'donut-sub' });
    return svg;
  }

  return { signal: signal, lines: lines, donut: donut, niceScale: niceScale };
})();
