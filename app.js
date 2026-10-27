
// v16: compact, accessible Settings accordion. Presentation only; no data changes.
function setupSettingsAccordion(){
 const panels=[...document.querySelectorAll('#settings .settings-accordion')];
 panels.forEach(panel=>{
  const toggle=panel.querySelector('.settings-toggle');
  const content=panel.querySelector('.settings-content');
  toggle.addEventListener('click',()=>{
   const opening=toggle.getAttribute('aria-expanded')!=='true';
   panels.forEach(other=>{
    other.querySelector('.settings-toggle').setAttribute('aria-expanded','false');
    other.querySelector('.settings-content').hidden=true;
   });
   if(opening){toggle.setAttribute('aria-expanded','true');content.hidden=false;}
  });
 });
}
'use strict';
const DEFAULT_CATS=['Groceries','Restaurants','Shopping','Household','Motoring','Subscriptions','Holidays','Entertainment','Health','Clothing','Transport','Other'];
const DBNAME='record-spend-local-v1';let db, data={transactions:[],cards:['Card 1','Card 2'],categories:[...DEFAULT_CATS],budgets:{},finance:{startDate:'',currentOpening:0,creditOpening:0,savings:[],entries:[]}};let month=new Date(),histMonth=new Date(),selectedCard=0;
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100), iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, ym=d=>iso(d).slice(0,7), label=d=>new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(d), cents=v=>Math.round(Number(String(v).replace('£','').replace(',',''))*100), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Payment-terminal amount entry: each digit represents pennies.
function initAmountEntry(){
  const field=$('amount');
  const format=digits=>(Number(digits||'0')/100).toFixed(2);
  const digitsOnly=value=>String(value).replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,10);
  let digits='';
  const paint=()=>{field.value=format(digits);field.setSelectionRange(field.value.length,field.value.length)};
  field.setAttribute('inputmode','numeric');
  field.setAttribute('aria-label','Amount in pounds and pence; enter digits without a decimal point');
  field.addEventListener('beforeinput',e=>{
    if(e.inputType==='deleteContentBackward'||e.inputType==='deleteContentForward'){
      e.preventDefault();digits=digits.slice(0,-1);paint();return;
    }
    if(e.inputType==='insertText'){
      e.preventDefault();digits=digitsOnly(digits+String(e.data||''));paint();return;
    }
    if(e.inputType==='insertFromPaste'||e.inputType==='insertReplacementText'){
      e.preventDefault();const text=e.dataTransfer?.getData('text')||e.data||'';
      digits=digitsOnly(digits+text);paint();return;
    }
  });
  // Fallback for browsers that do not implement beforeinput consistently.
  field.addEventListener('input',()=>{digits=digitsOnly(field.value);paint()});
  field.addEventListener('paste',e=>{e.preventDefault();digits=digitsOnly(digits+e.clipboardData.getData('text'));paint()});
  field.addEventListener('focus',paint);
  field.form.addEventListener('reset',()=>{digits='';queueMicrotask(()=>{field.value='0.00'})});
  field.value='0.00';
}
function openDB(){return new Promise((resolve,reject)=>{let req=indexedDB.open(DBNAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function dbGet(){return new Promise((resolve,reject)=>{let r=db.transaction('state').objectStore('state').get('all');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbSave(){return new Promise((resolve,reject)=>{let r=db.transaction('state','readwrite').objectStore('state').put(data,'all');r.onsuccess=resolve;r.onerror=()=>reject(r.error)})}
function selectOptions(el,values){let old=el.value;el.innerHTML=values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(values.includes(old))el.value=old}
function renderChoices(){let root=$('cardChoices');root.innerHTML=data.cards.map((name,i)=>`<button type="button" class="${i===selectedCard?'selected':''}" aria-pressed="${i===selectedCard}" data-card="${i}">${esc(name)}</button>`).join('');root.querySelectorAll('button').forEach(b=>b.onclick=()=>{selectedCard=Number(b.dataset.card);renderChoices()})}
function normalizeCategories(){const i=data.categories.indexOf('Other');if(i!==-1&&i!==data.categories.length-1){data.categories.splice(i,1);data.categories.push('Other')}}
function renderSettings(){
  if($('plannedIncome'))$('plannedIncome').value=expectedPlanIncome()===null?'':(expectedPlanIncome()/100).toFixed(2);
  data.cards.forEach((v,i)=>$('card'+i).value=v);
  $('budgetInputs').innerHTML=data.categories.map(c=>`<label>${esc(c)}<input type="number" inputmode="decimal" min="0" step="0.01" data-budget="${esc(c)}" value="${((data.budgets[c]||0)/100).toFixed(2)}"></label>`).join('');
  $('categorySettings').innerHTML=data.categories.map((c,i)=>{
    const pinned=c==='Other';
    const upDisabled=pinned||i===0;
    const downDisabled=pinned||i>=data.categories.length-2;
    return `<div class="category-order-row"><span class="category-name">${esc(c)}</span><div class="category-actions"><button type="button" class="secondary category-move" data-move="up" data-index="${i}" aria-label="Move ${esc(c)} up" title="Move up" ${upDisabled?'disabled':''}>↑</button><button type="button" class="secondary category-move" data-move="down" data-index="${i}" aria-label="Move ${esc(c)} down" title="Move down" ${downDisabled?'disabled':''}>↓</button><button type="button" class="secondary" data-rename="${esc(c)}">Rename</button></div></div>`;
  }).join('');
  $('categorySettings').querySelectorAll('[data-move]').forEach(b=>b.onclick=async()=>{
    const i=Number(b.dataset.index),j=i+(b.dataset.move==='up'?-1:1);
    if(i<0||j<0||j>=data.categories.length||data.categories[i]==='Other'||data.categories[j]==='Other')return;
    [data.categories[i],data.categories[j]]=[data.categories[j],data.categories[i]];
    await saveRender();
  });
  $('categorySettings').querySelectorAll('[data-rename]').forEach(b=>b.onclick=async()=>{
    const old=b.dataset.rename;
    if(old==='Other'){alert('Other is reserved as the final category.');return;}
    const n=prompt('Rename category',old)?.trim();
    if(!n||n===old)return;
    if(data.categories.some(c=>c.toLowerCase()===n.toLowerCase()))return alert('That category already exists.');
    data.categories=data.categories.map(c=>c===old?n:c);
    data.transactions.forEach(t=>{if(t.category===old)t.category=n});
    data.budgets[n]=data.budgets[old]||0;delete data.budgets[old];
    await saveRender();
  });
  $('storageStatus').textContent=`${data.transactions.length} transactions saved locally on this device.`;
}

// Stage 1: the original purchases stay unchanged; finance entries are stored separately.
function finance(){if(!data.finance||typeof data.finance!=='object')data.finance={};const f=data.finance;f.startDate=typeof f.startDate==='string'?f.startDate:'';f.currentOpening=Number.isSafeInteger(f.currentOpening)?f.currentOpening:0;f.creditOpening=Number.isSafeInteger(f.creditOpening)?f.creditOpening:0;f.savings=Array.isArray(f.savings)?f.savings:[];f.entries=Array.isArray(f.entries)?f.entries:[];f.recurring=Array.isArray(f.recurring)?f.recurring:[];f.recurringSkipped=Array.isArray(f.recurringSkipped)?f.recurringSkipped:[];f.provisions=Array.isArray(f.provisions)?f.provisions:[];f.provisionMonths=f.provisionMonths&&typeof f.provisionMonths==='object'?f.provisionMonths:{};return f}
// v21: a separately configured theoretical income; not a cash movement.
function expectedPlanIncome(){const v=finance().plannedMonthlyIncome;return Number.isSafeInteger(v)&&v>=0?v:null}
// v23: Forecast contributions are credited at the START of their month,
// before any payment in that month. This virtual ledger never mutates saved data.
function budgetPlanMonth(key,virtual,balances){
 const f=finance(),income=expectedPlanIncome(),budgets=Object.values(data.budgets).reduce((a,n)=>a+(Number.isSafeInteger(n)&&n>0?n:0),0);
 let provisions=0;const trace=[];
 const last=iso(new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),0));
 const prev=iso(new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,0));
 for(const p of f.provisions){
  if(p.paused||key<p.start.slice(0,7))continue;
  // The first forecast month starts from the genuine historical closing reserve.
  // Subsequent months use the previous simulated closing reserve, never a
  // recomputed balance that might omit a forecast contribution.
  const opening=Object.prototype.hasOwnProperty.call(balances,p.id)?balances[p.id]:provisionState(p,prev,true).balance;
  virtual[p.id]??={};
  const locked=virtual[p.id][key]!==undefined;
  const rule=f.recurring.find(r=>r.id===p.ruleId);
  let contribution;
  if(locked)contribution=virtual[p.id][key];
  else if(p.type==='allowance')contribution=Math.floor(p.target/12)+(Number(key.slice(5,7))<=p.target%12?1:0);
  else if(!rule||rule.paused||rule.type!=='expense'||rule.frequency!=='yearly')contribution=0;
  else{
   const dueDate=provisionNextDue(p,key+'-01');
   const months=Math.max(1,provisionMonthsBetween(key,dueDate.slice(0,7))+1);
   contribution=Math.max(0,Math.ceil((rule.amount-opening)/months));
  }
  if(!locked)virtual[p.id][key]=contribution;
  // Credit the monthly contribution before evaluating payments, including
  // renewals due on the first day of the month.
  let closing=opening+contribution,paid=0,covered=0,shortfall=0;
  const payments=provisionEvents(p,last,true).filter(e=>e.date.slice(0,7)===key&&e.kind!=='accrual');
  for(const e of payments){
   paid+=e.amount;
   if(e.amount>=0){const used=Math.min(Math.max(0,closing),e.amount);closing-=used;covered+=used;shortfall+=e.amount-used;}
   else{closing-=e.amount;covered+=e.amount;}
  }
  balances[p.id]=closing;
  const due=p.type==='bill'?provisionNextDue(p,key+'-01'):null;
  provisions+=contribution;
  trace.push({name:p.name,type:p.type,opening,contribution,available:opening+contribution,paid,closing,covered,shortfall,due,expected:p.type==='bill'?(rule?.amount??p.target):p.target,locked});
 }
 return {income,budgets,provisions,trace,surplus:income===null?null:income-budgets-provisions};
}
function renderBudgetPlan(){
 const summary=$('budgetPlanSummary'),table=$('budgetPlanForecast');if(!summary||!table)return;
 const f=finance(),original=f.provisionMonths;
 const virtual=Object.fromEntries(Object.entries(original).map(([id,months])=>[id,{...months}]));
 const balances=Object.create(null);
 const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1),rows=[];
 try{
  f.provisionMonths=virtual;
  for(let i=0;i<12;i++){
   const date=new Date(first.getFullYear(),first.getMonth()+i,1),key=ym(date);
   rows.push({date,key,...budgetPlanMonth(key,virtual,balances)});
  }
 }finally{f.provisionMonths=original}
 const current=rows[0],configured=current.income!==null;
 summary.innerHTML=`${configured?`<div class="finance-total ${current.surplus<0?'negative':''}">${current.surplus>=0?'+':''}${money(current.surplus)}</div>`:'<p class="warning">Set expected monthly income in Settings to calculate your budgeted surplus.</p>'}<div class="provision-summary-row"><span>Expected monthly income</span><strong>${configured?money(current.income):'Not set'}</strong></div><div class="provision-summary-row"><span>Full monthly budgets</span><strong>−${money(current.budgets)}</strong></div><div class="provision-summary-row"><span>Monthly annual provisions</span><strong>−${money(current.provisions)}</strong></div><p class="muted">Planning benchmark only. Expand a month below to trace each provision, including projected payments and carried-forward balances.</p>`;
 table.innerHTML=rows.map((r,i)=>`<tr><td><button type="button" class="budget-trace-toggle" data-trace="${i}" aria-expanded="false" aria-controls="budget-trace-${i}">▸ ${esc(label(r.date))}</button></td><td>${r.income===null?'—':money(r.income)}</td><td>${money(r.budgets)}</td><td>${money(r.provisions)}</td><td class="${r.surplus!==null&&r.surplus<0?'negative':''}">${r.surplus===null?'—':(r.surplus>=0?'+':'')+money(r.surplus)}</td></tr><tr id="budget-trace-${i}" class="budget-trace-row" hidden><td colspan="5"><div class="budget-trace-content"><strong>${esc(label(r.date))} · provision calculation</strong>${r.trace.length?r.trace.map(t=>`<div class="budget-trace-item"><strong>${esc(t.name)} <small>(${t.type==='bill'?'scheduled bill':'annual allowance'})</small></strong><div>Opening reserve: ${money(t.opening)}</div><div>Monthly contribution: <strong>${money(t.contribution)}</strong>${t.locked?' · recorded/locked':' · forecast'}</div><div>Available before payments: ${money(t.available)}</div><div>Payments: ${money(t.paid)}${t.paid?' · covered '+money(t.covered):''}</div><div>Closing reserve: ${money(t.closing)}</div>${t.due?`<div>Next scheduled due: ${esc(t.due)} · ${money(t.expected)}</div>`:''}${t.shortfall>0?`<div class="warning">Uncovered: ${money(t.shortfall)}</div>`:''}</div>`).join(''):'<p>No active provisions for this month.</p>'}</div></td></tr>`).join('');
 table.querySelectorAll('[data-trace]').forEach(btn=>btn.onclick=()=>{
  const detail=$('budget-trace-'+btn.dataset.trace),open=detail.hidden;
  detail.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=(open?'▾ ':'▸ ')+label(rows[Number(btn.dataset.trace)].date);
 });
}
function signedSpend(t){return t.refund?-t.amount:t.amount}
function isCredit(t){return t.card===data.cards[0]}
function isDebit(t){return t.card===data.cards[1]}
function accountNames(){return [{id:'current',name:'Current account'},{id:'credit',name:'Credit card'},...finance().savings.map(a=>({id:a.id,name:a.name}))]}
function accountName(id){return accountNames().find(a=>a.id===id)?.name||'Unknown account'}
function financeMovements(){const f=finance();const balances={current:f.currentOpening,credit:f.creditOpening};f.savings.forEach(a=>balances[a.id]=a.opening);if(!f.startDate)return balances;
  data.transactions.filter(t=>t.date>=f.startDate).forEach(t=>{if(isCredit(t))balances.credit+=signedSpend(t);else if(isDebit(t))balances.current-=signedSpend(t)});
  f.entries.filter(t=>t.date>=f.startDate).forEach(t=>{if(t.type==='income'){if(t.account==='credit')balances.credit-=t.amount;else balances[t.account]=(balances[t.account]||0)+t.amount}else if(t.type==='transfer'){if(t.from==='credit')balances.credit+=t.amount;else balances[t.from]=(balances[t.from]||0)-t.amount;if(t.to==='credit')balances.credit-=t.amount;else balances[t.to]=(balances[t.to]||0)+t.amount}});return balances}
function accountOptions(el,includeCredit=true){const opts=accountNames().filter(a=>includeCredit||a.id!=='credit');const old=el.value;el.innerHTML=opts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');if(opts.some(a=>a.id===old))el.value=old}
function renderFinance(){const f=finance();$('financeStart').value=f.startDate;$('currentOpening').value=(f.currentOpening/100).toFixed(2);$('creditOpening').value=(f.creditOpening/100).toFixed(2);$('savingsList').innerHTML=f.savings.length?f.savings.map(a=>`<div class="finance-account-row"><strong>${esc(a.name)}</strong><span>${money(a.opening)} opening</span><button type="button" class="secondary" data-saving-edit="${esc(a.id)}">Edit</button></div>`).join(''):'<p class="muted">No savings accounts added yet.</p>';
  document.querySelectorAll('[data-saving-edit]').forEach(b=>b.onclick=async()=>{const a=f.savings.find(x=>x.id===b.dataset.savingEdit);if(!a)return;const name=prompt('Savings account name',a.name)?.trim();if(!name)return;const amount=prompt('Opening balance (£)',(a.opening/100).toFixed(2));if(amount===null)return;const value=cents(amount);if(!Number.isSafeInteger(value)||value<0)return alert('Enter a valid balance.');a.name=name;a.opening=value;await saveRender()});
  ['incomeAccount','transferFrom','transferTo','financeEditAccount','financeEditFrom','financeEditTo'].forEach(id=>accountOptions($(id),id!=='incomeAccount'&&id!=='financeEditAccount'));
  $('financeSetupStatus').textContent=f.startDate?'Balances start at the beginning of '+f.startDate+'. Earlier purchases are excluded from account balances.':'Set an opening date and balances to activate account tracking.';
  $('financeDate').value||=iso(new Date());$('financeEditDate').value||=iso(new Date());
  const balance=financeMovements();const totalSavings=f.savings.reduce((v,a)=>v+(balance[a.id]||0),0);const net=(balance.current||0)+totalSavings-(balance.credit||0);
  $('netPosition').textContent=f.startDate?money(net):'Not set up';$('accountPositions').innerHTML=f.startDate?accountNames().map(a=>`<div class="finance-account-row"><span>${esc(a.name)}</span><strong>${a.id==='credit'?'−':''}${money(balance[a.id]||0)}</strong></div>`).join(''):'<p class="muted">Set your opening balances in Settings.</p>';
  const m=ym(month);const purchases=forMonth(month);const income=f.entries.filter(t=>t.type==='income'&&t.date.slice(0,7)===m).reduce((v,t)=>v+t.amount,0);const expense=sum(purchases);$('monthIncome').textContent=money(income);$('monthNet').textContent=(income-expense>=0?'+':'')+money(income-expense);$('monthNet').classList.toggle('negative',income-expense<0);
  renderRecurring();
  $('financeEntryType').onchange=()=>{$('incomeFields').hidden=$('financeEntryType').value!=='income';$('transferFields').hidden=$('financeEntryType').value!=='transfer'};$('financeEntryType').onchange();
}

// Stage 2: recurring entries are ordinary editable transactions with a stable occurrence key.
function recurringKey(rule,date){return rule.id+'@'+date}
function nextRecurringDate(rule,n){
  const [y,m,d]=rule.start.split('-').map(Number);
  if(rule.frequency==='weekly'){const v=new Date(y,m-1,d+7*n);return iso(v)}
  if(rule.frequency==='yearly'){const year=y+n;return iso(new Date(year,m-1,Math.min(d,new Date(year,m,0).getDate())))}
  const monthIndex=m-1+n,first=new Date(y,monthIndex,1);return iso(new Date(first.getFullYear(),first.getMonth(),Math.min(d,new Date(first.getFullYear(),first.getMonth()+1,0).getDate())));
}
function occurrenceExists(key){const f=finance();return f.recurringSkipped.includes(key)||data.transactions.some(t=>t.recurringKey===key)||f.entries.some(t=>t.recurringKey===key)}
async function catchUpRecurring(){
  const f=finance(),today=iso(new Date());if(!f.startDate||!f.recurring.length)return 0;
  let made=0;
  for(const rule of f.recurring){if(rule.paused)continue;
    for(let n=0;n<2400;n++){
      const date=nextRecurringDate(rule,n);
      if(date>today||rule.end&&date>rule.end)break;
      if(date<f.startDate||occurrenceExists(recurringKey(rule,date)))continue;
      if(made>=1000){alert('Recurring catch-up limit reached. Please review your scheduled transactions.');await dbSave();return made}
      const key=recurringKey(rule,date),base={id:crypto.randomUUID(),date,amount:rule.amount,created:Date.now()+made,recurringKey:key,recurringRuleId:rule.id};
      if(rule.type==='expense')data.transactions.push({...base,merchant:rule.description,category:rule.category,card:data.cards[rule.payFrom==='credit'?0:1],notes:'↻ Scheduled payment'});
      else if(rule.type==='income')f.entries.push({...base,type:'income',description:rule.description,account:rule.account});
      else f.entries.push({...base,type:'transfer',description:rule.description,from:rule.from,to:rule.to});
      made++;
    }
  }
  if(made)await dbSave();return made;
}
function renderRecurring(){
  const f=finance();
  selectOptions($('recCategory'),data.categories);
  for(const id of ['recIncomeAccount','recFrom','recTo'])accountOptions($(id),id!=='recIncomeAccount');
  $('recType').onchange=()=>{const t=$('recType').value;$('recExpenseFields').hidden=t!=='expense';$('recIncomeFields').hidden=t!=='income';$('recTransferFields').hidden=t!=='transfer'};
  $('recType').onchange();
  $('recStart').value||=iso(new Date());
  $('recurringList').innerHTML=f.recurring.length?f.recurring.map(r=>`<div class="recurring-row"><div><strong>${esc(r.description)}</strong><small>${esc(r.type)} · ${money(r.amount)} · ${esc(r.frequency)} · from ${esc(r.start)}${r.paused?' · Paused':''}</small></div><div class="recurring-actions"><button class="secondary" type="button" data-rec-edit="${esc(r.id)}">Edit</button><button class="secondary" type="button" data-rec-pause="${esc(r.id)}">${r.paused?'Resume':'Pause'}</button><button class="danger" type="button" data-rec-delete="${esc(r.id)}">Remove</button></div></div>`).join(''):'<p class="muted">No recurring transactions set up.</p>';
  $('recurringList').querySelectorAll('[data-rec-edit]').forEach(b=>b.onclick=()=>{
    const r=f.recurring.find(x=>x.id===b.dataset.recEdit);if(!r)return;
    // Editing takes effect on the next ungenerated occurrence; prior entries are preserved.
    let next='';const today=iso(new Date());
    for(let n=0;n<2400;n++){const d=nextRecurringDate(r,n);if(d>today){next=d;break}}
    if(!next){alert('No future occurrence available to edit.');return}
    $('recEditId').value=r.id;$('recType').value=r.type;$('recType').onchange();
    $('recDescription').value=r.description;$('recAmount').value=(r.amount/100).toFixed(2);
    $('recStart').value=next;$('recFrequency').value=r.frequency;$('recEnd').value=r.end||'';
    $('recCategory').value=r.category||data.categories[0];$('recPayFrom').value=r.payFrom||'current';
    $('recIncomeAccount').value=r.account||'current';$('recFrom').value=r.from||'current';$('recTo').value=r.to||'credit';
    $('recFormTitle').textContent='Edit recurring transaction';$('recSubmit').textContent='Save future changes';
    $('recCancelEdit').hidden=false;$('recStatus').textContent='Changes apply from the date shown. Transactions already in History will not change.';
    $('recurringForm').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('recurringList').querySelectorAll('[data-rec-pause]').forEach(b=>b.onclick=async()=>{const r=f.recurring.find(x=>x.id===b.dataset.recPause);if(!r)return;r.paused=!r.paused;await catchUpRecurring();await saveRender()});
  $('recurringList').querySelectorAll('[data-rec-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this schedule? Existing transactions will remain in History.'))return;f.recurring=f.recurring.filter(x=>x.id!==b.dataset.recDelete);await saveRender()});
}
function skipRecurringIfDeleted(t){if(t?.recurringKey&&!finance().recurringSkipped.includes(t.recurringKey))finance().recurringSkipped.push(t.recurringKey)}

function financeHistory(){const f=finance(),q=$('search').value.toLowerCase().trim(),m=ym(histMonth);return f.entries.filter(t=>t.date.slice(0,7)===m&&[t.description,t.type,accountName(t.account),accountName(t.from),accountName(t.to)].join(' ').toLowerCase().includes(q)).map(t=>({date:t.date,created:t.created||0,html:`<button type="button" class="transaction" data-finance-id="${esc(t.id)}"><span class="transaction-line"><strong>${t.recurringKey?'↻ ':''}${esc(t.description|| (t.type==='income'?'Income':'Transfer'))}</strong> · ${esc(t.date)} · ${t.type==='income'?'Income · '+esc(accountName(t.account)):'Transfer · '+esc(accountName(t.from))+' → '+esc(accountName(t.to))} · <strong class="transaction-amount">${money(signedSpend(t))}</strong></span></button>`}))}
function openFinanceEdit(id){const t=finance().entries.find(t=>t.id===id);if(!t)return;$('financeEditId').value=id;$('financeEditType').value=t.type;$('financeEditDate').value=t.date;$('financeEditAmount').value=(t.amount/100).toFixed(2);$('financeEditDescription').value=t.description||'';accountOptions($('financeEditAccount'),false);accountOptions($('financeEditFrom'));accountOptions($('financeEditTo'));$('financeEditAccount').value=t.account||'current';$('financeEditFrom').value=t.from||'current';$('financeEditTo').value=t.to||'credit';$('financeEditIncomeFields').hidden=t.type!=='income';$('financeEditTransferFields').hidden=t.type!=='transfer';$('financeDialog').showModal();$('financeEditHeading').focus({preventScroll:true})}
function renderAll(){selectOptions($('category'),data.categories);selectOptions($('editCategory'),data.categories);selectOptions($('editCard'),data.cards);renderChoices();renderSettings();renderCreditCycleSettings();renderDashboard();renderFinance();renderHistory();renderProvisions()}
function forMonth(d){return data.transactions.filter(t=>t.date.slice(0,7)===ym(d))}
function sum(ts){return ts.reduce((a,t)=>a+signedSpend(t),0)}
function bars(root,items,total){root.innerHTML=items.length?items.map(([name,value])=>`<div class="bar-item"><div class="inline"><span>${esc(name)}</span><strong>${money(value)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,total>0?value/total*100:0))}%"></div></div></div>`).join(''):'<p class="muted">No spending recorded for this month.</p>'}
// Stage 3: reporting is derived from existing transactions; no additional stored data.
function monthPerformance(monthKey){
  const income=finance().entries.filter(t=>t.type==='income'&&t.date.slice(0,7)===monthKey).reduce((a,t)=>a+t.amount,0);
  const spent=data.transactions.filter(t=>t.date.slice(0,7)===monthKey).reduce((a,t)=>a+signedSpend(t),0);
  return {income,spent,net:income-spent};
}
// Projected surplus for the selected calendar month: actual income less actual
// spending, plus only ungenerated future recurring income/expenses. Transfers
// (including credit-card repayments) never affect income or expenditure.
function projectedMonthSurplus(monthDate){
  const key=ym(monthDate),actual=monthPerformance(key),f=finance();
  const today=iso(new Date()),last=iso(new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0));
  if(last<today)return null; // A past month is actual, not a forecast.
  let remainingIncome=0,remainingSpend=0;
  for(const rule of f.recurring){
    if(rule.paused||rule.type==='transfer')continue;
    for(let n=0;n<2400;n++){
      const date=nextRecurringDate(rule,n);
      if(date>last||(rule.end&&date>rule.end))break;
      if(date<=today||date.slice(0,7)!==key||(f.startDate&&date<f.startDate)||occurrenceExists(recurringKey(rule,date)))continue;
      if(rule.type==='income')remainingIncome+=rule.amount;
      else if(rule.type==='expense')remainingSpend+=rule.amount; // Credit-card spending counts at purchase time.
    }
  }
  return actual.net+remainingIncome-remainingSpend;
}

// v18: annual provisions are virtual budgets, never cash movements.
// Month allocations are locked when the month begins. Editing a provision
// changes future months only; recorded purchases and account balances stay intact.
function provisionMonthKey(date){return date.slice(0,7)}
function provisionMonthStart(key){return key+'-01'}
function provisionMonthsBetween(from,to){return (Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7))}
function provisionNextDue(p,from){let due=p.due;if(p.type==='bill'){const rule=finance().recurring.find(r=>r.id===p.ruleId);if(rule&&rule.frequency==='yearly'&&rule.type==='expense'){for(let n=0;n<300;n++){const d=nextRecurringDate(rule,n);if(d>=from)return d;}return due;}}if(!due)return from;while(due<from){const y=Number(due.slice(0,4))+1,m=Number(due.slice(5,7)),d=Number(due.slice(8,10));due=iso(new Date(y,m-1,Math.min(d,new Date(y,m,0).getDate())))}return due}
function provisionTransactions(p){return data.transactions.filter(t=>t.provisionId===p.id||(p.type==='bill'&&p.ruleId&&t.recurringRuleId===p.ruleId)).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)))}
function provisionEvents(p,through,includeFuture=false){
 const f=finance(),events=[],start=p.start.slice(0,7),end=through.slice(0,7),today=iso(new Date());
 if(end<start)return events;
 for(let key=start,n=0;key<=end&&n<600;n++){
  const snap=f.provisionMonths[p.id]?.[key];
  if(snap!==undefined)events.push({date:key+'-01',order:0,amount:snap,kind:'accrual',month:key});
  const next=new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),1);next.setMonth(next.getMonth()+1);key=ym(next);
 }
 for(const t of provisionTransactions(p))if(t.date>=p.start&&t.date<=through)events.push({date:t.date,order:1,amount:signedSpend(t),kind:'payment',tx:t});
 if(includeFuture&&p.type==='bill'&&p.ruleId){
  const rule=f.recurring.find(r=>r.id===p.ruleId);
  if(rule&&!rule.paused&&rule.type==='expense')for(let n=0;n<2400;n++){
   const date=nextRecurringDate(rule,n);
   if(date>through||(rule.end&&date>rule.end))break;
   if(date<=today||date<p.start||occurrenceExists(recurringKey(rule,date)))continue;
   events.push({date,order:1,amount:rule.amount,kind:'future',month:date.slice(0,7)});
  }
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order||String(a.tx?.id||'').localeCompare(String(b.tx?.id||'')));
}
function provisionState(p,through,includeFuture=false){
 let balance=p.opening,coveredByMonth={},shortfallByMonth={},shortfallDetailsByMonth={},lastPayment='';
 for(const e of provisionEvents(p,through,includeFuture)){
  if(e.kind==='accrual'){balance+=e.amount;continue}
  const m=e.date.slice(0,7);
  if(e.amount>=0){const covered=Math.min(Math.max(0,balance),e.amount),uncovered=e.amount-covered;balance-=covered;coveredByMonth[m]=(coveredByMonth[m]||0)+covered;shortfallByMonth[m]=(shortfallByMonth[m]||0)+uncovered;if(uncovered>0){(shortfallDetailsByMonth[m]??=[]).push({date:e.date,description:e.tx?.merchant||e.tx?.notes||'Scheduled payment',amount:e.amount,covered,uncovered,future:e.kind==='future'});}lastPayment=e.date}
  else{ // Refund restores the provision; the reversed spending remains in actual expenditure.
   const returned=-e.amount;balance+=returned;coveredByMonth[m]=(coveredByMonth[m]||0)-returned;
  }
 }
 return {balance,coveredByMonth,shortfallByMonth,shortfallDetailsByMonth,lastPayment};
}
function provisionRequired(p,key,forecast=false){
 if(p.type==='allowance')return Math.floor(p.target/12)+(Number(key.slice(5,7))<=p.target%12?1:0);
 const rule=finance().recurring.find(r=>r.id===p.ruleId);if(!rule||rule.paused||rule.type!=='expense'||rule.frequency!=='yearly')return 0;
 const first=provisionMonthStart(key),due=provisionNextDue(p,first),remaining=Math.max(1,provisionMonthsBetween(key,due.slice(0,7))+1);
 // Balance immediately before this month's contribution. Historical accruals are locked.
 const prev=iso(new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,0));
 const balance=provisionState(p,prev,forecast).balance;
 return Math.max(0,Math.ceil((rule.amount-balance)/remaining));
}
function provisionAccrue(){
 const f=finance(),current=ym(new Date());let changed=false;
 for(const p of f.provisions){
  if(!f.provisionMonths[p.id]){f.provisionMonths[p.id]={};changed=true}
  if(p.paused)continue;
  const first=p.start.slice(0,7);if(first>current)continue;
  // Freeze a month at its first eligible opening. Do not backfill months before setup.
  for(let key=first,n=0;key<=current&&n<600;n++){
   if(f.provisionMonths[p.id][key]===undefined){f.provisionMonths[p.id][key]=provisionRequired(p,key);changed=true}
   const d=new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),1);d.setMonth(d.getMonth()+1);key=ym(d);
  }
 }
 return changed;
}
function provisionDashboard(){
 const root=$('annualProvisionDashboard');if(!root)return;
 const f=finance(),key=ym(month),today=iso(new Date()),last=iso(new Date(month.getFullYear(),month.getMonth()+1,0));
 if(!f.provisions.length){root.innerHTML='<p class="muted">No annual provisions yet. Add them in Settings to see your provision-adjusted spending outlook.</p>';return}
 const actual=monthPerformance(key).net,forecast=projectedMonthSurplus(month),base=forecast===null?actual:forecast;
 let contributions=0,covered=0,shortfall=0,total=0;const shortfallDetails=[];
 for(const p of f.provisions){
  const accrual=f.provisionMonths[p.id]?.[key];
  if(accrual!==undefined)contributions+=accrual;
  else if(key>=p.start.slice(0,7)&&last>=today&&!p.paused)contributions+=provisionRequired(p,key);
  const state=provisionState(p,last,last>=today);
  covered+=state.coveredByMonth[key]||0;shortfall+=state.shortfallByMonth[key]||0;for(const item of state.shortfallDetailsByMonth[key]||[])shortfallDetails.push({...item,provision:p.name||p.title||'Annual provision'});
  total+=provisionState(p,today).balance;
 }
 const adjusted=base-contributions+covered;
 root.innerHTML=`<div class="finance-total ${adjusted<0?'negative':''}">${adjusted>=0?'+':''}${money(adjusted)}</div><p class="muted">${esc(label(month))} · ${forecast===null?'actual':'projected'} surplus after annual allowances</p><div class="provision-summary-row"><span>${forecast===null?'Actual':'Projected'} month surplus</span><strong>${base>=0?'+':''}${money(base)}</strong></div><div class="provision-summary-row"><span>Monthly provision required</span><strong>−${money(contributions)}</strong></div><div class="provision-summary-row"><span>Provisioned spending covered</span><strong>+${money(covered)}</strong></div><div class="provision-summary-row"><span>Accumulated provision (today)</span><strong>${money(total)}</strong></div>${shortfall>0?`<details class="provision-shortfall"><summary class="warning">⚠ ${money(shortfall)} of provision-linked spending is not covered by accumulated provisions and remains included in the adjusted surplus. <span class="shortfall-hint">Show breakdown</span></summary><div class="shortfall-breakdown"><p class="muted">Uncovered amounts by provision and transaction. These amounts remain part of actual spending; they are not deducted again.</p>${shortfallDetails.map(item=>`<div class="shortfall-item"><div><strong>${esc(item.provision)}</strong><small>${esc(item.description)} · ${esc(item.date)}${item.future?' · Scheduled':''}</small><small>Payment ${money(item.amount)} · Covered ${money(item.covered)}</small></div><strong>${money(item.uncovered)} uncovered</strong></div>`).join('')}</div></details>`:''}<p class="muted">Provisions do not move money between accounts. Existing actual spending and account balances are unchanged.</p>`;
}
function renderProvisions(){
 const f=finance(),list=$('provisionList');if(!list)return;
 const today=iso(new Date()),key=ym(new Date());
 const options=f.recurring.filter(r=>r.type==='expense'&&r.frequency==='yearly');
 const old=$('provRule').value;
 const oldCategory=$('provCategory').value;
 $('provCategory').innerHTML='<option value="">None — select for each purchase</option>'+data.categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('provCategory').value=oldCategory;
 $('provRule').innerHTML='<option value="">Select an annual recurring expense</option>'+options.map(r=>`<option value="${esc(r.id)}">${esc(r.description)} · ${money(r.amount)}</option>`).join('');
 if(options.some(r=>r.id===old))$('provRule').value=old;
 $('provRule').onchange=()=>{const r=f.recurring.find(x=>x.id===$('provRule').value);$('provLinkedDetails').hidden=!r;if(r){$('provLinkedDetails').textContent=`From recurring payment: ${money(r.amount)} · Next due ${provisionNextDue({type:'bill',ruleId:r.id,due:r.start},today)}`;$('provTarget').value=(r.amount/100).toFixed(2);$('provDue').value=provisionNextDue({type:'bill',ruleId:r.id,due:r.start},today);}};
 $('provKind').onchange=()=>{const bill=$('provKind').value==='bill';$('provRuleFields').hidden=!bill;$('provNameFields').hidden=bill;$('provTargetFields').hidden=bill;$('provDueFields').hidden=bill;$('provCategoryFields').hidden=bill;$('provTarget').required=!bill;$('provDue').required=false;$('provLinkedDetails').hidden=!bill||!$('provRule').value;if(bill)$('provRule').onchange();};
 $('provKind').onchange();
 const total=f.provisions.reduce((a,p)=>a+(f.provisionMonths[p.id]?.[key]??(p.paused?0:provisionRequired(p,key))),0);
 $('provisionSummary').textContent=`${f.provisions.length} provision${f.provisions.length===1?'':'s'} · ${money(total)} required this month`;
 list.innerHTML=f.provisions.length?f.provisions.map(p=>{
  const state=provisionState(p,today),monthly=f.provisionMonths[p.id]?.[key]??(p.paused?0:provisionRequired(p,key));
  const linked=f.recurring.find(r=>r.id===p.ruleId);
  return `<details class="provision-item"><summary><strong>${esc(p.name)}</strong><small>${p.type==='bill'?'Annual bill':'Annual allowance'} · ${money(monthly)}/month${p.paused?' · Paused':''}</small></summary><div class="provision-item-body"><div class="provision-summary-row"><span>${p.type==='bill'?'Expected bill':'Annual budget'}</span><strong>${money(p.type==='bill'&&linked?linked.amount:p.target)}</strong></div><div class="provision-summary-row"><span>Accumulated</span><strong>${money(state.balance)}</strong></div><div class="provision-summary-row"><span>${p.type==='bill'?'Next due':'Budget year'}</span><strong>${p.type==='bill'?esc(linked?provisionNextDue(p,today):'Schedule missing'):'January–December'}</strong></div>${p.type==='allowance'&&provisionTransactions(p).filter(t=>t.date.slice(0,4)===today.slice(0,4)).reduce((v,t)=>v+signedSpend(t),0)>p.target?'<p class="warning">⚠ Annual spending exceeds the calendar-year budget.</p>':''}${p.type==='bill'?`<p class="muted">Linked payment: ${esc(linked?.description||'Schedule removed — review link')}${linked?.paused?' · Paused — review provision':''}</p>`:`<p class="muted">${p.category?`Automatically linked category: ${esc(p.category)}`:'Select provision manually on purchases.'} · Spent this calendar year: ${money(provisionTransactions(p).filter(t=>t.date.slice(0,4)===today.slice(0,4)).reduce((v,t)=>v+signedSpend(t),0))} / ${money(p.target)}</p>`}<div class="recurring-actions"><button type="button" class="secondary" data-prov-edit="${esc(p.id)}">Edit</button><button type="button" class="secondary" data-prov-pause="${esc(p.id)}">${p.paused?'Resume':'Pause'}</button><button type="button" class="danger" data-prov-delete="${esc(p.id)}">Remove</button></div></div></details>`
 }).join(''):'<p class="muted">No annual provisions set up.</p>';
 list.querySelectorAll('[data-prov-edit]').forEach(b=>b.onclick=()=>{
  const p=f.provisions.find(x=>x.id===b.dataset.provEdit);if(!p)return;
  $('provEditId').value=p.id;$('provKind').value=p.type;$('provKind').onchange();$('provName').value=p.name;$('provRule').value=p.ruleId||'';$('provTarget').value=(p.target/100).toFixed(2);$('provDue').value=p.due||'';$('provCategory').value=p.category||'';$('provRule').onchange();
  $('provOpeningFields').hidden=true;$('provSave').textContent='Save future changes';$('provCancel').hidden=false;
  $('provisionForm').scrollIntoView({behavior:'smooth',block:'start'});
 });
 list.querySelectorAll('[data-prov-pause]').forEach(b=>b.onclick=async()=>{const p=f.provisions.find(x=>x.id===b.dataset.provPause);if(!p)return;p.paused=!p.paused;await saveRender()});
 list.querySelectorAll('[data-prov-delete]').forEach(b=>b.onclick=async()=>{
  const p=f.provisions.find(x=>x.id===b.dataset.provDelete);if(!p)return;
  if(!confirm('Remove this provision? Existing transactions remain, but its allowance history and adjustments will no longer appear.'))return;
  f.provisions=f.provisions.filter(x=>x.id!==p.id);delete f.provisionMonths[p.id];await saveRender();
 });
 provisionSelectOptions();updateEntryAutoProvision();
}
function provisionSelectOptions(){
 const options=finance().provisions.filter(p=>p.type==='allowance');
 for(const id of ['entryProvision','editProvision']){
  const el=$(id);if(!el)continue;const old=el.value;
  el.innerHTML='<option value="">None — ordinary spending</option>'+options.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if(options.some(p=>p.id===old))el.value=old;
 }
}
function autoProvisionForCategory(category){return finance().provisions.find(p=>p.type==='allowance'&&p.category===category&&!p.paused)?.id||'';}
function updateEntryAutoProvision(){if(!$('entryProvision').dataset.manual)$('entryProvision').value=autoProvisionForCategory($('category').value);}
function resetProvisionForm(){
 $('provisionForm').reset();$('provEditId').value='';$('provOpeningFields').hidden=false;$('provSave').textContent='Add annual provision';$('provCancel').hidden=true;$('provKind').onchange();$('provDue').value='';$('provCategory').value='';
}
function setupProvisions(){
 $('provCancel').onclick=resetProvisionForm;
 $('category').addEventListener('change',()=>{$('entryProvision').dataset.manual='';updateEntryAutoProvision()});
 $('entryProvision').addEventListener('change',()=>{$('entryProvision').dataset.manual='1'});
 $('editCategory').addEventListener('change',()=>{if($('editCategory').value!==$('editCategory').dataset.originalCategory){$('editProvision').value=autoProvisionForCategory($('editCategory').value)}});
 $('provisionForm').onsubmit=async e=>{
  e.preventDefault();const f=finance(),id=$('provEditId').value,type=$('provKind').value,ruleId=type==='bill'?$('provRule').value:'',rule=f.recurring.find(r=>r.id===ruleId),name=type==='bill'?rule?.description:$('provName').value.trim(),target=type==='bill'?rule?.amount:cents($('provTarget').value),opening=cents($('provOpening').value||'0'),due=type==='bill'&&rule?provisionNextDue({type:'bill',ruleId:rule.id,due:rule.start},iso(new Date())):'',category=type==='allowance'?$('provCategory').value:'',today=iso(new Date());
  if(!name||!Number.isSafeInteger(target)||target<=0)return alert('Enter a valid provision and positive annual amount.');
  if(category&&f.provisions.some(p=>p.id!==id&&p.type==='allowance'&&p.category===category))return alert('That category is already linked to another annual allowance.');
  if(type==='bill'&&(!rule||rule.type!=='expense'||rule.frequency!=='yearly'))return alert('Choose a yearly recurring expense.');
  if(type==='bill'&&f.provisions.some(p=>p.id!==id&&p.ruleId===ruleId))return alert('That recurring expense already has a provision.');
  if(id){const p=f.provisions.find(x=>x.id===id);if(!p)return alert('Provision not found.');
   Object.assign(p,{type,name,target,due,ruleId,category});
  }else{
   if(!Number.isSafeInteger(opening)||opening<0)return alert('Opening provision must be zero or positive.');
   f.provisions.push({id:crypto.randomUUID(),type,name,target,due,ruleId,category,opening,start:today,paused:false});
  }
  provisionAccrue();resetProvisionForm();await saveRender();
 };
}
function renderTrend(){
  const rows=[];
  for(let n=11;n>=0;n--){const d=new Date(month.getFullYear(),month.getMonth()-n,1);rows.push({date:d,key:ym(d),...monthPerformance(ym(d))})}
  const totals=rows.reduce((a,r)=>({income:a.income+r.income,spent:a.spent+r.spent}),{income:0,spent:0});
  const net=totals.income-totals.spent;
  $('yearTotals').innerHTML=`<div>Income <strong>${money(totals.income)}</strong></div><div>Spending <strong>${money(totals.spent)}</strong></div><div>Surplus / deficit <strong class="${net<0?'negative':''}">${net>=0?'+':''}${money(net)}</strong></div><div>Projected month surplus <strong id="projectedMonthSurplus"></strong><small id="projectedMonthLabel"></small></div>`;
  const projected=projectedMonthSurplus(month);
  const projectionValue=$('projectedMonthSurplus');
  projectionValue.textContent=projected===null?'—':`${projected>=0?'+':''}${money(projected)}`;
  projectionValue.classList.toggle('negative',projected!==null&&projected<0);
  $('projectedMonthLabel').textContent=projected===null?'Past month — actual figures above':label(month)+' · scheduled items remaining';
  const max=Math.max(1,...rows.flatMap(r=>[r.income,r.spent]));
  $('yearTrend').innerHTML=rows.map(r=>`<div class="trend-row"><span>${esc(new Intl.DateTimeFormat('en-GB',{month:'short',year:'2-digit'}).format(r.date))}</span><div class="trend-bars"><div class="trend-bar income" style="width:${Math.max(0,r.income/max*100)}%" title="Income ${money(r.income)}"></div><div class="trend-bar spend" style="width:${Math.max(0,r.spent/max*100)}%" title="Spending ${money(r.spent)}"></div></div><strong class="${r.net<0?'negative':''}">${r.net>=0?'+':''}${money(r.net)}</strong></div>`).join('')+'<p class="muted">Green: income · Orange: spending · Right: monthly surplus / deficit</p>';
}
function renderProjection(){
  const f=finance(),today=iso(new Date()),last=iso(new Date(new Date().getFullYear(),new Date().getMonth()+1,0));
  const list=$('projectionSchedule');
  if(!f.startDate||f.startDate>today){$('projectedBalance').textContent='Not set up';$('projectionDetail').textContent='Set an opening date to activate projections.';list.innerHTML='';return}
  const opening=financeMovements().current||0,events=[];
  for(const rule of f.recurring){if(rule.paused)continue;
    for(let n=0;n<2400;n++){
      const date=nextRecurringDate(rule,n);
      if(date>last||(rule.end&&date>rule.end))break;
      if(date<=today||date<f.startDate||occurrenceExists(recurringKey(rule,date)))continue;
      let movement=0;
      if(rule.type==='expense'&&rule.payFrom!=='credit')movement=-rule.amount;
      else if(rule.type==='income'&&rule.account==='current')movement=rule.amount;
      else if(rule.type==='transfer'){
        if(rule.from==='current')movement-=rule.amount;
        if(rule.to==='current')movement+=rule.amount;
      }
      if(movement)events.push({date,movement,description:rule.description||'Scheduled transaction',id:rule.id});
    }
  }
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description)||a.id.localeCompare(b.id));
  let balance=opening,firstNegative=null;
  const lines=events.map(e=>{
    balance+=e.movement;
    if(balance<0&&!firstNegative)firstNegative=e.date;
    return `<div class="projection-row${balance<0?' projection-overdrawn':''}"><div><strong>${esc(e.description)}</strong><small>${esc(e.date)}</small></div><div class="projection-values"><span>${e.movement>=0?'+':'−'}${money(Math.abs(e.movement))}</span><strong>${money(balance)}</strong></div></div>`;
  });
  $('projectedBalance').textContent=money(balance);
  $('projectedBalance').classList.toggle('negative',balance<0);
  $('projectionDetail').textContent=`Current recorded balance ${money(opening)} · ${events.length} scheduled movement${events.length===1?'':'s'} remaining · Net scheduled change ${balance-opening>=0?'+':''}${money(balance-opening)}. Excludes unplanned spending, variable bill changes and any credit-card payment not scheduled as a transfer.`;
  list.innerHTML=`<div class="projection-head"><span>Scheduled transaction</span><span>Change / balance after</span></div>${lines.join('')||'<p class="muted">No further scheduled current-account movements this month.</p>'}${firstNegative?`<p class="projection-alert">⚠ Projected overdraft from ${esc(firstNegative)}. Consider transferring money into the current account before this date.</p>`:''}`;
}

