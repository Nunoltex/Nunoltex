import { productionQuantity } from './production.js';
const num=n=>Number(n)||0;
const densities={'Acero':7850,'Acero Inoxidable':7900,'Aluminio':2700,'Latón':8400,'Cobre':8960};
const speeds={'Acero':[[.5,12000],[1,8000],[1.5,6000],[2,4500],[3,3000],[4,2200],[5,1700],[6,1400],[8,900],[10,600],[12,450],[15,300],[20,180]],'Acero Inoxidable':[[.5,10000],[1,6500],[1.5,4800],[2,3500],[3,2200],[4,1600],[5,1200],[6,900],[8,600],[10,400],[12,280]],'Aluminio':[[.5,15000],[1,10000],[1.5,7500],[2,5500],[3,3800],[4,2800],[5,2200],[6,1800],[8,1200]],'Latón':[[.5,9000],[1,6000],[2,3300],[3,2100],[4,1500]],'Cobre':[[.5,8000],[1,5000],[2,2500],[3,1600],[4,1100]]};
const defaults={machine:36982925,laserKW:2,compressorKW:15,years:10,hoursDay:9,daysYear:250,electricity:590,oxygenM3:4375,oxygenRate:15,salary:1700000,maintenance:2500000,setupMin:25,nozzleCost:2500,nozzleLife:100,lensCost:1500,lensLife:200,ceramicCost:5000,ceramicLife:300,margin:40,pierceSeconds:0.5,airCostHour:0,extraHour:0,setupPerJob:1,vat:19};
const meta={machine:['Precio máquina','CLP'],laserKW:['Potencia láser','kW'],compressorKW:['Potencia compresor','kW'],years:['Vida útil','años'],hoursDay:['Horas/día','h'],daysYear:['Días/año','d'],electricity:['Electricidad','CLP/kWh'],oxygenM3:['Oxígeno','CLP/m³'],oxygenRate:['Consumo oxígeno','m³/h'],salary:['Operador','CLP/mes'],maintenance:['Mantención','CLP/año'],setupMin:['Preparación por trabajo','min'],nozzleCost:['Costo boquilla','CLP'],nozzleLife:['Vida boquilla','h'],lensCost:['Costo lente','CLP'],lensLife:['Vida lente','h'],ceramicCost:['Costo cerámico','CLP'],ceramicLife:['Vida cerámico','h'],margin:['Margen venta','%'],pierceSeconds:['Perforación estimada','s'],airCostHour:['Aire adicional','CLP/h'],extraHour:['Otros costos fijos','CLP/h'],vat:['IVA','%']};
const positiveConfig=new Set(['years','hoursDay','daysYear','nozzleLife','lensLife','ceramicLife']);
function validConfigValue(k,v){return typeof v==='number'&&Number.isFinite(v)&&(positiveConfig.has(k)?v>0:v>=0)&&(k!=='margin'||v<=95)&&(k!=='vat'||v<=100)}
function cleanConfig(value){let result={...defaults};if(value&&typeof value==='object'&&!Array.isArray(value))for(let k of Object.keys(defaults))if(validConfigValue(k,value[k]))result[k]=value[k];return result}

