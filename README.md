# RSF crowd meter — install as an app

This is a small installable web app (PWA) that shows live RSF weight room occupancy as a circular gauge.

## Why you need to host it (quick, free, 2 minutes)

Phones and laptops only let you "install" a web app if it's served over `https://`, not opened as a local file. Easiest free options:

**Option A — GitHub Pages**
1. Create a new GitHub repo, upload these 5 files (`index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`) to the root.
2. Repo Settings → Pages → Deploy from branch → `main` → `/ (root)`.
3. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

**Option B — Netlify Drop**
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page.
3. You instantly get a live `https://...netlify.app` URL — no account needed.

## Installing it

**iPhone (Safari):** open your hosted URL → Share button → "Add to Home Screen." It'll appear as a normal app icon and open full-screen.

**Android (Chrome):** open your hosted URL → menu (⋮) → "Install app" or "Add to Home screen."

**Mac/Windows (Chrome or Edge):** open your hosted URL → click the install icon (⊕ or a small monitor icon) in the address bar → "Install." It opens in its own window, pinnable to your dock/taskbar.

Once installed, the app updates its data live every 60 seconds whenever you open it, and caches the shell so it opens instantly even offline (though live counts obviously need a connection).

## About the data

It calls the same Density.io sensor feed the official Berkeley page uses, capped at 140 people = 100%. If that call ever gets blocked by CORS, the app falls back to a link straight to Berkeley's official live meter.
