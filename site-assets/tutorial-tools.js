/* Store only checklist booleans. No account data, free text, or analytics. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    var start = function () { api.mount(document, root); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
}(typeof window !== 'undefined' ? window : {}, function () {
  'use strict';
  function validState(raw, count) {
    try {
      var value = JSON.parse(raw);
      if (!Array.isArray(value) || value.length !== count || !value.every(function (v) { return typeof v === 'boolean'; })) return null;
      return value;
    } catch (_) { return null; }
  }
  function mount(doc, win) {
    doc.querySelectorAll('[data-workflow-checklist]').forEach(function (section) {
      var checks = Array.from(section.querySelectorAll('[data-workflow-check]'));
      var progress = section.querySelector('[data-workflow-progress]');
      var storageNote = section.querySelector('[data-workflow-storage]');
      var reset = section.querySelector('[data-workflow-reset]');
      var key = 'sih.workflow.' + section.dataset.workflowChecklist + '.' + section.dataset.checkVersion;
      var persistence = true;
      try {
        var raw = win.localStorage.getItem(key);
        var saved = validState(raw, checks.length);
        if (saved) saved.forEach(function (v, i) { checks[i].checked = v; });
        win.localStorage.setItem(key, JSON.stringify(checks.map(function (c) { return c.checked; })));
      } catch (_) { persistence = false; }
      function update() {
        progress.textContent = checks.filter(function (c) { return c.checked; }).length + ' of ' + checks.length + ' checks completed';
        storageNote.textContent = persistence ? 'Checkmarks are saved only in this browser. Clearing browser data removes them. A changed checklist starts fresh.' : 'Browser storage is unavailable. Checkmarks work during this visit but may be lost when you leave; download the kit to keep a copy.';
      }
      function save() {
        try { win.localStorage.setItem(key, JSON.stringify(checks.map(function (c) { return c.checked; }))); persistence = true; }
        catch (_) { persistence = false; }
        update();
      }
      checks.forEach(function (check) { check.addEventListener('change', save); });
      if (reset) {
        reset.hidden = false;
        reset.addEventListener('click', function () {
          if (checks.some(function (c) { return c.checked; }) && !win.confirm('Reset the checks for this guide on this browser?')) return;
          checks.forEach(function (c) { c.checked = false; });
          save();
        });
      }
      update();
    });
  }
  return { validState: validState, mount: mount };
}));
