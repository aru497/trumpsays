/* ============================================================
   TrumpSays — home page
   ============================================================ */
let ALL=[], view='all', channel='all';

async function load(){
  try{
    const d=await fetchData();
    ALL=d.mentions||[];
    initChrome(d, ALL);
    buildChannelBar(); render();
  }catch(e){
    const f=document.getElementById('feed');
    if(f) f.innerHTML='<p class="msg">⚠️ Could not load the wire. Check back shortly.</p>';
  }
}

function counts(){const c={};ALL.forEach(d=>{const k=chanOf(d);c[k]=(c[k]||0)+1;});return c;}
function buildChannelBar(){
  const c=counts(), bar=document.getElementById('channelbar');
  let html='<span class="ch-label">Where he said it</span>';
  html+=`<button class="ch-chip ${channel==='all'?'active':''}" data-ch="all">All Channels <span class="cc">${ALL.length}</span></button>`;
  CH_ORDER.forEach(k=>{
    const n=c[k]||0, x=CH[k];
    html+=`<button class="ch-chip ${channel===k?'active':''} ${n?'':'empty'}" data-ch="${k}" ${n?'':'disabled'}>`+
          `<span class="dot-c" style="background:var(${x.v})"></span>${x.ic} ${x.short} <span class="cc">${n}</span></button>`;
  });
  bar.innerHTML=html;
}

function filtered(){
  let arr=ALL.slice();
  if(channel!=='all') arr=arr.filter(d=>chanOf(d)===channel);
  if(view==='up') arr=arr.filter(d=>d.direction==='up');
  else if(view==='down') arr=arr.filter(d=>d.direction==='down');
  else if(view==='today'){const t=arr[0]?.date_display; arr=arr.filter(d=>d.date_display===t);}
  return arr;
}

function leadStory(items){
  const el=document.getElementById('lead');
  if(!items.length){el.innerHTML='';el.hidden=true;return;}
  el.hidden=false;
  const d=[...items].sort((a,b)=>Math.abs(b.change||0)-Math.abs(a.change||0))[0];
  const c=chanOf(d), icon=SRC_ICON[d.source]||CH[c].ic, sign=d.change>0?'+':'';
  const key=companyKey(d);
  const nMentions=ALL.filter(m=>companyKey(m)===key).length;
  const cover=d.image?`<a class="lead-cover" href="${escAttr(d.article_link)}" target="_blank" rel="noopener noreferrer"><img src="${escAttr(d.image)}" alt="" referrerpolicy="no-referrer" onerror="this.closest('.lead-cover').remove()"><span class="lead-cover-tag">${chanBadge(c)}</span></a>`:'';
  const transcript=isSpoken(c)?`<div class="transcript"><div class="tq">&ldquo;&hellip;${esc(d.quote||d.company)}&rdquo;</div><div class="ta">${CH[c].ic} Trump, ${CH[c].attr} · ${esc(d.date_display)}</div></div>`:'';
  el.innerHTML=`
    ${cover}
    <div class="lead-main">
      <div class="kicker">Lead · ${esc(d.ticker||'Market')} ${chanBadge(c)}</div>
      <a class="headline" href="${escAttr(d.article_link)}" target="_blank" rel="noopener noreferrer"><h2>${cleanHeadline(headlineOf(d),d.company)}</h2></a>
      ${transcript||`<p class="dek dropcap">Trump put <strong>${esc(d.company)}</strong> in the headlines${d.ticker?` (${esc(d.ticker)})`:''}. Here is the story moving the tape — and where the stock landed.</p>`}
      <div class="byline"><span class="src">${icon} ${esc(d.source)}</span> · <span>${esc(d.date_display)}</span></div>
      <div class="lead-actions">
        <a class="readmore" href="${escAttr(d.article_link)}" target="_blank" rel="noopener noreferrer">Read the full story <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        <button class="btn-ghost" type="button" data-key="${esc(key)}">${nMentions>1?`See all ${nMentions} mentions`:'See mention detail'} →</button>
      </div>
    </div>
    <div class="lead-chart open-modal" role="button" tabindex="0" data-key="${esc(key)}" aria-label="Open ${esc(d.company)} detail">
      <div class="lc-head">${media(d)}<div class="lc-co"><div class="n">${esc(d.company)}</div><div class="t">${esc(d.ticker||'—')} · NYSE/NASDAQ</div></div>
        <div class="lc-px">${d.price!=null?`<span class="v" style="color:${colFor(d.direction)}">${fmtPrice(d.price)}</span><br><span class="pill ${d.direction}" style="margin-top:3px">${arrow(d.direction)} ${sign}${d.change}%</span>`:'<span class="noprice">No quote</span>'}</div>
      </div>
      ${reactionChart(d)}
      <div class="lc-foot"><span>~1 month · daily close</span><span class="leg-tap">Tap to expand ↗</span></div>
    </div>`;
}

