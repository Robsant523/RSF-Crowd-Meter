// RSF Setup — run this once
// Stores your GitHub personal access token securely in the iOS Keychain,
// so RSF Crowd (the widget) can push history updates to your repo.
// Save this named "RSF Setup" and run it once from inside the Scriptable app.

const RSFData = importModule("RSFData");

const ok = await RSFData.setGithubToken();
const a = new Alert();
if (ok) {
  try {
    const count = await RSFData.fetchCount();
    const entries = await RSFData.recordSample(count);
    const result = await RSFData.pushHistoryToGitHub(entries);
    a.title = result.ok ? "Collection verified" : "Saved locally; sync failed";
    a.message = result.ok
      ? `Recorded ${count} people and verified GitHub sync. iOS controls widget refresh timing; use the scheduled collector for ongoing history.`
      : result.error;
  } catch (e) {
    a.title = "Token saved; collection failed";
    a.message = String(e);
  }
} else {
  a.title = "Not saved";
  a.message = "No token was saved. Run this script again when you're ready.";
}
a.addAction("OK");
await a.presentAlert();
Script.complete();