// v24: read-only statement ledger. Never changes the authoritative credit balance.
function creditCycle(){const f=finance();const c=f.creditCycle||{};return {statementDay:Math.max(1,Math.min(31,Number(c.statementDay)||8)),dueDay:Math.max(1,Math.min(31,Number(c.dueDay)||16))}}
function ccDate(y,m,day){return iso(new Date(y,m,Math.min(day,new Date(y,m+1,0).getDate())))}
function ccStatementFor(date,day){const [y,m]=date.slice(0,7).split('-').map(Number);const current=ccDate(y,m-1,day);return date<=current?current:ccDate(y,m,day)}
function ccNextStatement(date,day){const [y,m]=date.slice(0,7).split('-').map(Number);return ccDate(y,m,day)}
function ccDue(statement,dueDay){const [y,m]=statement.slice(0,7).split('-').map(Number);return ccDate(y,m,dueDay)}
function creditStatementLedger(){
 const f=finance(),cycle=creditCycle(),today=iso(new Date());if(!f.startDate)return null;
 const initial=ccStatementFor(f.startDate,cycle.statementDay);
 const rows=new Map();const rowFor=(date)=>{const key=ccStatementFor(date,cycle.statementDay);if(!rows.has(key))rows.set(key,{date:key,due:ccDue(key,cycle.dueDay),charges:0,credits:0,paid:0,items:[],opening:0});return rows.get(key)};
 // Opening balance is a carried-forward liability; do not invent a historical statement.
 if(f.creditOpening){const r=rowFor(f.startDate);r.opening+=f.creditOpening;r.items.push({date:f.startDate,label:'Opening card balance (historical statement unknown)',amount:f.creditOpening})}
 const movements=[];
 for(const t of data.transactions){if(t.date<f.startDate||!isCredit(t))continue;movements.push({date:t.date,id:t.id,amount:signedSpend(t),kind:'purchase',label:t.merchant||'Purchase'})}
 for(const t of f.entries){if(t.date<f.startDate)continue;let amount=0,kind='';if(t.type==='transfer'){if(t.to==='credit'){amount=-t.amount;kind='payment'}else if(t.from==='credit'){amount=t.amount;kind='charge'}}else if(t.type==='income'&&t.account==='credit'){amount=-t.amount;kind='credit'}if(kind)movements.push({date:t.date,id:t.id,amount,kind,label:t.description||kind})}
 movements.sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
 // Build dated statement obligations first, then apply payments oldest-first as they occur.
 for(const v of movements){if(v.kind==='purchase'||v.kind==='charge'){const r=rowFor(v.date);if(v.amount>=0)r.charges+=v.amount;else r.credits+=-v.amount;r.items.push(v)} }
 const issued=[...rows.values()].filter(r=>r.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 // Payment allocation respects statement issuance: payments made before a statement close
 // are kept as a credit and applied once a statement becomes due.
 let unapplied=0;const paymentEvents=movements.filter(v=>v.kind==='payment'||v.kind==='credit'||(v.kind==='purchase'&&v.amount<0)).sort((a,b)=>a.date.localeCompare(b.date));
 const payTo=(value,upTo)=>{let left=value;for(const r of issued){if(r.date>upTo)break;const remaining=Math.max(0,r.opening+r.charges-r.credits-r.paid);const used=Math.min(left,remaining);r.paid+=used;left-=used;if(!left)break}return left};
 // Allocate refunds against oldest liabilities too, but avoid counting them twice.
 // Rebuild statement charges without negative purchase credits to preserve the reconciliation.
 for(const r of rows.values())r.credits=0;
 const creditEvents=movements.filter(v=>v.kind==='payment'||v.kind==='credit'||(v.kind==='purchase'&&v.amount<0));
 for(const v of creditEvents){unapplied+=-v.amount;unapplied=payTo(unapplied,v.date)}
 if(unapplied)unapplied=payTo(unapplied,today);
 const all=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const balance=financeMovements().credit;
 const billed=issued.reduce((n,r)=>n+Math.max(0,r.opening+r.charges-r.paid),0);
 const unbilled=all.filter(r=>r.date>today).reduce((n,r)=>n+r.opening+r.charges,0);
 const reconcile=balance-(billed+unbilled-unapplied);
 return {rows:all,issued,billed,unbilled,unapplied,balance,reconcile,today,cycle};
}
function renderCreditStatements(){
 const summary=$('creditStatementSummary'),history=$('creditStatementHistory');if(!summary||!history)return;
 const ledger=creditStatementLedger();if(!ledger){summary.innerHTML='<p class="muted">Set your financial tracking start date and opening balances in Settings.</p>';history.innerHTML='';return}
 const {rows,issued,billed,unbilled,balance,reconcile,today}=ledger;
 const latest=issued.at(-1);const overdue=issued.reduce((n,r)=>n+(r.due<today?Math.max(0,r.opening+r.charges-r.paid):0),0);
 const nextDue=issued.find(r=>r.opening+r.charges-r.paid>0);
 summary.innerHTML=`<div class="finance-account-row"><span>Current card balance (authoritative)</span><strong>${money(balance)}</strong></div><div class="finance-account-row"><span>Issued statement balances unpaid</span><strong>${money(billed)}</strong></div><div class="finance-account-row"><span>Unbilled card spending</span><strong>${money(unbilled)}</strong></div>${ledger.unapplied?`<div class="finance-account-row"><span>Payments / credits awaiting allocation</span><strong>−${money(ledger.unapplied)}</strong></div>`:''}<div class="finance-account-row"><span>Next outstanding statement payment</span><strong>${nextDue?money(Math.max(0,nextDue.opening+nextDue.charges-nextDue.paid))+' · '+nextDue.due:'None'}</strong></div>${overdue?`<p class="warning">Overdue statement balance: ${money(overdue)}</p>`:''}${Math.abs(reconcile)>1?`<p class="warning">Statement reconciliation difference: ${money(reconcile)}. Check opening balance, dates and historical payments; the card balance above is unchanged.</p>`:''}<p class="muted">Statement cut-off: day ${ledger.cycle.statementDay}. Due: day ${ledger.cycle.dueDay} of the following month. The opening card balance is carried forward without assuming a historical statement.</p>`;
 history.innerHTML=rows.filter(r=>r.date<=ccNextStatement(today,ledger.cycle.statementDay)).slice(-18).reverse().map(r=>{const due=Math.max(0,r.opening+r.charges-r.paid),future=r.date>today;const status=future?'Current cycle':due===0?'Paid':r.due<today?'Overdue':r.paid>0?'Part paid':'Unpaid';return `<details class="cc-statement-row"><summary>${esc(r.date)} · ${esc(status)} · ${money(due)} remaining</summary><div class="finance-account-row"><span>Payment due</span><strong>${r.due}</strong></div><div class="finance-account-row"><span>Opening carried forward</span><strong>${money(r.opening)}</strong></div><div class="finance-account-row"><span>Purchases / charges</span><strong>${money(r.charges)}</strong></div><div class="finance-account-row"><span>Payments and credits allocated</span><strong>${money(r.paid)}</strong></div><div class="finance-account-row"><span>Still outstanding</span><strong>${money(due)}</strong></div>${r.items.map(v=>`<div class="finance-account-row"><span>${esc(v.date)} · ${esc(v.label)}</span><span>${money(v.amount)}</span></div>`).join('')}</details>`}).join('')||'<p class="muted">No credit-card transactions recorded yet.</p>';
}
function renderCreditCycleSettings(){const c=creditCycle();for(const [id,val] of [['ccStatementDay',c.statementDay],['ccDueDay',c.dueDay]]){const el=$(id);if(!el)return;el.innerHTML=Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');el.value=String(val)}}

function renderDashboard(){renderCreditStatements();renderBudgetPlan();renderTrend();renderProjection();provisionDashboard();let ts=forMonth(month),total=sum(ts),budget=Object.values(data.budgets).reduce((a,b)=>a+b,0);$('monthLabel').textContent=label(month);$('monthSpend').textContent=money(total);$('monthBudget').textContent=money(budget);bars($('categoryBars'),data.categories.map(c=>[c,sum(ts.filter(t=>t.category===c))]).filter(x=>x[1]!==0),Math.max(total,1));bars($('cardBars'),data.cards.map(c=>[c,sum(ts.filter(t=>t.card===c))]),Math.max(total,1));let used=data.categories.filter(c=>(data.budgets[c]||0)>0);$('budgetBars').innerHTML=used.length?used.map(c=>{let spent=sum(ts.filter(t=>t.category===c)),limit=data.budgets[c];return `<div class="bar-item"><div class="inline"><span>${esc(c)}</span><strong>${money(spent)} / ${money(limit)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,spent/limit*100))}%"></div></div>${spent>limit?'<small class="warning">Over budget</small>':''}</div>`}).join(''):'<p class="muted">Set monthly category budgets in Settings.</p>'}
function renderHistory(){let q=$('search').value.toLowerCase().trim();$('historyMonth').textContent=label(histMonth);let ts=forMonth(histMonth).filter(t=>[t.merchant,t.category,t.card,t.notes].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);$('historyList').innerHTML=ts.length?ts.map(t=>`<button type="button" class="transaction" data-id="${esc(t.id)}"><span class="transaction-line"><strong>${t.recurringKey?'↻ ':''}${t.refund?'↩ Refund · ':''}${t.provisionId?'◈ ':''}${esc(t.merchant||'Purchase')}</strong><span class="tx-sep"> · </span><span>${esc(t.date)}</span><span class="tx-sep"> · </span><span>${esc(t.category)}</span><span class="tx-sep"> · </span><span>${esc(t.card)}</span><span class="tx-sep"> · </span><strong class="transaction-amount">${money(signedSpend(t))}</strong></span></button>`).join(''):'<p class="muted">No matching transactions.</p>';const extras=financeHistory();if(extras.length){const all=[...extras,...ts.map(t=>({date:t.date,created:t.created,html:`<button type="button" class="transaction" data-id="${esc(t.id)}"><span class="transaction-line"><strong>${t.recurringKey?'↻ ':''}${t.refund?'↩ Refund · ':''}${t.provisionId?'◈ ':''}${esc(t.merchant||'Purchase')}</strong> · ${esc(t.date)} · ${esc(t.category)} · ${esc(t.card)} · <strong class="transaction-amount">${money(signedSpend(t))}</strong></span></button>`}))].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);$('historyList').innerHTML=all.map(x=>x.html).join('')} $('historyList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openEdit(b.dataset.id));$('historyList').querySelectorAll('[data-finance-id]').forEach(b=>b.onclick=()=>openFinanceEdit(b.dataset.financeId))}
async function saveRender(){await dbSave();renderAll()}
function showView(name){document.querySelectorAll('main section.view').forEach(s=>{s.classList.toggle('active',s.id===name);s.hidden=s.id!==name});document.querySelectorAll('nav button[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));if(name==='dashboard'){renderDashboard();renderFinance();}if(name==='history')renderHistory()}
function openEdit(id){let t=data.transactions.find(t=>t.id===id);if(!t)return;$('editId').value=id;$('editDate').value=t.date;$('editAmount').value=(t.amount/100).toFixed(2);$('editMerchant').value=t.merchant;$('editCategory').value=t.category;$('editCard').value=t.card;$('editNotes').value=t.notes||'';$('editKind').value=t.refund?'refund':'purchase';$('editProvision').value=t.provisionId||'';$('editCategory').dataset.originalCategory=t.category;$('editDialog').showModal();$('editHeading').focus({preventScroll:true})}
function download(content,name,type){let url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportCSV(){let rows=[['Date','Card','Merchant','Category','Amount (GBP)','Notes'],...data.transactions.map(t=>[t.date,t.card,t.merchant,t.category,(signedSpend(t)/100).toFixed(2),t.notes||''])];let csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');download('\ufeff'+csv,'spending-transactions-'+iso(new Date())+'.csv','text/csv;charset=utf-8')}
function validateBackup(v){return v&&Array.isArray(v.transactions)&&Array.isArray(v.cards)&&v.cards.length===2&&v.cards.every(x=>typeof x==='string')&&Array.isArray(v.categories)&&v.categories.every(x=>typeof x==='string')&&v.budgets&&typeof v.budgets==='object'&&v.transactions.every(t=>typeof t.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&Number.isSafeInteger(t.amount)&&typeof t.category==='string'&&typeof t.card==='string'&&typeof t.merchant==='string')}
async function init(){try{db=await openDB();let stored=await dbGet();if(stored&&validateBackup(stored))data=stored;else await dbSave();normalizeCategories();finance();await catchUpRecurring();if(provisionAccrue())await dbSave();initAmountEntry();$('entryDate').value=iso(new Date());$('todayLabel').textContent=new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date());$('entryMonth').textContent=label(new Date());renderAll();setupSettingsAccordion();setupProvisions();document.querySelectorAll('nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));showView('entry');$('entryForm').onsubmit=async e=>{e.preventDefault();let amount=cents($('amount').value),merchant=$('merchant').value.trim();if(!Number.isSafeInteger(amount)||amount<=0||!merchant)return alert('Enter a valid positive amount and merchant.');let t={id:crypto.randomUUID(),date:$('entryDate').value,card:data.cards[selectedCard],merchant,category:$('category').value,amount,refund:$('entryKind').value==='refund',notes:$('notes').value.trim(),provisionId:$('entryProvision').dataset.manual?$('entryProvision').value:($('entryProvision').value||autoProvisionForCategory($('category').value)),created:Date.now()};data.transactions.push(t);await saveRender();$('savedMessage').textContent=`Saved ${t.refund?'refund ':' '}${money(amount)} · ${merchant} · ${t.category} · ${t.card}`;$('entryForm').reset();$('entryProvision').dataset.manual='';updateEntryAutoProvision();$('entryDate').value=iso(new Date());$('amount').focus()};$('saveCreditCycle').onclick=async()=>{finance().creditCycle={statementDay:Number($('ccStatementDay').value),dueDay:Number($('ccDueDay').value)};await saveRender();$('ccCycleStatus').textContent='Statement dates saved. Existing transactions and balances are unchanged.'};$('saveCards').onclick=async()=>{let names=[$('card0').value.trim(),$('card1').value.trim()];if(names.some(x=>!x)||names[0]===names[1])return alert('Enter two different card names.');data.cards.forEach((old,i)=>data.transactions.forEach(t=>{if(t.card===old)t.card=names[i]}));data.cards=names;await saveRender()};$('savePlannedIncome').onclick=async()=>{const raw=$('plannedIncome').value.trim(),amount=cents(raw);if(!raw||!Number.isSafeInteger(amount)||amount<0)return alert('Enter a valid expected monthly income.');finance().plannedMonthlyIncome=amount;await saveRender();$('plannedIncomeStatus').textContent='Expected income saved.'};$('saveBudgets').onclick=async()=>{document.querySelectorAll('[data-budget]').forEach(el=>{let n=cents(el.value);data.budgets[el.dataset.budget]=Number.isSafeInteger(n)&&n>=0?n:0});await saveRender()};$('addCategory').onclick=async()=>{let c=$('newCategory').value.trim();if(!c||data.categories.some(x=>x.toLowerCase()===c.toLowerCase()))return alert('Enter a new, unique category.');data.categories.splice(Math.max(0,data.categories.indexOf('Other')),0,c);$('newCategory').value='';await saveRender()};$('prevMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderDashboard()};$('nextMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderDashboard()};$('histPrev').onclick=()=>{histMonth=new Date(histMonth.getFullYear(),histMonth.getMonth()-1,1);renderHistory()};$('histNext').onclick=()=>{histMonth=new Date(histMonth.getFullYear(),histMonth.getMonth()+1,1);renderHistory()};$('search').oninput=renderHistory;$('cancelEdit').onclick=()=>$('editDialog').close();$('editForm').onsubmit=async e=>{e.preventDefault();let t=data.transactions.find(t=>t.id===$('editId').value),amount=cents($('editAmount').value);if(!t||!Number.isSafeInteger(amount)||amount<=0)return alert('Enter a valid amount.');Object.assign(t,{date:$('editDate').value,amount,merchant:$('editMerchant').value.trim(),category:$('editCategory').value,card:$('editCard').value,refund:$('editKind').value==='refund',notes:$('editNotes').value.trim(),provisionId:$('editProvision').value||''});if(!t.merchant)return alert('Merchant is required.');await saveRender();$('editDialog').close()};$('deleteTx').onclick=async()=>{if(!confirm('Delete this transaction permanently?'))return;skipRecurringIfDeleted(data.transactions.find(t=>t.id===$('editId').value));data.transactions=data.transactions.filter(t=>t.id!==$('editId').value);await saveRender();$('editDialog').close()};$('exportCSV').onclick=exportCSV;$('backup').onclick=()=>{download(JSON.stringify({...data,backupVersion:4,exportedAt:new Date().toISOString()},null,2),'spending-backup-'+iso(new Date())+'.json','application/json');$('backupStatus').textContent='Backup file created. Save it in iCloud Drive.'};$('restoreFile').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{let parsed=JSON.parse(await f.text());if(!validateBackup(parsed))throw Error('Not a valid spending backup');if(!confirm(`Replace current data with ${parsed.transactions.length} transactions from this backup?`))return;data={transactions:parsed.transactions,cards:parsed.cards,categories:parsed.categories,budgets:parsed.budgets,finance:parsed.finance||{}};normalizeCategories();await saveRender();$('backupStatus').textContent='Backup restored successfully.'}catch(err){alert('Restore failed: '+err.message)}finally{e.target.value=''}};$('saveFinanceSetup').onclick=async()=>{const f=finance(),date=$('financeStart').value,cur=cents($('currentOpening').value),credit=cents($('creditOpening').value);if(!date||!Number.isSafeInteger(cur)||!Number.isSafeInteger(credit)||cur<0||credit<0)return alert('Enter a start date and valid positive or zero balances.');if(f.startDate&&f.startDate!==date&&!confirm('Changing the opening date changes which purchases affect account balances. Continue?'))return;f.startDate=date;f.currentOpening=cur;f.creditOpening=credit;await saveRender()};
$('addSaving').onclick=async()=>{const name=$('savingName').value.trim(),opening=cents($('savingOpening').value);if(!name||!Number.isSafeInteger(opening)||opening<0)return alert('Enter an account name and valid balance.');if(finance().savings.some(a=>a.name.toLowerCase()===name.toLowerCase()))return alert('Account already exists.');finance().savings.push({id:crypto.randomUUID(),name,opening});$('savingName').value='';$('savingOpening').value='';await saveRender()};
$('financeForm').onsubmit=async e=>{e.preventDefault();const type=$('financeEntryType').value,amount=cents($('financeAmount').value),date=$('financeDate').value,description=$('financeDescription').value.trim();if(!date||!Number.isSafeInteger(amount)||amount<=0)return alert('Enter a valid amount and date.');const entry={id:crypto.randomUUID(),type,amount,date,description,created:Date.now()};if(type==='income')entry.account=$('incomeAccount').value;else{entry.from=$('transferFrom').value;entry.to=$('transferTo').value;if(entry.from===entry.to)return alert('Choose two different accounts.')}finance().entries.push(entry);await saveRender();$('financeMessage').textContent=`Saved ${type}: ${money(amount)}`;$('financeForm').reset();$('financeDate').value=iso(new Date());$('financeEntryType').onchange()};
$('financeEditCancel').onclick=()=>$('financeDialog').close();$('financeEditForm').onsubmit=async e=>{e.preventDefault();const t=finance().entries.find(x=>x.id===$('financeEditId').value),amount=cents($('financeEditAmount').value);if(!t||!Number.isSafeInteger(amount)||amount<=0)return alert('Enter a valid amount.');t.amount=amount;t.date=$('financeEditDate').value;t.description=$('financeEditDescription').value.trim();if(t.type==='income')t.account=$('financeEditAccount').value;else{t.from=$('financeEditFrom').value;t.to=$('financeEditTo').value;if(t.from===t.to)return alert('Choose different accounts.')}await saveRender();$('financeDialog').close()};
$('financeEditDelete').onclick=async()=>{if(!confirm('Delete this transaction?'))return;skipRecurringIfDeleted(finance().entries.find(x=>x.id===$('financeEditId').value));finance().entries=finance().entries.filter(x=>x.id!==$('financeEditId').value);await saveRender();$('financeDialog').close()};

$('recCancelEdit').onclick=()=>{$('recurringForm').reset();$('recEditId').value='';$('recFormTitle').textContent='Add recurring transaction';$('recSubmit').textContent='Add recurring transaction';$('recCancelEdit').hidden=true;$('recStart').value=iso(new Date());$('recType').onchange();$('recStatus').textContent='';};
$('recurringForm').onsubmit=async e=>{e.preventDefault();const f=finance(),type=$('recType').value,description=$('recDescription').value.trim(),amount=cents($('recAmount').value),start=$('recStart').value,end=$('recEnd').value,frequency=$('recFrequency').value;
  if(!f.startDate)return alert('Set the financial tracking start date in Everyday accounts first.');
  if(!description||!Number.isSafeInteger(amount)||amount<=0||!start||end&&end<start)return alert('Enter a description, positive amount and valid dates.');
  const editId=$('recEditId').value;
  if(editId&&start<=iso(new Date()))return alert('For edits, choose a future first due date. Existing transactions are preserved.');
  if(!editId&&start<iso(new Date())&&!confirm('This start date is in the past. All due transactions from this date onwards will be added to History. Continue?'))return;
  const r={type,description,amount,start,end,frequency};
  if(type==='expense'){r.category=$('recCategory').value;r.payFrom=$('recPayFrom').value}
  else if(type==='income')r.account=$('recIncomeAccount').value;
  else{r.from=$('recFrom').value;r.to=$('recTo').value;if(r.from===r.to)return alert('Choose two different accounts.')}
  if(editId){
    const previous=f.recurring.find(x=>x.id===editId);if(!previous)return alert('Schedule no longer exists.');
    // Retain the schedule ID and its pause status; existing History is unchanged.
    Object.assign(previous,r);
  }else{
    f.recurring.push({id:crypto.randomUUID(),...r,paused:false});
  }
  const count=await catchUpRecurring();await saveRender();$('recStatus').textContent=`Schedule saved${count?' · '+count+' transaction(s) added':''}.`;
  $('recurringForm').reset();$('recStart').value=iso(new Date());
  $('recEditId').value='';$('recFormTitle').textContent='Add recurring transaction';$('recSubmit').textContent='Add recurring transaction';$('recCancelEdit').hidden=true;
};
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});}catch(e){alert('Local storage could not be opened. Use Safari on a secure HTTPS site. '+e.message)}}
document.addEventListener('DOMContentLoaded',init);