function storyRow(d){
  const c=chanOf(d), icon=SRC_ICON[d.source]||CH[c].ic, key=companyKey(d);
  const transcript=isSpoken(c)?`<div class="rowtranscript">&ldquo;&hellip;${esc((d.quote||d.company)).slice(0,140)}&rdquo;</div>`:'';
  return `<article class="story" role="button" tabindex="0" data-key="${esc(key)}" aria-label="Open ${esc(d.company)} detail">
    ${media(d,{badge:true})}
    <div class="body">
      <div class="tags">${d.ticker?`<span class="tk">${esc(d.ticker)}</span>`:''}<span class="co-tag">${esc(d.company)}</span>${chanBadge(c)}</div>
      <h4>${cleanHeadline(headlineOf(d),d.company)}</h4>
      ${transcript}
      <div class="meta"><span class="src">${icon} ${esc(d.source)}</span> · <span>${esc(d.date_display)}</span> · <a class="ext" href="${escAttr(d.article_link)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Open source ↗</a></div>
    </div>
    <div class="quote-box">${pill(d)}<div class="spark">${sparkline(d)}</div></div>
  </article>`;
}

function sidebar(items){
  const up=items.filter(d=>d.direction==='up').length, dn=items.filter(d=>d.direction==='down').length;
  const c=counts(), maxc=Math.max(1,...CH_ORDER.map(k=>c[k]||0));
  const chanHTML=CH_ORDER.map(k=>{
    const n=c[k]||0, x=CH[k];
    return `<div class="cb-row ${n?'':'empty'}" data-ch="${k}" ${n?'role="button" tabindex="0"':'aria-disabled="true"'}>
      <span class="cdot" style="background:var(${x.v})"></span>
      <span class="lbl">${x.short}</span>
      <span class="bar"><i style="width:${Math.round((n/maxc)*100)}%;background:var(${x.v})"></i></span>
      <span class="num">${n}</span></div>`;
  }).join('');
  const movers=[...items].filter(d=>d.price!=null).sort((a,b)=>Math.abs(b.change||0)-Math.abs(a.change||0)).slice(0,6);
  const moverHTML=movers.length?movers.map(d=>{
    const sign=d.change>0?'+':'';
    return `<div class="mover" role="button" tabindex="0" data-key="${esc(companyKey(d))}">${media(d)}
      <div class="mv-l"><div class="mv-tk">${esc(d.ticker||'')}</div><div class="mv-co">${esc(d.company)}</div></div>
      <span class="mv-spark">${miniSpark(d)}</span>
      <div class="mv-r ${d.direction==='up'?'g':d.direction==='down'?'r':''}">${arrow(d.direction)} ${sign}${d.change}%</div></div>`;
  }).join(''):'<div class="disc">No quotes yet.</div>';

  document.getElementById('rail').innerHTML=`
    <div class="rail-card"><div class="hd">Daily Index</div><div class="bd">
      <div class="idx-row"><span class="n">${items.length}</span><span class="t">Mentions shown</span></div>
      <div class="idx-row"><span class="n g">${up}</span><span class="t">Rallied on it</span></div>
      <div class="idx-row"><span class="n r">${dn}</span><span class="t">Sold off</span></div>
    </div></div>
    <div class="rail-card"><div class="hd">Where He Said It</div><div class="bd">${chanHTML}</div></div>
    <div class="rail-card"><div class="hd">Biggest Movers</div><div class="bd">${moverHTML}</div></div>
    <div class="rail-card"><div class="hd">Browse</div><div class="bd"><a class="rail-link" href="mentions.html">📋 All mentions, every company →</a></div></div>`;
}

function render(){
  const items=filtered();
  leadStory(items); sidebar(items);
  document.getElementById('wirecount').textContent=items.length?items.length+' stor'+(items.length===1?'y':'ies'):'';
  const feed=document.getElementById('feed');
  if(!items.length){feed.innerHTML='<p class="msg">No stories in this section yet.</p>';return;}
  const by={};
  items.forEach(d=>{(by[d.date_display]=by[d.date_display]||[]).push(d);});
  feed.innerHTML=Object.entries(by).map(([date,g])=>`<div class="daygroup"><div class="dayline">${esc(date)}</div>${g.map(storyRow).join('')}</div>`).join('');
}

