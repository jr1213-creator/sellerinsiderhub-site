const assert = require('node:assert/strict');
const {validState, mount} = require('../site-assets/tutorial-tools.js');

assert.deepEqual(validState('[true,false]', 2), [true,false]);
for (const raw of ['null', '{}', '["true",false]', '[true]', 'not-json', '[true,{"secret":"x"}]']) {
  assert.equal(validState(raw, 2), null, `Reject malformed or non-boolean saved state: ${raw}`);
}

function fixture(storage) {
  const checks = [0,1].map(() => ({checked:false, events:{}, addEventListener(name,fn){this.events[name]=fn;}}));
  const progress = {textContent:''}, status = {textContent:''};
  const reset = {hidden:true, events:{}, addEventListener(name,fn){this.events[name]=fn;}};
  const section = {dataset:{workflowChecklist:'guide',checkVersion:'v1'},querySelectorAll(){return checks;},querySelector(selector){return {'[data-workflow-progress]':progress,'[data-workflow-storage]':status,'[data-workflow-reset]':reset}[selector];}};
  const doc = {querySelectorAll(){return [section];}};
  const win = {localStorage:storage,confirm:()=>false};
  mount(doc,win);
  return {checks,progress,status,reset,win};
}
const memory = new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const saved=fixture(storage);
saved.checks[0].checked=true;saved.checks[0].events.change();
assert.match(saved.progress.textContent,/1 of 2/);
assert.equal(memory.get('sih.workflow.guide.v1'),'[true,false]');
assert.equal(fixture(storage).checks[0].checked,true);
saved.reset.events.click();assert.equal(saved.checks[0].checked,true,'Cancelled reset preserves progress');
saved.win.confirm=()=>true;saved.reset.events.click();assert.equal(saved.checks[0].checked,false);
const blocked=fixture({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
blocked.checks[0].checked=true;blocked.checks[0].events.change();
assert.match(blocked.status.textContent,/unavailable/);
assert.match(blocked.progress.textContent,/1 of 2/);
assert.equal(blocked.reset.hidden,false);
console.log('PASS: tutorial checklist state validation, persistence, cancelled reset, and blocked-storage behavior.');
