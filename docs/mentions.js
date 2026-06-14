/* ============================================================
   TrumpSays — All Mentions page
   ============================================================ */
let ALL=[];
const state={q:'',channel:'all',dir:'all',sort:'mentions'};

async function load(){
  try{
    const d=await fetchData();
    ALL=d.mentions||[];
    initChrome(d, ALL);
    render();
  }catch(e){
    document.getElementById('table').innerHTML='<p class="msg">⚠️ Could not load mentions.</p>';
  }
}

function matches(d){
  if(state.channel!=='all' && chanOf(d)!==state.channel) return false;
  if(state.dir!=='all' && d.direction!==state.dir) return false;
  if(state.q){
    const hay=`${d.company||''} ${d.ticker||''} ${headlineOf(d)||''}`.toLowerCase();
    if(!hay.includes(state.q)) return false;
  }
  return true;
}

function render(){
  const items=ALL.filter(matches);
  const groups=[...groupByCompany(items).values()];
  // sort groups
  groups.sort((a,b)=>{
    if(state.sort==='mentions') return b.items.length-a.items.length;
    if(state.sort==='az') return (a.company||'').localeCompare(b.company||'');
    if(state.sort==='move') return Math.abs(b.latest.change||0)-Math.abs(a.latest.change||0);
    return String(b.latest.date||b.latest.date_display).localeCompare(String(a.latest.date||a.latest.date_display)); // recent
  });
  const sub=document.getElementById('page-sub');
  sub.textContent=`${items.length} mention${items.length===1?'':'s'} across ${groups.length} compan${groups.length===1?'y':'ies'}. Tap a company for its full chart.`;
  const t=document.getElementById('table');
  if(!groups.length){t.innerHTML='<p class="msg">No mentions match your filters.</p>';return;}
  t.innerHTML=groups.map(g=>{
    const d=g.latest, sign=d.change>0?'+':'';
    const rows=g.items.map(m=>{
      const cc=chanOf(m), s2=m.change>0?'+':'';
      return `<a class="mrow" href="${escAttr(m.article_link)}" target="_blank" rel="noopener noreferrer">
        <div class="mrow-l"><div class="mrow-top">${chanBadge(cc)}<span class="mrow-date">${esc(m.date_display)}</span></div>
        <div class="mrow-h">${cleanHeadline(headlineOf(m),m.company)}</div></div>
        <div class="mrow-r">${m.price!=null?`<span class="pill ${m.direction}">${arrow(m.direction)} ${s2}${m.change}%</span>`:'<span class="noprice">—</span>'}<span class="mrow-ext">Open ↗</span></div>
      </a>`;
    }).join('');
    return `<div class="cgroup">
      <div class="cgroup-h" role="button" tabindex="0" data-key="${esc(g.key)}" aria-label="Open ${esc(g.company)} chart">
        ${media(d)}
        <div class="gl"><div class="gn">${esc(g.company)}</div><div class="gt">${esc(g.ticker||'—')} · ${g.items.length} mention${g.items.length===1?'':'s'}</div></div>
        <span class="gspark">${miniSpark(d)}</span>
        <div class="gp">${d.price!=null?`<div class="gv" style="color:${colFor(d.direction)}">${fmtPrice(d.price)}</div><span class="pill ${d.direction}">${arrow(d.direction)} ${sign}${d.change}%</span>`:'<span class="noprice">No quote</span>'}</div>
      </div>
      <div class="cgroup-rows">${rows}</div>
    </div>`;
  }).join('');
}

function openCompany(key){
  const g=groupByCompany(ALL).get(key); if(!g)return;
  const latest=g.latest, sign=latest.change>0?'+':'';
  const dates=g.items.map(i=>monthDay(i.date_display)).filter(Boolean);
  const chMix=[...new Set(g.items.map(chanOf))].map(chanBadge).join('');
  const rows=g.items.map(d=>{
    const cc=chanOf(d), s2=d.change>0?'+':'';
    return `<a class="mrow" href="${escAttr(d.article_link)}" target="_blank" rel="noopener noreferrer">
      <div class="mrow-l"><div class="mrow-top">${chanBadge(cc)}<span class="mrow-date">${esc(d.date_display)}</span></div>
      <div class="mrow-h">${cleanHeadline(headlineOf(d),d.company)}</div></div>
      <div class="mrow-r">${d.price!=null?`<span class="pill ${d.direction}">${arrow(d.direction)} ${s2}${d.change}%</span>`:'<span class="noprice">—</span>'}<span class="mrow-ext">Open ↗</span></div></a>`;
  }).join('');
  document.getElementById('modal-body').innerHTML=`
    <div class="m-head">${media(latest)}
      <div class="m-co"><div class="m-name">${esc(latest.company)}</div><div class="m-tk">${esc(latest.ticker||'—')} · ${g.items.length} mention${g.items.length===1?'':'s'}</div></div>
      <div class="m-px">${latest.price!=null?`<div class="m-v" style="color:${colFor(latest.direction)}">${fmtPrice(latest.price)}</div><span class="pill ${latest.direction}">${arrow(latest.direction)} ${sign}${latest.change}%</span>`:'<span class="noprice">No quote</span>'}</div>
    </div>
    <div class="m-chips">${chMix}</div>
    <div class="m-chart">${companyChart(g.series, dates, latest.direction)}</div>
    <div class="m-chart-cap"><span>~1 month · daily close</span><span class="leg"><span class="dotc"></span>each marker = a Trump mention</span></div>
    <div class="m-list-h">Every time he named ${esc(latest.company)}</div>
    <div class="m-list">${rows}</div>`;
  const m=document.getElementById('modal'); m.hidden=false; document.body.style.overflow='hidden';
  m.querySelector('.modal-close').focus();
}
function closeModal(){const m=document.getElementById('modal');m.hidden=true;document.body.style.overflow='';}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('q').addEventListener('input',e=>{state.q=e.target.value.trim().toLowerCase();render();});
  document.getElementById('f-channel').addEventListener('change',e=>{state.channel=e.target.value;render();});
  document.getElementById('f-dir').addEventListener('change',e=>{state.dir=e.target.value;render();});
  document.getElementById('f-sort').addEventListener('change',e=>{state.sort=e.target.value;render();});
  const t=document.getElementById('table');
  t.addEventListener('click',e=>{ if(e.target.closest('a'))return; const h=e.target.closest('.cgroup-h'); if(h)openCompany(h.dataset.key); });
  t.addEventListener('keydown',e=>{ if(e.key!=='Enter'&&e.key!==' ')return; const h=e.target.closest('.cgroup-h'); if(h){e.preventDefault();openCompany(h.dataset.key);} });
  const modal=document.getElementById('modal');
  modal.addEventListener('click',e=>{ if(e.target===modal||e.target.closest('.modal-close'))closeModal(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!modal.hidden)closeModal(); });
  load();
});
