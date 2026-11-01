/* Self-study controls. Store only enumerated answers, ratings, and checkmarks. */
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
  function evidenceIds(module) {
    var ids = module.passCriteria.map(function (_, i) { return 'c' + i; });
    (module.tracks || []).forEach(function (track) {
      track.passCriteria.forEach(function (_, i) { ids.push(track.id + ':c' + i); });
    });
    return ids;
  }
  function emptyState(path) {
    var state = { modules: {}, capstone: { scores: {}, failures: {}, noCritical: false, connected: false, reviewed: false } };
    path.modules.forEach(function (module) { state.modules[module.id] = { answers: {}, evidence: {}, track: '', checked: false }; });
    return state;
  }
  function validState(raw, path) {
    if (typeof raw !== 'string' || raw.length > 50000) return null;
    try {
      var value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !value.modules || !value.capstone) return null;
      var state = emptyState(path);
      path.modules.forEach(function (module) {
        var from = value.modules[module.id];
        if (!from || typeof from !== 'object') return;
        var to = state.modules[module.id];
        module.knowledgeChecks.forEach(function (q) {
          var answer = from.answers && from.answers[q.id];
          if (q.choices.some(function (c) { return c.id === answer; })) to.answers[q.id] = answer;
        });
        evidenceIds(module).forEach(function (id) { to.evidence[id] = !!(from.evidence && from.evidence[id] === true); });
        if ((module.tracks || []).some(function (t) { return t.id === from.track; })) to.track = from.track;
        to.checked = from.checked === true;
      });
      path.capstone.rubric.forEach(function (criterion) {
        var score = value.capstone.scores && value.capstone.scores[criterion.id];
        if (typeof score === 'string' && Object.prototype.hasOwnProperty.call(criterion.scores, score)) state.capstone.scores[criterion.id] = score;
      });
      path.capstone.criticalFailures.forEach(function (_, i) { state.capstone.failures['f' + i] = !!(value.capstone.failures && value.capstone.failures['f' + i] === true); });
      ['noCritical', 'connected', 'reviewed'].forEach(function (key) { state.capstone[key] = value.capstone[key] === true; });
      return state;
    } catch (_) { return null; }
  }
  function assessCapstone(capstone, state) {
    state = state || {};
    var missing = [], zeros = [], score = 0;
    capstone.rubric.forEach(function (criterion) {
      var selected = state.scores && state.scores[criterion.id];
      if (typeof selected !== 'string' || !Object.prototype.hasOwnProperty.call(criterion.scores, selected)) { missing.push(criterion.title); return; }
      var points = Number(selected);
      score += points;
      if (points < capstone.minimumPerCriterion) zeros.push(criterion.title);
    });
    var failures = capstone.criticalFailures.filter(function (_, i) { return state.failures && state.failures['f' + i] === true; });
    var reviewedFailures = state.noCritical === true || failures.length > 0;
    var contradiction = state.noCritical === true && failures.length > 0;
    var connectedConflict = state.connected === true && (!state.scores || state.scores.operation !== '2');
    var requirementsMet = missing.length === 0 && score >= capstone.minimumScore && zeros.length === 0 && failures.length === 0 && reviewedFailures && !contradiction && !connectedConflict;
    var outcome = missing.length || !reviewedFailures || contradiction || connectedConflict ? 'incomplete' : failures.length ? 'stop' : !requirementsMet ? 'revise' : state.connected === true ? 'ready' : 'practice';
    return { score: score, maximum: capstone.maximumScore, missing: missing, zeros: zeros, failures: failures, contradiction: contradiction, connectedConflict: connectedConflict, reviewedFailures: reviewedFailures, requirementsMet: requirementsMet, outcome: outcome };
  }
  function assessModule(module, state, capstoneResult) {
    state = state || { answers: {}, evidence: {} };
    var answered = 0, correct = 0;
    module.knowledgeChecks.forEach(function (q) {
      var answer = state.answers && state.answers[q.id];
      if (q.choices.some(function (c) { return c.id === answer; })) answered++;
      if (answer === q.answerId) correct++;
    });
    var required = module.passCriteria.map(function (_, i) { return 'c' + i; });
    var track = (module.tracks || []).find(function (t) { return t.id === state.track; });
    if (track) track.passCriteria.forEach(function (_, i) { required.push(track.id + ':c' + i); });
    var trackChosen = !module.tracks || module.tracks.length === 0 || !!track;
    var evidenceMet = trackChosen && required.every(function (id) { return state.evidence && state.evidence[id] === true; });
    var quizMet = state.checked === true && correct === module.knowledgeChecks.length;
    var rubricMet = module.id !== 'capstone' || !!(capstoneResult && capstoneResult.requirementsMet && capstoneResult.reviewed);
    return { answered: answered, correct: correct, total: module.knowledgeChecks.length, trackChosen: trackChosen, evidenceMet: evidenceMet, quizMet: quizMet, rubricMet: rubricMet, complete: evidenceMet && quizMet && rubricMet };
  }
  function mount(doc, win) {
    var root = doc.querySelector('[data-learning-path]');
    var script = doc.getElementById('learning-path-data');
    if (!root || !script) return;
    var path;
    try { path = JSON.parse(script.textContent); } catch (_) { return; }
    var storageKey = 'sih.learning.' + root.dataset.learningPath + '.' + root.dataset.learningVersion;
    var state = emptyState(path), persistence = true;
    try { state = validState(win.localStorage.getItem(storageKey), path) || state; win.localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_) { persistence = false; }
    function persist() {
      try { win.localStorage.setItem(storageKey, JSON.stringify(state)); persistence = true; }
      catch (_) { persistence = false; }
    }
    function renderCapstone() {
      var box = root.querySelector('[data-capstone-result]');
      var result = assessCapstone(path.capstone, state.capstone);
      result.reviewed = state.capstone.reviewed;
      path.capstone.rubric.forEach(function (criterion) {
        var selected = state.capstone.scores[criterion.id];
        var printValue = root.querySelector('[data-rubric-print="' + criterion.id + '"]');
        if (printValue) printValue.textContent = selected && criterion.scores[selected] ? selected + ' — ' + criterion.scores[selected] : 'Not yet scored.';
      });
      if (!state.capstone.reviewed) {
        box.dataset.outcome = 'incomplete';
        box.querySelector('h3').textContent = 'Choose evidence levels to review your decision.';
        box.querySelector('p').textContent = 'This self-review does not inspect your accounts or certify a live system.';
        return result;
      }
      var titles = { incomplete: 'Complete the evidence review.', stop: 'Stop and correct the critical failure.', revise: 'Revise the evidence before a pilot.', practice: 'Practice evidence meets the rubric; connected tests remain.', ready: 'Self-review supports considering a controlled pilot.' };
      var detail = [];
      if (result.missing.length) detail.push('Choose a score for: ' + result.missing.join('; ') + '.');
      else detail.push('Your self-assessed score: ' + result.score + ' of ' + result.maximum + '.');
      if (result.contradiction) detail.push('You selected an unresolved failure and also said none remains. Resolve that contradiction.');
      if (result.connectedConflict) detail.push('The connected-test confirmation conflicts with your Delivery and recovery rating. A connected pilot needs level 2 with dated observed tests; otherwise leave connected tests pending.');
      if (!result.reviewedFailures) detail.push('Review the five critical failures and explicitly confirm their status.');
      if (result.failures.length) detail.push(result.failures.length + ' critical failure(s) remain. Fix them and repeat the affected tests before a pilot.');
      if (result.zeros.length) detail.push('These criteria are below the minimum: ' + result.zeros.join('; ') + '.');
      if (result.outcome === 'revise') detail.push('The rubric requires at least ' + path.capstone.minimumScore + '/' + result.maximum + ', no zero, and no critical failure.');
      if (result.outcome === 'practice') detail.push('Keep the decision as practice complete or revise. Do not launch based only on simulations or reference answers.');
      if (result.outcome === 'ready') detail.push('This uses your answers, not an inspection of your accounts. The owner must check the evidence, limit the pilot, and monitor the stop conditions. It is not a certificate or a guaranteed outcome.');
      box.dataset.outcome = result.outcome;
      box.querySelector('h3').textContent = titles[result.outcome];
      box.querySelector('p').textContent = detail.join(' ');
      return result;
    }
    function render() {
      var capstoneResult = renderCapstone(), completed = 0;
      path.modules.forEach(function (module) {
        var moduleState = state.modules[module.id];
        var section = root.querySelector('[data-learning-module="' + module.id + '"]');
        var result = assessModule(module, moduleState, capstoneResult);
        if (result.complete) completed++;
        section.classList.toggle('is-complete', result.complete);
        section.querySelector('[data-module-status]').textContent = result.complete ? '· Self-checked' : '· Not yet self-checked';
        var status = section.querySelector('[data-quiz-status]');
        var message = 'Answer both questions, then check your answers.';
        if (moduleState.checked) {
          message = result.correct + ' of ' + result.total + ' answers correct. ';
          if (result.answered < result.total) message += 'Answer every question and check again. ';
          else if (!result.quizMet) message += 'Read the explanations, revise your answers, and try again. ';
          if (result.quizMet && !result.trackChosen) message += 'Choose a track and verify its evidence. ';
          else if (result.quizMet && !result.evidenceMet) message += 'Verify every required evidence statement to self-check this module. ';
          else if (result.quizMet && !result.rubricMet) message += 'Complete the capstone rubric below; missing evidence cannot be marked passed. ';
          else if (result.complete) message += 'This module is self-checked. Keep your underlying evidence; this is not independently verified.';
        }
        status.textContent = message;
        module.knowledgeChecks.forEach(function (q) {
          var feedback = section.querySelector('[data-question-feedback="' + q.id + '"]');
          var answer = moduleState.answers[q.id];
          feedback.hidden = !moduleState.checked;
          feedback.classList.toggle('is-correct', answer === q.answerId);
          feedback.textContent = !answer ? 'Choose an answer before checking this question.' : (answer === q.answerId ? 'Correct. ' : 'Revisit this. ') + q.explanation;
        });
      });
      root.querySelector('[data-learning-progress]').textContent = completed + ' of ' + path.modules.length + ' modules self-checked';
      root.querySelector('progress').value = completed;
      root.querySelector('[data-learning-storage]').textContent = persistence ? 'Only your choices and checkmarks are saved in this browser. A curriculum revision starts a fresh record. Keep project evidence in your own files.' : 'Browser storage is unavailable. These controls work for this visit; print or download the portfolio to keep your work.';
    }
    function restoreControls() {
      path.modules.forEach(function (module) {
        var section = root.querySelector('[data-learning-module="' + module.id + '"]');
        var ms = state.modules[module.id];
        section.querySelectorAll('input[type=radio]').forEach(function (input) { input.checked = ms.answers[input.name] === input.value; });
        section.querySelectorAll('[data-learning-evidence]').forEach(function (input) { input.checked = ms.evidence[input.dataset.evidenceId] === true; });
        var track = section.querySelector('[data-learning-track]');
        if (track) track.value = ms.track;
      });
      root.querySelectorAll('[data-rubric-score]').forEach(function (select) { select.value = state.capstone.scores[select.dataset.rubricScore] || ''; });
      root.querySelectorAll('[data-critical-failure]').forEach(function (input) { input.checked = state.capstone.failures[input.dataset.criticalFailure] === true; });
      root.querySelector('[data-no-critical]').checked = state.capstone.noCritical;
      root.querySelector('[data-connected-tests]').checked = state.capstone.connected;
    }
    path.modules.forEach(function (module) {
      var section = root.querySelector('[data-learning-module="' + module.id + '"]');
      section.querySelectorAll('input[type=radio]').forEach(function (input) {
        input.addEventListener('change', function () { state.modules[module.id].answers[input.name] = input.value; state.modules[module.id].checked = false; persist(); render(); });
      });
      section.querySelectorAll('[data-learning-evidence]').forEach(function (input) {
        input.addEventListener('change', function () { state.modules[module.id].evidence[input.dataset.evidenceId] = input.checked; persist(); render(); });
      });
      var track = section.querySelector('[data-learning-track]');
      if (track) track.addEventListener('change', function () { state.modules[module.id].track = track.value; persist(); render(); });
      section.querySelector('form').addEventListener('submit', function (event) { event.preventDefault(); state.modules[module.id].checked = true; persist(); render(); });
    });
    var capstoneForm = root.querySelector('[data-capstone-form]');
    capstoneForm.addEventListener('change', function (event) {
      var input = event.target;
      if (input.matches('[data-rubric-score]')) state.capstone.scores[input.dataset.rubricScore] = input.value;
      if (input.matches('[data-critical-failure]')) {
        state.capstone.failures[input.dataset.criticalFailure] = input.checked;
        if (input.checked) { state.capstone.noCritical = false; root.querySelector('[data-no-critical]').checked = false; }
      }
      if (input.matches('[data-no-critical]')) state.capstone.noCritical = input.checked;
      if (input.matches('[data-connected-tests]')) state.capstone.connected = input.checked;
      state.capstone.reviewed = false;
      persist(); render();
    });
    capstoneForm.addEventListener('submit', function (event) { event.preventDefault(); state.capstone.reviewed = true; persist(); render(); });
    var reset = root.querySelector('[data-learning-reset]');
    reset.hidden = false;
    reset.addEventListener('click', function () {
      if (!win.confirm('Reset this learning record on this browser? Your downloaded project files will not change.')) return;
      state = emptyState(path); restoreControls(); persist(); render();
    });
    var printDetails = [];
    if (win.addEventListener) {
      win.addEventListener('beforeprint', function () {
        printDetails = Array.from(root.querySelectorAll('details')).map(function (detail) { var previous = detail.open; detail.open = true; return [detail, previous]; });
      });
      win.addEventListener('afterprint', function () { printDetails.forEach(function (entry) { entry[0].open = entry[1]; }); printDetails = []; });
    }
    restoreControls(); render();
  }
  return { evidenceIds: evidenceIds, emptyState: emptyState, validState: validState, assessModule: assessModule, assessCapstone: assessCapstone, mount: mount };
}));
