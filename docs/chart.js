/* Crime Analysis dashboard — vanilla JS, hand-rolled SVG charts, no dependencies. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var SERIES_COLORS = ["series-1", "series-2", "series-3", "series-4", "series-8"];

  var FEATURE_LABELS = {
    PctKids2Par: "Families w/ two-parent kids",
    PctFam2Par: "Kids in two-parent housing",
    racePctWhite: "% population white",
    PctYoungKids2Par: "Young kids in two-parent homes",
    PctTeen2Par: "Teens in two-parent homes",
    pctWInvInc: "Households w/ investment income",
    PctPersOwnOccup: "People in owner-occupied homes",
    PctHousOwnOcc: "Owner-occupied housing units",
    medFamInc: "Median family income",
    medIncome: "Median household income",
    PctIlleg: "% illegitimate births",
    racepctblack: "% population Black",
    pctWPubAsst: "Households w/ public assistance",
    FemalePctDiv: "% females divorced",
    TotalPctDiv: "% population divorced",
    MalePctDivorce: "% males divorced",
    PctPopUnderPov: "% population under poverty line",
    PctUnemployed: "% unemployed",
    PctHousNoPhone: "Housing units w/o phone",
    PctNotHSGrad: "% not HS graduates",
    agePct12t21: "Age 12-21 %",
    agePct12t29: "Age 12-29 %",
    agePct16t24: "Age 16-24 %",
    agePct65up: "Age 65+ %",
    PctUnemployed_e: "% unemployed",
    PctEmploy: "% employed",
    PctEmplManu: "% employed, manufacturing",
    PctEmplProfServ: "% employed, professional services",
  };

  function label(key) {
    return FEATURE_LABELS[key] || key;
  }

  // ---------- small DOM helpers ----------
  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
      }
    }
    return e;
  }
  function textEl(x, y, str, cls, extra) {
    var e = svgEl("text", Object.assign({ x: x, y: y, class: cls || "" }, extra || {}));
    e.textContent = str; // never innerHTML — labels are data
    return e;
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function fmtR(v) {
    return (v >= 0 ? "+" : "") + v.toFixed(2);
  }
  function fmtPct1(v) {
    return (v * 100).toFixed(1) + "%";
  }
  function fmtNum2(v) {
    return v.toFixed(2);
  }

  // ---------- tooltip singleton ----------
  var tooltipEl = document.getElementById("tooltip");
  function hideTooltip() {
    tooltipEl.classList.remove("visible");
  }
  function showTooltip(clientX, clientY, title, rows) {
    tooltipEl.textContent = "";
    var t = el("div", { class: "tt-title" }, title);
    tooltipEl.appendChild(t);
    rows.forEach(function (r) {
      var row = el("div", { class: "tt-row" });
      if (r.color) {
        var key = el("span", { class: "tt-key" });
        key.style.background = "var(--" + r.color + ")";
        row.appendChild(key);
      }
      row.appendChild(el("span", { class: "tt-name" }, r.name));
      row.appendChild(el("span", { class: "tt-val" }, r.value));
      tooltipEl.appendChild(row);
    });
    var x = clientX + 14;
    var y = clientY + 14;
    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
    tooltipEl.classList.add("visible");
    // keep on screen
    requestAnimationFrame(function () {
      var rect = tooltipEl.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        tooltipEl.style.left = clientX - rect.width - 14 + "px";
      }
      if (rect.bottom > window.innerHeight - 8) {
        tooltipEl.style.top = clientY - rect.height - 14 + "px";
      }
    });
  }

  // ---------- generic table-view toggle ----------
  function wireTableToggle(mountId, buildTable) {
    var mount = document.getElementById(mountId);
    var card = mount.closest(".card");
    var btn = card.querySelector('.table-toggle[data-target="' + mountId + '"]');
    var table = buildTable();
    table.classList.add("data-table");
    mount.insertAdjacentElement("afterend", table);
    btn.addEventListener("click", function () {
      var showingTable = mount.classList.toggle("table-visible");
      table.classList.toggle("visible", showingTable);
      btn.textContent = showingTable ? "View as chart" : "View as table";
    });
  }
  function tableFrom(headers, rows) {
    var table = el("table");
    var thead = el("thead");
    var htr = el("tr");
    headers.forEach(function (h) {
      htr.appendChild(el("th", {}, h));
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (c) {
        tr.appendChild(el("td", {}, String(c)));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  // ============================================================
  // KPI row
  // ============================================================
  function renderKPI(summary) {
    var row = document.getElementById("kpi-row");
    row.textContent = "";
    var pct = ((summary.highCrimeCount / summary.communities) * 100).toFixed(1);
    var tiles = [
      { label: "Communities analyzed", value: summary.communities.toLocaleString(), sub: "rows after cleaning" },
      { label: "Predictive features", value: String(summary.cleanColumns - 1), sub: "+ 1 target, of " + summary.rawColumns + " raw columns" },
      { label: "High-crime communities", value: summary.highCrimeCount.toLocaleString() + " (" + pct + "%)", sub: "ViolentCrimesPerPop > 0.10" },
      { label: "Mean crime rate", value: summary.meanViolentCrime.toFixed(3), sub: "normalized 0–1 scale, median " + summary.medianViolentCrime.toFixed(3) },
    ];
    tiles.forEach(function (t) {
      var tile = el("div", { class: "stat-tile" });
      tile.appendChild(el("div", { class: "label" }, t.label));
      tile.appendChild(el("div", { class: "value" }, t.value));
      tile.appendChild(el("div", { class: "sub" }, t.sub));
      row.appendChild(tile);
    });
  }

  // ============================================================
  // Diverging bar chart — correlations
  // ============================================================
  function renderCorrelations(data) {
    var neg = data.negative.slice(); // ascending (most negative first)
    var pos = data.positive.slice().reverse(); // ascending (least positive first)
    var list = neg.concat(pos);

    var maxAbs = Math.max.apply(
      null,
      list.map(function (d) {
        return Math.abs(d.r);
      })
    );
    maxAbs = Math.ceil(maxAbs * 10) / 10;

    var W = 900;
    var rowH = 24;
    var rowGap = 4;
    var topPad = 10;
    var bottomPad = 30;
    var H = topPad + list.length * (rowH + rowGap) + bottomPad;
    var labelW = 210;
    var plotX0 = labelW;
    var plotW = W - labelW - 60;
    var midX = plotX0 + plotW / 2;
    var halfW = plotW / 2;

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Correlation with violent crime rate" });

    // zero baseline
    svg.appendChild(svgEl("line", { x1: midX, y1: topPad - 4, x2: midX, y2: H - bottomPad + 4, class: "base-line" }));
    // axis labels at ends
    svg.appendChild(textEl(plotX0, H - bottomPad + 18, "← protective (r)", "axis-text"));
    svg.appendChild(textEl(plotX0 + plotW, H - bottomPad + 18, "risk (r) →", "axis-text", { "text-anchor": "end" }));

    list.forEach(function (d, i) {
      var cy = topPad + i * (rowH + rowGap);
      var isNeg = d.r < 0;
      var barLen = (Math.abs(d.r) / maxAbs) * halfW;
      var barX = isNeg ? midX - barLen : midX;
      var cls = isNeg ? "mark-series-1" : "mark-series-8";

      // full-row hit target
      var hit = svgEl("rect", { x: 0, y: cy, width: W, height: rowH, class: "hover-hit" });

      var bar = svgEl("rect", {
        x: barX,
        y: cy + 2,
        width: Math.max(barLen, 1),
        height: rowH - 4,
        rx: 3,
        class: cls,
      });

      var catLabel = textEl(labelW - 12, cy + rowH / 2 + 4, label(d.feature), "value-text", { "text-anchor": "end" });
      var valX = isNeg ? midX - barLen - 6 : midX + barLen + 6;
      var valLabel = textEl(valX, cy + rowH / 2 + 4, fmtR(d.r), "end-label", { "text-anchor": isNeg ? "end" : "start" });

      var g = svgEl("g", {});
      g.appendChild(catLabel);
      g.appendChild(bar);
      g.appendChild(valLabel);
      g.appendChild(hit);
      svg.appendChild(g);

      var tipTitle = label(d.feature) + " (" + d.feature + ")";
      hit.addEventListener("pointermove", function (ev) {
        showTooltip(ev.clientX, ev.clientY, tipTitle, [
          { color: isNeg ? "series-1" : "series-8", name: "Pearson r", value: fmtR(d.r) },
        ]);
      });
      hit.addEventListener("pointerleave", hideTooltip);
      hit.tabIndex = 0;
      hit.addEventListener("focus", function () {
        var box = hit.getBoundingClientRect();
        showTooltip(box.left, box.top, tipTitle, [{ color: isNeg ? "series-1" : "series-8", name: "Pearson r", value: fmtR(d.r) }]);
      });
      hit.addEventListener("blur", hideTooltip);
    });

    var mount = document.getElementById("corr-chart");
    mount.appendChild(svg);

    wireTableToggle("corr-chart", function () {
      return tableFrom(
        ["Feature", "Description", "Pearson r"],
        list.map(function (d) {
          return [d.feature, label(d.feature), fmtR(d.r)];
        })
      );
    });
  }

  // ============================================================
  // Line chart — decile trends (age / employment)
  // ============================================================
  function renderTrendLine(mountId, trend, seriesKeys, seriesNames, unitNote) {
    var W = 500,
      H = 300;
    var margin = { top: 16, right: 118, bottom: 34, left: 40 };
    var plotW = W - margin.left - margin.right;
    var plotH = H - margin.top - margin.bottom;

    var deciles = trend.deciles;
    var allVals = [];
    seriesKeys.forEach(function (k) {
      allVals = allVals.concat(trend.series[k]);
    });
    var yMin = Math.min.apply(null, allVals);
    var yMax = Math.max.apply(null, allVals);
    var pad = (yMax - yMin) * 0.15 || 0.05;
    yMin = Math.max(0, yMin - pad);
    yMax = yMax + pad;

    function xPos(i) {
      return margin.left + (i / (deciles.length - 1)) * plotW;
    }
    function yPos(v) {
      return margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    }

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Trend across crime-rate deciles" });

    // gridlines (4 horizontal steps)
    var steps = 4;
    for (var s = 0; s <= steps; s++) {
      var v = yMin + (s / steps) * (yMax - yMin);
      var gy = yPos(v);
      svg.appendChild(svgEl("line", { x1: margin.left, y1: gy, x2: margin.left + plotW, y2: gy, class: "grid-line" }));
      svg.appendChild(textEl(margin.left - 8, gy + 3, fmtNum2(v), "axis-text", { "text-anchor": "end" }));
    }
    // x axis labels
    deciles.forEach(function (d, i) {
      if (i % 1 === 0) {
        svg.appendChild(textEl(xPos(i), margin.top + plotH + 18, d, "axis-text", { "text-anchor": "middle" }));
      }
    });
    svg.appendChild(
      textEl(margin.left + plotW / 2, H - 2, "Crime-rate decile (D1 = lowest → D10 = highest)", "axis-text", { "text-anchor": "middle" })
    );

    var endPoints = [];
    seriesKeys.forEach(function (key, si) {
      var color = SERIES_COLORS[si];
      var vals = trend.series[key];
      var pts = vals.map(function (v, i) {
        return [xPos(i), yPos(v)];
      });
      var d = pts
        .map(function (p, i) {
          return (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1);
        })
        .join(" ");
      svg.appendChild(svgEl("path", { d: d, fill: "none", class: "stroke-series-" + color.split("-")[1], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

      var last = pts[pts.length - 1];
      var dot = svgEl("circle", { cx: last[0], cy: last[1], r: 4, class: "mark-" + color });
      svg.appendChild(dot);
      endPoints.push({ y: last[1], name: seriesNames[si], color: color, x: last[0] });
    });

    // declutter end labels
    endPoints.sort(function (a, b) {
      return a.y - b.y;
    });
    var minGap = 13;
    for (var i = 1; i < endPoints.length; i++) {
      if (endPoints[i].y - endPoints[i - 1].y < minGap) {
        endPoints[i].y = endPoints[i - 1].y + minGap;
      }
    }
    endPoints.forEach(function (p) {
      var lx = p.x + 8;
      svg.appendChild(svgEl("line", { x1: p.x + 4, y1: p.y, x2: lx - 2, y2: p.y, class: "grid-line" }));
      svg.appendChild(textEl(lx, p.y + 3, p.name, "end-label"));
    });

    // hover crosshair + per-decile tooltip
    var hitW = plotW / deciles.length;
    deciles.forEach(function (dLabel, i) {
      var hit = svgEl("rect", { x: margin.left + i * hitW, y: margin.top, width: hitW, height: plotH, class: "hover-hit" });
      hit.addEventListener("pointermove", function (ev) {
        var rows = seriesKeys.map(function (key, si) {
          return { color: SERIES_COLORS[si], name: seriesNames[si], value: trend.series[key][i].toFixed(2) };
        });
        rows.push({ name: "Mean crime rate", value: trend.meanViolentCrime[i].toFixed(3) });
        showTooltip(ev.clientX, ev.clientY, dLabel, rows);
      });
      hit.addEventListener("pointerleave", hideTooltip);
      svg.appendChild(hit);
    });

    var mount = document.getElementById(mountId);
    mount.appendChild(svg);

    // legend (HTML, above/below chart, always present for >=2 series)
    var card = mount.closest(".card");
    var legend = el("div", { class: "legend" });
    seriesKeys.forEach(function (key, si) {
      var item = el("span", { class: "item" });
      var sw = el("span", { class: "swatch" });
      sw.style.background = "var(--" + SERIES_COLORS[si] + ")";
      item.appendChild(sw);
      item.appendChild(document.createTextNode(seriesNames[si]));
      legend.appendChild(item);
    });
    mount.insertAdjacentElement("beforebegin", legend);

    wireTableToggle(mountId, function () {
      var headers = ["Decile"].concat(seriesNames).concat(["Mean crime rate"]);
      var rows = deciles.map(function (d, i) {
        var row = [d];
        seriesKeys.forEach(function (key) {
          row.push(trend.series[key][i].toFixed(3));
        });
        row.push(trend.meanViolentCrime[i].toFixed(3));
        return row;
      });
      return tableFrom(headers, rows);
    });
  }

  // ============================================================
  // Box plot — population bins
  // ============================================================
  function renderPopulationBoxplot(data) {
    var bins = data.bins;
    var W = 900,
      H = 340;
    var margin = { top: 16, right: 20, bottom: 50, left: 44 };
    var plotW = W - margin.left - margin.right;
    var plotH = H - margin.top - margin.bottom;
    var slot = plotW / bins.length;
    var boxW = Math.min(48, slot * 0.5);

    function yPos(v) {
      return margin.top + plotH - v * plotH; // domain fixed 0..1
    }

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Violent crime rate by population bin" });

    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var gy = yPos(v);
      svg.appendChild(svgEl("line", { x1: margin.left, y1: gy, x2: margin.left + plotW, y2: gy, class: "grid-line" }));
      svg.appendChild(textEl(margin.left - 8, gy + 3, v.toFixed(2), "axis-text", { "text-anchor": "end" }));
    });

    bins.forEach(function (b, i) {
      var cx = margin.left + slot * (i + 0.5);
      var g = svgEl("g", {});
      // whisker
      g.appendChild(svgEl("line", { x1: cx, y1: yPos(b.min), x2: cx, y2: yPos(b.max), class: "base-line" }));
      g.appendChild(svgEl("line", { x1: cx - boxW / 4, y1: yPos(b.min), x2: cx + boxW / 4, y2: yPos(b.min), class: "base-line" }));
      g.appendChild(svgEl("line", { x1: cx - boxW / 4, y1: yPos(b.max), x2: cx + boxW / 4, y2: yPos(b.max), class: "base-line" }));
      // box
      var boxTop = yPos(b.q3),
        boxBot = yPos(b.q1);
      g.appendChild(svgEl("rect", { x: cx - boxW / 2, y: boxTop, width: boxW, height: Math.max(boxBot - boxTop, 1), rx: 3, class: "mark-seq", opacity: 0.28 }));
      g.appendChild(svgEl("rect", { x: cx - boxW / 2, y: boxTop, width: boxW, height: Math.max(boxBot - boxTop, 1), rx: 3, fill: "none", class: "stroke-seq", "stroke-width": 1.5 }));
      // median
      g.appendChild(svgEl("line", { x1: cx - boxW / 2, y1: yPos(b.median), x2: cx + boxW / 2, y2: yPos(b.median), class: "stroke-seq", "stroke-width": 2 }));

      g.appendChild(textEl(cx, margin.top + plotH + 18, "Bin " + b.bin, "axis-text", { "text-anchor": "middle" }));
      g.appendChild(textEl(cx, margin.top + plotH + 32, "n=" + b.count, "axis-text", { "text-anchor": "middle" }));

      var hit = svgEl("rect", { x: cx - slot / 2, y: margin.top, width: slot, height: plotH, class: "hover-hit" });
      hit.addEventListener("pointermove", function (ev) {
        showTooltip(ev.clientX, ev.clientY, "Population bin " + b.bin + " (n=" + b.count + ")", [
          { name: "Max", value: b.max.toFixed(2) },
          { name: "Q3", value: b.q3.toFixed(2) },
          { name: "Median", value: b.median.toFixed(2) },
          { name: "Mean", value: b.mean.toFixed(2) },
          { name: "Q1", value: b.q1.toFixed(2) },
          { name: "Min", value: b.min.toFixed(2) },
        ]);
      });
      hit.addEventListener("pointerleave", hideTooltip);
      g.appendChild(hit);

      svg.appendChild(g);
    });

    document.getElementById("pop-chart").appendChild(svg);

    wireTableToggle("pop-chart", function () {
      return tableFrom(
        ["Bin", "n", "Min", "Q1", "Median", "Q3", "Max", "Mean"],
        bins.map(function (b) {
          return [b.bin, b.count, b.min, b.q1, b.median, b.q3, b.max, b.mean];
        })
      );
    });
  }

  // ============================================================
  // Rent histogram (raw / log toggle)
  // ============================================================
  function renderRentHistogram(data) {
    var mount = document.getElementById("rent-chart");
    var W = 900,
      H = 280;
    var margin = { top: 16, right: 20, bottom: 40, left: 44 };
    var plotW = W - margin.left - margin.right;
    var plotH = H - margin.top - margin.bottom;

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "RentMedian histogram" });
    mount.appendChild(svg);

    function draw(view) {
      svg.textContent = "";
      var hist = data[view];
      var maxCount = Math.max.apply(null, hist.counts);
      var n = hist.counts.length;
      var barSlot = plotW / n;
      var barW = barSlot * 0.78;

      [0, 0.5, 1].forEach(function (f) {
        var gy = margin.top + plotH - f * plotH;
        svg.appendChild(svgEl("line", { x1: margin.left, y1: gy, x2: margin.left + plotW, y2: gy, class: "grid-line" }));
        svg.appendChild(textEl(margin.left - 8, gy + 3, Math.round(f * maxCount), "axis-text", { "text-anchor": "end" }));
      });

      hist.counts.forEach(function (c, i) {
        var h = (c / maxCount) * plotH;
        var x = margin.left + i * barSlot + (barSlot - barW) / 2;
        var y = margin.top + plotH - h;
        var bar = svgEl("rect", { x: x, y: y, width: barW, height: Math.max(h, 1), rx: 3, class: "mark-seq" });
        svg.appendChild(bar);

        var lo = hist.edges[i].toFixed(2);
        var hi = hist.edges[i + 1].toFixed(2);
        var hit = svgEl("rect", { x: margin.left + i * barSlot, y: margin.top, width: barSlot, height: plotH, class: "hover-hit" });
        hit.addEventListener("pointermove", function (ev) {
          showTooltip(ev.clientX, ev.clientY, lo + " – " + hi, [{ color: "accent", name: "Communities", value: String(c) }]);
        });
        hit.addEventListener("pointerleave", hideTooltip);
        svg.appendChild(hit);

        if (i % 2 === 0) {
          svg.appendChild(textEl(margin.left + i * barSlot + barSlot / 2, margin.top + plotH + 16, lo, "axis-text", { "text-anchor": "middle" }));
        }
      });
      svg.appendChild(
        textEl(margin.left + plotW / 2, H - 2, view === "raw" ? "RentMedian (normalized 0–1)" : "log(RentMedian + 1)", "axis-text", { "text-anchor": "middle" })
      );
    }

    draw("raw");

    var buttons = document.querySelectorAll('[data-rent-view]');
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
        draw(btn.getAttribute("data-rent-view"));
      });
    });

    wireTableToggle("rent-chart", function () {
      var rows = data.raw.counts.map(function (c, i) {
        return [
          data.raw.edges[i].toFixed(2) + "–" + data.raw.edges[i + 1].toFixed(2),
          c,
          data.log.counts[i],
        ];
      });
      return tableFrom(["Bin (raw range)", "Count (raw)", "Count (log-transformed)"], rows);
    });
  }

  // ============================================================
  // PCA variance bars
  // ============================================================
  function renderPCA(pca) {
    var W = 900,
      H = 300;
    var margin = { top: 16, right: 20, bottom: 34, left: 50 };
    var plotW = W - margin.left - margin.right;
    var plotH = H - margin.top - margin.bottom;
    var n = pca.components.length;
    var barSlot = plotW / n;
    var barW = barSlot * 0.6;
    var maxV = Math.max.apply(null, pca.varianceRatio);

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "PCA variance explained" });

    [0, 0.1, 0.2, 0.3].forEach(function (v) {
      if (v > maxV * 1.15) return;
      var gy = margin.top + plotH - (v / (maxV * 1.15)) * plotH;
      svg.appendChild(svgEl("line", { x1: margin.left, y1: gy, x2: margin.left + plotW, y2: gy, class: "grid-line" }));
      svg.appendChild(textEl(margin.left - 8, gy + 3, fmtPct1(v), "axis-text", { "text-anchor": "end" }));
    });

    pca.components.forEach(function (name, i) {
      var v = pca.varianceRatio[i];
      var h = (v / (maxV * 1.15)) * plotH;
      var x = margin.left + i * barSlot + (barSlot - barW) / 2;
      var y = margin.top + plotH - h;
      svg.appendChild(svgEl("rect", { x: x, y: y, width: barW, height: h, rx: 3, class: "mark-seq" }));
      svg.appendChild(textEl(margin.left + i * barSlot + barSlot / 2, margin.top + plotH + 16, name.replace("PC", ""), "axis-text", { "text-anchor": "middle" }));

      var hit = svgEl("rect", { x: margin.left + i * barSlot, y: margin.top, width: barSlot, height: plotH, class: "hover-hit" });
      hit.addEventListener("pointermove", function (ev) {
        showTooltip(ev.clientX, ev.clientY, name, [{ color: "accent", name: "Variance explained", value: fmtPct1(v) }]);
      });
      hit.addEventListener("pointerleave", hideTooltip);
      svg.appendChild(hit);
    });

    svg.appendChild(textEl(margin.left + plotW / 2, H - 2, "Principal component", "axis-text", { "text-anchor": "middle" }));

    document.getElementById("pca-chart").appendChild(svg);
    document.getElementById("pca-caption").textContent =
      "Cumulative variance across 14 components: " + fmtPct1(pca.cumulativeVariance) + ".";

    wireTableToggle("pca-chart", function () {
      return tableFrom(
        ["Component", "Variance explained"],
        pca.components.map(function (name, i) {
          return [name, fmtPct1(pca.varianceRatio[i])];
        })
      );
    });
  }

  // ============================================================
  // Theme toggle
  // ============================================================
  function initThemeToggle() {
    var buttons = document.querySelectorAll("[data-theme-choice]");
    var saved = localStorage.getItem("crime-analysis-theme") || "system";
    applyTheme(saved);
    buttons.forEach(function (btn) {
      if (btn.getAttribute("data-theme-choice") === saved) btn.setAttribute("aria-pressed", "true");
      else btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-theme-choice");
        applyTheme(choice);
        localStorage.setItem("crime-analysis-theme", choice);
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
      });
    });
  }
  function applyTheme(choice) {
    if (choice === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", choice);
    }
  }

  // ============================================================
  // boot
  // ============================================================
  initThemeToggle();

  fetch("data/dashboard.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      renderKPI(data.summary);
      renderCorrelations(data.correlations);
      renderTrendLine(
        "age-chart",
        data.ageTrend,
        ["agePct12t21", "agePct12t29", "agePct16t24", "agePct65up"],
        ["Age 12–21", "Age 12–29", "Age 16–24", "Age 65+"]
      );
      renderTrendLine(
        "employ-chart",
        data.employmentTrend,
        ["PctUnemployed", "PctEmploy", "PctEmplManu", "PctEmplProfServ"],
        ["Unemployed", "Employed", "Manufacturing", "Professional services"]
      );
      renderPopulationBoxplot(data.populationBins);
      renderRentHistogram(data.rent);
      renderPCA(data.pca);
    })
    .catch(function (err) {
      document.getElementById("kpi-row").innerHTML = "";
      var msg = el(
        "div",
        { class: "loading-note" },
        "Couldn't load dashboard data (" + err.message + "). Run scripts/generate_dashboard_data.py and reload."
      );
      document.getElementById("kpi-row").appendChild(msg);
    });
})();
