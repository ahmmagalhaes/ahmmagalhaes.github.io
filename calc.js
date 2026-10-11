/* Utilitários de Formatação */
const nf = (n, d = 1) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const nfClean = (n, d = 2) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  const val = Number(n);
  if (Math.round(val) === val) return String(val);
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Formato obrigatório: Massa de soluto (Número de ampolas) + Solvente em mL
function formatPreparo(massa, unidMassa, qtd, tipoRecipiente, volSolvente) {
  const isFrasco = String(tipoRecipiente).toLowerCase().startsWith('frasco');
  const termo = qtd === 1 ? (isFrasco ? 'frasco' : 'ampola') : (isFrasco ? 'frascos' : 'ampolas');
  const m = nfClean(massa);
  const q = Number(qtd);
  const solv = nfClean(volSolvente);
  return `${m} ${unidMassa} (${q} ${termo}) + ${solv} mL`;
}

/* Motor Matemático Clínico */
const CalcCore = (() => {
  const number = v => {
    if (typeof v === 'string') v = v.trim().replace(',', '.');
    if (v === '' || v === null || v === undefined) return NaN;
    return Number(v);
  };

  const convert = (amount, from, to) => {
    from = String(from).toLowerCase(); to = String(to).toLowerCase();
    if (from === to) return amount;
    if (from === 'mg' && to === 'mcg') return amount * 1000;
    if (from === 'mcg' && to === 'mg') return amount / 1000;
    return NaN;
  };

  const weightState = value => {
    const w = number(value);
    return Number.isFinite(w) && w > 0 && w <= 300 ? { valid: true, value: w } : { valid: false, value: null };
  };

  const needsWeight = (unit, attackUnit = '') => String(unit).includes('/kg') || String(attackUnit).toLowerCase().includes('/kg');

  const infusionRate = (dose, unit, concentration, weight) => {
    dose = number(dose); concentration = number(concentration);
    const w = weightState(weight);
    if (!Number.isFinite(dose) || dose < 0 || !Number.isFinite(concentration) || concentration <= 0 || (String(unit).includes('/kg') && !w.valid)) return NaN;
    return dose * (String(unit).includes('/kg') ? w.value : 1) * (String(unit).includes('/min') ? 60 : 1) / concentration;
  };

  const doseFromRate = (rate, concentration, unit, weight) => {
    rate = number(rate); concentration = number(concentration); const w = weightState(weight);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(concentration) || concentration <= 0 || (String(unit).includes('/kg') && !w.valid)) return NaN;
    return rate * concentration / ((String(unit).includes('/kg') ? w.value : 1) * (String(unit).includes('/min') ? 60 : 1));
  };

  const concentration = (amount, unit, finalVolume) => {
    const active = amount && typeof amount === 'object' ? number(amount.value) : number(amount);
    const sourceUnit = amount && typeof amount === 'object' ? amount.unit : unit;
    finalVolume = number(finalVolume);
    if (!Number.isFinite(active) || active <= 0 || !Number.isFinite(finalVolume) || finalVolume <= 0) return NaN;
    const converted = convert(active, sourceUnit, unit);
    return Number.isFinite(converted) ? converted / finalVolume : NaN;
  };

  const attackVolume = (dose, doseUnit, weight, conc, concUnit) => {
    dose = number(dose); conc = number(conc); const w = weightState(weight);
    if (!Number.isFinite(dose) || dose <= 0 || !Number.isFinite(conc) || conc <= 0) return NaN;
    const kg = String(doseUnit).toLowerCase().includes('/kg');
    if (kg && !w.valid) return NaN;
    const amount = dose * (kg ? w.value : 1);
    const unit = String(doseUnit).toLowerCase().split('/')[0];
    const converted = convert(amount, unit, concUnit);
    return Number.isFinite(converted) ? converted / conc : NaN;
  };

  const doseStatus = (dose, range) => dose < range[0] ? ['lo', 'abaixo da faixa usual'] : dose <= range[1] ? ['ok', 'dentro da faixa usual'] : ['hi', 'acima da faixa usual'];

  const normalizeRecipe = (entry, drug) => {
    const d = drug, base = String(d.u).split('/')[0].toLowerCase(), ap = d.ap;
    let name = '', qtd = 1, solventVolume = 0, drugMass = ap.m, drugVol = ap.v;

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      name = entry.nome || entry.name || '';
      qtd = Number.isFinite(entry.qtd) ? Number(entry.qtd) : 1;
      solventVolume = Number.isFinite(entry.solvente) ? Number(entry.solvente) : 0;
      drugMass = entry.massa !== undefined ? entry.massa : (ap.m * qtd);
      drugVol = entry.vol !== undefined ? entry.vol : (ap.v * qtd);
    }

    const active = convert(drugMass, ap.u, base);
    const finalVolume = drugVol + solventVolume;
    const conc = (Number.isFinite(active) && finalVolume > 0) ? (active / finalVolume) : NaN;
    const description = formatPreparo(drugMass, ap.u, qtd, ap.f, solventVolume);

    return { name, amount: active, unit: base, finalVolume, solventVolume, concentration: conc, description };
  };

  return Object.freeze({ number, convert, weightState, needsWeight, infusionRate, doseFromRate, concentration, attackVolume, doseStatus, normalizeRecipe });
})();