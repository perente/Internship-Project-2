(function () {
  const apiBase = "http://localhost:3001";
  const fromEl = document.getElementById("fromDate");
  const toEl   = document.getElementById("toDate");
  const btn    = document.getElementById("applyRange");
  const canvas = document.getElementById("dailyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let chart;

  function toYMD(v) {
    if (!v) return null;
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
  }

  async function fetchDaily(from, to) {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to)   p.set("to", to);
    const res = await fetch(`${apiBase}/api/get/logs/daily-raw?${p.toString()}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "fetch failed");
    return (data.rows || []).map(r => [r[0], toYMD(r[1]), Number(r[2])]); // [table, day, count]
  }

  function pivot(rows) {
    const daySet = new Set(), tableSet = new Set();
    const map = new Map(); // table -> (day -> count)
    rows.forEach(([t, d, c]) => {
      tableSet.add(t); daySet.add(d);
      if (!map.has(t)) map.set(t, new Map());
      map.get(t).set(d, c);
    });
    const labels = Array.from(daySet).sort();
    const datasets = Array.from(tableSet).sort().map(t => ({
      label: t,
      data: labels.map(d => map.get(t).get(d) ?? 0),
      tension: 0.25,
      fill: false
    }));
    return { labels, datasets };
  }

  async function draw() {
    try {
      const from = fromEl?.value || null;
      const to   = toEl?.value   || null;
      const rows = await fetchDaily(from, to);
      const { labels, datasets } = pivot(rows);
      const cfg = {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" }, tooltip: { mode: "index", intersect: false } },
          interaction: { mode: "nearest", intersect: false },
          scales: {
            x: { title: { display: true, text: "Day" } },
            y: { title: { display: true, text: "Request Count" }, beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      };
      if (chart) chart.destroy();
      chart = new Chart(ctx, cfg);
    } catch (e) {
      console.error(e);
    }
  }

  btn?.addEventListener("click", draw);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
  else draw();
})();
