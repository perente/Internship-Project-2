const BAR_THICKNESS_PX = 25;
const DEFAULT_TABLE = "T_BASE_OFFER";
const PALETTE_HEX = [
  "#0B132B",
  "#1E293B",
  "#1D4ED8",
  "#0F766E",
  "#14532D",
  "#3F6212",
  "#2F855A",
  "#1F6F8B",
  "#2A4365",
  "#22303C",
  "#334155",
  "#4B5563",
  "#374151",
  "#7C2D12",
  "#5B2C1E",
  "#2F3E46",
];

function $(id) {
  return document.getElementById(id);
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function assignColors(labels) {
  const uniq = [...new Set(labels)].sort();
  const m = PALETTE_HEX.length;

  const stride = Math.floor(m / 2) + 1;
  const order = [];
  let idx = 0;
  for (let i = 0; i < m; i++) {
    order.push(idx);
    idx = (idx + stride) % m;
  }

  const map = new Map();
  for (let i = 0; i < uniq.length; i++) {
    const base = PALETTE_HEX[order[i % m]];
    const wrap = Math.floor(i / m);
    const stroke = base;
    const fill = hexToRgba(base, wrap === 0 ? 0.6 : wrap === 1 ? 0.45 : 0.35);
    map.set(uniq[i], { stroke, fill });
  }

  return {
    strokes: labels.map((l) => map.get(l).stroke),
    fills: labels.map((l) => map.get(l).fill),
  };
}

(async function () {
  const apiBase = "http://localhost:3001";
  let barChart;
  let colChart;

  async function fetchTotals(from, to) {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const res = await fetch(`${apiBase}/api/get/logs/totals?${p.toString()}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "fetch totals failed");
    return (data.rows || []).map((r) => [String(r[0]), Number(r[1])]);
  }

  function buildConfig(labels, data) {
    const { fills, strokes } = assignColors(labels);

    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Requests",
            data,
            backgroundColor: fills,
            borderColor: strokes,
            borderWidth: 2,
            borderRadius: 4,
            barThickness: BAR_THICKNESS_PX,
            maxBarThickness: BAR_THICKNESS_PX,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: { label: (ctx) => String(ctx.parsed.y) },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Table" },
            grid: { display: false },
            ticks: { autoSkip: false, maxRotation: 0, minRotation: 0 },
          },
          y: {
            title: { display: true, text: "Requests" },
            beginAtZero: true,
            ticks: { precision: 0, stepSize: 1 },
          },
        },
        layout: { padding: { top: 6, right: 8, bottom: 6, left: 8 } },
      },
    };
  }

  async function draw() {
    try {
      const from = $("fromDate")?.value || null;
      const to = $("toDate")?.value || null;

      const rows = await fetchTotals(from, to);
      const labels = rows.map((r) => r[0]);
      const data = rows.map((r) => r[1]);

      const wrap = $("barWrap");
      const canvas = $("totalsBar");
      if (!wrap || !canvas) return;

      const PER_BAR_SPACE = BAR_THICKNESS_PX + 24;
      const minWidth = Math.max(
        labels.length * PER_BAR_SPACE,
        wrap.parentElement.clientWidth
      );
      wrap.style.width = minWidth + "px";

      const ctx = canvas.getContext("2d");
      if (!barChart) {
        barChart = new Chart(ctx, buildConfig(labels, data));
      } else {
        const { fills, strokes } = assignColors(labels);
        barChart.data.labels = labels;
        barChart.data.datasets[0].data = data;
        barChart.data.datasets[0].backgroundColor = fills;
        barChart.data.datasets[0].borderColor = strokes;
        barChart.update();
      }
    } catch (e) {
      console.error("[bar] draw error:", e);
    }
  }

  async function fetchByColumn(table) {
    const res = await fetch(
      `${apiBase}/api/get/logs/by-column?tableName=${encodeURIComponent(table)}`
    );
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "fetch by column failed");
    return (data.rows || []).map((r) => [String(r[0]), Number(r[1])]);
  }

  async function drawColumns(table) {
    try {
      const rows = await fetchByColumn(table);
      const labels = rows.map((r) => r[0]);
      const data = rows.map((r) => r[1]);

      const wrap = $("colBarWrap");
      const canvas = $("columnsBar");
      if (!wrap || !canvas) return;

      const PER_BAR_SPACE = BAR_THICKNESS_PX + 24;
      const minWidth = Math.max(
        labels.length * PER_BAR_SPACE,
        wrap.parentElement.clientWidth
      );
      wrap.style.width = minWidth + "px";

      const ctx = canvas.getContext("2d");
      if (!colChart) {
        colChart = new Chart(ctx, buildConfig(labels, data));
      } else {
        const { fills, strokes } = assignColors(labels);
        colChart.data.labels = labels;
        colChart.data.datasets[0].data = data;
        colChart.data.datasets[0].backgroundColor = fills;
        colChart.data.datasets[0].borderColor = strokes;
        colChart.update();
      }
    } catch (e) {
      console.error("[col] draw error:", e);
    }
  }

  function bind() {
    $("applyRange")?.addEventListener("click", (e) => {
      e.preventDefault();
      draw();
    });

    $("colTableSelect")?.addEventListener("change", (e) => {
      const table = e.target.value;
      if (table) drawColumns(table);
    });

    const sel = $("colTableSelect");
    if (sel) {
      const hasDefault = Array.from(sel.options).some(
        (o) => o.value === DEFAULT_TABLE
      );
      if (!sel.value && hasDefault) {
        sel.value = DEFAULT_TABLE;
      }
      if (sel.value) {
        drawColumns(sel.value);
      }
    }

    draw();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
