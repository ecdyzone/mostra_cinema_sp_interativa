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
function setup(storage={},search='',options={}){
 const ids=['search','theme','sort','day','date-label','intro','scope','featured','favorites','export-menu','export-toggle','download','calendar','download-all','calendar-all','print','filmes','count','empty','status','import-menu','import-toggle','import-txt','import-file','recover-old','recover-retry'];
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'), 'Elemento ausente: '+id);
 const els=Object.fromEntries(ids.map(id=>[id,new El()]));els.sort.value='curadoria';
 const cards=films.map(f=>{const c=new El();c.dataset.id=f.id;c.button=new El();c.button.dataset.favorite=f.id;return c});
 let exported;
 const url=new URL(options.href||'https://example.com/'+search);let navigation;
 const context={document:{addEventListener(){},getElementById:id=>els[id],querySelectorAll:()=>cards,createElement:()=>new El(),body:new El()},localStorage:{getItem:key=>{if(options.readError)throw Error('blocked');return storage[key]??null},setItem:(key,value)=>{if(options.writeError)throw Error('blocked');storage[key]=value}},Blob,TextEncoder,URL:Object.assign(URL,{createObjectURL:blob=>{exported=blob;return 'blob:test'},revokeObjectURL(){}}),URLSearchParams,setTimeout:fn=>fn(),window:{location:{search:url.search,href:url.href,origin:url.origin,assign:href=>{navigation=href}},history:{replaceState(_state,_title,href){context.window.location.href=String(href)}},print(){}}};
 vm.createContext(context);vm.runInContext(options.auto?code.replace('const AUTO_RECOVER_FAVORITES = false;','const AUTO_RECOVER_FAVORITES = true;'):code,context);
 return {els,cards,storage,context,navigation:()=>navigation,async importText(text){els['import-file'].files=[{size:Buffer.byteLength(text),text:async()=>text}];await els['import-file'].listeners.change()},exported:()=>exported,filename:()=>context.document.body.children.at(-1)?.download,calendarFor:selected=>context.buildCalendar(selected),visible:()=>cards.filter(c=>!c.hidden),changeDay(day){els.day.value=day;els.day.listeners.change()},choose(f){const button=cards.find(c=>c.dataset.id===f.id).button;els.filmes.listeners.click({target:{closest:()=>button}})}};
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
 // TXT exportado de verdade: todos os dias, filtros ativos e programas agrupados.
 const imported=setup();
 imported.choose(old);
 await imported.importText(fullText);
 const expectedIds=[...new Set([old.id,...selected.map(f=>f.id)])].sort();
 assert.deepEqual(JSON.parse(imported.storage['mostra-sessoes-2026-v2']).sort(),expectedIds);
 await imported.importText('\uFEFF'+fullText.replace(/\n/g,'\r\n'));
 assert.deepEqual(JSON.parse(imported.storage['mostra-sessoes-2026-v2']).sort(),expectedIds);
 assert.ok(imported.els.status.textContent.includes('0 favoritos adicionados'));
 const dailySource=setup();dailySource.choose(old);dailySource.changeDay(old.date);dailySource.els.download.listeners.click();
 const dailyText=await dailySource.exported().text();
 const dailyImport=setup();await dailyImport.importText(dailyText);
 assert.deepEqual(JSON.parse(dailyImport.storage['mostra-sessoes-2026-v2']),[old.id]);
 const accentImport=setup();await accentImport.importText(dailyText.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
 assert.deepEqual(JSON.parse(accentImport.storage['mostra-sessoes-2026-v2']),[old.id]);
 const beforeInvalid=imported.storage['mostra-sessoes-2026-v2'];
 await imported.importText('qualquer texto');assert.ok(imported.els.status.textContent.includes('Não foi possível ler'));
 assert.equal(imported.storage['mostra-sessoes-2026-v2'],beforeInvalid);
 const mismatch=dailyText.replace(old.title,'Filme que não existe');
 await imported.importText(mismatch);assert.ok(imported.els.status.textContent.includes('Nenhuma sessão'));
 assert.equal(imported.storage['mostra-sessoes-2026-v2'],beforeInvalid);
 await imported.importText(fullText.replace(selected[0].title,'Filme que não existe'));
 assert.ok(imported.els.status.textContent.includes('1 entrada não identificada'));
 // Sem data ou com sala/horário divergente, não adivinhar a sessão.
 for(const invalid of [dailyText.replace(/.+ na Mostra — .+\n/,''),dailyText.replace(old.venue,'OUTRO CINEMA'),dailyText.replace(old.time,'00:01')]){
  const app=setup();await app.importText(invalid);assert.equal(app.storage['mostra-sessoes-2026-v2'],'[]');
 }
 const ambiguous=setup();
 vm.runInContext('films.push({...films.find(f=>f.id==='+JSON.stringify(old.id)+'),id:"duplicado"})',ambiguous.context);
 await ambiguous.importText(dailyText);assert.ok(ambiguous.els.status.textContent.includes('Nenhuma sessão'));
 const blockedImport=setup({},'',{writeError:true});await blockedImport.importText(dailyText);
 assert.ok(blockedImport.els.status.textContent.includes('Não foi possível salvar'));
 assert.equal(vm.runInContext('chosen.size',blockedImport.context),0);
 const largeImport=setup();largeImport.els['import-file'].files=[{size:1000001,text:()=>{throw Error('não deveria ler')}}];
 await largeImport.els['import-file'].listeners.change();assert.ok(largeImport.els.status.textContent.includes('grande demais'));
 // Testar a página auxiliar real em uma origem antiga simulada, sem rede.
 const bridgeHtml=fs.readFileSync(path.join(__dirname,'..','transferir-favoritos','index.html'),'utf8');
 const bridgeCode=bridgeHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
 function runBridge(storage={},search='',options={}){
  const els={status:new El(),return:new El()};let destination;
  const context={URL,URLSearchParams,document:{getElementById:id=>els[id]},localStorage:{getItem(key){if(options.blocked)throw Error('blocked');return storage[key]??null}},window:{location:{origin:options.origin||'https://ecdyzone.github.io',search,replace:href=>{destination=href}}}};
  vm.createContext(context);vm.runInContext(bridgeCode,context);return {destination,els};
 }
 const originalStorage={'mostra-sessoes-2026-v2':JSON.stringify([old.id,selected[0].id,'sessao-desconhecida'])};
 const originalCopy=JSON.stringify(originalStorage);
 const bridge=runBridge(originalStorage,'?dia=2026-10-24&visao=todos&destino=https://example.org');
 const back=new URL(bridge.destination);
 assert.equal(back.origin,'https://mostrasp.com.br');assert.equal(back.search,'?dia=2026-10-24&visao=todos');
 assert.equal(JSON.stringify(originalStorage),originalCopy);
 const recovered=setup({'mostra-sessoes-2026-v2':JSON.stringify([old.id])},'',{href:bridge.destination});
 assert.ok(recovered.els.status.textContent.startsWith('Recuperação concluída'));
 assert.ok(recovered.els.status.textContent.includes('1 entrada não identificada'));
 assert.deepEqual(JSON.parse(recovered.storage['mostra-sessoes-2026-v2']).sort(),[...new Set([old.id,selected[0].id])].sort());
 assert.equal(new URL(recovered.context.window.location.href).hash,'');
 assert.equal(new URL(recovered.context.window.location.href).search,'?dia=2026-10-24&visao=todos');
 assert.equal(recovered.storage['mostra-migracao-2026-v1'],'done');
 const legacyBack=runBridge({'mostra-sabado-2026':'[6,99999]'});
 const legacyRecovered=setup({},'',{href:legacyBack.destination});
 assert.deepEqual(JSON.parse(legacyRecovered.storage['mostra-sessoes-2026-v2']),[old.id]);
 assert.ok(legacyRecovered.els.status.textContent.includes('1 entrada não identificada'));
 // A chave atual é autoritativa: não ressuscitar favoritos legados já removidos.
 const removedLegacy=runBridge({'mostra-sessoes-2026-v2':'[]','mostra-sabado-2026':'[6]'});
 const noFavorites=setup({},'',{href:removedLegacy.destination});
 assert.ok(noFavorites.els.status.textContent.includes('Nenhum favorito'));
 for(const options of [{blocked:true},{origin:'https://outro.example'}]){
  const failed=setup({},'',{href:runBridge(originalStorage,'',options).destination});
  assert.ok(failed.els.status.textContent.includes('Não foi possível ler'));assert.equal(failed.els['recover-retry'].hidden,false);
 }
 const corrupt=setup({},'',{href:runBridge({'mostra-sessoes-2026-v2':'{bad'}).destination});
 assert.equal(corrupt.storage['mostra-migracao-2026-v1'],'failed');
 for(const fragment of ['%xx',encodeURIComponent('{bad'),encodeURIComponent(JSON.stringify({version:2,ids:[],legacy:[]})),encodeURIComponent(JSON.stringify({version:1,ids:[{}],legacy:[]}))]){
  const bad=setup({},'',{href:'https://mostrasp.com.br/#mostra-favoritos='+fragment});
  assert.equal(bad.storage['mostra-migracao-2026-v1'],'failed');assert.ok(bad.els.status.textContent.includes('inválidos'));
 }
 const failedSave=setup({},'',{href:bridge.destination,writeError:true});
 assert.ok(failedSave.els.status.textContent.includes('Não foi possível salvar'));
 assert.ok(new URL(failedSave.context.window.location.href).hash.startsWith('#mostra-favoritos='));
 assert.equal(vm.runInContext('chosen.size',failedSave.context),0);
 // Configuração desligada, origens diferentes e acesso offline não navegam.
 for(const href of ['https://mostrasp.com.br/','https://ecdyzone.github.io/mostra_cinema_sp_interativa/','file:///tmp/index.html']){
  assert.equal(setup({},'',{href}).navigation(),undefined);
 }
 for(const href of ['https://ecdyzone.github.io/mostra_cinema_sp_interativa/','file:///tmp/index.html']){
  assert.equal(setup({},'',{href,auto:true}).navigation(),undefined);
 }
 const auto=setup({},'',{href:'https://mostrasp.com.br/?dia=2026-10-24&visao=todos',auto:true});
 assert.equal(auto.storage['mostra-migracao-2026-v1'],'pending');
 assert.equal(auto.navigation(),'https://ecdyzone.github.io/transferir-favoritos/?dia=2026-10-24&visao=todos');
 const interrupted=setup(auto.storage,'',{href:'https://mostrasp.com.br/',auto:true});
 assert.equal(interrupted.navigation(),undefined);assert.equal(interrupted.els['recover-retry'].hidden,false);
 interrupted.els['recover-retry'].listeners.click();assert.ok(interrupted.navigation());
 for(const state of ['done','failed','pending'])assert.equal(setup({'mostra-migracao-2026-v1':state},'',{href:'https://mostrasp.com.br/',auto:true}).navigation(),undefined);
 for(const options of [{readError:true},{writeError:true}])assert.equal(setup({},'',{...options,href:'https://mostrasp.com.br/',auto:true}).navigation(),undefined);
 const roundTrip=setup({},'',{href:runBridge(originalStorage,new URL(auto.navigation()).search).destination,auto:true});
 assert.equal(roundTrip.navigation(),undefined);assert.equal(roundTrip.storage['mostra-migracao-2026-v1'],'done');
 const revisited=setup(roundTrip.storage,'',{href:roundTrip.context.window.location.href,auto:true});assert.equal(revisited.navigation(),undefined);
 imported.els['import-txt'].listeners.click();assert.equal(imported.els['import-file'].clicked,true);
 imported.els['import-menu'].open=true;let prevented=false;
 imported.els['import-menu'].listeners.keydown({key:'Escape',preventDefault(){prevented=true}});
 assert.ok(prevented);assert.equal(imported.els['import-menu'].open,false);assert.equal(imported.els['import-toggle'].focused,true);
 console.log('Passou: TXT diário e completo, importação parcial, duplicatas, ambiguidades, acentos, falhas de armazenamento; página auxiliar, favoritos legados, retorno, recuperação única e desativação.');
 console.log('Passou: 15 dias, curadoria padrão e programação completa, seleção por URL, filtros, ordenação e favoritos nas duas visões; TXT e calendário por dia e completos; fuso, duração, virada de dia, programas e UTF-8.');
})();