function dxfPairs(txt){let lines=txt.replace(/\r/g,'').split('\n'),p=[];for(let i=0;i+1<lines.length;i+=2){let code=Number(lines[i].trim());if(Number.isFinite(code))p.push([code,lines[i+1].trim()])}return p}
function sampledArc(cx,cy,r,start,delta,n){
  const points=Array.from({length:n+1},(_,i)=>({x:cx+r*Math.cos(start+delta*i/n),y:cy+r*Math.sin(start+delta*i/n)}));
  points.bounds=[];for(let k=-8;k<=8;k++){const t=(k*Math.PI/2-start)/delta;if(t>0&&t<1)points.bounds.push({x:cx+r*Math.cos(k*Math.PI/2),y:cy+r*Math.sin(k*Math.PI/2)})}
  return points;
}
function polyBulge(a,b,bulge){if(!bulge)return [a,b];let theta=4*Math.atan(bulge),chord=Math.hypot(b.x-a.x,b.y-a.y);if(!chord)return [a,b];let r=chord/(2*Math.sin(Math.abs(theta)/2)),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dist=chord/(2*Math.tan(theta/2)),cx=mx-(b.y-a.y)/chord*dist,cy=my+(b.x-a.x)/chord*dist;return sampledArc(cx,cy,Math.abs(r),Math.atan2(a.y-cy,a.x-cx),theta,Math.max(4,Math.ceil(Math.abs(theta)/(Math.PI/48))))}
function arc(cx,cy,r,start,end,full=false){let delta=full?360:((end-start)%360+360)%360;if(!full&&delta===0)delta=360;start=((start%360)+360)%360;return sampledArc(cx,cy,r,start*Math.PI/180,delta*Math.PI/180,Math.max(12,Math.ceil(delta/3)))}
function field(fields,c,def=0){return num(fields.find(([k])=>k===c)?.[1]??def)}function same(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<.01}function polygonArea(p){let a=0;for(let i=0;i<p.length-1;i++)a+=p[i].x*p[i+1].y-p[i+1].x*p[i].y;return a/2}function pointIn(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a.y>p.y)!=(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
// DXF $INSUNITS factors to millimetres (codes 1–24).
const dxfUnitMM={1:25.4,2:304.8,3:1609344,4:1,5:10,6:1000,7:1000000,8:0.0000254,9:0.0254,10:914.4,11:0.0000001,12:0.000001,13:0.001,14:100,15:10000,16:100000,17:1e12,18:149597870700000,19:9.4607304725808e18,20:3.0856775814913673e19,21:1200000/3937,22:100000/3937,23:3600000/3937,24:6336000000/3937};
function readDXFUnits(pairs){let header=false;for(let i=0;i<pairs.length;i++){let [c,v]=pairs[i];if(c===0&&v==='SECTION'){header=pairs[i+1]?.[0]===2&&pairs[i+1]?.[1]==='HEADER'}if(c===0&&v==='ENDSEC')header=false;if(header&&c===9&&v==='$INSUNITS'){let pair=pairs[i+1],code=Number(pair?.[1]);if(pair?.[0]!==70||!Number.isInteger(code)||(code!==0&&!Object.hasOwn(dxfUnitMM,code)))throw Error('Unidad DXF no válida o no admitida. Exporta el plano en milímetros.');return {factor:code===0?1:dxfUnitMM[code],unitNote:code===0?'DXF sin unidades: se asumen milímetros.':''}}}return {factor:1,unitNote:'DXF sin unidades: se asumen milímetros.'}}
function parseDXF(txt,name){if(!txt.includes('SECTION'))throw Error('No parece un DXF ASCII válido. Exporta DXF ASCII desde CAD.');let pairs=dxfPairs(txt),units=readDXFUnits(pairs),ent=false,type=null,fields=[],shapes=[],sourceEntities=[],bad=[],ct=0;function commit(){if(!type)return;if(['POINT','TEXT','MTEXT','HATCH','DIMENSION','VIEWPORT'].includes(type))return;if(fields.some(([c,v])=>(c===210||c===220)&&Number(v)!==0||c===230&&Number(v)!==1))throw Error('Convierte el DXF a un plano 2D XY con normal positiva antes de distribuirlo.');if(type==='POLYLINE'&&(field(fields,70)&(8|16|64)))throw Error('Las polilíneas 3D requieren conversión a 2D.');let sh=null;const first=c=>field(fields,c),all=c=>fields.filter(([k])=>k===c).map(([,v])=>num(v));if(type==='LINE')sh={p:[{x:first(10),y:first(20)},{x:first(11),y:first(21)}],closed:false};else if(type==='CIRCLE')sh={p:arc(first(10),first(20),first(40),0,360,true),closed:true};else if(type==='ARC')sh={p:arc(first(10),first(20),first(40),first(50),first(51)),closed:false};else if(type==='LWPOLYLINE'){let pts=[],v=null;for(let [k,val] of fields){if(k===10){if(v)pts.push(v);v={x:num(val),y:0,bulge:0}}if(k===20&&v)v.y=num(val);if(k===42&&v)v.bulge=num(val)}if(v)pts.push(v);let closed=(first(70)&1)!==0;sh={p:joinPoly(pts,closed),closed}}else if(type==='POLYLINE'){let pts=[],v=null;for(let [k,val] of fields){if(k===0&&val==='VERTEX'){if(v)pts.push(v);v={x:0,y:0,bulge:0}}if(v&&k===10)v.x=num(val);if(v&&k===20)v.y=num(val);if(v&&k===42)v.bulge=num(val)}if(v)pts.push(v);let closed=(first(70)&1)!==0;sh={p:joinPoly(pts,closed),closed}}else if(type==='VERTEX'||type==='SEQEND')return;else{bad.push(type);return}if(sh&&sh.p.length>1&&sh.p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))){shapes.push(sh);sourceEntities.push({type,fields:fields.map(p=>p.slice())});ct++}}function joinPoly(pts,closed){let p=[];p.bounds=[];for(let i=0;i<pts.length-(closed?0:1);i++){let seg=polyBulge(pts[i],pts[(i+1)%pts.length],pts[i].bulge);p.bounds.push(...(seg.bounds||[]));p.push(...(p.length?seg.slice(1):seg))}if(!closed&&pts.length)p.push(pts.at(-1));return p}
for(let i=0;i<pairs.length;i++){let [c,v]=pairs[i];if(c===0&&v==='SECTION'&&pairs[i+1]?.[0]===2&&pairs[i+1]?.[1]==='ENTITIES'){ent=true;i++;continue}if(ent&&c===0&&v==='ENDSEC'){commit();break}if(!ent)continue;if(c===0){if(v==='VERTEX'&&type==='POLYLINE'){fields.push([0,'VERTEX']);continue}if(v==='SEQEND'&&type==='POLYLINE'){commit();type=null;fields=[];continue}commit();type=v;fields=[]}else if(type)fields.push([c,v])}if(bad.length)throw Error('Entidades no admitidas en '+name+': '+[...new Set(bad)].join(', ')+'. Convierte a líneas/arcos/polilíneas desde CAD y reexporta.');if(!shapes.length)throw Error('No se detectaron trayectorias compatibles en '+name);for(let s of shapes)for(let p of [...s.p,...(s.p.bounds||[])]){p.x*=units.factor;p.y*=units.factor}let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let s of shapes)for(let p of [...s.p,...(s.p.bounds||[])]){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}let length=0,segments=[];for(let s of shapes)for(let i=1;i<s.p.length;i++){let a=s.p[i-1],b=s.p[i];length+=Math.hypot(a.x-b.x,a.y-b.y);segments.push([a,b])} // Count connected components of cutting paths by endpoint adjacency.
let visited=new Set(),pierces=0;for(let i=0;i<shapes.length;i++){if(visited.has(i))continue;pierces++;let queue=[i];visited.add(i);while(queue.length){let s=shapes[queue.pop()];for(let j=0;j<shapes.length;j++){if(visited.has(j))continue;let t=shapes[j],e=[s.p[0],s.p.at(-1)],f=[t.p[0],t.p.at(-1)];if(e.some(a=>f.some(b=>same(a,b)))){visited.add(j);queue.push(j)}}}}
// Join touching LINE/ARC/polyline entities into complete contours.
let remaining=shapes.map(s=>({p:s.p.slice(),closed:s.closed})),chains=[];
while(remaining.length){let ch=remaining.shift();let changed=true;while(changed&&!same(ch.p[0],ch.p.at(-1))){changed=false;for(let j=0;j<remaining.length;j++){let q=remaining[j].p,first=ch.p[0],last=ch.p.at(-1),a=q[0],b=q.at(-1);if(same(last,a)){ch.p.push(...q.slice(1))}else if(same(last,b)){ch.p.push(...q.slice(0,-1).reverse())}else if(same(first,b)){ch.p.unshift(...q.slice(0,-1))}else if(same(first,a)){ch.p.unshift(...q.slice(1).reverse())}else continue;remaining.splice(j,1);changed=true;break}}chains.push(ch)}
let loops=chains.filter(s=>s.closed||same(s.p[0],s.p.at(-1))).map(s=>({p:s.p,area:Math.abs(polygonArea(s.p))})).filter(s=>s.area>.01);let area=0;for(let a of loops){let point=a.p[0],depth=loops.filter(b=>b!==a&&b.area>a.area+.01&&pointIn(point,b.p)).length;area+=(depth%2?-1:1)*a.area}let open=chains.filter(s=>!s.closed&&!same(s.p[0],s.p.at(-1))).length;return {name,unitNote:units.unitNote,unitFactor:units.factor,sourceEntities,shapes,length,area:Math.max(0,area),pierces,open,entities:ct,width:maxX-minX,height:maxY-minY,minX,maxX,minY,maxY}}

