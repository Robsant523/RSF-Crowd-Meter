# RSF crowd meter — live occupancy and shared history

The History tab combines automatic readings with optional iPhone widget readings. Choose a weekday to compare hourly averages over the last eight weeks, then use the existing recent-readings chart and time lookup.

## Enable collection

1. Merge the history changes into `main`.
2. In Settings → Pages, change Source to **GitHub Actions**.
3. Open Actions → **Collect history and deploy** → Run workflow on `main`.
4. Check that collection, history commit, and Pages deployment succeed.

The workflow requests repository Contents write access and Pages deployment permissions. Repository policy and branch protection must permit the automated history commits. It samples approximately every 15 minutes. GitHub schedules may be delayed or disabled after inactivity; check Actions when collection is behind. See [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Automatic readings are retained for 56 days in `data/history.json`. Widget uploads continue to use the original root `history.json`, so an older phone log cannot overwrite the automatic dataset. No private GitHub token is needed for the scheduled collector. The existing Density share token is used; do not replace this public token with a private API key.

## Understanding history

Hourly averages use Berkeley time (America/Los_Angeles), including daylight saving changes. Each recorded date has equal weight, even when one date has more samples. The chart shows the number of dates behind every hour. A dash means no data; zero means a real zero count. All hours are shown, including potentially closed hours: confirm opening times on the official RecWell page. A single date is an early reading, not an established pattern. Collection starts when enabled; there is no fabricated backfill.

The recent chart uses Pacific time. The date/time lookup explicitly uses your device's local time. History refreshes every five minutes. Failed or partial loads are identified and previously loaded history is retained when both sources fail. Both sources are validated and duplicate timestamps are removed. The recent summary is a sample average; the weekday view weights dates equally.

## Verification

```sh
node scripts/test-history.cjs
python3 -m unittest discover -s scripts -p 'test_*.py'
```

The collector only writes successful, nonnegative integer readings and retains existing history on request/validation failure. Its file replacement is atomic. The workflow deploys existing data if collection fails and then reports a failed run so the outage is visible.

## Optional iPhone widget

The existing Scriptable files and local viewer still work. Widget sync is optional and is separate from the automatic collector. Follow these instructions only if you also want your phone's observations in the website history:

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


## Install the web app

Open the HTTPS Pages URL. On iPhone: Safari → Share → Add to Home Screen. On desktop: the browser's install option. Live counts still depend on upstream sensor availability and browser CORS. React, Babel, Chart.js and fonts remain externally hosted, so a cold offline launch is not guaranteed.
