/* ============================================================
   TrumpSays — shared helpers (used by home + All Mentions page)
   ============================================================ */

const SRC_ICON={'White House':'🏛','WH Briefing Room':'🏛','Truth Social':'𝕏'};
const CH_ORDER=['Truth Social','Press Conference','Speech','News','Official'];
const CH={
  'Truth Social':    {v:'--truth',   ic:'𝕏',  short:'Truth Social', attr:'on Truth Social'},
  'Press Conference':{v:'--press',   ic:'🎤', short:'Press Conf.',  attr:'at a press conference'},
  'Speech':          {v:'--speech',  ic:'🗣', short:'Speech',       attr:'in a speech'},
  'News':            {v:'--news',    ic:'📰', short:'News',         attr:'in the news'},
  'Official':        {v:'--official',ic:'🏛', short:'Official',     attr:'in an official statement'},
};
const chanOf=d=>(d.channel && CH[d.channel])?d.channel:'News';
const isSpoken=c=>c==='Truth Social'||c==='Press Conference'||c==='Speech';

const DOMAINS={
 AAPL:'apple.com',MSFT:'microsoft.com',GOOGL:'google.com',AMZN:'amazon.com',META:'meta.com',
 NVDA:'nvidia.com',TSLA:'tesla.com',NFLX:'netflix.com',INTC:'intel.com',AMD:'amd.com',
 QCOM:'qualcomm.com',IBM:'ibm.com',ORCL:'oracle.com',CRM:'salesforce.com',ADBE:'adobe.com',
 ZM:'zoom.us',X:'x.com',PLTR:'palantir.com',SNOW:'snowflake.com',UBER:'uber.com',LYFT:'lyft.com',
 ABNB:'airbnb.com',SHOP:'shopify.com',SPOT:'spotify.com',PINS:'pinterest.com',
 JPM:'jpmorganchase.com',GS:'goldmansachs.com',BAC:'bankofamerica.com',WFC:'wellsfargo.com',
 MS:'morganstanley.com',C:'citigroup.com','BRK-B':'berkshirehathaway.com',BLK:'blackrock.com',
 V:'visa.com',MA:'mastercard.com',AXP:'americanexpress.com',COIN:'coinbase.com',HOOD:'robinhood.com',
 PYPL:'paypal.com',XOM:'exxonmobil.com',CVX:'chevron.com',COP:'conocophillips.com',HAL:'halliburton.com',
 BP:'bp.com',SHEL:'shell.com',LMT:'lockheedmartin.com',RTX:'rtx.com',BA:'boeing.com',
 NOC:'northropgrumman.com',GD:'gd.com',LHX:'l3harris.com',TXT:'textron.com',WMT:'walmart.com',
 TGT:'target.com',COST:'costco.com',HD:'homedepot.com',LOW:'lowes.com',MCD:'mcdonalds.com',
 SBUX:'starbucks.com',KO:'coca-cola.com',PEP:'pepsico.com',NKE:'nike.com',GPS:'gap.com',
 DG:'dollargeneral.com',DLTR:'dollartree.com',F:'ford.com',GM:'gm.com',STLA:'stellantis.com',
 RIVN:'rivian.com',LCID:'lucidmotors.com',PFE:'pfizer.com',JNJ:'jnj.com',UNH:'unitedhealthgroup.com',
 CVS:'cvshealth.com',MRNA:'modernatx.com',LLY:'lilly.com',MRK:'merck.com',ABBV:'abbvie.com',
 AMGN:'amgen.com',DIS:'disney.com',CMCSA:'comcast.com',T:'att.com',VZ:'verizon.com',FOX:'fox.com',
 NYT:'nytimes.com',WBD:'wbd.com',CAT:'caterpillar.com',DE:'deere.com',MMM:'3m.com',HON:'honeywell.com',
 GE:'ge.com',UPS:'ups.com',FDX:'fedex.com',DAL:'delta.com',UAL:'united.com',AAL:'aa.com',
 LUV:'southwest.com',TCEHY:'tencent.com',BABA:'alibaba.com',XIACY:'mi.com',NUE:'nucor.com',STLD:'steeldynamics.com'
};
const COMPANY_DOMAINS={'new york times':'nytimes.com','john deere':'deere.com','warner bros':'wbd.com'};
const domainFor=d=>DOMAINS[d.ticker]||COMPANY_DOMAINS[(d.company||'').toLowerCase()]||null;
const hueOf=s=>{let h=0;for(const ch of (s||'?'))h=(h*31+ch.charCodeAt(0))%360;return h;};
const monoOf=d=>((d.ticker||d.company||'?').replace(/[^A-Za-z0-9]/g,'').slice(0,2)||'•').toUpperCase();

