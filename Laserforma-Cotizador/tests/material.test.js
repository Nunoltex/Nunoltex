import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDXF, defaults, calcQuote, evaluate, rateHour } from '../src/engine.js';
import { planMaterials, groupKey, stockWeight, productionQuantity, transformPoint } from '../src/material.js';
const fixture=(entities,unit=4)=>'0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n'+unit+'\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n'+entities+'0\nENDSEC\n0\nEOF\n';
const rectangle=(w,h)=>'0\nLWPOLYLINE\n70\n1\n10\n0\n20\n0\n10\n'+w+'\n20\n0\n10\n'+w+'\n20\n'+h+'\n10\n0\n20\n'+h+'\n';
const piece=(id,w=10,h=10,qty=1)=>({...parseDXF(fixture(rectangle(w,h)),id+'.dxf'),id,qty,material:'Latón',thickness:1,speed:2,gas:'Aire',pricekg:1000,includeMaterial:true,reserveMode:'percent',reserve:0,allowRotate:true});
const stock=(width=122,height=122,price=10000,limit='')=>({id:'s',name:'Plancha',width,height,price,limit});
const settings=(items,stocks=[stock()],gap=2,margin=2)=>Object.fromEntries(items.map(it=>[groupKey(it),{stocks,gap,margin}]));
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,a+' != '+b);
function checkLayout(plan){
  assert.equal(plan.valid,true,plan.errors.join('; '));
  for(const group of plan.groups)for(const sheet of group.sheets){
    const gap=Number(group.options.gap),m=Number(group.options.margin),ps=sheet.placements;
    for(const p of ps){assert.ok(p.x>=m-1e-7&&p.y>=m-1e-7);assert.ok(p.x+p.width<=sheet.stock.width-m+1e-7);assert.ok(p.y+p.height<=sheet.stock.height-m+1e-7)}
    for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
      const a=ps[i],b=ps[j];
      assert.ok(a.x+a.width+gap<=b.x+1e-7||b.x+b.width+gap<=a.x+1e-7||a.y+a.height+gap<=b.y+1e-7||b.y+b.height+gap<=a.y+1e-7,'Overlap or missing gap');
    }
  }
}
test('300 separadores + 10%: 4 planchas, margen y separacion de 2 mm',()=>{
  const it={...piece('sep',10,10,300),reserve:10},p=planMaterials([it],settings([it]));
  checkLayout(p);assert.equal(p.totalSheets,4);assert.equal(p.totalProduction,330);
  assert.deepEqual(p.groups[0].sheets.map(s=>s.placements.length),[100,100,100,30]);
  assert.equal(p.groups[0].sheets.flatMap(s=>s.placements).filter(p=>p.reserve).length,30);
  close(p.totalCost,30000+10000*38/122);close(p.allocations.sep,p.totalCost);close(p.groups[0].sheets.at(-1).fraction,38/122);
});
test('Giro 90 permite seis piezas; desactivado conserva orientacion',()=>{
  const it=piece('wide',70,40,6),opts=settings([it],[stock(120,140)],0,0);
  const p=planMaterials([it],opts);checkLayout(p);assert.equal(p.totalSheets,1);assert.ok(p.groups[0].sheets[0].placements.every(p=>p.rotation===90));
  const fixed=planMaterials([{...it,allowRotate:false}],opts);checkLayout(fixed);assert.equal(fixed.totalSheets,2);assert.ok(fixed.groups[0].sheets.every(s=>s.placements.every(p=>p.rotation===0)));
});
test('Separacion solo entre piezas; margen en ambos bordes',()=>{
  const it=piece('box',10,10,4);
  assert.equal(planMaterials([it],settings([it],[stock(26,26)])).totalSheets,1);
  assert.equal(planMaterials([it],settings([it],[stock(25.9,25.9)])).totalSheets,4);
});
test('Modelos mixtos comparten plancha y costo se cobra una vez',()=>{
  const items=[piece('a',10,10,3),piece('b',20,10,4)];
  const p=planMaterials(items,settings(items,[stock(100,100,500)]));checkLayout(p);
  assert.equal(p.totalSheets,1);assert.equal(p.groups[0].sheets[0].placements.length,7);
  close(p.totalCost,117);close(p.allocations.a+p.allocations.b,p.totalCost);
});
test('No se mezclan materiales, espesores ni suministro del cliente',()=>{
  const items=[piece('a'),{...piece('b'),material:'Acero'},{...piece('c'),thickness:2},{...piece('d'),includeMaterial:false}];
  const p=planMaterials(items,settings(items));checkLayout(p);assert.equal(p.groups.length,4);close(p.totalCost,30000*196/(122*122));assert.equal(p.allocations.d,0);
});
test('Retazos limitados se consumen y formato adicional completa el lote',()=>{
  const it=piece('a',10,10,5),stocks=[stock(26,26,0,1),{...stock(26,26,100),id:'new'}];
  const p=planMaterials([it],settings([it],stocks));checkLayout(p);assert.equal(p.totalSheets,2);close(p.totalCost,100*196/676);
  assert.equal(p.groups[0].sheets.filter(s=>s.stock.id==='s').length,1);
  const bad=planMaterials([it],settings([it],[stocks[0]]));assert.equal(bad.valid,false);assert.equal(calcQuote([it],defaults,bad).valid,false);
});
test('Datos incompletos, negativos y piezas imposibles bloquean resultados',()=>{
  const it=piece('a');
  for(const s of [stock('',100),stock(100,100,''),stock(100,100,-1),stock(100,100,10,1.5),stock(5,5)]){
    assert.equal(planMaterials([it],settings([it],[s])).valid,false);
  }
  assert.equal(planMaterials([{...it,qty:''}],settings([it])).valid,false);
  assert.equal(planMaterials([{...it,reserveMode:'units',reserve:1.2}],settings([it])).valid,false);
  assert.equal(planMaterials([{...it,qty:5001}],settings([it])).valid,false);
});
test('Peso y precio por kilo de laton calculados desde plancha completa',()=>{
  const kg=stockWeight(stock(1000,2000,168000),'Latón',1);close(kg,16.8);close(168000/kg,10000);
});
test('Reserva redondea hacia arriba y se cobra corte, material y preparacion una vez',()=>{
  const it={...piece('a',10,10,101),reserve:5};
  const p=planMaterials([it],settings([it])),q=calcQuote([it],defaults,p),v=evaluate(it,defaults);
  assert.equal(productionQuantity(it).extra,6);assert.equal(q.totalUnits,101);assert.equal(q.totalProduction,107);
  close(q.cost,p.totalCost+(v.machine+v.gas)*107+rateHour(defaults)*defaults.setupMin/60);
  close(q.lines[0].priceUnit*101,q.net);close(q.net,q.cost/.6);close(q.gross,q.net*1.19);
  const client={...it,includeMaterial:false},cp=planMaterials([client],settings([client])),cq=calcQuote([client],defaults,cp);
  close(cq.cost,(v.machine+v.gas)*107+q.setup);assert.equal(cp.totalCost,0);
});
test('Vista girada conserva dimensiones y extremos de curvas',()=>{
  const g=parseDXF(fixture(rectangle(2,1)+'0\nCIRCLE\n10\n1\n20\n0.5\n40\n0.1\n',1),'inch');
  const it={...piece('inch'),...g,id:'inch',qty:2},p=planMaterials([it],settings([it],[stock(35,120)],2,2));
  checkLayout(p);assert.equal(p.totalSheets,1);
  for(const place of p.groups[0].sheets[0].placements){assert.equal(place.rotation,90);for(const shape of it.shapes)for(const point of shape.p){const q=transformPoint(point,it,place);assert.ok(q.x>=place.x-1e-7&&q.x<=place.x+place.width+1e-7&&q.y>=place.y-1e-7&&q.y<=place.y+place.height+1e-7)}}
  const arc=parseDXF(fixture('0\nARC\n10\n0\n20\n0\n40\n10\n50\n13\n51\n166\n'),'arc');
  close(arc.maxY,10);
});
test('Bloque 400x300 en plancha 1000x2000 cobra exactamente 6 por ciento',()=>{
  const it={...piece('a',396,296),allowRotate:false},p=planMaterials([it],settings([it],[stock(1000,2000,200000)]));
  checkLayout(p);const sheet=p.groups[0].sheets[0];
  assert.equal(sheet.usedWidth,400);assert.equal(sheet.usedHeight,300);close(sheet.fraction,.06);close(sheet.price,12000);
  close(sheet.usedWeight,sheet.weight*.06);close(p.totalPurchaseCost,200000);
});
test('Cobro de plancha completa solamente al ocupar el bloque completo',()=>{
  const it={...piece('a',996,1996),allowRotate:false},p=planMaterials([it],settings([it],[stock(1000,2000,200000)]));
  checkLayout(p);assert.equal(p.groups[0].sheets[0].fraction,1);assert.equal(p.totalCost,200000);
});
test('Solo corte funciona sin formatos, precios ni plan de material valido',()=>{
  const it={...piece('a',20,30,100),reserveMode:'units',reserve:5},invalid=planMaterials([it],{});
  assert.equal(invalid.valid,false);
  const q=calcQuote([it],defaults,invalid,{cutOnly:true}),v=evaluate(it,defaults);
  assert.equal(q.valid,true);assert.equal(q.mode,'cutOnly');assert.equal(q.totalProduction,105);assert.equal(q.lines[0].materialCost,0);
  close(q.cost,(v.machine+v.gas)*105+rateHour(defaults)*defaults.setupMin/60);
  close(q.lines[0].cutPriceUnit,q.lines[0].priceUnit);
  const p=planMaterials([it],settings([it],[stock(1000,1000,500000)])),withMaterial=calcQuote([it],defaults,p);
  close(withMaterial.net-q.net,p.totalCost/.6);
  close(withMaterial.lines[0].cutSubtotal,q.net);
  assert.equal(calcQuote([{...it,reserve:-1}],defaults,undefined,{cutOnly:true}).valid,false);
});
test('Varios lotes mixtos respetan distancias y conservan todas las unidades',()=>{
  for(let seed=1;seed<=12;seed++){
    const items=Array.from({length:4},(_,i)=>({...piece('p'+i,8+(seed*7+i*11)%32,7+(seed*3+i*13)%30,5+i*3),reserveMode:'units',reserve:i}));
    const p=planMaterials(items,settings(items,[stock(120,150,200)],seed%4,seed%5));checkLayout(p);
    for(const it of items)assert.equal(p.groups.flatMap(g=>g.sheets.flatMap(s=>s.placements)).filter(x=>x.itemId===it.id).length,it.qty+it.reserve);
  }
});


