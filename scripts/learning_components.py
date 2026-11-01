"""Render the self-study path with accessible, progressively enhanced practice."""
from html import escape
from hashlib import sha256
import json


def h(value):
    return escape(str(value), quote=True)


def items(values, cls=''):
    return '<ul' + (f' class="{cls}"' if cls else '') + '>' + ''.join('<li>' + h(v) + '</li>' for v in values) + '</ul>'


def links(values, download=False):
    return '<ul class="learning-links">' + ''.join(
        f'<li><a href="{h(v["href"])}"' + (' download' if download else '') + f'>{h(v["label"])} <span aria-hidden="true">{"↓" if download else "↗"}</span></a></li>'
        for v in values) + '</ul>'


def criteria(module_id, values, track=''):
    return '<div class="learning-evidence">' + ''.join(
        f'<label><input type="checkbox" data-learning-evidence="{h(module_id)}" data-evidence-id="{h((track + ":") if track else "")}c{i}"><span>{h(v)}</span></label>'
        for i, v in enumerate(values)) + '</div>'


def render_module(module):
    identifier = module['id']
    questions = []
    answer_key = []
    for index, question in enumerate(module['knowledgeChecks'], 1):
        choices = ''.join(
            f'<label><input type="radio" name="{h(question["id"])}" value="{h(c["id"])}"><span>{h(c["text"])}</span></label>'
            for c in question['choices'])
        questions.append(f'<fieldset class="learning-question"><legend>{index}. {h(question["prompt"])}</legend>{choices}<p class="learning-feedback" data-question-feedback="{h(question["id"])}" hidden></p></fieldset>')
        correct = next(c['text'] for c in question['choices'] if c['id'] == question['answerId'])
        answer_key.append(f'<li><strong>{h(correct)}</strong> {h(question["explanation"])}</li>')
    track_html = ''
    if module.get('tracks'):
        options = '<option value="">Choose your practice track</option>' + ''.join(f'<option value="{h(t["id"])}">{h(t["title"])}</option>' for t in module['tracks'])
        track_html = f'<label class="learning-track-label" for="track-{h(identifier)}">Your chosen track</label><select id="track-{h(identifier)}" data-learning-track="{h(identifier)}">{options}</select>'
        for track in module['tracks']:
            track_html += f'<details class="learning-track"><summary>{h(track["title"])}</summary><p>{h(track["bestFor"])}</p><p><a class="button light small" href="{h(track["href"])}">Open this tutorial ↗</a></p><h4>Keep this evidence</h4>{items(track["submission"])}<h4>Check the selected track</h4>{criteria(identifier, track["passCriteria"], track["id"])}</details>'
    practice = '<p class="learning-note"><strong>Practice without a live account:</strong> ' + h(module['practiceMode']) + '</p>' if module.get('practiceMode') else ''
    resources = f'<h3>Exercise files</h3>{links(module["resources"], True)}' if module.get('resources') else ''
    opened = ' open' if module['number'] == 1 else ''
    return f'''<section class="learning-module" id="module-{h(identifier)}" data-learning-module="{h(identifier)}">
      <div class="learning-module-heading"><span class="learning-number">{module['number']:02d}</span><div><span class="eyebrow">Module {module['number']} <span class="learning-module-status" data-module-status="{h(identifier)}">· Not yet self-checked</span></span><h2>{h(module['title'])}</h2></div></div>
      <p class="learning-module-summary">{h(module['summary'])}</p><p class="small muted">{h(module['timeEstimate'])}</p>
      {links(module['lessons'])}
      <details class="learning-assignment"{opened}><summary>Outcomes, assignment, and self-check</summary>
        <h3>What you will be able to do</h3>{items(module['objectives'])}
        {resources}{track_html}{practice}
        <h3>Your assignment</h3>{items(module['submission'])}
        <h3>Verify your evidence</h3><p class="small">Check each statement only after your own work meets it. Configuration screenshots alone do not establish a successful run.</p>{criteria(identifier, module['passCriteria'])}
        <form class="learning-quiz" data-learning-quiz="{h(identifier)}"><h3>Check your understanding</h3>{''.join(questions)}<button class="button small" type="submit">Check module {module['number']} answers</button><p class="learning-quiz-status" data-quiz-status="{h(identifier)}" role="status">Answer both questions, then check your answers.</p></form>
        <details class="learning-answer-key"><summary>Read the answer explanations</summary><ol>{''.join(answer_key)}</ol></details>
      </details>
    </section>'''


