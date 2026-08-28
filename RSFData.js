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
  a.addTextField("ghp_... or github_pat_...");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  const result = await a.presentAlert();
  if (result === -1) return false;
  const token = a.textFieldValue(0).trim();
  if (!token) return false;
  Keychain.set(KEYCHAIN_KEY, token);
  return true;
}

// Pushes the full history array to history.json in the GitHub repo.
// Requires a token already stored via setGithubToken(). Silently no-ops if none is set,
// so the widget still works locally even before you've done the one-time setup.
async function pushHistoryToGitHub(history) {
  const token = getGithubToken();
  if (!token) return { skipped: true };

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "RSF-Crowd-Meter-Scriptable"
  };

  // Need the current file's SHA to update it (GitHub requires this to avoid overwriting blind).
  let sha = null;
  try {
    const getReq = new Request(apiUrl);
    getReq.headers = headers;
    const current = await getReq.loadJSON();
    sha = current.sha || null;
  } catch (e) {
    sha = null; // file may not exist yet — that's fine, it'll be created
  }

  const contentStr = JSON.stringify(history);
  const base64Content = Data.fromString(contentStr).toBase64String();

  const putReq = new Request(apiUrl);
  putReq.method = "PUT";
  putReq.headers = headers;
  const body = {
    message: `Update history — ${new Date().toISOString()}`,
    content: base64Content
  };
  if (sha) body.sha = sha;
  putReq.body = JSON.stringify(body);

  try {
    const res = await putReq.loadJSON();
    return { skipped: false, ok: !res.message || !res.message.includes("error"), raw: res };
  } catch (e) {
    return { skipped: false, ok: false, error: String(e) };
  }
}

function logPath() {
  const fm = FileManager.iCloud();
  const dir = fm.documentsDirectory();
  return fm.joinPath(dir, "rsf-history.json");
}

async function fetchCount() {
  const req = new Request(SPACE_URL);
  req.headers = { Authorization: "Bearer " + TOKEN };
  const json = await req.loadJSON();
  return json.count;
}

function loadHistory() {
  const fm = FileManager.iCloud();
  const path = logPath();
  if (!fm.fileExists(path)) return [];
  try {
    if (fm.isFileDownloaded(path) === false) fm.downloadFileFromiCloud(path);
    const raw = fm.readString(path);
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveHistory(entries) {
  const fm = FileManager.iCloud();
  const path = logPath();
  const trimmed = entries.slice(-MAX_ENTRIES);
  fm.writeString(path, JSON.stringify(trimmed));
  return trimmed;
}

// Call after a successful fetch — appends {t, count, pct} and persists it.
function recordSample(count) {
  const history = loadHistory();
  history.push({
    t: Date.now(),
    count: count,
    pct: Math.round((count / CAPACITY) * 1000) / 10
  });
  return saveHistory(history);
}

// Returns entries between two Date objects (inclusive), oldest first.
function historyBetween(startDate, endDate) {
  const all = loadHistory();
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  return all.filter((e) => e.t >= startMs && e.t <= endMs);
}

// Finds the logged entry closest to a given Date.
function nearestEntry(targetDate) {
  const all = loadHistory();
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
