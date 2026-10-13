var $=function(i){return document.getElementById(i)},f=function(x){return(x<0?'\u2212':'')+Math.abs(x).toFixed(1)};
var prog=0,t0=0,raf=0,fin=false;
function tick(n){prog=Math.min(1,(n-t0)/1300);$('fill').style.transform='scaleX('+prog+')';if(prog>=1){end();return}raf=requestAnimationFrame(tick)}
function start(e){if(fin)return;e.preventDefault();cancelAnimationFrame(raf);t0=performance.now();$('ht').textContent='Fusing…';raf=requestAnimationFrame(tick)}
function stop(){if(fin)return;cancelAnimationFrame(raf);$('fill').style.transform='scaleX(0)';$('ht').textContent='Hold to splice fiber'}
function end(){fin=true;$('hero').classList.add('done');hb.classList.add('x');if(navigator.vibrate)navigator.vibrate(35);var s0=performance.now();
(function c(n){var p=Math.min(1,(n-s0)/1500),v=-40+21.5*p*(2-p);$('lv').textContent=f(v);if(p<1)requestAnimationFrame(c);else{$('lu').textContent='● ONLINE · dBm';$('lu').style.color='var(--ok)'}})(s0);
$('ht').textContent='Fused. Welcome in.';$('hint').textContent='0.1 dB lost. The street is lit.';$('tg').hidden=false;setTimeout(function(){view(1)},1900)}
var hb=$('hold');hb.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(function(n){hb.addEventListener(n,stop)});
hb.addEventListener('keydown',function(e){if((e.key==' '||e.key=='Enter')&&!e.repeat)start(e)});hb.addEventListener('keyup',stop);
function view(s){$('land').hidden=!!s;$('studio').hidden=!s;window.scrollTo(0,0)}$('tg').onclick=function(){view(1)};

