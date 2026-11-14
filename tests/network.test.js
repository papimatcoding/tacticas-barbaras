"use strict";
// Simulate two independent browser tabs and a PeerJS signalling/data-channel layer.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {EventEmitter}=require("node:events");
const engine=require("../shared/combat");
const source=fs.readFileSync(require("node:path").join(__dirname,"../public/network.js"),"utf8");
const peers=new Map();
let nextPeer=1;

class DataLink extends EventEmitter {
  constructor(peer){super();this.peer=peer;this.open=false;this.partner=null;}
  send(payload){if(this.open&&this.partner?.open){
    const target=this.partner;
    queueMicrotask(()=>{if(target.open)target.emit("data",structuredClone(payload));});
  }}
  close(){
    this.open=false;this.emit("close");
    if(this.partner){this.partner.open=false;this.partner.emit("close");}
  }
}
class FakePeer extends EventEmitter {
  constructor(id){
    super();this.id=id||"guest-"+nextPeer++;
    if(peers.has(this.id)){
      queueMicrotask(()=>this.emit("error",{type:"unavailable-id"}));
      return;
    }
    peers.set(this.id,this);
    queueMicrotask(()=>this.emit("open",this.id));
  }
  connect(id){
    const target=peers.get(id);
    const initiator=new DataLink(id),acceptor=new DataLink(this.id);
    initiator.partner=acceptor;acceptor.partner=initiator;
    queueMicrotask(()=>{
      if(!target){this.emit("error",{type:"peer-unavailable"});return;}
      target.emit("connection",acceptor);
      initiator.open=true;acceptor.open=true;
      initiator.emit("open");acceptor.emit("open");
    });
    return initiator;
  }
  destroy(){peers.delete(this.id);}
}
function createBrowser(){
  const window={
    BattleEngine:engine,Peer:FakePeer,
    crypto:{getRandomValues(bytes){bytes.forEach((_,i)=>bytes[i]=5+i*11);return bytes;}},
    setTimeout(fn,ms){return ms>=10000?0:setTimeout(fn,ms);}
  };
  vm.runInNewContext(source,{window,console});
  return window.TBNetwork;
}
const delay=(ms=15)=>new Promise(done=>setTimeout(done,ms));

test("two browser tabs can create, join, ready and resolve a private match",async()=>{
  peers.clear();
  const host=createBrowser(),guest=createBrowser();
  let hjoin=null,gjoin=null,hstart=null,gstart=null,hresult=null,gresult=null,hready=null,gready=null;
  host.on("round:start",x=>hstart=x);
  guest.on("round:start",x=>gstart=x);
  host.on("round:result",x=>hresult=x);
  guest.on("round:result",x=>gresult=x);
  host.emit("room:create",{name:"Primero"},r=>hjoin=r);
  await delay();
  assert.equal(hjoin?.ok,true);
  assert.match(hjoin.code,/^[A-Z2-9]{6}$/);
  guest.emit("room:join",{name:"Segundo",code:hjoin.code},r=>gjoin=r);
  await delay();
  assert.equal(gjoin?.ok,true);
  assert.ok(hstart);assert.ok(gstart);
  assert.equal(gstart.round,1);
  const hostBoard=[{type:"pereira",x:2,y:1,star:1}];
  const guestBoard=[{type:"pato",x:1,y:0,star:1}];
  host.emit("round:ready",{board:hostBoard},r=>hready=r);
  guest.emit("round:ready",{board:guestBoard},r=>gready=r);
  await delay();
  assert.equal(hready?.ok,true);
  assert.equal(gready?.ok,true);
  assert.ok(hresult?.result?.frames?.length>0);
  assert.equal(gresult?.result?.winner,hresult.result.winner);
  assert.equal(gresult.sides.a,hjoin.id);
  assert.equal(gresult.sides.b,gjoin.id);
  host.emit("room:leave");
  guest.emit("room:leave");
});
