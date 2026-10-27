import { densities } from './engine.js';
import { productionQuantity } from './production.js';
export { productionQuantity } from './production.js';
export const groupKey = it => JSON.stringify([it.material, Number(it.thickness), it.includeMaterial !== false]);
export const defaultStock = () => ({ id: crypto.randomUUID(), name: 'Plancha / trozo', width: '', height: '', price: '', limit: '' });
export const defaultGroup = () => ({ gap: 2, margin: 2, stocks: [defaultStock()] });
const finite = v => v !== '' && v != null && Number.isFinite(Number(v));
const nonnegative = v => finite(v) && Number(v) >= 0;
const positive = v => finite(v) && Number(v) > 0;
const integer = v => nonnegative(v) && Number.isSafeInteger(Number(v));
const EPS = 1e-8;

export function stockWeight(stock, material, thickness) {
  return Number(stock.width) * Number(stock.height) * Number(thickness) * densities[material] / 1e9;
}
// Shelf layout of bounding rectangles; no interlocking or claim of global optimality.
function packSheet(models, remaining, stock, gap, margin) {
  const right = Number(stock.width) - margin, top = Number(stock.height) - margin;
  const rows = [], placements = [];
  const ordered = models.slice().sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height);
  for (const it of ordered) {
    const orientations = [{ w: it.width, h: it.height, rotation: 0 }];
    if (it.allowRotate !== false && Math.abs(it.width - it.height) > EPS) orientations.push({ w: it.height, h: it.width, rotation: 90 });
    for (let n = 0; n < remaining[it.id]; n++) {
      let choice;
      for (let r = 0; r < rows.length; r++) for (const o of orientations) {
        const row = rows[r];
        if (row.x + o.w <= right + EPS && o.h <= row.height + EPS) {
          const score = (row.height - o.h) * Number(stock.width) + (right - row.x - o.w);
          if (!choice || score < choice.score) choice = { r, ...o, score };
        }
      }
      if (!choice) {
        const y = rows.length ? rows.at(-1).y + rows.at(-1).height + gap : margin;
        const capacity = o => Math.floor((right - margin + gap + EPS) / (o.w + gap)) * Math.floor((top - y + gap + EPS) / (o.h + gap));
        const fits = orientations.filter(o => margin + o.w <= right + EPS && y + o.h <= top + EPS).sort((a, b) => capacity(b) - capacity(a) || a.h - b.h || b.w - a.w);
        if (!fits.length) break;
        const o = fits[0];
        rows.push({ x: margin, y, height: o.h });
        choice = { r: rows.length - 1, ...o };
      }
      const row = rows[choice.r];
      placements.push({ itemId: it.id, x: row.x, y: row.y, width: choice.w, height: choice.h, rotation: choice.rotation });
      row.x += choice.w + gap;
    }
  }
  return placements;
}
export function planMaterials(items, settings) {
  const result = { valid: true, errors: [], groups: [], allocations: {}, production: {}, totalCost: 0, totalWeight: 0, totalUsedWeight: 0, totalPurchaseCost: 0, totalSheets: 0, totalProduction: 0 };
  const grouped = new Map();
  for (const it of items) {
    try {
      result.production[it.id] = productionQuantity(it);
      result.totalProduction += result.production[it.id].total;
      if (!positive(it.width) || !positive(it.height) || !nonnegative(it.area) || it.open > 0 || !densities[it.material] || !positive(it.thickness)) throw Error('El plano debe tener contornos cerrados, dimensiones válidas y material definido.');
      const key = groupKey(it);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(it);
      result.allocations[it.id] = 0;
    } catch (e) { result.errors.push(it.name + ': ' + e.message); }
  }
  if (result.totalProduction > 5000) result.errors.push('El límite por trabajo es de 5.000 piezas, incluida la reserva.');
  if (result.errors.length) return { ...result, valid: false };
  for (const [key, models] of grouped) {
    const title = models[0].material + ' · ' + models[0].thickness + ' mm · ' + (models[0].includeMaterial === false ? 'material del cliente' : 'material incluido');
    const options = settings[key];
    const group = { key, title, models, sheets: [], cost: 0, weight: 0, usedWeight: 0, purchaseCost: 0, usedArea: 0, area: 0, netArea: 0, production: 0, options };
    result.groups.push(group);
    try {
      if (!options || !nonnegative(options.gap) || !nonnegative(options.margin)) throw Error('Define una separación y un margen al borde de cero o más milímetros.');
      const gap = Number(options.gap), margin = Number(options.margin);
      if (!options.stocks?.length) throw Error('Agrega al menos una plancha o trozo.');
      const charged = models[0].includeMaterial !== false;
      for (const s of options.stocks) {
        if (!positive(s.width) || !positive(s.height) || Number(s.width) <= 2 * margin || Number(s.height) <= 2 * margin) throw Error('Revisa las medidas de las planchas: deben superar el margen de ambos bordes.');
        if (!Number.isFinite(Number(s.width)*Number(s.height)*Number(models[0].thickness)*densities[models[0].material])) throw Error('Las dimensiones son demasiado grandes.');
        if (charged && !nonnegative(s.price)) throw Error('Ingresa el precio neto de cada plancha o trozo completo (puede ser cero).');
        if (s.limit !== '' && !integer(s.limit)) throw Error('La disponibilidad debe ser un entero de cero o más, o quedar vacía para compra sin límite.');
      }
      const remaining = Object.fromEntries(models.map(it => [it.id, result.production[it.id].total]));
      const used = Object.fromEntries(options.stocks.map(s => [s.id, 0]));
      const placed = Object.fromEntries(models.map(it => [it.id, 0]));
      while (Object.values(remaining).some(n => n > 0)) {
        if (group.sheets.length >= 500) throw Error('Se requieren más de 500 planchas. Divide el trabajo en lotes.');
        let best;
        for (const stock of options.stocks) {
          if (stock.limit !== '' && used[stock.id] >= Number(stock.limit)) continue;
          const placements = packSheet(models, remaining, stock, gap, margin);
          if (!placements.length) continue;
          const occupied = placements.reduce((sum, p) => sum + p.width * p.height, 0);
          const usedWidth = Math.min(Number(stock.width), Math.max(...placements.map(p=>p.x+p.width)) + margin);
          const usedHeight = Math.min(Number(stock.height), Math.max(...placements.map(p=>p.y+p.height)) + margin);
          const fraction = usedWidth * usedHeight / (Number(stock.width) * Number(stock.height));
          const score = (charged ? Number(stock.price) * fraction : usedWidth * usedHeight) / occupied;
          if (!best || score < best.score || (score === best.score && placements.length > best.placements.length)) best = { stock, placements, score, occupied };
        }
        if (!best) throw Error('No alcanza el material disponible o alguna pieza no cabe con esos márgenes. Agrega otro formato o más unidades.');
        const { stock, placements, occupied } = best;
        used[stock.id]++;
        const fullPrice = charged ? Number(stock.price) : 0;
        const usedWidth = Math.min(Number(stock.width), Math.max(...placements.map(p=>p.x+p.width)) + margin);
        const usedHeight = Math.min(Number(stock.height), Math.max(...placements.map(p=>p.y+p.height)) + margin);
        const usedArea = usedWidth * usedHeight, fraction = usedArea / (Number(stock.width) * Number(stock.height));
        const price = fullPrice * fraction;
        const weight = stockWeight(stock, models[0].material, models[0].thickness);
        for (const p of placements) {
          p.reserve = placed[p.itemId] >= result.production[p.itemId].delivery;
          placed[p.itemId]++;
          remaining[p.itemId]--;
          result.allocations[p.itemId] += price * p.width * p.height / occupied;
        }
        const netArea = placements.reduce((sum, p) => sum + models.find(it => it.id === p.itemId).area, 0);
        const sheet = { stock, placements, price, fullPrice, fraction, weight, usedWeight: weight * fraction, netArea, usedArea, usedWidth, usedHeight };
        group.sheets.push(sheet);
        group.cost += price;
        group.purchaseCost += fullPrice;
        group.usedArea += usedArea;
        group.usedWeight += weight * fraction;
        group.weight += weight;
        group.area += Number(stock.width) * Number(stock.height);
        group.netArea += netArea;
        group.production += placements.length;
      }
      result.totalCost += group.cost;
      result.totalPurchaseCost += group.purchaseCost;
      result.totalUsedWeight += group.usedWeight;
      result.totalWeight += group.weight;
      result.totalSheets += group.sheets.length;
    } catch (e) { result.errors.push(title + ': ' + e.message); }
  }
  if (![result.totalCost,result.totalWeight,...Object.values(result.allocations)].every(Number.isFinite)) result.errors.push('Los valores exceden el rango de cálculo. Revisa dimensiones y precios.');
  result.valid = result.errors.length === 0;
  return result;
}
export function transformPoint(p, it, placement) {
  const x = p.x - it.minX, y = p.y - it.minY;
  return placement.rotation === 90 ? { x: placement.x + it.height - y, y: placement.y + x } : { x: placement.x + x, y: placement.y + y };
}

