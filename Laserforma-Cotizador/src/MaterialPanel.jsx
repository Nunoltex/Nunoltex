import React, { useEffect, useRef, useState } from 'react';
import { groupKey, defaultStock, stockWeight, productionQuantity, transformPoint } from './material.js';
const money = n => new Intl.NumberFormat('es-CL', { style:'currency',currency:'CLP',maximumFractionDigits:0 }).format(n);
const num = n => new Intl.NumberFormat('es-CL', {maximumFractionDigits:3}).format(n);
const colors = ['#67b7ff','#8be1bf','#d6b5ff','#f8b5c4','#aee5ee'];
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function SheetDrawing({sheet,models,margin}) {
  const ref=useRef(null);
  const [view,setView]=useState({zoom:1,x:0,y:0});
  const drag=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;
    function draw(){
      const width=canvas.clientWidth,height=360,ratio=window.devicePixelRatio||1;
      canvas.width=width*ratio;canvas.height=height*ratio;
      const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
      const sw=Number(sheet.stock.width),sh=Number(sheet.stock.height),scale=Math.min((width-40)/sw,(height-40)/sh)*view.zoom;
      const ox=(width-sw*scale)/2+view.x,oy=(height-sh*scale)/2+view.y;
      ctx.fillStyle='#101e2d';ctx.fillRect(ox,oy,sw*scale,sh*scale);
      ctx.fillStyle='#163d342e';ctx.fillRect(ox,oy+(sh-sheet.usedHeight)*scale,sheet.usedWidth*scale,sheet.usedHeight*scale);
      ctx.strokeStyle='#839bb5';ctx.lineWidth=1;ctx.strokeRect(ox,oy,sw*scale,sh*scale);
      ctx.strokeStyle='#8be1bf';ctx.lineWidth=2;ctx.strokeRect(ox,oy+(sh-sheet.usedHeight)*scale,sheet.usedWidth*scale,sheet.usedHeight*scale);ctx.lineWidth=1;
      ctx.setLineDash([5,4]);ctx.strokeStyle='#50627a';ctx.strokeRect(ox+margin*scale,oy+margin*scale,(sw-2*margin)*scale,(sh-2*margin)*scale);ctx.setLineDash([]);
      for(const p of sheet.placements){
        const index=models.findIndex(m=>m.id===p.itemId),it=models[index];
        ctx.strokeStyle=p.reserve?'#ffbd69':colors[index%colors.length];ctx.lineWidth=1;
        ctx.beginPath();
        for(const shape of it.shapes)shape.p.forEach((point,i)=>{
          const q=transformPoint(point,it,p),x=ox+q.x*scale,y=oy+(sh-q.y)*scale;
          i?ctx.lineTo(x,y):ctx.moveTo(x,y);
        });
        ctx.stroke();
      }
    }
    draw();const observer=new ResizeObserver(draw);observer.observe(canvas);return()=>observer.disconnect();
  },[sheet,models,margin,view]);
  function zoom(delta){setView(v=>({...v,zoom:Math.max(1,Math.min(8,v.zoom*delta))}))}
  function pointerDown(e){drag.current={x:e.clientX,y:e.clientY,originX:view.x,originY:view.y};e.currentTarget.setPointerCapture(e.pointerId)}
  function pointerMove(e){if(!drag.current)return;setView(v=>({...v,x:drag.current.originX+e.clientX-drag.current.x,y:drag.current.originY+e.clientY-drag.current.y}))}
  return <><div className="sheet-drawing zoomable-sheet"><canvas ref={ref} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onWheel={e=>{e.preventDefault();zoom(e.deltaY<0?1.15:.87)}} aria-label={'Distribución de '+sheet.placements.length+' piezas en '+sheet.stock.width+' por '+sheet.stock.height+' mm. Usa la rueda para ampliar y arrastra para mover.'}/></div><div className="sheet-zoom-controls"><span>Rueda para acercar · arrastra para mover · {Math.round(view.zoom*100)}%</span><button type="button" onClick={()=>zoom(.8)} aria-label="Alejar distribución">−</button><button type="button" onClick={()=>zoom(1.25)} aria-label="Acercar distribución">＋</button><button type="button" onClick={()=>setView({zoom:1,x:0,y:0})}>Ajustar a plancha</button></div></>;
}
function GroupResult({group}) {
  const [selected,setSelected]=useState(0);
  const index=Math.min(selected,group.sheets.length-1),sheet=group.sheets[index];
  if(!sheet)return null;
  const spare=sheet.placements.filter(p=>p.reserve).length;
  return <div className="material-result">
    <div className="metrics">{[
      ['Planchas / trozos',group.sheets.length],
      ['Bloque ocupado a cobrar',num(group.usedArea/1e6)+' m²'],
      ['Peso del material utilizado',num(group.usedWeight)+' kg'],
      ['Costo proporcional del material',money(group.cost)],
      ['Superficie neta de piezas',num(group.netArea/1e6)+' m²'],
      ['Fuera de los bloques ocupados',num(Math.max(0,group.area-group.usedArea)/1e6)+' m²'],
    ].map(([label,value])=><div className="metric" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <p className="note">Se cobra el rectángulo ocupado de cada plancha, incluidas separaciones y márgenes. La superficie fuera de esos bloques queda excluida del cobro. Material total de los formatos de referencia: {num(group.area/1e6)} m².</p>
    <Field label="Plancha / trozo para ver la estimación"><select value={index} onChange={e=>setSelected(Number(e.target.value))}>{group.sheets.map((s,i)=><option key={i} value={i}>{i+1}. {s.stock.name} · {s.stock.width} × {s.stock.height} mm · {s.placements.length} piezas</option>)}</select></Field>
    <SheetDrawing sheet={sheet} models={group.models} margin={Number(group.options.margin)}/>
    <p className="note">Esta plancha: {sheet.placements.length-spare} piezas para entregar + {spare} de reserva (naranja). Bloque ocupado, con margen: {num(sheet.usedWidth)} × {num(sheet.usedHeight)} mm. Representa el {num(sheet.fraction*100)}% del formato: {money(sheet.price)} de material neto.</p>
    <ul className="material-legend">{group.models.map((it,i)=>{
      const positions=sheet.placements.filter(p=>p.itemId===it.id);
      return positions.length>0&&<li key={it.id}><span className={'model-color color-'+i%colors.length}>●</span> {it.name}: {positions.length} ({positions.filter(p=>p.reserve).length} de reserva)</li>;
    })}</ul>
    <p className="note">Vista orientativa para estimar material. El bloque a cobrar se marca en verde. Define la distribución final y los ajustes físicos de corte en CypCut.</p>
  </div>;
}
export default function MaterialPanel({items,settings,setSettings,plan,updateItem,removeItem}) {
  const [notice,setNotice]=useState('');
  const groups=new Map();
  for(const it of items){const key=groupKey(it);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(it)}
  function editGroup(key,patch){setSettings(old=>({...old,[key]:{...old[key],...patch}}))}
  function editStock(key,id,patch){setSettings(old=>({...old,[key]:{...old[key],stocks:old[key].stocks.map(s=>s.id===id?{...s,...patch}:s)}}))}
  function save(){try{localStorage.setItem('lf_stock_v1',JSON.stringify(settings));setNotice('Formatos, precios, separación y márgenes guardados en este computador.')}catch{setNotice('No se pudieron guardar los formatos en este computador.')}}
  return <section className="panel material-panel"><div className="panel-heading"><div><span className="step">03</span><h2>Material y distribución</h2></div><span className="tag">Filas · giro 90°</span></div>
    <p className="note">Cada DXF representa un modelo o conjunto que se repite completo. Los diseños se agrupan por material, espesor y suministro. Las medidas de cada formato son las que comprarás o utilizarás, incluidos los bordes. El precio completo sirve como referencia para cobrar solo el bloque utilizado.</p>
    {!items.length&&<p className="empty-quote">Agrega tus diseños a la cotización para definir las planchas y distribuir las piezas.</p>}
    {[...groups].map(([key,models])=>{
      const options=settings[key];if(!options)return null;
      const charged=models[0].includeMaterial!==false,group=plan.groups.find(g=>g.key===key);
      return <div className="material-group" key={key}><h3>{models[0].material} · {models[0].thickness} mm <small>{charged?'Material incluido':'Material del cliente'}</small></h3>
        <div className="fields-grid"><Field label="Separación libre entre piezas · mm"><input type="number" min="0" step="any" value={options.gap} onChange={e=>editGroup(key,{gap:e.target.value})}/></Field><Field label="Margen en cada borde · mm"><input type="number" min="0" step="any" value={options.margin} onChange={e=>editGroup(key,{margin:e.target.value})}/></Field></div>
        <p className="note">La separación se mide entre los rectángulos exteriores de las figuras. Los valores iniciales de 2 mm son editables por material y espesor.</p>
        <h4>Planchas, tiras y retazos disponibles</h4>
        {options.stocks.map((stock,i)=>{
          const kg=stockWeight(stock,models[0].material,models[0].thickness);
          const valid=Number.isFinite(kg)&&kg>0&&stock.price!==''&&Number.isFinite(Number(stock.price))&&Number(stock.price)>=0;
          return <div className="stock-card" key={stock.id}><div className="card-heading"><b>Formato {i+1}</b><button type="button" className="remove-button" aria-label={'Quitar formato '+(i+1)} title="Quitar este formato" onClick={()=>editGroup(key,{stocks:options.stocks.filter(s=>s.id!==stock.id)})}>×</button></div><div className="fields-grid stock-fields">
            <Field label="Nombre del formato"><input value={stock.name} onChange={e=>editStock(key,stock.id,{name:e.target.value})}/></Field>
            <Field label="Ancho · mm"><input type="number" min="0.001" step="any" value={stock.width} onChange={e=>editStock(key,stock.id,{width:e.target.value})}/></Field>
            <Field label="Largo · mm"><input type="number" min="0.001" step="any" value={stock.height} onChange={e=>editStock(key,stock.id,{height:e.target.value})}/></Field>
            {charged&&<Field label="Precio de la plancha / trozo · CLP sin IVA"><input type="number" min="0" step="any" value={stock.price} onChange={e=>editStock(key,stock.id,{price:e.target.value})}/></Field>}
            <Field label="Cantidad disponible · vacío = sin límite"><input type="number" min="0" step="1" value={stock.limit} placeholder="Compra sin límite" onChange={e=>editStock(key,stock.id,{limit:e.target.value})}/></Field>
          </div><p className="success-note">{Number.isFinite(kg)&&kg>0?'Peso estimado por formato: '+num(kg)+' kg. ':''}{charged&&valid?'Precio equivalente: '+money(Number(stock.price)/kg)+'/kg.':''}</p>
          </div>;
        })}
        <button type="button" className="secondary" onClick={()=>editGroup(key,{stocks:[...options.stocks,defaultStock()]})}>＋ Agregar plancha o retazo</button>
        <p className="note">Para retazos existentes, indica cuántos tienes. Ingresa el precio del formato entero; se cobra proporcionalmente el bloque ocupado. Usa 0 si no deseas cobrar ese material. En retazos irregulares, introduce un rectángulo útil interior. El peso depende de una densidad nominal del material.</p>
        <h4>Reserva por fallas y orientación</h4>
        {models.map(it=>{let production;try{production=productionQuantity(it)}catch{}
          return <div className="reserve-card" key={it.id}><div className="card-heading"><b>{it.name}</b><button type="button" className="remove-button" aria-label={'Quitar diseño '+it.name} title="Quitar este diseño de la cotización" onClick={()=>removeItem(it.id)}>×</button></div><div className="fields-grid stock-fields">
            <Field label="Unidades a entregar"><input type="number" min="1" max="5000" step="1" value={it.qty} onChange={e=>updateItem(it.id,{qty:e.target.value===''?'':Number(e.target.value)})}/></Field>
            <Field label="Tipo de reserva"><select value={it.reserveMode??'percent'} onChange={e=>updateItem(it.id,{reserveMode:e.target.value,reserve:0})}><option value="percent">Porcentaje adicional</option><option value="units">Unidades adicionales</option></select></Field>
            <Field label={it.reserveMode==='units'?'Piezas extra':'Reserva adicional · %'}><input type="number" min="0" step={it.reserveMode==='units'?'1':'any'} value={it.reserve??0} onChange={e=>updateItem(it.id,{reserve:e.target.value===''?'':Number(e.target.value)})}/></Field>
          </div><label className="rotate-option"><input type="checkbox" checked={it.allowRotate!==false} onChange={e=>updateItem(it.id,{allowRotate:e.target.checked})}/> Permitir giro de 90°</label>
          {production&&<p className="success-note">Entregar {production.delivery} + reserva {production.extra} = preparar {production.total} piezas.</p>}</div>;
        })}
        <p className="note">El costo de las piezas extra incluye material y corte, repartido entre las unidades a entregar. La reserva inicial es 0: elige el porcentaje o las unidades que deseas cubrir.</p>
        {plan.valid&&group&&<GroupResult group={group}/>}
      </div>;
    })}
    {plan.errors.length>0&&<div role="alert" className="error-box">{plan.errors.map((e,i)=><p key={i}>{e}</p>)}<p>Completa estos datos para cotizar con material. Puedes elegir «Solo corte» sin definir las planchas.</p></div>}
    {items.length>0&&<div className="actions"><button type="button" disabled={!plan.valid} onClick={save}>Guardar formatos y precios</button></div>}
    {notice&&<p role="status" className="notice">{notice}</p>}
    <p className="note">Distribución rectangular por filas, con giros opcionales. Puede combinar modelos y formatos, pero no garantiza el mínimo posible de planchas ni encaja piezas dentro de agujeros. Límite: 5.000 piezas por trabajo y 500 planchas por grupo.</p>
  </section>;
}
export function MaterialPrintSummary({plan}) {
  if(!plan.valid||!plan.groups.length)return null;
  return <div className="print-material"><h2>Material utilizado y reserva considerados</h2>{plan.groups.map(g=><div key={g.key}><h3>{g.title}</h3><p>{g.sheets.length} formato(s) de referencia · {num(g.usedWeight)} kg de material utilizado · {g.options.gap} mm entre piezas · {g.options.margin} mm al borde.</p><ul>{g.options.stocks.map(s=>{const count=g.sheets.filter(sheet=>sheet.stock.id===s.id).length;return count>0&&<li key={s.id}>{count} × {s.name}: {s.width} × {s.height} mm</li>})}</ul><p>Bloques ocupados: {num(g.usedArea/1e6)} m². Se cobra solo esa proporción de los formatos.</p><p>{g.models.map(it=>{const p=plan.production[it.id];return it.name+': '+p.delivery+' a entregar + '+p.extra+' de reserva'}).join('; ')}.</p></div>)}</div>;
}