/* ── company modal ── */
function openCompany(key){
  const g=groupByCompany(ALL).get(key); if(!g)return;
  const latest=g.latest, c=chanOf(latest), sign=latest.change>0?'+':'';
  const dates=g.items.map(i=>monthDay(i.date_display)).filter(Boolean);
  const chMix=[...new Set(g.items.map(chanOf))].map(chanBadge).join('');
  const rows=g.items.map(d=>{
    const cc=chanOf(d), s2=d.change>0?'+':'';
    return `<a class="mrow" href="${escAttr(d.article_link)}" target="_blank" rel="noopener noreferrer">
      <div class="mrow-l">
        <div class="mrow-top">${chanBadge(cc)}<span class="mrow-date">${esc(d.date_display)}</span></div>
        <div class="mrow-h">${cleanHeadline(headlineOf(d),d.company)}</div>
      </div>
      <div class="mrow-r">${d.price!=null?`<span class="pill ${d.direction}">${arrow(d.direction)} ${s2}${d.change}%</span>`:'<span class="noprice">—</span>'}<span class="mrow-ext">Open ↗</span></div>
    </a>`;
  }).join('');
  document.getElementById('modal-body').innerHTML=`
    <div class="m-head">
      ${media(latest)}
      <div class="m-co"><div class="m-name">${esc(latest.company)}</div><div class="m-tk">${esc(latest.ticker||'—')} · ${g.items.length} mention${g.items.length===1?'':'s'}</div></div>
      <div class="m-px">${latest.price!=null?`<div class="m-v" style="color:${colFor(latest.direction)}">${fmtPrice(latest.price)}</div><span class="pill ${latest.direction}">${arrow(latest.direction)} ${sign}${latest.change}%</span>`:'<span class="noprice">No quote</span>'}</div>
    </div>
    <div class="m-chips">${chMix}</div>
    <div class="m-chart">${companyChart(g.series, dates, latest.direction)}</div>
    <div class="m-chart-cap"><span>~1 month · daily close</span><span class="leg"><span class="dotc"></span>each marker = a Trump mention</span></div>
    <div class="m-list-h">Every time he named ${esc(latest.company)}</div>
    <div class="m-list">${rows}</div>`;
  const m=document.getElementById('modal');
  m.hidden=false; document.body.style.overflow='hidden';
  m.querySelector('.modal-close').focus();
}
function closeModal(){const m=document.getElementById('modal'); m.hidden=true; document.body.style.overflow='';}

/* ── newsletter ── */
async function subscribe(email,ref){
  try{
    const r=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,ref})});
    let j={}; try{j=await r.json();}catch(_){}
    if(r.ok && j.ok!==false) return {ok:true};
    if(r.status===400 && j && j.error) return {ok:false,error:j.error};
    return {ok:false,soft:true};   // endpoint missing (static host) / 5xx — already saved locally
  }catch(e){ return {ok:false,soft:true}; }
}
function initNewsletter(){
  const form=document.getElementById('newsletter'); if(!form)return;
  const msg=document.getElementById('news-msg'), input=form.querySelector('input[type=email]'), btn=form.querySelector('button');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=(input.value||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.textContent='Please enter a valid email.'; msg.className='news-note err'; return; }
    btn.disabled=true; const orig=btn.textContent; btn.textContent='…';
    // local backup so a signup is never lost even before KV is wired
    try{const k='ts_subs';const a=JSON.parse(localStorage.getItem(k)||'[]');if(!a.includes(email)){a.push(email);localStorage.setItem(k,JSON.stringify(a));}}catch(_){}
    const res=await subscribe(email,'home');
    btn.disabled=false; btn.textContent=orig;
    if(res.ok || res.soft){
      form.reset();
      msg.textContent="You're on the list — we'll only email when he moves a market.";
      msg.className='news-note ok';
    }else{
      msg.textContent=res.error||'Something went wrong. Try again.'; msg.className='news-note err';
    }
  });
}

/* ── events ── */
function bindModalOpeners(container){
  container.addEventListener('click',e=>{
    if(e.target.closest('a'))return;            // let real links through
    const t=e.target.closest('[data-key]'); if(t) openCompany(t.dataset.key);
  });
  container.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const t=e.target.closest('[data-key]'); if(t){e.preventDefault();openCompany(t.dataset.key);}
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('tabs').addEventListener('click',e=>{
    const b=e.target.closest('.tab'); if(!b)return;
    document.querySelectorAll('.tab').forEach(c=>c.classList.remove('active'));
    b.classList.add('active'); view=b.dataset.f; render();
  });
  document.getElementById('channelbar').addEventListener('click',e=>{
    const b=e.target.closest('.ch-chip'); if(!b||b.disabled)return;
    channel=b.dataset.ch; buildChannelBar(); render();
  });
  // rail: channel rows filter; movers open modal
  const rail=document.getElementById('rail');
  rail.addEventListener('click',e=>{
    const cb=e.target.closest('.cb-row');
    if(cb && !cb.classList.contains('empty')){ channel=cb.dataset.ch; buildChannelBar(); render(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    const mv=e.target.closest('.mover'); if(mv) openCompany(mv.dataset.key);
  });
  rail.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const cb=e.target.closest('.cb-row');
    if(cb && !cb.classList.contains('empty')){ e.preventDefault(); channel=cb.dataset.ch; buildChannelBar(); render(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    const mv=e.target.closest('.mover'); if(mv){ e.preventDefault(); openCompany(mv.dataset.key); }
  });
  bindModalOpeners(document.getElementById('feed'));
  bindModalOpeners(document.getElementById('lead'));
  // modal close
  const modal=document.getElementById('modal');
  modal.addEventListener('click',e=>{ if(e.target===modal || e.target.closest('.modal-close')) closeModal(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !modal.hidden) closeModal(); });
  initNewsletter();
  load();
  setInterval(load, 10*60*1000);
});