def render_learning_path(path, byline):
    version = sha256(json.dumps(path, sort_keys=True).encode()).hexdigest()[:12]
    rubric = path['capstone']
    module_nav = ''.join(f'<a href="#module-{h(m["id"])}"><span>{m["number"]:02d}</span>{h(m["title"])}</a>' for m in path['modules'])
    rubric_fields = []
    for criterion in rubric['rubric']:
        choices = '<option value="">Choose the evidence level</option>' + ''.join(f'<option value="{h(score)}">{h(score)} — {h(label)}</option>' for score, label in criterion['scores'].items())
        rubric_fields.append(f'<div class="learning-rubric-field"><label for="rubric-{h(criterion["id"])}">{h(criterion["title"])}</label><select id="rubric-{h(criterion["id"])}" data-rubric-score="{h(criterion["id"])}">{choices}</select><p class="learning-print-score" data-rubric-print="{h(criterion["id"])}" aria-hidden="true">Not yet scored.</p></div>')
    critical = ''.join(f'<label><input type="checkbox" data-critical-failure="f{i}"><span>{h(failure)}</span></label>' for i, failure in enumerate(rubric['criticalFailures']))
    schema = json.dumps(path, ensure_ascii=False).replace('<', '\\u003c')
    return f'''<div class="learning-path" data-learning-path="{h(path['id'])}" data-learning-version="{version}">
    <section class="learning-hero"><div class="wrap"><div class="breadcrumbs"><a href="/">Home</a><span>/</span><span>AI implementation path</span></div><div class="learning-hero-grid"><div><span class="eyebrow">Free self-study · Practical business skills</span><h1>Build AI workflows<br><em>you can verify.</em></h1><p>{h(path['description'])}</p><div class="actions"><a class="button" href="#module-business-brief">Start the learning path →</a><a class="button light" href="/assets/learning/implementation-portfolio.txt" download>Get the portfolio template ↓</a></div><p class="small learning-credential">{h(path['credentialStatement'])}</p></div><aside class="learning-outcome-card"><span class="eyebrow">Your finished work</span><h2>A useful setup.<br>A checked result.<br>A plan for running it.</h2><dl><div><dt>6</dt><dd>ordered modules</dd></div><div><dt>12</dt><dd>practice questions</dd></div><div><dt>1</dt><dd>evidence portfolio</dd></div></dl><p>Original sales and support exercises, worked solutions, and a capstone rubric. No course signup.</p></aside></div></div></section>
    <div class="wrap learning-layout"><aside class="learning-sidebar"><div class="card"><span class="eyebrow">Your learning path</span><p class="learning-progress" data-learning-progress role="status">0 of 6 modules self-checked</p><progress max="6" value="0" aria-label="Modules self-checked"></progress><nav aria-label="Learning modules">{module_nav}<a href="#capstone-rubric"><span>↗</span>Score your capstone</a></nav><p class="small" data-learning-storage>Enable JavaScript for browser-only progress. All lessons and answer explanations remain available.</p><button class="text-button" type="button" data-learning-reset hidden>Reset this learning record</button></div></aside>
    <div class="learning-main">{byline}
      <section class="learning-introduction" id="before-you-start"><span class="eyebrow">AI for small business</span><h2>A practical implementation path.</h2><p>{h(path['audience'])}</p><p>{h(path['timeEstimate'])}</p><details class="learning-guide"><summary>Before you begin: requirements and how to use the path</summary><h3>What you need</h3>{items(path['prerequisites'])}<h3>How to work through it</h3><ol>{''.join('<li>'+h(v)+'</li>' for v in path['howToUse'])}</ol><h3>What this path establishes</h3>{items(path['outcomes'])}<h3>Assessment boundaries</h3>{items(path['limitations'])}<p>{h(path['progressStatement'])}</p></details></section>
      {''.join(render_module(m) for m in path['modules'])}
      <section class="learning-capstone" id="capstone-rubric"><span class="eyebrow">Turn the work into a decision</span><h2>{h(rubric['title'])}</h2><p>{h(rubric['reviewMethod'])}</p><p><strong>{h(rubric['passRule'])}</strong></p><form data-capstone-form><div class="learning-rubric-grid">{''.join(rubric_fields)}</div><fieldset class="learning-critical"><legend>Does any critical failure remain?</legend><p>Select every statement that is still true. A high score cannot cancel a critical failure.</p>{critical}<label class="learning-none"><input type="checkbox" data-no-critical><span>I reviewed all five statements; none remains unresolved.</span></label></fieldset><label class="learning-connected"><input type="checkbox" data-connected-tests><span>The relevant connected delivery, approval, recovery, and escalation tests have dated observed evidence, and the owner has accepted the procedure.</span></label><button class="button" type="submit">Review my capstone evidence →</button><div class="learning-capstone-result" data-capstone-result role="status"><h3>Choose evidence levels to review your decision.</h3><p>This self-review does not inspect your accounts or certify a live system.</p></div></form>
      <details class="learning-guide"><summary>See a worked decision and the portfolio contents</summary><h3>{h(rubric['workedDecision']['label'])}</h3><p>{h(rubric['workedDecision']['scenario'])}</p><p><strong>{h(rubric['workedDecision']['decision'])}</strong> {h(rubric['workedDecision']['reason'])}</p><h3>Keep these eight sections</h3>{items(rubric['portfolioSections'])}<a class="button light" href="/assets/learning/implementation-portfolio.txt" download>Download the editable portfolio template ↓</a></details></section>
      <section class="learning-next"><h2>Make one useful change, then measure it.</h2><p>Finish a controlled workflow, preserve the test evidence, and review its actual quality and cost. Your portfolio should make a correction as easy to explain as a successful result.</p><div class="actions"><a class="button light" href="/playbooks/">Browse all tutorials ↗</a><button class="button light" data-print>Print the learning path</button></div><details class="learning-guide"><summary>Curriculum references and editorial method</summary><p>The sequence and assessment are Seller Insider Hub’s original self-study design. These public references informed the learning structure; the providers do not endorse or accredit this path. Each tutorial carries its own technical sources.</p>{links(path['sources'])}</details></section>
    </div></div><script type="application/json" id="learning-path-data">{schema}</script></div>'''
