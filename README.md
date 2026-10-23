# RSF Crowd Meter

A monochrome live gym meter with light/dark mode and weekday occupancy history. Collection runs on your own Mac, Linux computer, or Raspberry Pi using Python and cron. No Python packages, cloud collector, or phone widget are required.

## Collect on your computer

Install Python 3.9 or newer, then clone this repository after the changes are merged. Keep the checkout in a permanent folder, such as `/home/pi/RSF-Crowd-Meter` or `/Users/yourname/RSF-Crowd-Meter`.

```sh
python3 scripts/collect.py
```

Each successful run appends a UTC timestamp and nonnegative integer count to `local-data/occupancy.sqlite3`. It atomically exports the last 56 days to `data/history.json`, which the website already understands. The SQLite database keeps all observations; back it up if you want long-term history. Errors exit nonzero and never become fake zero readings. A failed export or upload does not discard the saved database reading. Failed uploads are caught up by the next successful run's full export.

Paths are resolved relative to the script's project directory, regardless of cron's working directory. Optional `--db` and `--output` flags accept alternate paths. Run `python3 scripts/collect.py --help` for options. The existing sensor share token is in `scripts/source.json`.

## Keep the hosted website updated (optional)

Local collection alone does **not** update GitHub Pages. To publish automatically:

1. Merge this project's changes first, so `data/history.json` exists on `main`.
2. Set repository Settings → Pages → Source to **GitHub Actions**. The included workflow only deploys after a push or manual run; it does not collect data.
3. Create a fine-grained GitHub token limited to this repository, with **Contents: read and write**. Repository rules must permit its commits to main.
4. Save the token in a private file **outside the repository**, for example `/home/pi/.config/rsf/github-token`. Restrict it with `chmod 600 /home/pi/.config/rsf/github-token`.
5. Test:

```sh
python3 scripts/collect.py --publish --token-file /home/pi/.config/rsf/github-token
```

Alternatively supply `RSF_GITHUB_TOKEN` in the process environment. Do not put a token in source code, crontab command text, or a public issue. Publishing updates only `data/history.json`; your user token's push triggers the deployment workflow. A valid sensor response is saved before publishing is attempted.

Use one collection computer/database as the source for this file. Starting with an empty database replaces the website export with that database's readings; it does not import old JSON history. Keep/move your SQLite database when replacing the computer. Historical phone readings remain separate in root `history.json` and are still readable by the website. The old Scriptable files are optional legacy clients, not required collectors.

## Schedule on Mac/Linux/Raspberry Pi

On the collection computer, run `command -v python3` to find its absolute Python path, and `pwd` inside the checkout to find the project path. Run the command manually once before scheduling it.

Open `crontab -e`, then add this line **with your actual paths**:

```cron
*/15 * * * * /usr/bin/python3 /home/pi/RSF-Crowd-Meter/scripts/collect.py --publish --token-file /home/pi/.config/rsf/github-token >> /home/pi/RSF-Crowd-Meter/collector.log 2>&1
```

For local-only storage, omit `--publish --token-file ...`. On a Mac, Python may be `/opt/homebrew/bin/python3` or another path; use `command -v python3`, not the example. Quote paths containing spaces. Cron treats `%` specially, so avoid that character in paths. Ensure the cron service is enabled on Linux and that the user can access the project files. No root cron job is needed.

Verify the entry with `crontab -l`, wait for the next quarter hour, then inspect `collector.log` and query the database:

```sh
sqlite3 /home/pi/RSF-Crowd-Meter/local-data/occupancy.sqlite3 'SELECT at, count FROM readings ORDER BY at DESC LIMIT 5;'
```

The sqlite3 command-line tool is optional; Python already includes the SQLite library used by the collector. Remove the line with `crontab -e` to stop. Rotate or occasionally clear the log so it does not grow forever.

Collection runs only while the computer is awake, online, and the scheduler is running. Missed runs are not backfilled. A Raspberry Pi or an old laptop kept awake can collect continuously. [Cron syntax reference](https://man7.org/linux/man-pages/man5/crontab.5.html).

## Windows alternative

In Task Scheduler, create a task with a daily trigger, repeating every 15 minutes indefinitely. Set Program to the full path of `python.exe`, Arguments to `"C:\RSF-Crowd-Meter\scripts\collect.py"` (plus optional `--publish --token-file "C:\private\github-token"`), and Start in to `C:\RSF-Crowd-Meter`. Choose “Do not start a new instance” if the task is already running. Configure the task to run under the account that owns the files; test with **Run** and check Last Run Result. [Microsoft Task Scheduler reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create).

## Website history

Weekday/hour averages use America/Los_Angeles time with each recorded date weighted equally. A dash means missing data; zero is a real reading. All hours are shown, including possible closed hours. Several weeks of samples are needed for useful comparisons. The live count and collection both depend on the upstream sensor remaining available.

## Tests

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
node scripts/test-history.cjs
node --test scripts/test-phone.cjs
```

The collector tests cover SQLite append behavior, UTC exports, retention, duplicate timestamps, invalid values, network failures, and persistence after export failures. Scheduling must be installed and verified on the collection computer; this repository does not install a cron job automatically.
