# RSF crowd meter — install as an app + phone widget with history

This is an installable web app (PWA) plus an iPhone home-screen widget. Both show live RSF weight room occupancy as a circular gauge, and the widget logs history that syncs to this website's History tab.

## 1. Push these files to your repo

```
git init
git add .
git commit -m "RSF crowd meter with history"
git branch -M main
git remote add origin https://github.com/Robsant523/RSF-Crowd-Meter.git
git push -u origin main
```

Then: Settings → Pages → Deploy from branch → `main` → `/ (root)`. Live at `https://robsant523.github.io/RSF-Crowd-Meter/`.

## 2. Create a GitHub token (lets the widget write history to your repo)

1. GitHub → your profile photo → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access** → Only select repositories → `RSF-Crowd-Meter`.
3. **Permissions** → Repository permissions → **Contents** → set to **Read and write**.
4. Generate, then copy the token — GitHub only shows it once.

## 3. Set up Scriptable on your iPhone

Install the free **Scriptable** app, then create three scripts (paste the matching file's contents into each, name them exactly as shown):

| Script name | File |
|---|---|
| `RSFData` | `RSFData.js` — shared module, not run directly |
| `RSF Crowd` | `rsf-crowd-meter-scriptable.js` — the widget |
| `RSF History` | `RSF-History.js` — local history viewer/chart |
| `RSF Setup` | `RSF-Setup.js` — run this once |

Run **RSF Setup** once and paste in the token from step 2 when prompted. It's stored in the iOS Keychain, not in the script text.

Then add the widget: long-press your home screen → **+** → **Scriptable** → small or medium → edit widget → set Script to `RSF Crowd`.

## 4. What happens automatically

Every time the widget refreshes (iOS decides the timing, roughly every 15–30+ min):
- It fetches the live count
- Appends it to a local history log on your phone
- Pushes the updated history to `history.json` in your GitHub repo

Your website's **History** tab reads that same `history.json` file, so it updates within a minute or two of each widget refresh (however long GitHub Pages takes to redeploy).

## 5. Installing the web app itself

**iPhone (Safari):** open your hosted URL → Share → "Add to Home Screen."
**Mac/Windows (Chrome/Edge):** open the URL → install icon in the address bar → "Install."

## About the data

Both the widget and the website call the same Density.io sensor feed Berkeley's own page uses, capped at 140 people = 100%. If that call is ever blocked, both fall back to a link to Berkeley's official page.

