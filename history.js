(function (root) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  function parts(date) {
    const p = Object.fromEntries(formatter.formatToParts(date).map(x => [x.type, x.value]));
    return { day: p.weekday, date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  }
  function valid(s) { return s && Number.isFinite(Date.parse(s.at)) && Number.isInteger(s.count) && s.count >= 0; }
  function summarize(samples, day, now = Date.now()) {
    const buckets = Array.from({ length: 24 }, () => new Map());
    const seen = new Set();
    for (const s of samples) {
      if (!valid(s)) continue;
      const t = Date.parse(s.at);
      if (t < now - 56 * 86400000 || t > now || seen.has(t)) continue;
      seen.add(t);
      const p = parts(new Date(t));
      if (p.day !== day) continue;
      const b = buckets[p.hour];
      const v = b.get(p.date) || { sum: 0, n: 0 };
      v.sum += s.count; v.n++; b.set(p.date, v);
    }
    return buckets.map((b, hour) => ({ hour, days: b.size, average: b.size ? [...b.values()].reduce((sum, v) => sum + v.sum / v.n, 0) / b.size : null }));
  }
  function normalize(data) {
    const raw = Array.isArray(data) ? data : data?.version === 1 ? data.samples : null;
    if (!Array.isArray(raw)) throw new Error('Invalid history');
    return raw.map(s => {
      const t = Array.isArray(data) ? s?.t : Date.parse(s?.at);
      if (!Number.isFinite(t) || !Number.isFinite(new Date(t).getTime()) || !Number.isInteger(s?.count) || s.count < 0) throw new Error('Invalid reading');
      return { t, count: s.count, pct: Math.round(s.count / 140 * 1000) / 10 };
    });
  }
  function merge(sources, now = Date.now()) {
    const samples = new Map();
    for (const s of sources.flat()) {
      if (s.t <= now && s.t >= now - 56 * 86400000) samples.set(s.t, s);
    }
    return [...samples.values()].sort((a, b) => a.t - b.t);
  }
  const api = { normalize, merge, days, parts, valid, summarize, hourLabel: h => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}` };
  if (typeof module !== 'undefined') module.exports = api;
  else root.RSFHistory = api;
})(typeof window === 'undefined' ? globalThis : window);
