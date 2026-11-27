// Simulasi minimal lingkungan Google Apps Script untuk menguji Code.gs
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');

function makeSheet(name) {
  const data = []; // array of rows (arrays)
  let maxRows = 1000;
  const sh = {
    name, data,
    getName: () => name,
    getLastRow: () => data.length,
    getMaxRows: () => Math.max(maxRows, data.length),
    setFrozenRows: () => sh,
    appendRow: (r) => { data.push(r.slice()); return sh; },
    deleteRow: (r) => { data.splice(r - 1, 1); },
    getRange: (r, c, nr, nc) => {
      nr = nr || 1; nc = nc || 1;
      const rg = {
        getValues: () => { const out = []; for (let i = 0; i < nr; i++) { const row = data[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(o); } return out; },
        setValues: (v) => { for (let i = 0; i < nr; i++) { while (data.length < r + i) data.push([]); const row = data[r - 1 + i]; for (let j = 0; j < nc; j++) row[c - 1 + j] = v[i][j]; } return rg; },
        setNumberFormat: () => rg, setFontWeight: () => rg, setBackground: () => rg, setFontColor: () => rg
      };
      return rg;
    }
  };
  return sh;
}

function createGas(codePath) {
  const sheets = [makeSheet('Sheet1')];
  const ss = {
    getSheetByName: (n) => sheets.find(s => s.name === n) || null,
    insertSheet: (n) => { const s = makeSheet(n); sheets.push(s); return s; },
    getSheets: () => sheets,
    deleteSheet: (s) => { sheets.splice(sheets.indexOf(s), 1); }
  };
  const cache = {}, props = {};
  const pad = (n) => String(n).padStart(2, '0');
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const x = new Date(d.getTime() + 8 * 3600 * 1000); // WITA
        return fmt.replace('yyyy', x.getUTCFullYear()).replace('MM', pad(x.getUTCMonth() + 1)).replace('dd', pad(x.getUTCDate()))
          .replace('HH', pad(x.getUTCHours())).replace('mm', pad(x.getUTCMinutes())).replace('ss', pad(x.getUTCSeconds()));
      },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' }
    },
    CacheService: { getScriptCache: () => ({ put: (k, v) => (cache[k] = v), get: (k) => (k in cache ? cache[k] : null), remove: (k) => delete cache[k] }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { }, releaseLock: () => { } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => (props[k] = v) }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => { }, newTrigger: () => { const t = { timeBased: () => t, everyDays: () => t, atHour: () => t, nearMinute: () => t, inTimezone: () => t, create: () => t }; return t; } },
    HtmlService: {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx, { filename: 'Code.gs' });
  return {
    ctx, ss,
    call: (fn, args) => { vm.runInContext('_cache = {};', ctx); return JSON.parse(JSON.stringify(ctx[fn].apply(null, args || []))); },
    run: (code) => vm.runInContext(code, ctx)
  };
}

function buildPage(dir) {
  let html = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8');
  html = html.replace(/<\?!=\s*include\('(\w+)'\);\s*\?>/g, (m, n) => fs.readFileSync(path.join(dir, n + '.html'), 'utf8'));
  const shim = `<script>
  window.google = { script: { run: new Proxy({}, { get: function (t, fn) {
    var ok = function(){}, fail = function(){};
    var o = { withSuccessHandler: function (f) { ok = f; return p; }, withFailureHandler: function (f) { fail = f; return p; } };
    var p = new Proxy(o, { get: function (t2, k) { if (k in t2) return t2[k]; return function () { var a = Array.prototype.slice.call(arguments); window.__gas(k, a).then(function (r) { setTimeout(function(){ ok(r); }, 30); }, function (e) { fail(new Error(String(e))); }); }; } });
    if (fn === 'withSuccessHandler' || fn === 'withFailureHandler') return p[fn];
    return p[fn];
  } }) } };
  </script>`;
  return html.replace('<head>', '<head>' + shim);
}

module.exports = { createGas, buildPage };
