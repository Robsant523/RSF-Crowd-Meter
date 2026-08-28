// RSF History — Scriptable script
// Shows how full the RSF weight room was over time, using the log the "RSF Crowd" widget builds.
// Install: save this named "RSF History" in the same Scriptable app (needs "RSFData" saved too).
// Run it directly from the Scriptable app (tap it in the list) — it's a tool, not a widget.

const RSFData = importModule("RSFData");

async function mainMenu() {
  const alert = new Alert();
  alert.title = "RSF History";
  alert.message = "What do you want to see?";
  alert.addAction("Today's chart");
  alert.addAction("Last 7 days chart");
  alert.addAction("Look up a specific time");
  alert.addAction("Export raw log (JSON)");
  alert.addCancelAction("Close");
  const choice = await alert.presentSheet();

  if (choice === 0) await showChart(1);
  else if (choice === 1) await showChart(7);
  else if (choice === 2) await lookupTime();
  else if (choice === 3) await exportLog();
}

async function showChart(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const entries = RSFData.historyBetween(start, end);

  if (entries.length === 0) {
    const a = new Alert();
    a.title = "No data yet";
    a.message = "No history has been logged in this window yet. The widget records a sample every time it refreshes, so check back after it's run a few times.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  const labels = entries.map((e) => {
    const d = new Date(e.t);
    return days === 1
      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric" });
  });
  const values = entries.map((e) => e.pct);

  // Thin labels out so the axis isn't unreadable with lots of points
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(labels.length / maxLabels));
  const thinnedLabels = labels.map((l, i) => (i % step === 0 ? l : ""));

  const chartConfig = {
    type: "line",
    data: {
      labels: thinnedLabels,
      datasets: [
        {
          label: "% full",
          data: values,
          borderColor: "#FDB515",
          backgroundColor: "rgba(253,181,21,0.15)",
          fill: true,
          pointRadius: 0,
          tension: 0.25
        }
      ]
    },
    options: {
      title: { display: true, text: `RSF weight room — last ${days === 1 ? "24 hours" : days + " days"}`, fontColor: "#E9E6DC" },
      legend: { display: false },
      scales: {
        yAxes: [{ ticks: { min: 0, max: 100, fontColor: "#8B93A0" }, gridLines: { color: "#232E3D" } }],
        xAxes: [{ ticks: { fontColor: "#8B93A0" }, gridLines: { color: "#232E3D" } }]
      }
    }
  };

  const url =
    "https://quickchart.io/chart?bkg=%230E1520&width=700&height=400&c=" +
    encodeURIComponent(JSON.stringify(chartConfig));

  const req = new Request(url);
  const img = await req.loadImage();

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const peak = Math.round(Math.max(...values));

  await QuickLook.present(img);

  const a = new Alert();
  a.title = "Summary";
  a.message = `Average: ${avg}% full\nPeak: ${peak}% full\nSamples logged: ${entries.length}`;
  a.addAction("OK");
  await a.presentAlert();
}

async function lookupTime() {
  const dp = new DatePicker();
  dp.initialDate = new Date();
  const picked = await dp.pickDateAndTime();

  const result = RSFData.nearestEntry(picked);
  const a = new Alert();
  if (!result) {
    a.title = "No data";
    a.message = "No history has been logged yet.";
  } else {
    const d = new Date(result.entry.t);
    a.title = "Closest logged reading";
    a.message =
      `${d.toLocaleString()}\n\n` +
      `${result.entry.pct}% full (${result.entry.count} people)\n\n` +
      (result.diffMinutes > 30
        ? `Note: nearest sample was ${result.diffMinutes} min away from the time you picked — the widget doesn't log continuously, only when it refreshes.`
        : `${result.diffMinutes} min from the time you picked.`);
  }
  a.addAction("OK");
  await a.presentAlert();
}

async function exportLog() {
  const history = RSFData.loadHistory();
  const fm = FileManager.iCloud();
  const path = RSFData.logPath();
  const a = new Alert();
  a.title = "Log location";
  a.message = `${history.length} entries stored at:\n${path}\n\nYou can open this JSON file directly in the Files app (iCloud Drive > Scriptable) to pull it into a spreadsheet or another tool.`;
  a.addAction("OK");
  await a.presentAlert();
}

await mainMenu();
Script.complete();
