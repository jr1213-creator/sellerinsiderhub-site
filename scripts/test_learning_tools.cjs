'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../site-assets/learning-tools.js');
const curriculum = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/learning-paths.json'), 'utf8'));
const moduleById = id => curriculum.modules.find(module => module.id === id);
function completedState(module) {
  const state = engine.emptyState(curriculum).modules[module.id];
  for (const question of module.knowledgeChecks) state.answers[question.id] = question.answerId;
  for (const id of engine.evidenceIds(module)) state.evidence[id] = true;
  state.checked = true;
  if (module.tracks) state.track = module.tracks[0].id;
  return state;
}
function strongCapstone() {
  return { scores: Object.fromEntries(curriculum.capstone.rubric.map(c => [c.id, '2'])), failures: {}, noCritical: true, connected: true, reviewed: true };
}

test('opening the course and reading answers cannot complete any module', () => {
  const state = engine.emptyState(curriculum);
  for (const module of curriculum.modules) assert.equal(engine.assessModule(module, state.modules[module.id]).complete, false);
});
test('correct quiz answers require both an explicit check and underlying evidence', () => {
  const module = moduleById('business-brief'), state = completedState(module);
  assert.equal(engine.assessModule(module, state).complete, true);
  state.checked = false;
  assert.equal(engine.assessModule(module, state).complete, false);
  state.checked = true; state.evidence.c0 = false;
  assert.equal(engine.assessModule(module, state).complete, false);
});
test('a wrong or unanswered question cannot be hidden by checked evidence', () => {
  const module = moduleById('sales-analysis'), state = completedState(module);
  const question = module.knowledgeChecks[0];
  state.answers[question.id] = question.choices.find(c => c.id !== question.answerId).id;
  assert.equal(engine.assessModule(module, state).complete, false);
  delete state.answers[question.id];
  assert.equal(engine.assessModule(module, state).answered, 1);
  assert.equal(engine.assessModule(module, state).complete, false);
});
test('only the explicitly chosen acquisition track can satisfy its evidence gate', () => {
  const module = moduleById('customer-workflow'), state = completedState(module);
  const first = module.tracks[0], second = module.tracks[1];
  for (let i = 0; i < second.passCriteria.length; i++) state.evidence[second.id + ':c' + i] = false;
  assert.equal(engine.assessModule(module, state).complete, true);
  state.track = second.id;
  assert.equal(engine.assessModule(module, state).complete, false);
  state.track = '';
  assert.equal(engine.assessModule(module, state).trackChosen, false);
});
test('a perfect score cannot outweigh a critical failure', () => {
  const state = strongCapstone();
  state.failures.f0 = true; state.noCritical = false;
  const result = engine.assessCapstone(curriculum.capstone, state);
  assert.equal(result.score, 12);
  assert.equal(result.outcome, 'stop');
  assert.equal(result.requirementsMet, false);
});
test('ten points with one zero still requires revision', () => {
  const state = strongCapstone();
  state.scores.operation = '0'; state.connected = false;
  const result = engine.assessCapstone(curriculum.capstone, state);
  assert.equal(result.score, 10);
  assert.equal(result.outcome, 'revise');
  assert.deepEqual(result.zeros, ['Delivery and recovery']);
});
test('practice-only evidence cannot become a connected-pilot recommendation', () => {
  const state = strongCapstone(); state.connected = false;
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'practice');
  state.connected = true;
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'ready');
});
test('a connected confirmation cannot contradict a pending operational test rating', () => {
  const state = strongCapstone(); state.scores.operation = '1'; state.scores.ownership = '1';
  const result = engine.assessCapstone(curriculum.capstone, state);
  assert.equal(result.score, 10);
  assert.equal(result.connectedConflict, true);
  assert.equal(result.requirementsMet, false);
  assert.equal(result.outcome, 'incomplete');
  state.connected = false;
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'practice');
});
test('minimum score is inclusive and requires every criterion', () => {
  const state = strongCapstone(); state.scores.scope = '1'; state.scores.measurement = '1';
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'ready');
  state.scores.ownership = '1';
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'revise');
  delete state.scores.sources;
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'incomplete');
});
test('failure review cannot be silently assumed or contradicted', () => {
  const state = strongCapstone(); state.noCritical = false;
  assert.equal(engine.assessCapstone(curriculum.capstone, state).outcome, 'incomplete');
  state.noCritical = true; state.failures.f2 = true;
  const result = engine.assessCapstone(curriculum.capstone, state);
  assert.equal(result.contradiction, true); assert.equal(result.requirementsMet, false);
});
test('the capstone module requires a reviewed passing rubric as well as checked claims', () => {
  const module = moduleById('capstone'), state = completedState(module);
  assert.equal(engine.assessModule(module, state).complete, false);
  const result = engine.assessCapstone(curriculum.capstone, strongCapstone());
  assert.equal(engine.assessModule(module, state, result).complete, false);
  assert.equal(engine.assessModule(module, state, {...result, reviewed: true}).complete, true);
});
test('stored content is restricted to allowed IDs and cannot retain arbitrary private text', () => {
  const state = engine.emptyState(curriculum), module = moduleById('business-brief');
  state.modules[module.id] = completedState(module);
  state.modules[module.id].notes = 'private customer information';
  state.modules[module.id].answers.unrecognized = 'private customer information';
  state.modules[module.id].answers[module.knowledgeChecks[0].id] = 'private customer information';
  state.capstone.scores.scope = '999'; state.capstone.note = 'private customer information';
  const restored = engine.validState(JSON.stringify(state), curriculum);
  assert.ok(restored);
  assert.doesNotMatch(JSON.stringify(restored), /private customer|999|unrecognized/);
  assert.equal(engine.assessModule(module, restored.modules[module.id]).complete, false);
});
test('malformed or oversized storage cannot break the learning controls', () => {
  for (const raw of ['{', 'null', '[]', '{}', 'true', 'x'.repeat(50001), null]) assert.equal(engine.validState(raw, curriculum), null);
});