function rateHour(cfg){let yearHours=Math.max(1,cfg.hoursDay*cfg.daysYear),monthHours=yearHours/12;return (cfg.laserKW+cfg.compressorKW)*cfg.electricity+cfg.salary/monthHours+cfg.machine/Math.max(1,cfg.years)/yearHours+cfg.maintenance/yearHours+cfg.nozzleCost/Math.max(1,cfg.nozzleLife)+cfg.lensCost/Math.max(1,cfg.lensLife)+cfg.ceramicCost/Math.max(1,cfg.ceramicLife)+cfg.extraHour}
function evaluate(it,cfg){let min=it.length/Math.max(0.001,it.speed*1000)+it.pierces*cfg.pierceSeconds/60, gas=(it.gas==='Oxígeno'?cfg.oxygenM3*cfg.oxygenRate:cfg.airCostHour)*(min/60), machine=rateHour(cfg)*min/60, kg=it.area*it.thickness*densities[it.material]/1e9,mat=kg*it.pricekg;return {min,gas,machine,mat,kg,total:(gas+machine+mat)*it.qty}}

function calcQuote(items,config,plan,{cutOnly=false}={}){
  const mode=cutOnly?'cutOnly':'material';
  if(cutOnly){
    plan={valid:true,production:{},allocations:{},totalProduction:0,errors:[]};
    for(const it of items)try{const p=productionQuantity(it);plan.production[it.id]=p;plan.totalProduction+=p.total;plan.allocations[it.id]=0}catch(e){plan.errors.push(it.name+': '+e.message)}
    if(plan.totalProduction>5000)plan.errors.push('El límite por trabajo es de 5.000 piezas, incluida la reserva.');
    plan.valid=plan.errors.length===0;
  }
  if(plan && !plan.valid)return {valid:false,mode,errors:plan.errors,lines:items.map(it=>({it,priceUnit:0,subtotal:0,materialCost:0})),totalUnits:items.reduce((s,it)=>s+(Number(it.qty)||0),0),setup:0,cost:0,net:0,vat:0,gross:0};
  const cfg=cleanConfig(config);
  let setup=items.length?rateHour(cfg)*cfg.setupMin/60:0;
  let totalUnits=items.reduce((sum,it)=>sum+it.qty,0);
  // Distribute one quote-level setup cost by physical unit across all lines.
  let setupPerUnit=totalUnits?setup/totalUnits:0;
  let margin=Math.min(95,Math.max(0,num(cfg.margin)))/100;
  let lines=items.map(it=>{
    let v=evaluate(it,cfg);
    let production=plan?.production[it.id] ?? {delivery:it.qty,extra:0,total:it.qty};
    let materialCost=it.includeMaterial===false?0:plan?plan.allocations[it.id]/it.qty:v.mat;
    let cutCostUnit=(v.machine+v.gas)*production.total/it.qty+setupPerUnit;
    let cutPriceUnit=cutCostUnit/(1-margin);
    let costUnit=cutCostUnit+materialCost;
    let priceUnit=costUnit/(1-margin);
    return {it,v,production,materialCost,cutCostUnit,cutPriceUnit,cutSubtotal:cutPriceUnit*it.qty,costUnit,priceUnit,subtotal:priceUnit*it.qty};
  });
  let cost=lines.reduce((sum,l)=>sum+l.costUnit*l.it.qty,0);
  let net=lines.reduce((sum,l)=>sum+l.subtotal,0);
  let vat=net*Math.max(0,cfg.vat)/100;
  return {valid:true,mode,lines,setup,totalUnits,totalProduction:plan?.totalProduction??totalUnits,cost,net,vat,gross:net+vat};
}

export {densities,speeds,defaults,meta,positiveConfig,validConfigValue,cleanConfig,parseDXF,rateHour,evaluate,calcQuote};

