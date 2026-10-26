'use strict';
const fmt=(v,n=1)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('ko-KR',{minimumFractionDigits:n,maximumFractionDigits:n});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const significant=s=>(s.pct_float!=null&&Math.abs(s.pct_float)>=5)||(s.pct_adv20!=null&&Math.abs(s.pct_adv20)>=50);
const nav=(e,a)=>a[e.etf]?.nav??e.aum??null;
const monthStats=(es,ym,a)=>{const rs=es.filter(e=>e.change?.startsWith(ym));return {count:rs.length,nav:rs.some(e=>nav(e,a)==null)?null:rs.reduce((n,e)=>n+nav(e,a),0)}};
const iso=d=>d.toISOString().slice(0,10),month=(today,offset)=>iso(new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1+offset,1))).slice(0,7);
const signed=v=>v==null?'—':(v>0?'+':'')+fmt(v);
const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${heads.length}" class="empty">해당 데이터가 없습니다.</td></tr>`}</tbody></table>`;
if(typeof module!=='undefined')module.exports={fmt,significant,nav,monthStats};
if(typeof document!=='undefined'){
let D,signalFilter='all',etfFilter='all',monthOffset=0,days=365;
const $=id=>document.getElementById(id),val=(id,html)=>$(id).innerHTML=html;
const next=(etf,key)=>D.events.filter(e=>(!etf||e.etf===etf)&&e[key]&&e[key]>=D.today).sort((a,b)=>a[key].localeCompare(b[key]))[0];
const delta=date=>Math.round((Date.parse(date)-Date.parse(D.today))/86400000);
const dayLabel=d=>d?(delta(d)===0?'D-day':'D-'+delta(d)):'일정 없음';
const navT=v=>v==null?'—':fmt(v/10000,2)+'조';
function overview(){
 const etfs=new Set(D.events.map(e=>e.etf)),star=new Set(D.signals.filter(significant).map(s=>s.code));
 val('updated',`빌드 ${esc(D.built_at.slice(0,16).replace('T',' '))} KST`);
 val('summary',`<span>추적 ETF <b>${etfs.size}</b></span><span>정기변경 이벤트 <b>${D.events.length}</b></span><span>예상 수급 <b>${D.signals.length}종목</b></span><span>시세 기준 <b>${esc([...new Set(D.signals.map(s=>s.price_date).filter(Boolean))].join(', ')||'미확보')}</b></span>`);
 const r=next(null,'review'),t=next(null,'trade'),trades=new Set(D.events.filter(e=>e.trade>=D.today&&delta(e.trade)<=45).map(e=>e.trade));
 const top=[...D.signals].sort((a,b)=>Math.abs(b.flow_억??0)-Math.abs(a.flow_억??0))[0];
 const ms=[0,1].map(i=>monthStats(D.events,month(D.today,i),D.aum));
 const cards=[['다음 심사',r?dayLabel(r.review):'—',r?.review??'미확보'],['다음 매매',t?dayLabel(t.trade):'—',t?.trade??'미확보'],['45일 내 매매일',trades.size+'일','중복 날짜 제외'],['이번달 / 다음달 NAV',navT(ms[0].nav)+' / '+navT(ms[1].nav),'정기변경일 기준 합계'],['★ 유의미 종목',star.size+'종목','유동시총 5% 또는 ADV20 50%'],['최대 예상 매매',top?signed(top.flow_억)+'억':'—',top?.stock??'미산출']];
 val('kpis',cards.map(c=>`<div class="kpi"><small>${c[0]}</small><b>${c[1]}</b><small>${c[2]}</small></div>`).join(''));
 const unique=[...new Map(D.events.map(e=>[e.etf,e])).values()].sort((a,b)=>(nav(b,D.aum)??0)-(nav(a,D.aum)??0)).slice(0,4);
 val('ticker',`<small>NAV 상위 · 가격 등락 미수집</small>`+unique.map(e=>`<span>${esc(e.etf)} <b>${navT(nav(e,D.aum))}</b></span>`).join(''));
 const warnings=D.signals.flatMap(s=>(s.warnings||[]).map(w=>`<li><b>${esc(s.stock)}</b> ${esc(w)}</li>`));
 val('warnings',(warnings.length?`<ul>${warnings.join('')}</ul>`:'<p>원천 warnings에 등록된 경고는 없습니다. <b>관리·환기·상폐사유 전수검증은 미확보</b>이며, 경고 없음은 편출 위험 없음이 아닙니다.</p>')+'<p class="muted">현재 비중 하위 5종목 · 감시 목록이며 편출 확정 또는 사고 발생 판정이 아닙니다.</p><div class="table-wrap">'+table(['종목','현재 비중','시총(억)','ADV60(억)','사고요건 확인'],[...D.signals].filter(s=>s.current_weight!=null).sort((a,b)=>a.current_weight-b.current_weight).slice(0,5).map(s=>`<tr><td><b>${esc(s.stock)}</b></td><td>${fmt(s.current_weight,2)}%</td><td>${fmt(s.market_cap_억)}</td><td>${fmt(s.adv60_억)}</td><td class="text">관리·환기·상폐사유 확인 대기</td></tr>`))+'</div>');
 for(const s of D.signals)$('stock-select').insertAdjacentHTML('beforeend',`<option value="${esc(s.code)}">${esc(s.stock)}</option>`);
}
function signalRows(){return D.signals.filter(s=>signalFilter==='all'||signalFilter==='star'&&significant(s)||signalFilter==='buy'&&s.flow_억>0||signalFilter==='sell'&&s.flow_억<0).sort((a,b)=>Math.abs(b.flow_억??0)-Math.abs(a.flow_억??0))}
function renderSignals(){
 const ss=signalRows();val('signal-count',ss.length+'종목');
 val('signal-table',table(['ETF','종목','구분','현재 → 예상 비중','예상 매매(억)','유동시총 대비','ADV20 대비','★','비고'],ss.map(s=>`<tr class="${significant(s)?'highlight':''}"><td>${esc(s.etf)}</td><td class="text"><b>${esc(s.stock)}</b></td><td>${esc(s.action)}</td><td>${fmt(s.current_weight,2)} → ${fmt(s.target_weight,2)}%</td><td class="${s.flow_억>0?'buy':'sell'}"><b>${signed(s.flow_억)}</b></td><td>${fmt(s.pct_float,2)}%</td><td>${fmt(s.pct_adv20,2)}%</td><td class="star">${significant(s)?'★':'—'}</td><td class="note"><details><summary>조건·단독 수급</summary>${esc(s.note)}<p>기본 ETF 단독 ${signed(s.single_etf_flow_억)}억</p></details></td></tr>`)));
 const max=Math.max(1,...ss.map(s=>Math.abs(s.flow_억??0)));const h=Math.max(160,ss.length*23+28);
 val('flow-bars',ss.length?`<svg class="chart" viewBox="0 0 650 ${h}" role="img" aria-label="예상 매매금액 막대차트"><line x1="355" y1="0" x2="355" y2="${h-18}" stroke="#ccd7d9"/>${ss.map((s,i)=>{const w=Math.abs(s.flow_억??0)/max*180,y=i*23+6;return `<text x="0" y="${y+12}">${esc(s.stock)}${significant(s)?' ★':''}</text><rect x="${s.flow_억<0?355-w:355}" y="${y}" width="${w}" height="15" rx="2" fill="${s.flow_억>0?'#c0392b':'#2563eb'}"><title>${esc(s.stock)} ${signed(s.flow_억)}억원</title></rect><text x="640" text-anchor="end" y="${y+12}">${signed(s.flow_억)}</text>`}).join('')}<text x="355" y="${h-2}" text-anchor="middle">0 · 억원</text></svg>`:'<div class="empty">해당 신호 없음</div>');
 const s=ss[0];if(!s){val('focus','<p class="empty">해당 신호 없음</p>');return}
 const e=next(s.etf,'trade');
 val('focus',`<small>${esc(s.etf)} · 기존 구성 유지 조건부 시나리오</small><div class="focus-number ${s.flow_억>0?'buy':'sell'}">${esc(s.stock)} ${significant(s)?'<span class="star">★</span>':''}</div><p><b class="${s.flow_억>0?'buy':'sell'}">${signed(s.flow_억)}억원</b> · 유동시총 ${fmt(s.pct_float,2)}% / ADV20 ${fmt(s.pct_adv20,2)}%</p><div class="event-strip"><div><span class="tag review">심사</span><b>${e?.review??'미확보'}</b></div><div><span class="tag weight">비중확정</span><b>${weightDate(e)??'미확보'}</b></div><div><span class="tag trade">매매</span><b>${e?.trade??'미확보'}</b></div></div><p class="muted">동일지수 2개 ETF AUM 단순합 시나리오. 레버리지 배수·파생 헤지 미반영으로 실제 현물 주문액과 다릅니다. 기본 ETF 단독 수급은 표의 비고에서 확인하세요.</p>`);
}
function weightDate(e){return e?.etf==='SOL 조선TOP3플러스'&&e?.change==='2026-11-16'?'2026-11-11':e?.weight_date??null}
function svgSeries(rows,series,markers,label){
 if(!rows.length)return '<div class="empty">수집된 관측이 없습니다.</div>';
 const W=660,H=230,L=58,R=20,T=38,B=35,values=rows.flatMap(r=>series.map(s=>r[s.key])).filter(v=>v!=null&&Number.isFinite(v));
 if(!values.length)return '<div class="empty">유효 관측이 없습니다.</div>';
 const min=Math.min(...values),max=Math.max(...values),pad=(max-min)*.08||1,lo=min-pad,hi=max+pad;
 const start=Date.parse(rows[0].date),end=Math.max(Date.parse(rows.at(-1).date),...markers.filter(m=>m.date).map(m=>Date.parse(m.date))),range=end-start||1;
 const x=d=>L+(Date.parse(d)-start)/range*(W-L-R),y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
 let out=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
 for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3,yy=y(v);out+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e6ebee"/><text x="${L-6}" y="${yy+3}" text-anchor="end">${fmt(v,0)}</text>`}
 for(const s of series){let path='',pen=false;for(const r of rows){const v=r[s.key];if(v==null){pen=false;continue}path+=(pen?'L':'M')+x(r.date).toFixed(1)+','+y(v).toFixed(1);pen=true}out+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="1.8"/>`}
 markers.filter(m=>m.date&&Date.parse(m.date)>=start).forEach((m,i)=>{const xx=x(m.date);out+=`<line x1="${xx}" y1="${T}" x2="${xx}" y2="${H-B}" stroke="${m.color}" stroke-dasharray="4 3"/><text x="${xx-3}" y="${10+i*12}" text-anchor="end">${m.name} ${m.date.slice(5)}</text>`});
 out+=`<text x="${L}" y="${H-8}">${rows[0].date}</text><text x="${W-R}" y="${H-8}" text-anchor="end">${iso(new Date(end))}</text></svg>`;return out;
}
function renderCharts(){
 const choice=$('stock-select').value;let ss=signalRows();if(choice==='top')ss=ss.filter((s,i)=>i<3||significant(s));else if(choice!=='all')ss=ss.filter(s=>s.code===choice);
 const cutoff=iso(new Date(Date.parse(D.today)-days*86400000));
 val('stock-charts',ss.map(s=>{const st=D.stocks.find(x=>x.code===s.code),e=next(s.etf,'trade'),markers=[{name:'심사',date:e?.review,color:'#727db4'},{name:'비중확정',date:weightDate(e),color:'#a677af'},{name:'매매',date:e?.trade,color:'#c49928'}];const prices=(st?.prices||[]).filter(r=>r.date>=cutoff);let f=0,i=0;const flows=(st?.flows||[]).filter(r=>r.date>=cutoff).map(r=>({date:r.date,foreign:r.foreign_value==null?null:(f+=r.foreign_value/1e8),institution:r.institution_value==null?null:(i+=r.institution_value/1e8)}));return `<article class="card"><h2>${esc(s.stock)} <span class="star">${significant(s)?'★':''}</span><small>${esc(s.code)} · ${signed(s.flow_억)}억 예상</small></h2><div class="legend">주가(원) · 마지막 관측 ${prices.at(-1)?.date??'미확보'}</div>${svgSeries(prices,[{key:'close',color:'#427967'}],markers,s.stock+' 주가')}<div class="legend">거래대금 대용치(억원) = 종가 × 거래량 · 실제 체결대금 아님</div>${svgSeries(prices.map(r=>({...r,turnover:r.turnover_proxy==null?null:r.turnover_proxy/1e8})),[{key:'turnover',color:'#8daaa0'}],markers,s.stock+' 거래대금 대용치')}<div class="legend"><span style="color:#2563eb">외국인</span><span style="color:#c98500">기관</span> 기간 누적 순매수 환산액(억원)</div>${svgSeries(flows,[{key:'foreign',color:'#2563eb'},{key:'institution',color:'#c98500'}],markers,s.stock+' 투자자 누적 수급')}<div class="chart-meta">수급 = 일별 순매수 주수 × trend 종가 · 실제 체결금액 아님. 결측은 선을 끊고 관측치만 누적. 미래 이벤트까지 축 확장, 미래 가격은 그리지 않음.<br>가격 ${prices.length}개 / 수급 ${flows.length}개 · ${st?.price_mismatches?.length??0}개 chart/trend 종가 불일치(원인 미확정).<br>${esc((st?.errors||[]).join(' / '))}</div></article>`}).join('')||'<div class="empty">선택 조건에 맞는 차트가 없습니다.</div>');
}
function renderCalendar(){
 let html='';for(let off=monthOffset;off<monthOffset+3;off++){const ym=month(D.today,off),[year,mo]=ym.split('-').map(Number),first=new Date(Date.UTC(year,mo-1,1)),count=new Date(Date.UTC(year,mo,0)).getUTCDate(),stats=monthStats(D.events,ym,D.aum);let cells='월화수목금토일'.split('').map(d=>`<div class="weekday">${d}</div>`).join('');const blank=(first.getUTCDay()+6)%7;for(let i=0;i<blank;i++)cells+='<div class="day"></div>';
 for(let day=1;day<=count;day++){const date=ym+'-'+String(day).padStart(2,'0'),entries=[];for(const e of D.events)for(const [key,label] of [['review','심사'],['trade','매매'],['change','변경']])if(e[key]===date)entries.push({e,key,label});entries.sort((a,b)=>(nav(b.e,D.aum)??0)-(nav(a.e,D.aum)??0));const shown=entries.filter(v=>nav(v.e,D.aum)>=5000),small=entries.filter(v=>nav(v.e,D.aum)!=null&&nav(v.e,D.aum)<5000).length,unknown=entries.filter(v=>nav(v.e,D.aum)==null).length;
 cells+=`<div class="day ${((blank+day-1)%7>=5)?'weekend':''} ${date===D.today?'today':''}" data-date="${date}"><div class="day-num">${day}</div>${shown.map(({e,key,label})=>`<div class="cal-item ${key}" data-nav="${nav(e,D.aum)}"><b>${label}</b> ${esc(e.etf.split(' (')[0])} <i>${navT(nav(e,D.aum))}</i>${key==='change'&&e.change_end?' ~'+e.change_end.slice(5):''}</div>`).join('')}${small?`<div class="cal-more">+${small}개 (NAV 0.5조 미만)</div>`:''}${unknown?`<div class="cal-more">${unknown}개 NAV 미확보</div>`:''}</div>`}
 for(let pad=(7-(blank+count)%7)%7;pad>0;pad--)cells+='<div class="day"></div>';
 html+=`<article class="month"><h2>${year}년 ${mo}월 <span>정기변경 ${stats.count}개 · NAV 합 ${navT(stats.nav)}</span></h2><div class="calendar-grid">${cells}</div></article>`}
 val('months',html);
}
function renderEtfs(){
 const ym=month(D.today,etfFilter==='next'?1:0);let es=[...new Map(D.events.map(e=>[e.etf,e])).values()];
 es=es.filter(e=>etfFilter==='all'||etfFilter==='top'&&e.top10||etfFilter==='structured'&&e.method.startsWith('정형')||['this','next'].includes(etfFilter)&&D.events.some(x=>x.etf===e.etf&&x.change.startsWith(ym)));
 const sort=$('etf-sort').value;es.sort((a,b)=>sort==='name'?a.etf.localeCompare(b.etf,'ko'):sort==='trade'?(next(a.etf,'trade')?.trade??'9999').localeCompare(next(b.etf,'trade')?.trade??'9999'):(nav(b,D.aum)??0)-(nav(a,D.aum)??0));
 val('etf-table',table(['ETF','운용사','NAV(조)','기초지수 방식','다음 심사','다음 매매','다음 변경','규칙 · p14 / KRX','예측 상태'],es.map(e=>{const active=e.etf.includes('액티브'),has=D.signals.some(s=>s.etf===e.etf),change=next(e.etf,'change');return `<tr><td><b>${esc(e.etf)}</b>${e.top10?' <span class="tag change">TOP10</span>':''}</td><td>${esc(e.manager)}</td><td>${fmt(nav(e,D.aum)==null?null:nav(e,D.aum)/10000,2)}<br><small>${esc(D.aum[e.etf]?.asof??'보고서 참고값')}</small></td><td class="text">${esc(active?'액티브 · 예측 제외':e.method||'분류 미확보')}</td><td>${next(e.etf,'review')?.review??'미확보'}</td><td>${next(e.etf,'trade')?.trade??'일정 없음'}</td><td>${change?.change??'일정 없음'}${change?.change_end?' ~ '+change.change_end:''}</td><td class="text">${esc(e.rule)}</td><td>${active?'예측불가':has?'완료(조건부)':'미산출'}</td></tr>`})));
}
function renderMethod(){
 const dates=[...new Set(Object.values(D.aum).map(a=>a.asof))].join(', '),ps=[...new Set(D.signals.map(s=>s.price_date))].join(', ');
 val('method-content',`<div class="methods"><article class="card"><h2>날짜 정의 · 실행 주체</h2><ul><li>심사일: 편입·편출 판단 기준일.</li><li>비중확정일: 비중 산식의 종가 기준일. ETF별 방법론 확인 필요.</li><li>매매일(T-1): 기관(ETF 운용사)이 변경일 전 영업일 종가 근처에 매매.</li><li>변경일(T): 개장 전 지수 반영. 범위형 일정은 시작일을 기준으로 매매일 계산.</li><li>SOL 조선: 심사 2026-10-30 / 비중확정 2026-11-11 / 매매 2026-11-13 / 변경 2026-11-16.</li></ul></article><article class="card"><h2>계산식 · ★ 유의미</h2><ul><li>지수채용시총 = 종가 × 주식수 × 유동주식비율 × IIF.</li><li>예상 매매금액 = (예상 비중 − 현재 비중) × 동일지수 ETF AUM 합.</li><li>★ 절대 예상 매매금액 / 유동시총 ≥ 5% <b>또는</b> / 20일 평균 거래대금 ≥ 50%.</li><li>표의 두 비율은 원천의 실제 거래대금 기반. 주가 차트의 종가×거래량 대용치와 다름.</li><li>액티브 ETF는 일정만 추적, 수급 예측에서 제외.</li></ul></article><article class="card"><h2>예측 범위 · 확인 대기</h2><ul><li>SOL 기존 13종목·TOP3 유지, 가격·AUM 고정 조건부 시나리오. 신규 편입 예측 불가.</li><li>정형: 공시 유니버스·버퍼 순위 필요. 비정형: 신규 편입 예측 불가, 기초요건 미달 편출 감시.</li><li>WiseReport 유동비율은 FnGuide 적용값의 대용. IIF·보호예수·반기·5% 버퍼 미재현.</li><li>동일지수 레버리지 AUM 1배 합산. 실제 현물 주문액 아님. 기본 ETF 단독 금액 병기.</li><li>관리·환기·상폐사유 전수검증과 최신 별도매출 순위 미확보.</li><li>2027 휴장일 추정. TIGER 은행고배당플러스TOP10 심사·변경월 불일치 확인 대기.</li><li>다른 ETF 예상 수급은 미산출. NAV 자동갱신·ETF 가격 등락은 미수집.</li></ul></article><article class="card sources"><h2>데이터 기준 · 원천</h2><ul><li>네이버 ETF NAV 스냅샷 ${esc(dates)}. KOSPI200·KOSDAQ150은 동일지수 ETF 합계.</li><li>예상 수급 시세/PDF ${esc(ps)} · 예측 보고서 2026-10-25. NAV 변경 시 기존 신호를 자동 재계산하지 않음.</li><li>일정: DS투자증권 「ETF 리밸런싱 수급의 정석」2026-09-17 p14/p24, KRX 방법론.</li><li>SOL 운용사 전체 PDF/AUM, WiseReport 유동비율, Daum 실제 거래대금. FnGuide v1.4 p5 / KIND 2025-10-31 공시.</li><li>차트: Naver chart / trend. 최근 1년, 당일 관측 제외. chart/trend 종가 불일치는 각 카드에 공개.</li><li>가격·수급 수집 ${esc(D.collection.completed_at??'미실행')} · 수집 오류 ${(D.collection.errors||[]).length}건.</li></ul><details><summary>원천 파일·체크섬</summary>${Object.entries(D.sources).map(([k,v])=>`<p><b>${esc(k)}</b><br><code>${esc(v.path)}<br>SHA-256 ${esc(v.sha256)}</code></p>`).join('')}</details></article></div>`);
}
function activateTab(name){document.querySelectorAll('.tab').forEach(el=>el.hidden=el.id!==name);document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));}
function chips(container,key,fn){$(container).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$(container).querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));fn(b.dataset[key])})}
fetch('data.json').then(r=>{if(!r.ok)throw Error('데이터 HTTP '+r.status);return r.json()}).then(d=>{D=d;overview();renderSignals();renderCharts();renderCalendar();renderEtfs();renderMethod();$('tabs').onclick=e=>{const b=e.target.closest('button');if(b)activateTab(b.dataset.tab)};chips('signal-filters','signal',v=>{signalFilter=v;renderSignals();renderCharts()});chips('etf-filters','etf',v=>{etfFilter=v;renderEtfs()});chips('periods','days',v=>{days=+v;renderCharts()});$('stock-select').onchange=renderCharts;$('etf-sort').onchange=renderEtfs;for(const [id,step] of [['prev-month',-1],['next-month',1],['today-month',0]])$(id).onclick=()=>{monthOffset=step===0?0:monthOffset+step;renderCalendar()};window.__ready=true;}).catch(e=>{console.error(e);val('signals',`<div class="empty">데이터 로드 실패: ${esc(e.message)}</div>`)});
}
