// RSF Setup — run this once
// Stores your GitHub personal access token securely in the iOS Keychain,
// so RSF Crowd (the widget) can push history updates to your repo.
// Save this named "RSF Setup" and run it once from inside the Scriptable app.

const RSFData = importModule("RSFData");

const ok = await RSFData.setGithubToken();
const a = new Alert();
if (ok) {
  a.title = "Saved";
  a.message = "Token stored. The RSF Crowd widget will now push history updates to GitHub every time it refreshes.";
} else {
  a.title = "Not saved";
  a.message = "No token was saved. Run this script again when you're ready.";
}
a.addAction("OK");
await a.presentAlert();
Script.complete();
