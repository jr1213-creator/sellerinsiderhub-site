/* The guide planner stays on this page; only checklist booleans are saved. */
(function () {
  'use strict';

  function initializeGuide() {
    var form = document.getElementById('social-route-form');
    var goal = document.getElementById('social-goal');
    var result = document.getElementById('social-route-result');
    var routes = {
      chat: {
        title: 'Create through chat; publish through Buffer.',
        text: 'Prepare your campaign brief, then connect Buffer and verify that your chat account can save one unscheduled draft. If that action is unavailable, use Buffer’s own composer. Review the saved content before scheduling, and add an Instagram reply flow only when you need it.'
      },
      dashboard: {
        title: 'Start with one social dashboard.',
        text: 'Evaluate Metricool’s planning and supported reply workflows together. Check the plan, account type, and message limits, then test one Instagram Flow. A simple guide-delivery journey may fit this setup without a separate reply platform.'
      },
      instagram: {
        title: 'Build one useful Instagram conversation.',
        text: 'Start with a Manychat flow for a specific inbound trigger and an approved response. Test the keyword, resource link, and human handoff before activating it. Add a publishing tool when you also need scheduled posts across channels.'
      },
      budget: {
        title: 'Use what you already have first.',
        text: 'Prepare the campaign in your existing AI tool and use Buffer’s free plan when its channel and queue limits fit. Review and schedule directly in Buffer. Handle replies in the social app until a repeated task justifies automation, then check the full cost before upgrading.'
      }
    };

    if (form && goal && result) {
      result.setAttribute('role', 'status');
      result.setAttribute('aria-live', 'polite');
      result.setAttribute('aria-atomic', 'true');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var route = routes[goal.value];
        if (!route) return;
        var title = document.createElement('strong');
        var description = document.createElement('p');
        title.textContent = route.title;
        description.textContent = route.text;
        result.replaceChildren(title, description);
      });
    }

    var list = document.getElementById('social-launch-checklist');
    if (!list) return;
    var checks = Array.from(list.querySelectorAll('input[type="checkbox"][data-check-id]'));
    var progress = document.getElementById('social-check-progress');
    var reset = document.getElementById('social-reset-checks');
    var storageKey = 'sih.social-guide-checks.v1';
    var saved = null;

    try {
      saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    } catch (error) {
      /* The checklist remains usable when storage is unavailable or malformed. */
    }

    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      checks.forEach(function (input) {
        var id = input.dataset.checkId;
        if (Object.prototype.hasOwnProperty.call(saved, id) && typeof saved[id] === 'boolean') {
          input.checked = saved[id];
        }
      });
    }

    function updateProgress() {
      var completed = 0;
      checks.forEach(function (input) {
        if (input.checked) completed += 1;
        var row = input.closest('li') || input.closest('label');
        if (row) row.classList.toggle('is-checked', input.checked);
      });
      if (progress) progress.textContent = completed + '/' + checks.length + ' checked';
    }

    if (progress) {
      progress.setAttribute('role', 'status');
      progress.setAttribute('aria-live', 'polite');
      progress.setAttribute('aria-atomic', 'true');
    }

    checks.forEach(function (input) {
      input.addEventListener('change', function () {
        var state = Object.create(null);
        checks.forEach(function (check) {
          if (check.dataset.checkId) state[check.dataset.checkId] = check.checked;
        });
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
          /* No storage is required to use the checklist during this visit. */
        }
        updateProgress();
      });
    });

    if (reset) {
      reset.addEventListener('click', function (event) {
        event.preventDefault();
        checks.forEach(function (input) { input.checked = false; });
        try {
          window.localStorage.removeItem(storageKey);
        } catch (error) {
          /* Reset the visible checklist even when browser storage is blocked. */
        }
        updateProgress();
      });
    }
    updateProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGuide, { once: true });
  } else {
    initializeGuide();
  }
}());