var SPL={2:3.7,4:7.2,8:10.5,16:13.8,32:17.1,64:20.5},AT={1310:.35,1490:.25};
var N=[],E=[],M=2,auto=true,sel=null,lm=false,la=null,uid=0,stale=false,R={P:{},ont:[]},mi=-1,drag=null,mode='';
var K={olt:{tx:5,on:1,c:'C+'},sp:{r:32,ex:0},fb:{ty:'feeder',km:2,sp:2,cn:2,wl:1490},ont:{nm:'Subscriber'}};
function nd(k,x,y,o){var n=Object.assign({id:++uid,k:k,x:x,y:y},K[k],o||{});N.push(n);return n.id}
function by(i){for(var j=0;j<N.length;j++)if(N[j].id==i)return N[j]}
function load(p){N=[];E=[];uid=0;sel=null;la=null;var o=nd('olt',180,36,p=='long'?{on:0}:{}),a=nd('fb',180,104,{km:p=='long'?18:p=='rescue'?10:8,sp:4,cn:2}),s=nd('sp',180,174,{r:p=='rescue'?64:32});E.push([o,a],[a,s]);
if(p=='rescue'){var d=nd('fb',180,250,{ty:'drop',km:6,sp:1,cn:2}),t=nd('ont',180,332,{nm:'Unpatched home'});E.push([d,t])}
else if(p=='long'){var d=nd('fb',180,250,{ty:'drop',km:4,sp:1,cn:2}),t=nd('ont',180,332,{nm:'Dukan Ridge — Tower 7'});E.push([s,d],[d,t])}
else[[60,1.5,1,2,'Villa 1'],[180,3,1,2,'Villa 2'],[300,14,2,8,'Villa 3']].forEach(function(v){var d=nd('fb',v[0],250,{ty:'drop',km:v[1],sp:v[2],cn:v[3]}),t=nd('ont',v[0],332,{nm:v[4]});E.push([s,d],[d,t])});
M=2;$('mar').value=2;upd();ins()}
function sim(){var P={},ont=[],adj={};N.forEach(function(n){adj[n.id]=[]});E.forEach(function(e){if(adj[e[0]])adj[e[0]].push(e[1])});
function go(id,p,L,seen){var n=by(id);if(!n||seen[id])return;seen=Object.assign({},seen);seen[id]=1;var l=L.slice();
if(n.k=='fb'){var a=n.km*AT[n.wl],s=n.sp*.1,c=n.cn*.5;p-=a+s+c;l=[l[0]+a,l[1]+s,l[2]+c,l[3]]}else if(n.k=='sp'){var q=SPL[n.r]+n.ex;p-=q;l[3]+=q}
P[id]=Math.max(P[id]==null?-99:P[id],p);
if(n.k=='ont'){var x=p-M;ont.push({id:id,prx:x,l:l.concat([M]),st:x>-8?'OVERLOAD':x>=-24?'ONLINE':x>=-28?'WARNING':'LOS'});return}
adj[id].forEach(function(c){go(c,p,l,seen)})}
N.filter(function(n){return n.k=='olt'&&n.on}).forEach(function(o){P[o.id]=o.tx;var s={};s[o.id]=1;adj[o.id].forEach(function(c){go(c,o.tx,[0,0,0,0],s)})});return{P:P,ont:ont}}
function st(id){for(var i=0;i<R.ont.length;i++)if(R.ont[i].id==id)return R.ont[i];return null}
var SC={ONLINE:'#0F8A5F',WARNING:'#B36B00',LOS:'#C23B3B',OVERLOAD:'#C23B3B',DISCONNECTED:'#9A8576'};
function upd(){if(auto){R=sim();stale=false}else stale=true;draw()}
function draw(){dE();dN();$('cv').className='cv'+(stale?' stale':'');$('sb').textContent=stale?'STALE · run test':'';health();ivals();if(!$('mo').hidden&&mode=='m')mshow()}
function dE(){var h='';E.forEach(function(e){var a=by(e[0]),b=by(e[1]);if(!a||!b)return;var sx=a.x,sy=a.y+22,tx=b.x,ty=b.y-22,p=R.P[e[1]],q=p==null?null:p-M,c=q==null?'#B8A08C':q>=-24?'#2F6BFF':q>=-28?'#E8A33D':'#C23B3B',d='M'+sx+' '+sy+'C'+sx+' '+(sy+28)+' '+tx+' '+(ty-28)+' '+tx+' '+ty,mx=(sx+tx)/2,my=(sy+ty)/2;
h+='<path d="'+d+'" fill="none" stroke="#2B1A14" stroke-width="5.5" stroke-linecap="round" opacity=".16"/><path class="lane" d="'+d+'" stroke="'+c+'"'+(q==null?' stroke-dasharray="4 5" opacity=".6"':'')+'/>'+(q==null?'':'<path class="pulse" d="'+d+'"/>')+(p==null?'':'<g><rect x="'+(mx-19)+'" y="'+(my-8)+'" width="38" height="16" rx="8" fill="#FFFAF2" stroke="#EED8BF"/><text x="'+mx+'" y="'+(my+4)+'" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="#2B1A14">'+f(p)+'</text></g>')});$('eg').innerHTML=h}
var T={olt:'OLT',sp:'Splitter',fb:'Fiber',ont:'ONT'};
function dN(){var h='';N.forEach(function(n){var s=n.k=='ont'?(st(n.id)||{st:'DISCONNECTED'}):null,t=n.k=='fb'?{feeder:'Feeder',dist:'Distrib.',drop:'Drop'}[n.ty]:n.k=='ont'?n.nm.slice(0,13):T[n.k],
sub=n.k=='olt'?(n.on?'+'+n.tx.toFixed(1)+' dBm':'laser off'):n.k=='sp'?'1:'+n.r+' · '+(SPL[n.r]+n.ex).toFixed(1)+'dB':n.k=='fb'?n.km+' km':(s.prx!=null?f(s.prx)+' dBm':s.st.toLowerCase()),
wc=s?(s.st=='ONLINE'||s.st=='WARNING'?'#FFB020':s.st=='OVERLOAD'?'#fff':'#7A5A4C'):'',
sl=sel==n.id||la==n.id;
h+='<g data-i="'+n.id+'" transform="translate('+n.x+' '+n.y+')" style="cursor:grab;touch-action:none">'+(s&&s.st=='ONLINE'?'<circle r="46" fill="url(#og)"/>':'')+'<rect x="-44" y="-22" width="88" height="44" rx="12" fill="#FFFAF2" filter="url(#sh)" stroke="'+(sl?'#E4673F':'#EED8BF')+'" stroke-width="'+(sl?2.5:1.5)+'"/>'+
'<svg x="-40" y="-14" width="30" height="20" viewBox="0 0 48 32"><use href="#i-'+n.k+'"'+(s?' style="color:'+wc+'"'+(s.st=='WARNING'?' class="fk"':''):'')+'/></svg>'+
'<text x="-7" y="-4" font-size="11" font-weight="500" fill="#2B1A14" font-family="Manrope">'+t+'</text><text x="-7" y="10" font-size="10" fill="'+(s?SC[s.st]:'#85695A')+'" font-family="JetBrains Mono,monospace">'+sub+'</text>'+
(s?'<circle cx="38" cy="-16" r="4" fill="'+SC[s.st]+'"/>':'')+'<circle cx="0" cy="-22" r="3.5" fill="#fff" stroke="#2F6BFF"/><circle cx="0" cy="22" r="3.5" fill="#fff" stroke="#2F6BFF"/></g>'});$('ng').innerHTML=h}
function health(){var o=N.filter(function(n){return n.k=='ont'}),ok=0,w=0,d=0;o.forEach(function(n){var s=(st(n.id)||{st:'DISCONNECTED'}).st;if(s=='ONLINE')ok++;else if(s=='WARNING')w++;else d++});
var t=!o.length?['No subscribers yet','var(--mut)']:d?['Network down','var(--bad)']:w?['Marginal','var(--warn)']:['Optimal','var(--ok)'];$('hp').textContent=t[0]+(o.length?' · '+ok+' up '+w+' warn '+d+' down':'');$('hp').style.color=t[1]}
var CAT={olt:['1U GPON pizza-box OLT','Central-office optical line terminal',['SFP GPON ports with SC/UPC','10GE uplinks, dual power supplies'],['Match SFP class (B+/C+) to the budget.','Never look into a live port.']],
sp:['Box-type PLC splitter','Passive 1:N cassette with SC/APC pigtails',['1 input, N outputs','Green SC/APC ferrules'],['Each doubling of N adds about 3.5 dB.','Label every output you patch.']],
fb:['Loose-tube cable span','Feeder, distribution or drop plant',['PE jacket, water-block tape','Single-mode glass core'],['Count every splice and connector.','Never mate APC to UPC.']],
ont:['Desktop GPON ONT','Subscriber terminal with SC/APC input',['SC/APC optical input','Gigabit LAN, status LEDs'],['Low power or LOS usually means loss upstream.','Check the drop first.']]};
function ins(){var n=by(sel),el=$('ins');if(!n){el.innerHTML='<h3>Inspector</h3><small>Select a node to see its hardware card and controls.</small>';return}
var c=CAT[n.k],h='<div class="hc2"><svg viewBox="0 0 48 32"><use href="#i-'+n.k+'" style="color:#FFB020"/></svg></div><h3>'+c[0]+'</h3><small>'+c[1]+' · representative illustration</small><ul>'+c[2].concat(c[3]).map(function(x){return'<li>'+x+'</li>'}).join('')+'</ul><div class="ctl">';
function R_(k,l,a,b,s,u){h+='<label>'+l+'<b id="v_'+k+'">'+n[k]+u+'</b></label><input type="range" data-f="'+k+'" data-u="'+u+'" min="'+a+'" max="'+b+'" step="'+s+'" value="'+n[k]+'">'}
function S_(k,l,o,cur){h+='<label>'+l+'</label><select data-f="'+k+'">'+o.map(function(x){return'<option value="'+x[0]+'"'+(x[0]==cur?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select>'}
if(n.k=='olt'){R_('tx','Launch power',1.5,7,.5,' dBm');h+='<label><span>Laser</span><input type="checkbox" data-f="on"'+(n.on?' checked':'')+'></label>'}
if(n.k=='sp'){S_('r','Split ratio',Object.keys(SPL).map(function(r){return[r,'1:'+r+' · '+SPL[r]+' dB']}),n.r);R_('ex','Excess loss',0,3,.1,' dB')}
if(n.k=='fb'){S_('ty','Type',[['feeder','Feeder'],['dist','Distribution'],['drop','Drop']],n.ty);R_('km','Length',0,30,.5,' km');R_('sp','Splices',0,20,1,'');R_('cn','Connectors',0,16,1,'');S_('wl','Wavelength',[[1310,'1310 nm · 0.35 dB/km'],[1490,'1490 nm · 0.25 dB/km']],n.wl)}
if(n.k=='ont')h+='<label>Subscriber</label><input type="text" data-f="nm" value="'+n.nm.replace(/"/g,'')+'"><div id="bk"></div>';
el.innerHTML=h+'</div>';
el.querySelectorAll('[data-f]').forEach(function(i){i.oninput=i.onchange=function(){var k=i.dataset.f;n[k]=i.type=='checkbox'?(i.checked?1:0):i.type=='text'?i.value:(k=='ty'?i.value:+i.value);if(i.type=='range'&&$('v_'+k))$('v_'+k).textContent=n[k]+i.dataset.u;upd()}});ivals()}
function ivals(){var n=by(sel);if(!n||n.k!='ont'||!$('bk'))return;var s=st(n.id);$('bk').innerHTML=s?'<div class="bk"><span>Fiber</span><u>'+s.l[0].toFixed(1)+' dB</u><span>Splices</span><u>'+s.l[1].toFixed(1)+' dB</u><span>Connectors</span><u>'+s.l[2].toFixed(1)+' dB</u><span>Splitter</span><u>'+s.l[3].toFixed(1)+' dB</u><span>Margin</span><u>'+s.l[4].toFixed(1)+' dB</u><span>Receive</span><u style="color:'+SC[s.st]+'">'+f(s.prx)+' dBm · '+s.st+'</u></div>':'<small>No active path to this subscriber.</small>'}
var sv=$('sv');function hl(){sv.querySelectorAll('[data-i]').forEach(function(g){var r=g.querySelector('rect'),s=g.dataset.i==sel;r.setAttribute('stroke',s?'#E4673F':'#EED8BF');r.setAttribute('stroke-width',s?2.5:1.5)})}function pt(e){var r=sv.getBoundingClientRect();return[(e.clientX-r.left)*360/r.width,(e.clientY-r.top)*400/r.height]}
sv.addEventListener('pointerdown',function(e){var g=e.target.closest('[data-i]');if(!g)return;var n=by(g.dataset.i);if(lm){if(la==null){la=n.id}else if(la!=n.id){var i=-1;E.forEach(function(x,j){if(x[0]==la&&x[1]==n.id)i=j});if(i>=0)E.splice(i,1);else E.push([la,n.id]);la=null}upd();return}
sel=n.id;var p=pt(e);drag={n:n,dx:n.x-p[0],dy:n.y-p[1],m:0};hl();ins()});
sv.addEventListener('pointermove',function(e){if(!drag)return;var p=pt(e);drag.n.x=Math.max(46,Math.min(314,p[0]+drag.dx));drag.n.y=Math.max(26,Math.min(374,p[1]+drag.dy));var g=sv.querySelector('[data-i="'+drag.n.id+'"]');if(g)g.setAttribute('transform','translate('+drag.n.x+' '+drag.n.y+')');dE()});
['pointerup','pointercancel'].forEach(function(ev){window.addEventListener(ev,function(){drag=null})});
function mo(h,m){mode=m;$('mc').innerHTML=h;$('mo').hidden=false}$('mo').onclick=function(e){if(e.target==$('mo'))$('mo').hidden=true};
var MS=[['The Marginal Villa','Villa 3 sits in warning. Bring all three homes online, keep the margin at 2.0 dB and the launch power at or below +5.0 dBm.','std',[['All ONTs online',function(){return R.ont.length>0&&R.ont.every(function(o){return o.st=='ONLINE'})}],['Margin is 2.0 dB',function(){return M==2}],['OLT launch at or below +5.0 dBm',function(){return N.every(function(n){return n.k!='olt'||n.tx<=5})}]]],
['Diagnose the Silent ONT','A subscriber at Dukan Ridge — Tower 7 reports complete loss of light. Find out why and restore the path.','long',[['Laser is on',function(){return N.some(function(n){return n.k=='olt'&&n.on})}],['Target ONT is online',function(){return R.ont.length>0&&R.ont.every(function(o){return o.st=='ONLINE'})}]]],
['Rescue the Unpatched Subscriber','A drop is not patched to the splitter. Connect it, then cut split loss until the subscriber lights up.','rescue',[['Splitter linked to the drop',function(){return E.some(function(e){var a=by(e[0]),b=by(e[1]);return a&&b&&a.k=='sp'&&b.k=='fb'})}],['Drop linked to the ONT',function(){return E.some(function(e){var a=by(e[0]),b=by(e[1]);return a&&b&&a.k=='fb'&&b.k=='ont'})}],['Subscriber is online',function(){return R.ont.length>0&&R.ont.every(function(o){return o.st=='ONLINE'})}]]]];
function mshow(){var h='<h2>Field <em>missions</em></h2><small style="color:var(--mut)">Objectives update live against your network. Dirty connectors and macro-bends are not modeled as separate losses.</small>';
MS.forEach(function(m,i){var on=i==mi,done=on&&m[3].every(function(o){return o[1]()});h+='<div class="ms"><h3>'+m[0]+'</h3><p>'+m[1]+'</p>'+m[3].map(function(o){var y=on&&o[1]();return'<div class="ob'+(y?' y':'')+'"><i>'+(y?'●':'○')+'</i>'+o[0]+'</div>'}).join('')+(done?'<p style="color:var(--ok);margin-top:10px">Mission complete. The window is lit.</p>':'')+'<button class="b pr" data-m="'+i+'" style="margin-top:10px">'+(on?'Restart':'Start mission')+'</button></div>'});mo(h,'m')}
function bom(){var km=0,sp=0,cn=0,S={},o=[];N.forEach(function(n){if(n.k=='fb'){km+=n.km;sp+=n.sp;cn+=n.cn}if(n.k=='sp')S[n.r]=(S[n.r]||0)+1});R.ont.forEach(function(r){o.push({subscriber:by(r.id).nm,rx_dbm:+r.prx.toFixed(1),status:r.st})});return{fiber_km:km,splices:sp,connectors:cn,splitters:S,subscribers:o,safety_margin_db:M}}
function bshow(){var b=bom(),csv='item,value\nfiber_km,'+b.fiber_km+'\nsplices,'+b.splices+'\nconnectors,'+b.connectors+'\n'+Object.keys(b.splitters).map(function(r){return'splitter_1:'+r+','+b.splitters[r]}).join('\n')+'\nsubscriber,rx_dbm,status\n'+b.subscribers.map(function(s){return s.subscriber+','+s.rx_dbm+','+s.status}).join('\n');window._c=csv;window._j=JSON.stringify(b,null,2);
mo('<h2>Bill of <em>materials</em></h2><table><tr><td>Fiber</td><td>'+b.fiber_km+' km</td></tr><tr><td>Splices</td><td>'+b.splices+'</td></tr><tr><td>Connectors</td><td>'+b.connectors+'</td></tr>'+Object.keys(b.splitters).map(function(r){return'<tr><td>Splitter 1:'+r+'</td><td>'+b.splitters[r]+'</td></tr>'}).join('')+'</table><table><tr><th>Subscriber</th><th>Rx dBm</th><th>Status</th></tr>'+b.subscribers.map(function(s){return'<tr><td>'+s.subscriber+'</td><td>'+f(s.rx_dbm)+'</td><td>'+s.status+'</td></tr>'}).join('')+'</table><button class="b" data-c="c">Copy CSV</button> <button class="b" data-c="j">Copy JSON</button><textarea id="ta" readonly aria-label="Export text" style="margin-top:10px"></textarea>','b')}
document.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
if(b.dataset.m!=null){mi=+b.dataset.m;load(MS[mi][2]);mshow();return}
if(b.dataset.c){var t=b.dataset.c=='c'?window._c:window._j,ta=$('ta');ta.value=t;ta.select();try{navigator.clipboard.writeText(t)}catch(x){}return}
var a=b.dataset.a;if(!a)return;
if(a=='ov')view(0);if(a=='ms')mshow();if(a=='bom')bshow();
if(a=='run'){R=sim();stale=false;draw()}
if(a=='clr'){N=[];E=[];sel=null;la=null;R={P:{},ont:[]};upd();ins()}
if(a=='link'){lm=!lm;la=null;b.className='b'+(lm?' on':'');b.textContent=lm?'Linking: tap two nodes':'Link nodes';dN()}
if(a=='del'&&sel){N=N.filter(function(n){return n.id!=sel});E=E.filter(function(x){return x[0]!=sel&&x[1]!=sel});sel=null;upd();ins()}
if(a[0]=='+'){var k=a.slice(1),id=nd(k,60+Math.random()*240,60+Math.random()*280);sel=id;upd();ins()}});
$('pre').onchange=function(e){if(e.target.value){mi=-1;load(e.target.value);e.target.value=''}};
$('mar').oninput=function(e){M=Math.max(0,Math.min(6,+e.target.value||0));upd()};$('au').onchange=function(e){auto=e.target.checked;if(auto)upd()};
load('std');
