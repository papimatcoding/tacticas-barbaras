"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {DATA,simulate}=require("../shared/combat");

test("expected roster includes our original absurd characters",()=>{
  for(const type of ["pato","abuela","pereira","tung","trancas"]){
    assert.ok(DATA[type],type+" should exist");
    assert.ok(DATA[type].name);
  }
});
test("teams are mirrored from opposite perspectives",()=>{
  const result=simulate([{type:"capibara",x:0,y:0,star:1}],[{type:"pato",x:0,y:0,star:1}],2);
  const [first]=result.frames;
  const a=first.units.find(u=>u.side==="a"),b=first.units.find(u=>u.side==="b");
  assert.deepEqual([a.x,a.y],[0,4]);
  assert.deepEqual([b.x,b.y],[4,3]);
});
test("three stars are stronger than one star",()=>{
  const result=simulate([{type:"pereira",x:0,y:0,star:3}], [{type:"pereira",x:0,y:0,star:1}],55);
  const first=result.frames[0].units;
  assert.ok(first[0].maxHp>first[1].maxHp);
  assert.equal(first[0].star,3);
});
test("same seed and team produce identical match",()=>{
  const a=[{type:"abuela",x:2,y:1,star:1},{type:"pato",x:4,y:3,star:2}];
  const b=[{type:"pereira",x:2,y:2,star:1},{type:"tung",x:3,y:0,star:1}];
  assert.deepEqual(simulate(a,b,123),simulate(a,b,123));
});
test("invalid units and duplicates do not create extra combatants",()=>{
  const result=simulate([{type:"pato",x:0,y:0,star:1},{type:"abuela",x:0,y:0,star:1},{type:"bad",x:3,y:1,star:1}],[],1);
  assert.equal(result.frames[0].units.length,1);
  assert.equal(result.winner,"a");
});
test("combat frames have a safe upper bound and inputs stay unchanged",()=>{
  const a=[{type:"capibara",x:0,y:3,star:3}],b=[{type:"capibara",x:4,y:3,star:3}];
  const snapshot=JSON.stringify({a,b});
  const result=simulate(a,b,1);
  assert.ok(result.frames.length<=91);
  assert.ok(["a","b","draw"].includes(result.winner));
  assert.equal(JSON.stringify({a,b}),snapshot);
});
