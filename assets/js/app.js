
let affiliateTools = {};

async function loadAffiliateLinks(){
  try{
    const linkDataPath = ['/data','affiliate-links.json'].join('/');
    const res = await fetch(linkDataPath);
    const data = await res.json();
    (data.tools||[]).forEach(t=>{
      affiliateTools[t.category] = affiliateTools[t.category] || [];
      if(!affiliateTools[t.category].some(existing=>existing.id===t.id || existing.name===t.name)){
        affiliateTools[t.category].push(t);
      }
    });
  }catch(e){ console.warn('Tool link data not loaded', e); }
}

function preferredToolUrl(t){ return (t && (t.affiliate_url || t.website_url)) || '#'; }
function preferredTrialUrl(t){ return (t && (t.free_trial_url || t.affiliate_url || t.website_url)) || '#'; }

function trackClick(name){
  try{
    const clicks=JSON.parse(localStorage.getItem("sih_clicks")||"{}");
    clicks[name]=(clicks[name]||0)+1;
    localStorage.setItem("sih_clicks",JSON.stringify(clicks));
    renderAdminClicks();
  }catch(e){}
}

function applyToolNameLinks(){
  document.querySelectorAll('[data-tool-id]').forEach(a=>{
    const id=a.getAttribute('data-tool-id');
    const tool=Object.values(affiliateTools).flat().find(t=>t.id===id);
    if(tool){
      a.href=preferredToolUrl(tool);
      a.textContent=tool.name;
      a.setAttribute('target','_blank');
      a.setAttribute('rel','sponsored nofollow noopener');
    }
  });
  document.querySelectorAll('[data-tool-category]').forEach(span=>{
    const cat=span.getAttribute('data-tool-category');
    const tools=(affiliateTools[cat]||[]).slice(0,5);
    span.innerHTML=tools.map(t=>`<a onclick="trackClick('${cat}:${t.name}')" class="tool-name" data-tool-id="${t.id}" rel="sponsored nofollow noopener" href="${preferredToolUrl(t)}" target="_blank">${t.name}</a>`).join(' · ');
  });
}

function renderToolLibrary(){
  const target=document.getElementById('tool-library'); if(!target) return;
  const all=Object.values(affiliateTools).flat();
  if(!all.length) return;
  target.innerHTML = all.map(t=>`<div class="tool-card"><span class="eyebrow">${t.category}</span><h3><a class="tool-name" data-tool-id="${t.id}" rel="sponsored nofollow noopener" href="${preferredToolUrl(t)}" target="_blank">${t.name}</a></h3><p>${t.best_for||''}</p><small>Editorial fit: ${t.rating||'TBD'}/5</small><p class="fine-print">Disclosure: this card may include affiliate-supported outbound links. Recommendations stay editorial.</p>${t.free_trial_url?`<br><a class="free-trial-link" href="${preferredTrialUrl(t)}" target="_blank" rel="sponsored nofollow noopener">Visit tool</a>`:''}</div>`).join('');
}

document.addEventListener('DOMContentLoaded', async()=>{ await loadAffiliateLinks(); renderToolLibrary(); applyToolNameLinks(); renderAdminClicks(); });

const catalog = {
  "AI assistant": {
    label:"AI assistant",
    examples:"ChatGPT, Claude, Perplexity, Jasper, Copy.ai",
    why:"This helps turn the messy thoughts in your head into drafts, ideas, replies, plans, and first versions you can actually use.",
    first:"Save three reusable prompts: customer reply, content idea helper, and weekly planning helper.",
    link:"/tools/ai-assistant-tools.html"
  },
  "Design": {
    label:"Design",
    examples:"Canva, Adobe Express, Adobe Firefly",
    why:"This helps you make graphics, PDFs, lead magnets, mockups, and social posts without staring at a blank screen.",
    first:"Create one reusable template for posts, one for a PDF/lead magnet, and one for product or service graphics.",
    link:"/tools/design-tools.html"
  },
  "Automation": {
    label:"Automation",
    examples:"Zapier, Make, Pabbly Connect, IFTTT, n8n",
    why:"This is for the annoying repeat stuff — copying details, sending reminders, moving information, or remembering follow-ups.",
    first:"Start with one tiny rule: when someone fills out a form, send you an email and save the details in a list.",
    link:"/tools/automation-tools.html"
  },
  "Email": {
    label:"Email",
    examples:"MailerLite, Kit, Beehiiv, Flodesk, ActiveCampaign",
    why:"This helps you keep in touch after someone visits, buys, books, or shows interest — instead of hoping they remember you later.",
    first:"Create one simple sign-up form and three friendly welcome emails.",
    link:"/tools/email-tools.html"
  },
  "Planning": {
    label:"Planning",
    examples:"Notion, Trello, Airtable, ClickUp, Monday",
    why:"This gives your ideas, tasks, offers, content plans, and reminders a home outside your overwhelmed brain.",
    first:"Create one dashboard with: ideas, active projects, weekly tasks, and follow-ups.",
    link:"/tools/planning-tools.html"
  },
  "Seller tools": {
    label:"Seller tools",
    examples:"eRank, Marmalead, Shopify apps",
    why:"These help you check keywords, listing ideas, product demand, and marketplace details before you waste time making things nobody searches for.",
    first:"Create a listing path: idea → keyword check → draft → photos/mockups → publish → review results.",
    link:"/tools/seller-tools.html"
  },
  "CRM": {
    label:"CRM",
    examples:"HubSpot, Pipedrive, Zoho CRM, Airtable, Monday CRM",
    why:"This helps you remember who asked about what, who needs a follow-up, and who is close to buying.",
    first:"Create simple stages: new lead, replied, follow-up, booked/bought, and later.",
    link:"/tools/crm-tools.html"
  },
  "SEO": {
    label:"SEO",
    examples:"Semrush, Ahrefs, Ubersuggest, Google Search Console",
    why:"This helps you see what people are already searching for before you spend hours making pages, posts, or products.",
    first:"Pick one topic and make five helpful pages around it instead of random posts.",
    link:"/tools/seo-tools.html"
  },
  "Voice": {
    label:"Voice / video",
    examples:"ElevenLabs, Descript, Riverside",
    why:"This helps turn scripts, tutorials, and ideas into videos, voiceovers, or short content faster.",
    first:"Write one tiny explainer, record or generate one version, then repurpose it into short clips and a page section.",
    link:"/tools/voice-video-tools.html"
  }
};