/* escape untrusted strings before inserting into HTML / attributes */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr=u=>{const s=String(u==null?'':u);return /^(https?:|#|\/)/i.test(s)?esc(s):'#';};

function logoImg(dom,big){
  const fav=`https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(dom)}`;
  return `<img src="https://logo.clearbit.com/${encodeURIComponent(dom)}?size=${big?256:128}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${fav}'}else{this.remove()}">`;
}
function media(d,opts={}){
  const {badge=false}=opts, dom=domainFor(d), hue=hueOf(d.ticker||d.company), mono=monoOf(d);
  if(d.image){
    const b=(badge&&dom)?`<img class="badge" src="https://logo.clearbit.com/${encodeURIComponent(dom)}?size=64" referrerpolicy="no-referrer" onerror="this.remove()">`:'';
    return `<span class="media photo" style="background:hsl(${hue} 30% 22%)"><span class="mono">${mono}</span><img src="${escAttr(d.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">${b}</span>`;
  }
  return `<span class="media logo" style="background:hsl(${hue} 42% 36%)"><span class="mono">${mono}</span>${dom?logoImg(dom):''}</span>`;
}

/* ── charts ── */
const MON={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
function monthDay(disp){const m=/([A-Za-z]{3})\s+(\d{1,2})/.exec(disp||'');return m&&MON[m[1]]?MON[m[1]]+'-'+String(+m[2]).padStart(2,'0'):null;}
function colFor(dir){return dir==='up'?'#00b386':dir==='down'?'#ff5e3b':'#8a9097';}
let _gid=0;
function markerIndex(series,md){
  if(!md||!series.length) return -1;
  const exact=series.findIndex(p=>p.d===md);
  if(exact>=0) return exact;
  const key=s=>(+s.slice(0,2))*100+(+s.slice(3,5));
  let yr=0,prevM=-1; const abs=series.map(p=>{const m=+p.d.slice(0,2); if(prevM!==-1&&m<prevM)yr++; prevM=m; return yr*1300+key(p.d);});
  const firstM=+series[0].d.slice(0,2), mM=+md.slice(0,2);
  const mAbs=((mM<firstM)?yr:0)*1300+key(md);
  for(let j=abs.length-1;j>=0;j--){ if(abs[j]<=mAbs) return j; }
  return 0;
}
function geom(series,w,h,pt,pb){
  const cs=series.map(p=>p.c), min=Math.min(...cs), max=Math.max(...cs), rng=(max-min)||1, n=series.length;
  const X=i=> n<2?w/2 : 3+(i/(n-1))*(w-6);
  const Y=c=>pt+(1-(c-min)/rng)*(h-pt-pb);
  return {X,Y,min,max,n};
}
function smoothPath(pts){
  if(pts.length<2) return '';
  if(pts.length===2) return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`;
  let d=`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const t=0.16;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    const c1x=p1[0]+(p2[0]-p0[0])*t, c1y=p1[1]+(p2[1]-p0[1])*t;
    const c2x=p2[0]-(p3[0]-p1[0])*t, c2y=p2[1]-(p3[1]-p1[1])*t;
    d+=` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function sparkline(d){
  const s=d.series; if(!s||s.length<2) return '';
  const w=120,h=36,g=geom(s,w,h,3,3),col=colFor(d.direction);
  const pts=s.map((p,i)=>[g.X(i),g.Y(p.c)]);
  const line=smoothPath(pts), last=pts[pts.length-1];
  const uid='s'+(_gid++);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".2"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${last[0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z" fill="url(#${uid})"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" fill="${col}"/></svg>`;
}
function miniSpark(d){
  const s=d.series; if(!s||s.length<2) return '';
  const w=54,h=26,g=geom(s,w,h,2,2),col=colFor(d.direction);
  const pts=s.map((p,i)=>[g.X(i),g.Y(p.c)]);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${smoothPath(pts)}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function reactionChart(d){
  const s=d.series;
  if(!s||s.length<2) return `<div class="lc-body" style="padding:26px 14px;font-family:var(--mono);font-size:11px;color:var(--gray-40);text-align:center">Price series unavailable</div>`;
  const w=380,h=150,pt=18,pb=22,g=geom(s,w,h,pt,pb),col=colFor(d.direction);
  const pts=s.map((p,i)=>[g.X(i),g.Y(p.c)]);
  const line=smoothPath(pts), last=pts[pts.length-1];
  const uid='r'+(_gid++);
  let mi=markerIndex(s, monthDay(d.date_display));
  let marker='';
  if(mi>=0){
    const mx=g.X(mi).toFixed(1), my=g.Y(s[mi].c).toFixed(1), lab=mi>s.length*0.62;
    marker=`<line x1="${mx}" y1="${pt-7}" x2="${mx}" y2="${h-pb}" stroke="#0a0e14" stroke-width="1" stroke-dasharray="3 3"/>`+
           `<circle cx="${mx}" cy="${my}" r="3.6" fill="#fff" stroke="#0a0e14" stroke-width="1.8"/>`+
           `<text x="${lab?mx-4:+mx+4}" y="${pt-10}" text-anchor="${lab?'end':'start'}" font-family="'IBM Plex Mono',monospace" font-size="8.5" fill="#0a0e14" font-weight="700">HE NAMED IT</text>`;
  }
  return `<div class="lc-body"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="aspect-ratio:${w}/${h}">`+
    `<defs><linearGradient id="${uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".18"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`+
    `<path d="${line} L${last[0].toFixed(1)},${h-pb} L${pts[0][0].toFixed(1)},${h-pb} Z" fill="url(#${uid})"/>`+marker+
    `<path d="${line}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`+
    `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" fill="${col}"/>`+
    `</svg></div>`;
}
/* big chart for the modal: marks EVERY date the company was mentioned */
function companyChart(series,markDates,dir){
  if(!series||series.length<2) return `<div class="big-chart-empty">Price series unavailable for this company.</div>`;
  const w=640,h=240,pt=22,pb=26,g=geom(series,w,h,pt,pb),col=colFor(dir);
  const pts=series.map((p,i)=>[g.X(i),g.Y(p.c)]);
  const line=smoothPath(pts), last=pts[pts.length-1], uid='cc'+(_gid++);
  const seen=new Set(); let marks='';
  (markDates||[]).forEach(md=>{
    const mi=markerIndex(series,md); if(mi<0||seen.has(mi))return; seen.add(mi);
    const mx=g.X(mi).toFixed(1), my=g.Y(series[mi].c).toFixed(1);
    marks+=`<line x1="${mx}" y1="${pt-6}" x2="${mx}" y2="${h-pb}" stroke="#0a0e14" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>`+
           `<circle cx="${mx}" cy="${my}" r="4" fill="#fff" stroke="#0a0e14" stroke-width="1.8"/>`;
  });
  const yMax=`<text x="6" y="${(pt+4)}" font-family="'IBM Plex Mono',monospace" font-size="9" fill="#8a9097">$${g.max.toLocaleString()}</text>`;
  const yMin=`<text x="6" y="${(h-pb)}" font-family="'IBM Plex Mono',monospace" font-size="9" fill="#8a9097">$${g.min.toLocaleString()}</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="aspect-ratio:${w}/${h};width:100%;height:auto;display:block">`+
    `<defs><linearGradient id="${uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".18"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`+
    `<path d="${line} L${last[0].toFixed(1)},${h-pb} L${pts[0][0].toFixed(1)},${h-pb} Z" fill="url(#${uid})"/>`+marks+
    `<path d="${line}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`+
    `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" fill="${col}"/>${yMax}${yMin}</svg>`;
}

function fmtPrice(p){return '$'+Number(p).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
function arrow(d){return d==='up'?'▲':d==='down'?'▼':'■';}
function chanBadge(c){const x=CH[c];return `<span class="chan" style="background:color-mix(in srgb, var(${x.v}) 13%, #fff)"><span class="cdot" style="background:var(${x.v})"></span><span aria-hidden="true">${x.ic}</span> ${x.short}</span>`;}
function pill(d){
  if(d.price==null) return '<span class="noprice">No quote</span>';
  const sign=d.change>0?'+':'';
  return `<span class="price">${fmtPrice(d.price)}</span><span class="pill ${d.direction}">${arrow(d.direction)} ${sign}${d.change}%</span>`;
}
function cleanHeadline(q,company){
  if(!q) return 'Trump names '+esc(company||'a company');
  let t=String(q).trim().replace(/\s*[-–—|]\s*[^-–—|]{0,40}$/,'').replace(/^[a-z]/,c=>c.toUpperCase());
  return esc(t.length<12 ? 'Trump names '+(company||'a company') : t);
}
const headlineOf=d=>d.headline||d.quote;
const companyKey=d=>(d.ticker||d.company||'?');

/* group all mentions by company; newest first within each group */
function groupByCompany(mentions){
  const map=new Map();
  mentions.forEach(d=>{
    const k=companyKey(d);
    if(!map.has(k)) map.set(k,{key:k,company:d.company,ticker:d.ticker,items:[],series:null,latest:d});
    const g=map.get(k); g.items.push(d);
    if(d.series && (!g.series || d.series.length>g.series.length)) g.series=d.series;
    if(!g.latest.price && d.price!=null) g.latest=d;
  });
  for(const g of map.values()){
    g.items.sort((a,b)=>String(b.date||b.date_display).localeCompare(String(a.date||a.date_display)));
    g.latest=g.items.find(i=>i.price!=null)||g.items[0];
  }
  return map;
}

/* shared chrome: topbar date, ticker tape, folio counter */
function initChrome(d, ALL){
  const set=(id,txt)=>{const el=document.getElementById(id); if(el)el.textContent=txt;};
  if(d && d.updated_at){
    const dt=new Date(d.updated_at);
    set('topdate', dt.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
    const t=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    set('liveupd','Updated '+t); set('navupd','⟳ '+t);
    set('folio-r','Tracking '+ALL.length+' mention'+(ALL.length===1?'':'s'));
  }
  buildTape(ALL);
}
function buildTape(ALL){
  const el=document.getElementById('tape'); if(!el)return;
  const seen=new Set(), priced=[];
  for(const d of ALL){ if(d.price==null||!d.ticker||seen.has(d.ticker))continue; seen.add(d.ticker); priced.push(d); }
  if(!priced.length){el.innerHTML='';return;}
  const item=d=>{
    const dom=domainFor(d), sign=d.change>0?'+':'', cc=d.direction==='up'?'g':d.direction==='down'?'r':'f';
    const lg=dom?`<img class="lg" src="https://logo.clearbit.com/${encodeURIComponent(dom)}?size=32" referrerpolicy="no-referrer" onerror="this.remove()">`:'';
    return `<span class="tk-item">${lg}<span class="s">${esc(d.ticker)}</span><span class="p">${fmtPrice(d.price)}</span><span class="c ${cc}">${arrow(d.direction)} ${sign}${d.change}%</span></span>`;
  };
  const row=priced.map(item).join(''); el.innerHTML=row+row;
}

async function fetchData(){
  const base=location.pathname.replace(/\/[^/]*$/,'');
  const r=await fetch(base+'/data.json?t='+Date.now());
  return r.json();
}
