// RSF Crowd Meter — Scriptable widget
// Draws a circular progress ring showing live RSF weight room occupancy.
// Also logs every sample to history so "RSF History" can show past fullness.
//
// Install (in order):
// 1. Save "RSFData" as its own script in Scriptable (paste RSFData.js contents, name it exactly "RSFData").
// 2. Save this script named "RSF Crowd".
// 3. Long-press your home screen > add widget > Scriptable > small or medium > edit widget > set Script to "RSF Crowd".

const RSFData = importModule("RSFData");
const CAPACITY = RSFData.CAPACITY;

const COLORS = {
  bg: new Color("#0E1520"),
  track: new Color("#232E3D"),
  text: new Color("#E9E6DC"),
  dim: new Color("#8B93A0"),
  quiet: new Color("#7FB069"),
  moderate: new Color("#FDB515"),
  busy: new Color("#E58A4E"),
  full: new Color("#DC4E33")
};

function statusFor(pct) {
  if (pct < 30) return { label: "QUIET", color: COLORS.quiet };
  if (pct < 60) return { label: "MODERATE", color: COLORS.moderate };
  if (pct < 95) return { label: "BUSY", color: COLORS.busy };
  return { label: "NEAR CAP", color: COLORS.full };
}

// Draws a ring by plotting points along the arc and connecting them —
// Scriptable's DrawContext has no built-in "draw arc" primitive.
function ringPath(cx, cy, r, startDeg, endDeg, steps = 120) {
  const path = new Path();
  const toRad = (d) => (d - 90) * (Math.PI / 180);
  const first = new Point(cx + r * Math.cos(toRad(startDeg)), cy + r * Math.sin(toRad(startDeg)));
  path.move(first);
  for (let i = 1; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = toRad(deg);
    path.addLine(new Point(cx + r * Math.cos(rad), cy + r * Math.sin(rad)));
  }
  return path;
}

function drawGauge(size, pct, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.09;

  ctx.setLineWidth(strokeW);

  // background track (full circle)
  ctx.setStrokeColor(COLORS.track);
  const track = ringPath(cx, cy, r, 0, 360, 200);
  track.closeSubpath();
  ctx.addPath(track);
  ctx.strokePath();

  // progress arc
  const clamped = Math.max(0, Math.min(100, pct));
  if (clamped > 0) {
    ctx.setStrokeColor(color);
    const arc = ringPath(cx, cy, r, 0, clamped * 3.6, Math.max(2, Math.round(clamped * 1.2)));
    ctx.addPath(arc);
    ctx.strokePath();
  }

  return ctx.getImage();
}

async function buildWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.bg;
  widget.setPadding(14, 14, 14, 14);

  let count = null;
  let pct = 0;
  let errored = false;
  let historyStatus = "";

  try {
    count = await RSFData.fetchCount();
    pct = (count / CAPACITY) * 100;

  } catch (e) {
    errored = true;
  }

  if (!errored) {
    try {
      const entries = await RSFData.recordSample(count);
      const result = await RSFData.pushHistoryToGitHub(entries);
      historyStatus = result.ok ? "History synced" : result.skipped ? "History local · run Setup" : "Saved locally · sync failed";
      if (!result.ok) console.warn(result.error);
    } catch (e) {
      historyStatus = "History save failed · open app";
      console.warn(String(e));
    }
  }

  const family = config.widgetFamily || "small";
  const imgSize = family === "small" ? 130 : 130;

  if (errored) {
    const title = widget.addText("RSF CROWD METER");
    title.font = Font.boldSystemFont(16);
    title.textColor = COLORS.moderate;
    widget.addSpacer(6);
    const msg = widget.addText("Data unavailable — tap to open live meter");
    msg.font = Font.systemFont(12);
    msg.textColor = COLORS.dim;
    widget.url = "https://robsant523.github.io/RSF-Crowd-Meter/";
    widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
    return widget;
  }

  const s = statusFor(pct);
  const gaugeImg = drawGauge(imgSize, pct, s.color);

  if (family === "small") {
    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();

    const title = stack.addText("RSF CROWD METER");
    title.font = Font.boldSystemFont(11);
    title.textColor = COLORS.text;
    title.centerAlignText();
    stack.addSpacer(6);

    const imgStack = stack.addStack();
    imgStack.size = new Size(imgSize, imgSize);
    const img = imgStack.addImage(gaugeImg);
    img.imageSize = new Size(imgSize, imgSize);

    // overlay percentage text centered on the gauge using an underlying stack trick:
    // Scriptable doesn't support true overlays, so we place percentage below instead.
    stack.addSpacer(6);
    const pctText = stack.addText(`${Math.round(pct)}%`);
    pctText.font = Font.boldSystemFont(24);
    pctText.textColor = s.color;
    pctText.centerAlignText();

    const label = stack.addText(s.label);
    label.font = Font.systemFont(10);
    label.textColor = COLORS.dim;
    label.centerAlignText();
  } else {
    const row = widget.addStack();
    row.centerAlignContent();

    const imgStack = row.addStack();
    imgStack.size = new Size(imgSize, imgSize);
    const img = imgStack.addImage(gaugeImg);
    img.imageSize = new Size(imgSize, imgSize);

    row.addSpacer(14);

    const col = row.addStack();
    col.layoutVertically();

    const title = col.addText("RSF CROWD METER");
    title.font = Font.boldSystemFont(13);
    title.textColor = COLORS.text;
    col.addSpacer(6);

    const pctText = col.addText(`${Math.round(pct)}%`);
    pctText.font = Font.boldSystemFont(30);
    pctText.textColor = s.color;
    col.addSpacer(2);

    const label = col.addText(s.label);
    label.font = Font.systemFont(12);
    label.textColor = COLORS.dim;
    col.addSpacer(8);

    const countText = col.addText(`${count} people · cap 140`);
    countText.font = Font.systemFont(11);
    countText.textColor = COLORS.dim;
  }

  widget.addSpacer(3);
  const syncLabel = widget.addText(historyStatus);
  syncLabel.font = Font.systemFont(9);
  syncLabel.textColor = COLORS.dim;
  widget.url = "https://robsant523.github.io/RSF-Crowd-Meter/";
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  return widget;
}

const widget = await buildWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // running inside the Scriptable app — preview it
  await widget.presentSmall();
}
Script.complete();

