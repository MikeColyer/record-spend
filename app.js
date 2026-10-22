
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
function finance(){if(!data.finance||typeof data.finance!=='object')data.finance={};const f=data.finance;f.startDate=typeof f.startDate==='string'?f.startDate:'';f.currentOpening=Number.isSafeInteger(f.currentOpening)?f.currentOpening:0;f.creditOpening=Number.isSafeInteger(f.creditOpening)?f.creditOpening:0;f.savings=Array.isArray(f.savings)?f.savings:[];f.entries=Array.isArray(f.entries)?f.entries:[];f.recurring=Array.isArray(f.recurring)?f.recurring:[];f.recurringSkipped=Array.isArray(f.recurringSkipped)?f.recurringSkipped:[];return f}
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
function renderAll(){selectOptions($('category'),data.categories);selectOptions($('editCategory'),data.categories);selectOptions($('editCard'),data.cards);renderChoices();renderSettings();renderDashboard();renderFinance();renderHistory()}
function forMonth(d){return data.transactions.filter(t=>t.date.slice(0,7)===ym(d))}
function sum(ts){return ts.reduce((a,t)=>a+signedSpend(t),0)}
function bars(root,items,total){root.innerHTML=items.length?items.map(([name,value])=>`<div class="bar-item"><div class="inline"><span>${esc(name)}</span><strong>${money(value)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,total>0?value/total*100:0))}%"></div></div></div>`).join(''):'<p class="muted">No spending recorded for this month.</p>'}
// Stage 3: reporting is derived from existing transactions; no additional stored data.
function monthPerformance(monthKey){
  const income=finance().entries.filter(t=>t.type==='income'&&t.date.slice(0,7)===monthKey).reduce((a,t)=>a+t.amount,0);
  const spent=data.transactions.filter(t=>t.date.slice(0,7)===monthKey).reduce((a,t)=>a+signedSpend(t),0);
  return {income,spent,net:income-spent};
}
function renderTrend(){
  const rows=[];
  for(let n=11;n>=0;n--){const d=new Date(month.getFullYear(),month.getMonth()-n,1);rows.push({date:d,key:ym(d),...monthPerformance(ym(d))})}
  const totals=rows.reduce((a,r)=>({income:a.income+r.income,spent:a.spent+r.spent}),{income:0,spent:0});
  const net=totals.income-totals.spent;
  $('yearTotals').innerHTML=`<div>Income <strong>${money(totals.income)}</strong></div><div>Spending <strong>${money(totals.spent)}</strong></div><div>Surplus / deficit <strong class="${net<0?'negative':''}">${net>=0?'+':''}${money(net)}</strong></div>${totals.income?`<div>Income spent <strong>${Math.round(totals.spent/totals.income*100)}%</strong></div>`:''}`;
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
function renderDashboard(){renderTrend();renderProjection();let ts=forMonth(month),total=sum(ts),budget=Object.values(data.budgets).reduce((a,b)=>a+b,0);$('monthLabel').textContent=label(month);$('monthSpend').textContent=money(total);$('monthBudget').textContent=money(budget);bars($('categoryBars'),data.categories.map(c=>[c,sum(ts.filter(t=>t.category===c))]).filter(x=>x[1]!==0),Math.max(total,1));bars($('cardBars'),data.cards.map(c=>[c,sum(ts.filter(t=>t.card===c))]),Math.max(total,1));let used=data.categories.filter(c=>(data.budgets[c]||0)>0);$('budgetBars').innerHTML=used.length?used.map(c=>{let spent=sum(ts.filter(t=>t.category===c)),limit=data.budgets[c];return `<div class="bar-item"><div class="inline"><span>${esc(c)}</span><strong>${money(spent)} / ${money(limit)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(0,spent/limit*100))}%"></div></div>${spent>limit?'<small class="warning">Over budget</small>':''}</div>`}).join(''):'<p class="muted">Set monthly category budgets in Settings.</p>'}
function renderHistory(){let q=$('search').value.toLowerCase().trim();$('historyMonth').textContent=label(histMonth);let ts=forMonth(histMonth).filter(t=>[t.merchant,t.category,t.card,t.notes].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);$('historyList').innerHTML=ts.length?ts.map(t=>`<button type="button" class="transaction" data-id="${esc(t.id)}"><span class="transaction-line"><strong>${t.recurringKey?'↻ ':''}${t.refund?'↩ Refund · ':''}${esc(t.merchant||'Purchase')}</strong><span class="tx-sep"> · </span><span>${esc(t.date)}</span><span class="tx-sep"> · </span><span>${esc(t.category)}</span><span class="tx-sep"> · </span><span>${esc(t.card)}</span><span class="tx-sep"> · </span><strong class="transaction-amount">${money(signedSpend(t))}</strong></span></button>`).join(''):'<p class="muted">No matching transactions.</p>';const extras=financeHistory();if(extras.length){const all=[...extras,...ts.map(t=>({date:t.date,created:t.created,html:`<button type="button" class="transaction" data-id="${esc(t.id)}"><span class="transaction-line"><strong>${t.recurringKey?'↻ ':''}${t.refund?'↩ Refund · ':''}${esc(t.merchant||'Purchase')}</strong> · ${esc(t.date)} · ${esc(t.category)} · ${esc(t.card)} · <strong class="transaction-amount">${money(signedSpend(t))}</strong></span></button>`}))].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);$('historyList').innerHTML=all.map(x=>x.html).join('')} $('historyList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openEdit(b.dataset.id));$('historyList').querySelectorAll('[data-finance-id]').forEach(b=>b.onclick=()=>openFinanceEdit(b.dataset.financeId))}
async function saveRender(){await dbSave();renderAll()}
function showView(name){document.querySelectorAll('main section.view').forEach(s=>{s.classList.toggle('active',s.id===name);s.hidden=s.id!==name});document.querySelectorAll('nav button[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));if(name==='dashboard'){renderDashboard();renderFinance();}if(name==='history')renderHistory()}
function openEdit(id){let t=data.transactions.find(t=>t.id===id);if(!t)return;$('editId').value=id;$('editDate').value=t.date;$('editAmount').value=(t.amount/100).toFixed(2);$('editMerchant').value=t.merchant;$('editCategory').value=t.category;$('editCard').value=t.card;$('editNotes').value=t.notes||'';$('editKind').value=t.refund?'refund':'purchase';$('editDialog').showModal();$('editHeading').focus({preventScroll:true})}
function download(content,name,type){let url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportCSV(){let rows=[['Date','Card','Merchant','Category','Amount (GBP)','Notes'],...data.transactions.map(t=>[t.date,t.card,t.merchant,t.category,(signedSpend(t)/100).toFixed(2),t.notes||''])];let csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');download('\ufeff'+csv,'spending-transactions-'+iso(new Date())+'.csv','text/csv;charset=utf-8')}
function validateBackup(v){return v&&Array.isArray(v.transactions)&&Array.isArray(v.cards)&&v.cards.length===2&&v.cards.every(x=>typeof x==='string')&&Array.isArray(v.categories)&&v.categories.every(x=>typeof x==='string')&&v.budgets&&typeof v.budgets==='object'&&v.transactions.every(t=>typeof t.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&Number.isSafeInteger(t.amount)&&typeof t.category==='string'&&typeof t.card==='string'&&typeof t.merchant==='string')}
async function init(){try{db=await openDB();let stored=await dbGet();if(stored&&validateBackup(stored))data=stored;else await dbSave();normalizeCategories();finance();await catchUpRecurring();initAmountEntry();$('entryDate').value=iso(new Date());$('todayLabel').textContent=new Intl.DateTimeFormat('en-GB',{dateStyle:'full'}).format(new Date());$('entryMonth').textContent=label(new Date());renderAll();setupSettingsAccordion();document.querySelectorAll('nav button[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));showView('entry');$('entryForm').onsubmit=async e=>{e.preventDefault();let amount=cents($('amount').value),merchant=$('merchant').value.trim();if(!Number.isSafeInteger(amount)||amount<=0||!merchant)return alert('Enter a valid positive amount and merchant.');let t={id:crypto.randomUUID(),date:$('entryDate').value,card:data.cards[selectedCard],merchant,category:$('category').value,amount,refund:$('entryKind').value==='refund',notes:$('notes').value.trim(),created:Date.now()};data.transactions.push(t);await saveRender();$('savedMessage').textContent=`Saved ${t.refund?'refund ':' '}${money(amount)} · ${merchant} · ${t.category} · ${t.card}`;$('entryForm').reset();$('entryDate').value=iso(new Date());$('amount').focus()};$('saveCards').onclick=async()=>{let names=[$('card0').value.trim(),$('card1').value.trim()];if(names.some(x=>!x)||names[0]===names[1])return alert('Enter two different card names.');data.cards.forEach((old,i)=>data.transactions.forEach(t=>{if(t.card===old)t.card=names[i]}));data.cards=names;await saveRender()};$('saveBudgets').onclick=async()=>{document.querySelectorAll('[data-budget]').forEach(el=>{let n=cents(el.value);data.budgets[el.dataset.budget]=Number.isSafeInteger(n)&&n>=0?n:0});await saveRender()};$('addCategory').onclick=async()=>{let c=$('newCategory').value.trim();if(!c||data.categories.some(x=>x.toLowerCase()===c.toLowerCase()))return alert('Enter a new, unique category.');data.categories.splice(Math.max(0,data.categories.indexOf('Other')),0,c);$('newCategory').value='';await saveRender()};$('prevMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);renderDashboard()};$('nextMonth').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);renderDashboard()};$('histPrev').onclick=()=>{histMonth=new Date(histMonth.getFullYear(),histMonth.getMonth()-1,1);renderHistory()};$('histNext').onclick=()=>{histMonth=new Date(histMonth.getFullYear(),histMonth.getMonth()+1,1);renderHistory()};$('search').oninput=renderHistory;$('cancelEdit').onclick=()=>$('editDialog').close();$('editForm').onsubmit=async e=>{e.preventDefault();let t=data.transactions.find(t=>t.id===$('editId').value),amount=cents($('editAmount').value);if(!t||!Number.isSafeInteger(amount)||amount<=0)return alert('Enter a valid amount.');Object.assign(t,{date:$('editDate').value,amount,merchant:$('editMerchant').value.trim(),category:$('editCategory').value,card:$('editCard').value,refund:$('editKind').value==='refund',notes:$('editNotes').value.trim()});if(!t.merchant)return alert('Merchant is required.');await saveRender();$('editDialog').close()};$('deleteTx').onclick=async()=>{if(!confirm('Delete this transaction permanently?'))return;skipRecurringIfDeleted(data.transactions.find(t=>t.id===$('editId').value));data.transactions=data.transactions.filter(t=>t.id!==$('editId').value);await saveRender();$('editDialog').close()};$('exportCSV').onclick=exportCSV;$('backup').onclick=()=>{download(JSON.stringify({...data,backupVersion:3,exportedAt:new Date().toISOString()},null,2),'spending-backup-'+iso(new Date())+'.json','application/json');$('backupStatus').textContent='Backup file created. Save it in iCloud Drive.'};$('restoreFile').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{let parsed=JSON.parse(await f.text());if(!validateBackup(parsed))throw Error('Not a valid spending backup');if(!confirm(`Replace current data with ${parsed.transactions.length} transactions from this backup?`))return;data={transactions:parsed.transactions,cards:parsed.cards,categories:parsed.categories,budgets:parsed.budgets,finance:parsed.finance||{}};normalizeCategories();await saveRender();$('backupStatus').textContent='Backup restored successfully.'}catch(err){alert('Restore failed: '+err.message)}finally{e.target.value=''}};$('saveFinanceSetup').onclick=async()=>{const f=finance(),date=$('financeStart').value,cur=cents($('currentOpening').value),credit=cents($('creditOpening').value);if(!date||!Number.isSafeInteger(cur)||!Number.isSafeInteger(credit)||cur<0||credit<0)return alert('Enter a start date and valid positive or zero balances.');if(f.startDate&&f.startDate!==date&&!confirm('Changing the opening date changes which purchases affect account balances. Continue?'))return;f.startDate=date;f.currentOpening=cur;f.creditOpening=credit;await saveRender()};
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