function $(id){return document.getElementById(id)}
function val(id){return $(id)?.value || ""}
function checked(name){return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value)}

function chooseStack(){
  const business=val("business-type"), goal=val("main-goal"), pain=val("pain-point").toLowerCase(), tasks=checked("tasks");
  let stack=[];
  if(tasks.includes("write")||goal==="content"||pain.includes("content")) stack.push("AI assistant","Design");
  if(tasks.includes("organize")||goal==="clarity"||pain.includes("scattered")||pain.includes("overwhelm")) stack.push("Planning");
  if(tasks.includes("repeat")||goal==="time"||pain.includes("repeat")||pain.includes("manual")) stack.push("Automation");
  if(tasks.includes("sell")||business.includes("Etsy")||business.includes("Ecommerce")) stack.push("Seller tools","Email","SEO");
  if(tasks.includes("market")||goal==="growth") stack.push("Email","Design","SEO");
  if(tasks.includes("leads")||business.includes("Service")||business.includes("Real estate")) stack.push("CRM","Automation","Email");
  if(tasks.includes("video")) stack.push("Voice","Design");
  stack=[...new Set(stack)];
  return stack.length ? stack : ["AI assistant","Planning","Design"];
}

function workflowFor(business){
  if(business.includes("Etsy")||business.includes("Ecommerce")) return ["Capture a product idea or customer problem.","Use AI to draft the title, description, FAQ, photo checklist, and customer benefit angle.","Check keywords/demand before designing 25 variations.","Create mockups and Pinterest/social assets from one design session.","Publish, track views/clicks/orders, and improve weekly."];
  if(business.includes("Service")) return ["Create a simple inquiry form.","Use AI to summarize what the customer needs and draft a helpful reply.","Move the lead into a CRM board with a next-action date.","Automate reminders and follow-up emails.","Review the pipeline weekly and fix one bottleneck."];
  if(business.includes("Real estate")) return ["Define buyer/seller/client type.","Use AI to create listing copy, neighborhood content, FAQs, and follow-up scripts.","Track leads in a CRM with next action dates.","Automate form notifications and reminders.","Repurpose local knowledge into short-form content."];
  return ["Pick one repeated task draining your time.","Use AI to create a reusable template or script for that task.","Organize that asset in a simple dashboard.","Add one automation only after the process is clear.","Review weekly: what saved time, what made money, what created noise?"];
}

function setTab(tab){
  ["summary","workflow","tools","report"].forEach(t=>{
    const el=$("tab-"+t), btn=$("btn-"+t);
    if(el) el.classList.toggle("hidden", t!==tab);
    if(btn) btn.classList.toggle("active", t===tab);
  });
}

