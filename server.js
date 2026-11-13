'use strict';
const express=require('express');
const http=require('node:http');
const {Server}=require('socket.io');
const fs=require('node:fs');
const path=require('node:path');
const G=require('./game-logic');
const app=express();const server=http.createServer(app);const io=new Server(server,{maxHttpBufferSize:15_000,serveClient:true});
app.disable('x-powered-by');app.use(express.static(path.join(__dirname,'public'),{maxAge:3600000}));
app.get('/health',(req,res)=>res.json({ok:true}));
const rooms=new Map();const dir=process.env.MAFIA_DATA_DIR||'';
const stateFile=dir?path.join(dir,'almudhakhar-rooms-v1.json'):null;
if(stateFile){try{fs.mkdirSync(dir,{recursive:true});const old=JSON.parse(fs.readFileSync(stateFile,'utf8'));for(const r of old){if(r.updatedAt>Date.now()-7*86400000){r.players.forEach(p=>p.connected=false);rooms.set(r.code,r)}}}catch(e){if(e.code!=='ENOENT')console.warn('Room restore failed:',e.message)}}
function save(){if(!stateFile)return;try{const tmp=stateFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify([...rooms.values()]));fs.renameSync(tmp,stateFile)}catch(e){console.error('Room persistence failed',e.message)}}
function notify(room){room.updatedAt=Date.now();save();for(const socket of io.sockets.sockets.values()){const actor=socket.data.actor;if(actor&&actor.code===room.code){const view=G.project(room,actor);if(view)socket.emit('room:state',view)}}}
function ack(fn,data){if(typeof fn==='function')fn(data)}
function safe(socket,cb,handler){try{const output=handler();ack(cb,{ok:true,...output})}catch(e){ack(cb,{ok:false,error:e.message||'خطأ غير متوقع'})}}
function mustActor(socket,hostOnly=false){const actor=socket.data.actor;if(!actor)G.fail('انتهت الجلسة، ادخل الغرفة من جديد');const r=rooms.get(actor.code);if(!r)G.fail('الغرفة غير موجودة');const isHost=actor.token===r.host.token;if(hostOnly&&!isHost)G.fail('هذه العملية للراوي فقط');const player=isHost?null:r.players.find(p=>p.token===actor.token&&!p.left);if(!isHost&&!player)G.fail('لا تملك صلاحية لهذه الغرفة');return {r,isHost,player}}
function setActor(socket,r,token){socket.data.actor={code:r.code,token};socket.join(r.code);const player=r.players.find(p=>p.token===token);if(player)player.connected=true;notify(r)}
io.on('connection',socket=>{
  socket.on('room:create',(data,cb)=>safe(socket,cb,()=>{if(rooms.size>=500)G.fail('السيرفر ممتلئ مؤقتاً');const room=G.makeRoom(data?.name);for(let tries=0;tries<20&&rooms.has(room.code);tries++)room.code=G.code();if(rooms.has(room.code))G.fail('حاول مرة أخرى');rooms.set(room.code,room);setActor(socket,room,room.host.token);return {code:room.code,token:room.host.token,host:true}}));
  socket.on('room:join',(data,cb)=>safe(socket,cb,()=>{const code=String(data?.code||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();const room=rooms.get(code);if(!room)G.fail('ما لقينا غرفة بهذا الرمز');const player=G.addPlayer(room,data?.name);setActor(socket,room,player.token);return {code,token:player.token,host:false}}));
  socket.on('room:resume',(data,cb)=>safe(socket,cb,()=>{const code=String(data?.code||'').toUpperCase();const room=rooms.get(code);if(!room)G.fail('الغرفة غير موجودة');const token=String(data?.token||'');if(room.host.token!==token&&!room.players.some(p=>p.token===token&&!p.left))G.fail('الجلسة غير صالحة');setActor(socket,room,token);return {code,token,host:room.host.token===token}}));
  socket.on('room:settings',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);if(r.phase!=='lobby')G.fail('لا يمكن تعديل الإعدادات بعد بداية اللعبة');const mafia=Number(data?.mafia),silencer=Number(data?.silencer);if(!Number.isInteger(mafia)||mafia<1||mafia>10)G.fail('عدد المافيا يجب أن يكون بين 1 و10');if(!Number.isInteger(silencer)||silencer<0||silencer>=mafia)G.fail('عدد المُسكّتين يجب أن يكون أقل من عدد المافيا');r.settings={mafia,doctor:!!data?.doctor,detective:!!data?.detective,silencer};notify(r);return {}}));
  socket.on('room:start',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);G.start(r);notify(r);return {}}));
  socket.on('night:submit',(data,cb)=>safe(socket,cb,()=>{const {r,player}=mustActor(socket);if(!player)G.fail('الراوي لا ينفذ حركات اللاعبين');G.submitAction(r,player,String(data?.targetId||''));notify(r);return {}}));
  socket.on('night:resolve',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);const summary=G.resolveNight(r);notify(r);return {summary}}));
  socket.on('day:eliminate',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);const result=G.eliminate(r,String(data?.playerId||''));notify(r);return {result}}));
  socket.on('day:skip',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);if(r.phase!=='day')G.fail('ليست مرحلة النقاش');if(r.dayEliminated)G.fail('انتهى التصويت، انتقل إلى مرحلة نهاية الجولة التالية');r.history.push({type:'skip',round:r.round});G.nextNight(r);notify(r);return {}}));
  socket.on('day:next',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);G.nextNight(r);notify(r);return {}}));
  socket.on('room:reset',(data,cb)=>safe(socket,cb,()=>{const {r}=mustActor(socket,true);G.resetGame(r);notify(r);return {}}));
  socket.on('room:leave',(data,cb)=>safe(socket,cb,()=>{const {r,isHost,player}=mustActor(socket);if(isHost){rooms.delete(r.code);save();io.to(r.code).emit('room:closed');for(const c of io.sockets.sockets.values())if(c.data.actor?.code===r.code){c.data.actor=null;c.leave(r.code)}}else if(player){const previousToken=player.token;G.leavePlayer(r,player);for(const c of io.sockets.sockets.values()){if(c.data.actor?.code===r.code&&c.data.actor.token===previousToken){c.emit('room:left');c.data.actor=null;c.leave(r.code)}}notify(r)}return {}}));
  socket.on('disconnect',()=>{const actor=socket.data.actor;if(!actor)return;const r=rooms.get(actor.code);if(!r)return;const p=r.players.find(x=>x.token===actor.token);if(p){p.connected=[...io.sockets.sockets.values()].some(other=>other!==socket&&other.data.actor?.token===p.token&&other.data.actor?.code===r.code);notify(r)}});
});
setInterval(()=>{let changed=false;for(const [code,r] of rooms){if(r.updatedAt<Date.now()-7*86400000){rooms.delete(code);changed=true}}if(changed)save()},3600_000).unref();
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log(`Mafia Al-Mudhakhar live on port ${port}`));
