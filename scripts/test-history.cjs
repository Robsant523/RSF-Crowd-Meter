const assert = require('node:assert/strict');
const H = require('../history.js');
const now = Date.parse('2026-10-20T00:00:00Z');
const samples = [
  {at:'2026-10-19T17:07:00Z',count:20},
  {at:'2026-10-19T17:22:00Z',count:40},
  {at:'2026-10-12T17:07:00Z',count:90},
  {at:'2026-10-12T17:07:00Z',count:90},
  {at:'2026-10-19T18:07:00Z',count:0},
  {at:'2026-01-05T18:07:00Z',count:100},
  {at:'2026-10-26T17:07:00Z',count:100},
  {at:'invalid',count:100},
  {at:'2026-10-19T19:07:00Z',count:null}
];
const hours = H.summarize(samples,'Mon',now);
assert.equal(hours[10].average,60);
assert.equal(hours[10].days,2);
assert.equal(hours[11].average,0);
assert.equal(hours[12].average,null);
assert.equal(H.summarize(samples,'Tue',now)[10].days,0);
assert.equal(H.parts(new Date('2026-10-19T06:30:00Z')).day,'Sun');
assert.equal(H.parts(new Date('2026-11-01T08:30:00Z')).hour,1);
assert.equal(H.parts(new Date('2026-11-01T09:30:00Z')).hour,1);
assert.equal(H.parts(new Date('2026-10-19T07:00:00Z')).hour,0);
console.log('History tests passed: daily weighting, duplicates, zero/missing, retention, invalid/future data, Pacific date and DST.');
const widget = H.normalize([{t: now - 1000, count: 70, pct: 999}]);
const collector = H.normalize({version: 1, samples: [{at: new Date(now - 1000).toISOString(), count: 70}, {at: new Date(now - 2000).toISOString(), count: 0}]});
assert.equal(widget[0].pct, 50);
assert.equal(H.merge([widget, collector], now).length, 2);
assert.equal(H.merge([widget, collector], now)[0].count, 0);
assert.throws(() => H.normalize({samples: []}));
assert.throws(() => H.normalize([{t: now, count: null}]));
assert.deepEqual(H.normalize([]), []);
console.log('Source compatibility tests passed.');
