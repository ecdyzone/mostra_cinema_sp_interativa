const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const films=JSON.parse(code.match(/const films = (\[.*?\]);/s)[1]);
for(const film of films.filter(f=>f.curated)){
 assert.ok(typeof film.why==='string'&&film.why.trim(), 'Justificativa ausente: '+film.title);
 const card=html.match(new RegExp('<article[^>]*data-id="'+film.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"[^>]*>[\\s\\S]*?</article>'));
 assert.ok(card&&card[0].includes('<p class="why">'), 'Justificativa não renderizada: '+film.title);
}
class El{
 constructor(){this.value='';this.hidden=false;this.attrs={};this.listeners={};this.firstElementChild={textContent:''};this.dataset={};this.children=[];}
 setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.listeners[k]=fn}appendChild(el){this.children=this.children.filter(c=>c!==el);this.children.push(el)}replaceChildren(){this.children=[]}querySelector(){return this.button}click(){this.clicked=true}focus(){this.focused=true}remove(){}
}
function setup(storage={},search=''){
 const ids=['search','theme','sort','day','date-label','intro','scope','featured','favorites','export-menu','export-toggle','download','calendar','download-all','calendar-all','print','filmes','count','empty','status'];
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'), 'Elemento ausente: '+id);
 const els=Object.fromEntries(ids.map(id=>[id,new El()]));els.sort.value='curadoria';
 const cards=films.map(f=>{const c=new El();c.dataset.id=f.id;c.button=new El();c.button.dataset.favorite=f.id;return c});
 let exported;
 const context={document:{addEventListener(){},getElementById:id=>els[id],querySelectorAll:()=>cards,createElement:()=>new El(),body:new El()},localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},Blob,TextEncoder,URL:Object.assign(URL,{createObjectURL:blob=>{exported=blob;return 'blob:test'},revokeObjectURL(){}}),URLSearchParams,setTimeout:fn=>fn(),window:{location:{search,href:'https://example.com/'+search},history:{replaceState(){}},print(){}}};
 vm.createContext(context);vm.runInContext(code,context);
 return {els,cards,storage,exported:()=>exported,filename:()=>context.document.body.children.at(-1)?.download,calendarFor:selected=>context.buildCalendar(selected),visible:()=>cards.filter(c=>!c.hidden),changeDay(day){els.day.value=day;els.day.listeners.change()},choose(f){const button=cards.find(c=>c.dataset.id===f.id).button;els.filmes.listeners.click({target:{closest:()=>button}})}};
}
(async()=>{
 const old=films.find(f=>f.date==='2026-10-17'&&f.legacyId===6);
 const app=setup({'mostra-sabado-2026':'[6]'},'?dia=2026-10-17');
 assert.equal(app.visible().length,24);assert.equal(app.els.favorites.textContent,'Minha lista do dia (1)');
 assert.ok(JSON.parse(app.storage['mostra-sessoes-2026-v2']).includes(old.id));
 app.changeDay('2026-10-24');assert.equal(app.visible().length,32);assert.equal(app.els.favorites.textContent,'Minha lista do dia (0)');
 assert.ok(app.visible().every(c=>c.dataset.id.startsWith('2026-10-24')));
 app.els.featured.listeners.click();assert.equal(app.visible().length,12);app.els.featured.listeners.click();
 const second=films.find(f=>f.date==='2026-10-24'&&f.title===old.title);app.choose(second);assert.equal(app.els.favorites.textContent,'Minha lista do dia (1)');
 app.els.favorites.listeners.click();assert.equal(app.visible().length,1);
 app.els.download.listeners.click();const text=await app.exported().text();assert.ok(text.includes('24/10/2026'));assert.ok(text.includes('14:30'));assert.ok(!text.includes('15:45'));
 app.changeDay('2026-10-17');assert.equal(app.visible().length,1);assert.equal(app.visible()[0].dataset.id,old.id);
 app.els.favorites.listeners.click();app.els.search.value='Concreto';app.els.search.listeners.input();assert.equal(app.visible().length,1);
 app.changeDay('2026-10-24');assert.equal(app.visible().length,0);assert.equal(app.els.empty.hidden,false);
 app.els.search.value='Nosso Século';app.els.search.listeners.input();assert.equal(app.visible().length,1);
 assert.equal(setup({},'?dia=2026-10-24').visible().length,32);
 assert.equal(setup({'mostra-sessoes-2026-v2':'{bad'},'?dia=invalid').visible().length,25);
 const sessions24=films.filter(f=>f.date==='2026-10-24');assert.equal(sessions24.filter(f=>f.members).length,2);
 assert.deepEqual(sessions24.filter(f=>f.members).map(f=>f.minutes),[73,75]);
 for(const [day,count,dayName] of [['2026-10-23',30,'Sexta-feira'],['2026-10-25',27,'Domingo']]){
  const added=setup({},'?dia='+day);
  assert.equal(added.visible().length,count);
  assert.ok(added.els['date-label'].textContent.startsWith(dayName));
  assert.ok(added.visible().every(c=>c.dataset.id.startsWith(day)));
  added.els.featured.listeners.click();assert.equal(added.visible().length,12);
  added.els.featured.listeners.click();
  added.els.theme.value='Animação';added.els.theme.listeners.change();
  assert.ok(added.visible().length>0);
  assert.ok(added.visible().every(c=>films.find(f=>f.id===c.dataset.id).tags.includes('Animação')));
  added.els.theme.value='';added.els.theme.listeners.change();
  const selected=films.find(f=>f.date===day&&f.title==='Everytime');
  added.choose(selected);added.els.favorites.listeners.click();assert.equal(added.visible().length,1);
  added.els.download.listeners.click();
  const exported=await added.exported().text();
  assert.ok(exported.startsWith(dayName+' na Mostra — '+day.split('-').reverse().join('/')));
  assert.ok(exported.includes(selected.time+' — Everytime'));
  added.changeDay('2026-10-17');assert.equal(added.visible().length,0);
  added.changeDay(day);assert.equal(added.visible().length,1);
  assert.equal(setup(added.storage,'?dia='+day).els.favorites.textContent,'Minha lista do dia (1)');
 }
 const allDays=Array.from({length:15},(_,i)=>'2026-10-'+String(i+15));
 assert.deepEqual([...new Set(films.map(f=>f.date))].sort(),allDays);
 for(const day of allDays){
  assert.ok(html.includes('<option value="'+day+'">'));
  const daily=setup({},'?dia='+day);
  const dayFilms=films.filter(f=>f.date===day),curated=dayFilms.filter(f=>f.curated);
  assert.equal(daily.visible().length,curated.length);
  assert.ok(daily.visible().every(c=>c.dataset.id.startsWith(day)));
  daily.els.featured.listeners.click();
  assert.equal(daily.visible().length,dayFilms.filter(f=>f.featured).length);
  daily.els.featured.listeners.click();
  daily.els.sort.value='horario';daily.els.sort.listeners.change();
  const times=daily.els.filmes.children.filter(c=>!c.hidden).map(c=>films.find(f=>f.id===c.dataset.id).time);
  assert.deepEqual(times,[...times].sort());
  daily.choose(dayFilms[0]);daily.els.calendar.listeners.click();
  const exported=await daily.exported().text();
  assert.equal((exported.match(/BEGIN:VEVENT/g)||[]).length,1);
  daily.changeDay(day==='2026-10-15'?'2026-10-16':'2026-10-15');
  assert.equal(daily.els.favorites.textContent,'Minha lista do dia (0)');
  const complete=setup({},'?dia='+day);
  complete.els.featured.listeners.click();
  complete.els.scope.listeners.click();
  assert.equal(complete.visible().length,dayFilms.length);
  assert.equal(complete.els.scope.attrs['aria-pressed'],'true');
  assert.equal(complete.els.featured.hidden,true);
  assert.equal(complete.els.sort.value,'horario');
  assert.equal(complete.els.featured.attrs['aria-pressed'],'false');
  const outside=dayFilms.find(f=>!f.curated);
  assert.ok(outside);
  complete.choose(outside);
  complete.els.scope.listeners.click();
  assert.equal(complete.visible().length,curated.length);
  assert.equal(complete.cards.find(c=>c.dataset.id===outside.id).hidden,true);
  complete.els.favorites.listeners.click();
  assert.equal(complete.visible().length,1);
  assert.equal(complete.visible()[0].dataset.id,outside.id);
  complete.els.download.listeners.click();
  assert.ok((await complete.exported().text()).includes(outside.title));
  complete.els.calendar.listeners.click();
  assert.equal((await complete.exported().text()).split('BEGIN:VEVENT').length-1,1);
  assert.equal(setup({},'?dia='+day+'&visao=todos').visible().length,dayFilms.length);
 }
 assert.equal((html.match(/<article /g)||[]).length,films.length);
 const calendar=setup({},'?dia=2026-10-24');
 calendar.els.calendar.listeners.click();assert.equal(calendar.exported(),undefined);
 assert.ok(calendar.els.status.textContent.includes('Marque a estrela'));
 const movie=films.find(f=>f.date==='2026-10-24'&&f.title==='Everytime');
 const program=films.find(f=>f.date==='2026-10-24'&&f.members&&f.time==='15:00');
 calendar.choose(movie);calendar.choose(program);
 // Uma escolha em outro dia não deve vazar para a exportação atual.
 calendar.changeDay('2026-10-17');calendar.choose(old);calendar.changeDay('2026-10-24');
 calendar.els.calendar.listeners.click();
 assert.equal(calendar.exported().type,'text/calendar;charset=utf-8');
 const ics=await calendar.exported().text();
 const unfold=text=>text.replace(/\r\n[ \t]/g,'');
 const unfolded=unfold(ics);
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
 assert.equal(ics.replace(/\r\n/g,'').includes('\n'),false);
 assert.equal((unfolded.match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.equal((unfolded.match(/END:VEVENT/g)||[]).length,2);
 assert.ok(unfolded.includes('DTSTART:20261024T170000Z\r\nDTEND:20261024T190300Z'));
 assert.ok(unfolded.includes('DTSTART:20261024T180000Z\r\nDTEND:20261024T191300Z'));
 assert.ok(unfolded.includes('LOCATION:CINESESC'));
 assert.ok(unfolded.includes('URL:'+movie.url));
 assert.ok(unfolded.includes('Nosso Século (48 min)'));
 assert.ok(!unfolded.includes('DTSTART:20261017'));
 assert.equal((unfolded.match(/^DTSTAMP:\d{8}T\d{6}Z$/gm)||[]).length,2);
 assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
 const uids=text=>unfold(text).match(/^UID:.*$/gm);
 assert.deepEqual(uids(ics),uids(calendar.calendarFor([movie,program])));
 const fixture={...movie,id:'teste-calendario',date:'2026-10-25',time:'23:30',minutes:90,
  title:'Sessão, café; 🎬 \\fim\nOutra linha',venue:'Cinema, sala; 1',
  summary:'Memória 🎬 '.repeat(30),members:[]};
 const special=calendar.calendarFor([fixture]),specialText=unfold(special);
 assert.ok(specialText.includes('DTSTART:20261026T023000Z\r\nDTEND:20261026T040000Z'));
 assert.ok(specialText.includes('SUMMARY:Mostra: Sessão\\, café\\; 🎬 \\\\fim\\nOutra linha'));
 assert.ok(specialText.includes('LOCATION:Cinema\\, sala\\; 1'));
 assert.ok(specialText.includes('Memória 🎬 '.repeat(30)));
 assert.ok(special.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
 assert.equal(special.includes('\uFFFD'),false);
 // A lista completa inclui os 15 dias e ignora visualização, filtros e ordem de marcação.
 const full=setup({'mostra-sabado-2026':'[6]'},'?dia=2026-10-24');
 const selected=[...new Map([
  ...allDays.map(day=>films.find(f=>f.date===day)),old,movie,program,
  films.find(f=>f.date==='2026-10-29'&&!f.curated),
  films.find(f=>f.date==='2026-10-23'&&f.title===movie.title)
 ].map(f=>[f.id,f])).values()];
 for(const f of [...selected].reverse())if(f.id!==old.id)full.choose(f);
 const chronological=[...selected].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
 full.els.search.value='nenhum filme com este nome';full.els.search.listeners.input();
 full.els.theme.value='Animação';full.els.theme.listeners.change();
 full.els.featured.listeners.click();
 assert.equal(full.visible().length,0);
 full.els['export-menu'].open=true;full.els['download-all'].listeners.click();
 assert.equal(full.els['export-menu'].open,false);assert.equal(full.els['export-toggle'].focused,true);
 assert.equal(full.filename(),'minha-lista-mostra-todos-os-dias.txt');
 assert.equal(full.exported().type,'text/plain;charset=utf-8');
 const fullText=await full.exported().text();
 assert.ok(fullText.startsWith('Minha lista completa na Mostra — Todos os dias\n'));
 for(const day of allDays)assert.equal(fullText.split(day.split('-').reverse().join('/')).length-1,1);
 let position=-1;
 for(const f of chronological){
  const next=fullText.indexOf(f.time+' — '+f.title+' ('+f.minutes+' min)\n'+f.venue+'\n'+f.director+'\n'+f.url+'\n',position+1);
  assert.ok(next>position,'Sessão ausente ou fora de ordem: '+f.id);position=next;
 }
 assert.equal(fullText.split('\n').filter(line=>/^\d{2}:\d{2} — /.test(line)).length,selected.length);
 for(const member of program.members)assert.ok(fullText.includes(member.title+' ('+member.minutes+' min) — '+member.url));
 assert.ok(full.els.status.textContent.includes(selected.length+' opções'));
 full.els['calendar-all'].listeners.click();
 assert.equal(full.filename(),'mostra-calendario-todos-os-dias.ics');
 assert.equal(full.exported().type,'text/calendar;charset=utf-8');
 const fullIcs=await full.exported().text();
 assert.equal((fullIcs.match(/BEGIN:VEVENT/g)||[]).length,selected.length);
 assert.deepEqual(uids(fullIcs),uids(full.calendarFor(chronological)));
 assert.ok(fullIcs.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));
 // Reabrir em outra data e visualização mantém a exportação completa.
 const reloaded=setup(full.storage,'?dia=2026-10-15&visao=todos');
 reloaded.els.favorites.listeners.click();reloaded.els['download-all'].listeners.click();
 assert.equal(await reloaded.exported().text(),fullText);
 reloaded.els['calendar-all'].listeners.click();assert.deepEqual(uids(await reloaded.exported().text()),uids(fullIcs));
 // Um dia sem favoritos não impede exportar escolhas de outros dias.
 const otherDay=setup({'mostra-sabado-2026':'[6]'},'?dia=2026-10-15');
 otherDay.els.download.listeners.click();assert.equal(otherDay.exported(),undefined);
 otherDay.els.calendar.listeners.click();assert.equal(otherDay.exported(),undefined);
 otherDay.els['download-all'].listeners.click();assert.ok((await otherDay.exported().text()).includes(old.title));
 assert.ok(otherDay.els.status.textContent.endsWith('1 opção.'));
 otherDay.els['calendar-all'].listeners.click();assert.deepEqual(uids(await otherDay.exported().text()),uids(otherDay.calendarFor([old])));
 otherDay.choose(old); // Remover a última escolha deve impedir downloads vazios.
 const empty=setup(otherDay.storage);
 for(const id of ['download-all','calendar-all']){
  empty.els[id].listeners.click();assert.equal(empty.exported(),undefined);
  assert.ok(empty.els.status.textContent.includes('Marque a estrela'));
  assert.ok(!empty.els.status.textContent.includes('deste dia'));
 }
 console.log('Passou: 15 dias, curadoria padrão e programação completa, seleção por URL, filtros, ordenação e favoritos nas duas visões; TXT e calendário por dia e completos; fuso, duração, virada de dia, programas e UTF-8.');
})();
