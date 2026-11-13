'use strict';const test=require('node:test');const assert=require('node:assert/strict');const G=require('../game-logic');
function room(n=7){const r=G.makeRoom('Narrator');for(let i=0;i<n;i++)G.addPlayer(r,'Player'+i);return r}
test('random codes and unique session credentials',()=>{let a=room();assert.match(a.code,/^[A-Z2-9]{6}$/);assert.equal(new Set(a.players.map(x=>x.token)).size,a.players.length)});
test('role counts and mafia teammate privacy',()=>{const r=room();r.settings={mafia:3,silencer:1,doctor:true,detective:true};G.start(r);assert.equal(r.players.filter(x=>x.role==='mafia_silencer').length,1);assert.equal(r.players.filter(x=>x.role==='mafia_killer').length,2);const maf=r.players.find(p=>p.role==='mafia_silencer');const civ=r.players.find(p=>p.role==='civilian');assert.equal(G.project(r,{token:maf.token}).teammates.length,2);assert.equal(G.project(r,{token:civ.token}).teammates.length,0);assert.equal(G.project(r,{token:civ.token}).players.some(p=>p.role),false)});
test('silencers cannot target mafia teammates',()=>{const r=room();r.settings={mafia:2,silencer:1,doctor:true,detective:true};G.start(r);const sil=r.players.find(p=>p.role==='mafia_silencer');const killer=r.players.find(p=>p.role==='mafia_killer');assert.throws(()=>G.submitAction(r,sil,killer.id),/مافيا/)});
test('silencer becomes killing mafia when last killer is eliminated and card role changes',()=>{const r=room();r.settings={mafia:2,silencer:1,doctor:false,detective:false};G.start(r);const k=r.players.find(p=>p.role==='mafia_killer'),s=r.players.find(p=>p.role==='mafia_silencer');r.phase='day';const result=G.eliminate(r,k.id);assert.deepEqual(result.promotions,[s.name]);assert.equal(s.role,'mafia_killer');assert.equal(G.project(r,{token:s.token}).self.role,'mafia_killer');assert.equal(G.project(r,{token:s.token}).teammates.length,1);});
test('no promotion while another killing mafia remains',()=>{const r=room();r.settings={mafia:3,silencer:1,doctor:false,detective:false};G.start(r);const killers=r.players.filter(p=>p.role==='mafia_killer'),sil=r.players.find(p=>p.role==='mafia_silencer');r.phase='day';G.eliminate(r,killers[0].id);assert.equal(sil.role,'mafia_silencer');G.nextNight(r);r.phase='day';G.eliminate(r,killers[1].id);assert.equal(sil.role,'mafia_killer')});
test('unanimous kill blocked by doctor and silencing affects day',()=>{const r=room(8);r.settings={mafia:3,silencer:1,doctor:true,detective:true};G.start(r);const ks=r.players.filter(p=>p.role==='mafia_killer'),sil=r.players.find(p=>p.role==='mafia_silencer'),doc=r.players.find(p=>p.role==='doctor'),victim=r.players.find(p=>p.role==='civilian');for(const k of ks)G.submitAction(r,k,victim.id);G.submitAction(r,doc,victim.id);G.submitAction(r,sil,victim.id);const summary=G.resolveNight(r);assert.equal(summary.killed,null);assert.equal(summary.saved,true);assert.equal(G.project(r,{token:victim.token}).self.silenced,true);assert.equal(r.phase,'day')});
test('mismatched killers have no kill',()=>{const r=room(8);r.settings={mafia:2,silencer:0,doctor:false,detective:false};G.start(r);const [a,b]=r.players.filter(p=>p.role==='mafia_killer'),t=r.players.filter(p=>p.role==='civilian');G.submitAction(r,a,t[0].id);G.submitAction(r,b,t[1].id);const s=G.resolveNight(r);assert.equal(s.killed,null)});

test('one elimination per day; next night resets the guard',()=>{const r=room(7);r.settings={mafia:1,silencer:0,doctor:false,detective:false};G.start(r);r.phase='day';const civilians=r.players.filter(p=>p.role==='civilian');G.eliminate(r,civilians[0].id);assert.throws(()=>G.eliminate(r,civilians[1].id),/بالفعل/);G.nextNight(r);assert.equal(r.dayEliminated,false)});


test('leave during live game is a permanent forfeit, clears actions and denies private state',()=>{
 const r=room(8);r.settings={mafia:2,silencer:1,doctor:true,detective:true};G.start(r);
 const player=r.players.find(p=>p.role==='civilian');const oldToken=player.token;
 const killer=r.players.find(p=>p.role==='mafia_killer');G.submitAction(r,killer,player.id);
 const result=G.leavePlayer(r,killer);
 assert.equal(result.forfeited,true);assert.equal(killer.alive,false);assert.equal(killer.left,true);
 assert.deepEqual(result.promotions,[r.players.find(p=>p.role==='mafia_killer'&&p.alive).name]);
 assert.equal(r.actions[killer.id],undefined);assert.equal(G.project(r,{token:killer.token}),null);
 assert.equal(G.project(r,{token:oldToken}).self.alive,true);
 assert.throws(()=>G.submitAction(r,killer,player.id));
});

test('leaving lobby removes the player; restart does not restore quitters',()=>{
 const r=room(7);const p=r.players[0];G.leavePlayer(r,p);
 assert.equal(r.players.length,6);assert.equal(r.players.includes(p),false);
 r.settings={mafia:2,silencer:1,doctor:false,detective:false};G.start(r);
 const q=r.players.find(x=>x.role==='civilian');G.leavePlayer(r,q);r.phase='finished';
 G.resetGame(r);assert.equal(r.players.includes(q),false);assert.equal(r.phase,'lobby');
});

test('losing the final living Mafia by leaving ends the game for innocents',()=>{
 const r=room(6);r.settings={mafia:1,silencer:0,doctor:false,detective:false};G.start(r);
 const killer=r.players.find(p=>p.role==='mafia_killer');G.leavePlayer(r,killer);
 assert.equal(r.winner,'town');assert.equal(r.phase,'finished');
});


test('leaving cancels actions that target the quitter',()=>{
 const r=room(7);r.settings={mafia:1,silencer:0,doctor:true,detective:false};G.start(r);
 const killer=r.players.find(p=>p.role==='mafia_killer');const target=r.players.find(p=>p.role==='civilian');
 G.submitAction(r,killer,target.id);assert.equal(r.actions[killer.id],target.id);
 G.leavePlayer(r,target);assert.equal(r.actions[killer.id],undefined);
 const result=G.resolveNight(r);assert.equal(result.killed,null);
});

test('silencer promoted mid-night must choose a fresh killing target',()=>{
 const r=room(8);r.settings={mafia:2,silencer:1,doctor:false,detective:false};G.start(r);
 const killer=r.players.find(p=>p.role==='mafia_killer');const silencer=r.players.find(p=>p.role==='mafia_silencer');const victim=r.players.find(p=>p.role==='civilian');
 G.submitAction(r,silencer,victim.id);G.leavePlayer(r,killer);
 assert.equal(silencer.role,'mafia_killer');assert.equal(r.actions[silencer.id],undefined);
 assert.equal(G.resolveNight(r).killed,null);
});
