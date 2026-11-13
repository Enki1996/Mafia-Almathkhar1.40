'use strict';
const { randomBytes,randomInt } = require('node:crypto');
const ROLES=['civilian','mafia_killer','mafia_silencer','doctor','detective'];
const MAFIA=new Set(['mafia_killer','mafia_silencer']);
function id(bytes=18){return randomBytes(bytes).toString('hex')}
function code(){return Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('')}
function cleanName(value){return String(value??'').replace(/[<>\u0000-\u001f\u007f]/g,'').trim().slice(0,28)}
function fail(msg){throw Error(msg)}
function settingsFor(s,n){
  const mafia=Math.max(1,Math.min(Number.isInteger(s.mafia)?s.mafia:1,Math.max(1,n-1)));
  const doctor=!!s.doctor,detective=!!s.detective;
  const maxSilencers=Math.max(0,mafia-1);
  const silencer=Math.max(0,Math.min(Number.isInteger(s.silencer)?s.silencer:0,maxSilencers));
  if(mafia+Number(doctor)+Number(detective)>n) fail('عدد الأدوار أكبر من عدد اللاعبين');
  return {mafia,doctor,detective,silencer};
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function makeRoom(hostName){const host=cleanName(hostName);if(!host)fail('اكتب اسم الراوي');return {code:code(),createdAt:Date.now(),updatedAt:Date.now(),phase:'lobby',round:0,dayEliminated:false,host:{name:host,token:id()},players:[],settings:{mafia:1,doctor:true,detective:true,silencer:0},actions:{},summary:null,history:[],winner:null}}
function addPlayer(room,name){if(room.phase!=='lobby')fail('الغرفة بدأت اللعبة بالفعل');if(room.players.length>=20)fail('الغرفة ممتلئة');name=cleanName(name);if(!name)fail('اكتب اسم اللاعب');if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))fail('الاسم مستخدم بالغرفة');const p={id:id(9),token:id(),name,role:null,alive:true,silencedRound:0,investigations:[]};room.players.push(p);return p}
function start(room){if(room.phase!=='lobby')fail('المرحلة غير صحيحة');const n=room.players.length;if(n<4)fail('نحتاج ٤ لاعبين على الأقل');const s=settingsFor(room.settings,n);if(s.mafia>=n)fail('يجب أن يبقى مدني واحد على الأقل');const roles=[...Array(s.mafia-s.silencer).fill('mafia_killer'),...Array(s.silencer).fill('mafia_silencer')];if(s.doctor)roles.push('doctor');if(s.detective)roles.push('detective');while(roles.length<n)roles.push('civilian');shuffle(roles);room.players.forEach((p,i)=>{p.role=roles[i];p.alive=true;p.silencedRound=0;p.investigations=[]});room.phase='night';room.round=1;room.dayEliminated=false;room.actions={};room.summary=null;room.winner=null;room.history=[]}
function living(room){return room.players.filter(p=>p.alive)}
function eligible(room,p,kind){if(room.phase!=='night')fail('الحركات متاحة في مرحلة نهاية الجولة فقط');if(!p.alive)fail('اللاعب خارج اللعبة');if(kind==='mafia_killer'||kind==='mafia_silencer'||kind==='doctor'||kind==='detective'){if(p.role!==kind)fail('الدور لا يملك هذه الحركة');return}fail('الدور لا يملك حركة سرية')}
function submitAction(room,p,targetId){eligible(room,p,p.role);const target=room.players.find(x=>x.id===targetId&&x.alive);if(!target)fail('الهدف غير متاح');if(MAFIA.has(p.role)&&MAFIA.has(target.role))fail('لا يمكن استهداف أحد أفراد فريق المافيا');room.actions[p.id]=target.id}
function actionProgress(room){const active=living(room).filter(p=>p.role!=='civilian');return {done:active.filter(p=>room.actions[p.id]).length,total:active.length}}
function resolveNight(room){if(room.phase!=='night')fail('ليست مرحلة نهاية الجولة');const alive=living(room),killers=alive.filter(x=>x.role==='mafia_killer');const killVotes=killers.map(k=>room.actions[k.id]).filter(Boolean);let kill=null;
 // When multiple active killers exist, all must select the same living target.
 if(killers.length&&killVotes.length===killers.length&&new Set(killVotes).size===1)kill=killVotes[0];
 const doctors=alive.filter(p=>p.role==='doctor');const saved=new Set(doctors.map(p=>room.actions[p.id]).filter(Boolean));
 const killed=kill&&!saved.has(kill)?room.players.find(x=>x.id===kill&&x.alive):null;
 const silences=alive.filter(p=>p.role==='mafia_silencer').map(p=>room.actions[p.id]).filter(Boolean);
 const silenced=[];
 for(const targetId of silences){const target=room.players.find(x=>x.id===targetId&&x.alive&&x!==killed);if(target){target.silencedRound=room.round;silenced.push(target.name)}}
 for(const detective of alive.filter(x=>x.role==='detective')){const target=room.players.find(x=>x.id===room.actions[detective.id]);if(target){detective.investigations.push({round:room.round,name:target.name,isMafia:MAFIA.has(target.role)})}}
 if(killed)killed.alive=false;
 const promotions=promote(room);
 room.summary={round:room.round,killed:killed?.name||null,saved:kill&&saved.has(kill),silenced,killVotes:killers.map(x=>({by:x.name,target:room.players.find(p=>p.id===room.actions[x.id])?.name||'لم يصوت'})),actions:alive.filter(x=>x.role!=='civilian').map(x=>({name:x.name,role:x.role,target:room.players.find(p=>p.id===room.actions[x.id])?.name||null})),promotions};
 room.history.push({type:'night',...room.summary});room.actions={};room.dayEliminated=false;room.phase='day';checkWinner(room);return room.summary;
}
function promote(room){const promotions=[];while(room.phase!=='lobby'&&!living(room).some(p=>p.role==='mafia_killer')){const next=living(room).find(p=>p.role==='mafia_silencer');if(!next)break;next.role='mafia_killer';promotions.push(next.name);break}return promotions}
function checkWinner(room){if(room.phase==='lobby')return null;const alive=living(room),mafia=alive.filter(p=>MAFIA.has(p.role));if(mafia.length===0){room.phase='finished';room.winner='town'}else if(mafia.length>=alive.length-mafia.length){room.phase='finished';room.winner='mafia'}return room.winner}
function eliminate(room,targetId){if(room.phase!=='day')fail('الإقصاء متاح أثناء النقاش فقط');if(room.dayEliminated)fail('تم تسجيل إقصاء هذه الجولة بالفعل');const target=room.players.find(x=>x.id===targetId&&x.alive);if(!target)fail('اللاعب غير متاح');target.alive=false;room.dayEliminated=true;const promotions=promote(room);room.history.push({type:'elimination',round:room.round,name:target.name,role:target.role,promotions});checkWinner(room);return {name:target.name,role:target.role,promotions}}
function nextNight(room){if(room.phase!=='day')fail('لا يمكن البدء من هذه المرحلة');room.phase='night';room.round++;room.dayEliminated=false;room.actions={};room.summary=null;for(const p of room.players){p.silencedRound=0}}
function leavePlayer(room,player){if(player.left)fail('اللاعب غادر الغرفة بالفعل');const wasPlaying=room.phase!=='lobby'&&room.phase!=='finished';const active=!!player.alive;player.left=true;player.connected=false;player.token=id();delete room.actions[player.id];for(const [actorId,targetId] of Object.entries(room.actions)){if(targetId===player.id)delete room.actions[actorId]}if(room.phase==='lobby'){room.players=room.players.filter(p=>p.id!==player.id);return {forfeited:false,promotions:[]}}if(wasPlaying&&active){player.alive=false;const promotions=promote(room);for(const promotedName of promotions){const promoted=room.players.find(p=>p.name===promotedName);if(promoted)delete room.actions[promoted.id]}room.history.push({type:'forfeit',round:room.round,name:player.name,role:player.role,promotions});checkWinner(room);return {forfeited:true,promotions}}return {forfeited:false,promotions:[]}}
function resetGame(room){room.players=room.players.filter(p=>!p.left);room.phase='lobby';room.round=0;room.dayEliminated=false;room.actions={};room.summary=null;room.history=[];room.winner=null;room.players.forEach(p=>{p.role=null;p.alive=true;p.silencedRound=0;p.investigations=[]})}
function project(room,actor){const isHost=actor.token===room.host.token;const self=isHost?null:room.players.find(p=>p.token===actor.token&&!p.left);if(!isHost&&!self)return null;const base={code:room.code,phase:room.phase,round:room.round,hostName:room.host.name,settings:room.settings,winner:room.winner,dayEliminated:!!room.dayEliminated,players:room.players.map(p=>({id:p.id,name:p.name,alive:p.alive,connected:!!p.connected})),progress:room.phase==='night'?actionProgress(room):null,host:isHost};
 if(isHost)return {...base,players:room.players.map(p=>({...p,token:undefined,investigations:undefined})),actions:room.phase==='night'?room.players.filter(p=>p.role!=='civilian').map(p=>({id:p.id,name:p.name,role:p.role,target:room.players.find(x=>x.id===room.actions[p.id])?.name||null,submitted:!!room.actions[p.id]})):[],summary:room.summary};
 return {...base,self:{id:self.id,name:self.name,role:self.role,alive:self.alive,silenced:room.phase==='day'&&self.silencedRound===room.round,submitted:!!room.actions[self.id],selectedTargetId:room.actions[self.id]||null,investigations:self.investigations.slice(-3)},teammates:MAFIA.has(self.role)?room.players.filter(p=>MAFIA.has(p.role)&&p.id!==self.id).map(p=>({id:p.id,name:p.name,role:p.role,alive:p.alive})):[]};
}
module.exports={ROLES,MAFIA,code,id,cleanName,makeRoom,addPlayer,settingsFor,start,living,submitAction,actionProgress,resolveNight,promote,checkWinner,eliminate,nextNight,resetGame,leavePlayer,project,fail};