function buildAISetup(){
  const business=val("business-type"), skill=val("tech-level"), budget=val("budget"), goal=val("main-goal"), pain=val("pain-point");
  const stack=chooseStack(), workflow=workflowFor(business);
  const score=Math.min(96,44+stack.length*6+(skill==="Beginner"?6:0)+(budget==="$0-$25/month"?0:6)+(pain.length>40?8:0));
  const tableRows=stack.map(s=>`<tr>
    <td><a class="internal-category-link" href="${catalog[s].link}">${catalog[s].label}</a><br><small>${catalog[s].examples}</small></td>
    <td>${catalog[s].why}</td>
    <td>${catalog[s].first}</td>
    <td><span class="tool-name-list" data-tool-category="${s}"></span></td>
  </tr>`).join("");
  const lead=skill==="Beginner"?"Your first win is not buying more tools. It is making one small part of your business feel less chaotic.":"You can handle a connected stack, but keep it lean: one home base, one automation, one customer capture path, one review habit.";
  $("setup-result").innerHTML=`<h2>Your AI Setup Plan</h2><p><strong>${business}</strong> · ${goal||"practical growth"} · ${budget}</p><div class="result-card"><h3>Readiness score: ${score}/100</h3><p>${lead}</p><div class="progress"><div class="bar" style="width:${score}%"></div></div></div><div class="tabs"><button id="btn-summary" class="tab active" onclick="setTab('summary')">Summary</button><button id="btn-workflow" class="tab" onclick="setTab('workflow')">Step-by-step path</button><button id="btn-tools" class="tab" onclick="setTab('tools')">Tool Stack</button><button id="btn-report" class="tab" onclick="setTab('report')">Report Preview</button></div><div id="tab-summary"><div class="result-grid"><div class="result-card"><h3>Start here</h3><p>Begin with <strong>${stack[0]}</strong>. Then add ${stack.slice(1,3).join(" + ")||"support tools"} only after the first setup is useful.</p></div><div class="result-card"><h3>Practical warning</h3><p>The mistake is buying a fancy stack before knowing the job each tool has. Tools should replace friction, not become another chore.</p></div></div><div class="result-card"><h3>Your recommended categories</h3>${stack.map(s=>`<a class="tool-pill" href="${catalog[s].link}">${s}</a>`).join("")}</div></div><div id="tab-workflow" class="hidden"><div class="result-card"><h3>Plain-English setup path</h3><ol>${workflow.map(w=>`<li>${w}</li>`).join("")}</ol></div><div class="result-card"><h3>7-day action plan</h3><ol><li>Pick one annoying repeat task.</li><li>Create one AI prompt/template.</li><li>Use it on real work.</li><li>Save it in your planning system.</li><li>Add one tool only if it removes a bottleneck.</li><li>Add a simple tracking habit.</li><li>Review what saved time or made money.</li></ol></div></div><div id="tab-tools" class="hidden"><p class="fine-print">Disclosure: tool-name buttons may use affiliate-supported outbound links. Recommendations are based on practical fit, not commissions.</p><table class="stack-table"><thead><tr><th>Category</th><th>Why it matters</th><th>First setup</th><th>Tool options</th></tr></thead><tbody>${tableRows}</tbody></table></div><div id="tab-report" class="hidden"><div class="result-card"><h3>Report preview</h3><p>A deeper report can turn this starter plan into a documented setup checklist with tool choices, prompts, an automation map, and next steps.</p><ul><li>Custom tool stack</li><li>Setup checklist</li><li>Prompt pack</li><li>Tool links</li><li>Workflow map</li></ul></div><button class="btn coral" onclick="downloadReport()">Download sample report</button></div><div class="cta-box"><h3>Send me this setup</h3><p>Get your plan sent to your inbox so you can come back to it later.</p><form name="ai-concierge-leads" method="POST" data-netlify="true"><input type="hidden" name="form-name" value="ai-concierge-leads"><div class="email-row"><input name="email" type="email" aria-label="Email for your AI setup"><button class="btn coral" type="submit">Send my plan</button></div></form></div>`;
  localStorage.setItem("latest_plan",JSON.stringify({business,skill,budget,goal,pain,stack,workflow,score,created:new Date().toISOString()})); 
  applyToolNameLinks();
}

function downloadReport(){
  const plan=JSON.parse(localStorage.getItem("latest_plan")||"{}");
  const text=`Seller Insider Hub - AI Setup Report\n\nBusiness: ${plan.business||""}\nReadiness Score: ${plan.score||""}/100\nRecommended Stack: ${(plan.stack||[]).join(", ")}\n\nSetup Path:\n${(plan.workflow||[]).map((w,i)=>`${i+1}. ${w}`).join("\n")}\n\nNext Step: Pick one repeat task and build a simple AI-assisted process before buying multiple tools.`;
  const blob=new Blob([text],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="seller-insider-ai-setup-report.txt";a.click();URL.revokeObjectURL(url);
}

function renderAdminClicks(){
  const target=$("click-log");if(!target)return;
  const clicks=JSON.parse(localStorage.getItem("sih_clicks")||"{}");
  const rows=Object.entries(clicks).sort((a,b)=>b[1]-a[1]);
  target.innerHTML=rows.length?rows.map(([k,v])=>`<div class="minirow"><div><b>${k}</b><br><small>local demo click event</small></div><span class="status">${v}</span></div>`).join(""):"<p>No local demo clicks yet. Click tool-name links in the generator to see events here.</p>";
}
