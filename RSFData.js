// RSFData.js — shared module for RSF Crowd Meter scripts.
// Save this in Scriptable named exactly "RSFData" (no .js needed in the app).
// Both "RSF Crowd" (the widget) and "RSF History" (the viewer) import this.

const SPACE_URL = "https://api.density.io/v2/spaces/spc_863128347956216317/count";
const TOKEN = "shr_o69HxjQ0BYrY2FPD9HxdirhJYcFDCeRolEd744Uj88e";
const CAPACITY = 140;
const MAX_ENTRIES = 5000; // roughly months of widget-refresh-rate samples

// --- GitHub sync config ---
const GITHUB_OWNER = "Robsant523";
const GITHUB_REPO = "RSF-Crowd-Meter";
const GITHUB_FILE_PATH = "history.json";
const KEYCHAIN_KEY = "rsf_github_pat";

function getGithubToken() {
  if (Keychain.contains(KEYCHAIN_KEY)) return Keychain.get(KEYCHAIN_KEY);
  return null;
}

// Run this once (from any script) to store your token securely on-device.
async function setGithubToken() {
  const a = new Alert();
  a.title = "GitHub token";
  a.message = "Paste your fine-grained personal access token (Contents: read/write on RSF-Crowd-Meter only).";
  a.addSecureTextField("ghp_... or github_pat_...");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  const result = await a.presentAlert();
  if (result === -1) return false;
  const token = a.textFieldValue(0).trim();
  if (!token) return false;
  Keychain.set(KEYCHAIN_KEY, token);
  return true;
}

// Validate and merge without discarding observations from other devices.
function mergeHistory(...sources) {
  const entries = new Map();
  for (const source of sources) {
    if (!Array.isArray(source)) throw new Error("History must be an array; existing file was not replaced.");
    for (const e of source) {
      if (!e || !Number.isFinite(e.t) || !Number.isInteger(e.count) || e.count < 0)
        throw new Error("Invalid history entry; existing file was not replaced.");
      entries.set(e.t, { t: e.t, count: e.count, pct: Math.round(e.count / CAPACITY * 1000) / 10 });
    }
  }
  return [...entries.values()].sort((a, b) => a.t - b.t).slice(-MAX_ENTRIES);
}

async function githubRequest(url, token, body) {
  const req = new Request(url);
  req.timeoutInterval = 15;
  req.headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
    "Content-Type": "application/json", "User-Agent": "RSF-Crowd-Meter-Scriptable" };
  if (body) { req.method = "PUT"; req.body = JSON.stringify(body); }
  const text = await req.loadString();
  const status = req.response.statusCode;
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error(`GitHub returned invalid JSON (HTTP ${status}).`); }
  return { status, data };
}

async function pushHistoryToGitHub(history) {
  const token = getGithubToken();
  if (!token) return { skipped: true, ok: false, error: "Sync not configured. Run RSF Setup." };
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  try {
    const local = mergeHistory(history);
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await githubRequest(url + "?ref=main", token);
      // Never interpret a failed read as an empty remote history.
      if (current.status !== 200) throw new Error(`GitHub read failed (HTTP ${current.status}). Check token, repository access and history.json on main.`);
      if (!current.data.sha || current.data.encoding !== "base64" || typeof current.data.content !== "string")
        throw new Error("GitHub history response was incomplete.");
      const remote = JSON.parse(Data.fromBase64String(current.data.content.replace(/\s/g, "")).toRawString());
      const merged = mergeHistory(remote, local);
      if (JSON.stringify(merged) === JSON.stringify(remote)) return { ok: true, skipped: false, count: merged.length };
      const result = await githubRequest(url, token, {
        message: "Record phone occupancy readings", branch: "main", sha: current.data.sha,
        content: Data.fromString(JSON.stringify(merged)).toBase64String()
      });
      if (result.status === 409) continue; // Re-read and merge against the new SHA.
      if (![200, 201].includes(result.status) || !result.data.commit?.sha)
        throw new Error(`GitHub upload failed (HTTP ${result.status}). Check Contents write permission, token expiry and branch rules.`);
      return { ok: true, skipped: false, count: merged.length };
    }
    throw new Error("GitHub changed during all three upload attempts. Local readings are saved; retry later.");
  } catch (e) { return { skipped: false, ok: false, error: String(e) }; }
}

function logPath() {
  const fm = FileManager.iCloud();
  const dir = fm.documentsDirectory();
  return fm.joinPath(dir, "rsf-history.json");
}

async function fetchCount() {
  const req = new Request(SPACE_URL);
  req.headers = { Authorization: "Bearer " + TOKEN };
  req.timeoutInterval = 15;
  const json = await req.loadJSON();
  if (req.response.statusCode !== 200 || !Number.isInteger(json.count) || json.count < 0)
    throw new Error(`Invalid sensor response (HTTP ${req.response.statusCode}).`);
  return json.count;
}

async function loadHistory() {
  const fm = FileManager.iCloud();
  const path = logPath();
  if (!fm.fileExists(path)) return [];
  await fm.downloadFileFromiCloud(path);
  // Propagate read/parse errors so recordSample cannot overwrite a failed read.
  return mergeHistory(JSON.parse(fm.readString(path)));
}

function saveHistory(entries) {
  const fm = FileManager.iCloud();
  const path = logPath();
  const trimmed = mergeHistory(entries);
  fm.writeString(path, JSON.stringify(trimmed));
  return trimmed;
}

// Call after a successful fetch — appends {t, count, pct} and persists it.
async function recordSample(count) {
  if (!Number.isInteger(count) || count < 0) throw new Error("Invalid sensor count");
  const history = await loadHistory();
  history.push({
    t: Date.now(),
    count: count,
    pct: Math.round((count / CAPACITY) * 1000) / 10
  });
  return saveHistory(history);
}

// Returns entries between two Date objects (inclusive), oldest first.
async function historyBetween(startDate, endDate) {
  const all = await loadHistory();
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  return all.filter((e) => e.t >= startMs && e.t <= endMs);
}

// Finds the logged entry closest to a given Date.
async function nearestEntry(targetDate) {
  const all = await loadHistory();
  if (all.length === 0) return null;
  const targetMs = targetDate.getTime();
  let best = all[0];
  let bestDiff = Math.abs(all[0].t - targetMs);
  for (const e of all) {
    const diff = Math.abs(e.t - targetMs);
    if (diff < bestDiff) {
      best = e;
      bestDiff = diff;
    }
  }
  return { entry: best, diffMinutes: Math.round(bestDiff / 60000) };
}

module.exports = {
  CAPACITY,
  mergeHistory,
  fetchCount,
  loadHistory,
  saveHistory,
  recordSample,
  historyBetween,
  nearestEntry,
  logPath,
  setGithubToken,
  pushHistoryToGitHub
};

