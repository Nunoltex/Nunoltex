const finite = v => v !== '' && v != null && Number.isFinite(Number(v));
const nonnegative = v => finite(v) && Number(v) >= 0;
const integer = v => nonnegative(v) && Number.isSafeInteger(Number(v));
export function productionQuantity(it) {
  if (!integer(it.qty) || Number(it.qty) < 1) throw Error('La cantidad a entregar debe ser un entero positivo.');
  const mode = it.reserveMode ?? 'percent', reserve = it.reserve ?? 0;
  if (!['percent', 'units'].includes(mode) || !nonnegative(reserve) || (mode === 'units' && !integer(reserve))) throw Error('Revisa la reserva por fallas. Usa un porcentaje positivo o unidades enteras.');
  const extra = mode === 'percent' ? Math.ceil(Number(it.qty) * Number(reserve) / 100) : Number(reserve);
  const total = Number(it.qty) + extra;
  if (!Number.isSafeInteger(total) || total > 5000) throw Error('El límite por trabajo es de 5.000 piezas, incluida la reserva.');
  return { delivery: Number(it.qty), extra, total };
}

