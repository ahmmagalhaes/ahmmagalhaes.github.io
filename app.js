/* Controlador de Interface do Usuário */
const $ = id => document.getElementById(id);
const S = { plano: false, cat: ORDEM[0], drug: '', prep: 'padrao', dil: 0, qtd: 1, vf: 250, dose: 0, ataque: false };
let plan = [], uid = 0;

const peso = () => { const w = CalcCore.weightState($('peso').value); return w.valid ? w.value : null; };
const cur = () => { const d = DROGAS[S.cat][S.drug]; d.name = S.drug; return d; };
const kgOf = u => u.includes('/kg'), minOf = u => u.includes('/min');
const baseUnit = u => u.split('/')[0].toLowerCase();
const convert = CalcCore.convert;
const status = CalcCore.doseStatus;

function context() {
  const d = cur(), mu = baseUnit(d.u);
  let recipe;
  if (S.prep === 'padrao') {
    recipe = CalcCore.normalizeRecipe(d.dil[S.dil], d);
  } else {
    const a = d.ap;
    const qtd = Number.isFinite(S.qtd) && S.qtd > 0 ? S.qtd : 1;
    const drugMass = a.m * qtd;
    const drugVol = a.v * qtd;
    const finalVolume = CalcCore.number(S.vf);
    const total = convert(drugMass, a.u, mu);
    const conc = CalcCore.concentration({ value: drugMass, unit: a.u }, mu, finalVolume);
    const solvent = Number.isFinite(finalVolume) ? Math.max(0, finalVolume - drugVol) : NaN;
    const desc = Number.isFinite(solvent) && finalVolume >= drugVol
      ? formatPreparo(drugMass, a.u, qtd, a.f, solvent)
      : `${nfClean(drugMass)} ${a.u} (${qtd} ${qtd === 1 ? (a.f === 'frasco' ? 'frasco' : 'ampola') : (a.f === 'frasco' ? 'frascos' : 'ampolas')}) + volume inválido`;
    recipe = { name: 'Preparo personalizado', amount: total, unit: mu, finalVolume, solventVolume: solvent, concentration: conc, description: desc };
  }
  return { d, mu, conc: recipe.concentration, desc: recipe.description, recipe };
}

const vazao = (dose, unid, conc) => CalcCore.infusionRate(dose, unid, conc, $('peso').value);

function ataque(d, conc, mu) {
  if (!d.at) return null;
  const vol = CalcCore.attackVolume(d.at.v, d.at.u, $('peso').value, conc, mu);
  if (!Number.isFinite(vol)) return null;
  const kg = d.at.u.toLowerCase().includes('/kg'), unit = d.at.u.toLowerCase().split('/')[0];
  const total = d.at.v * (kg ? peso() : 1), quando = d.at.t > 0 ? `em ${d.at.t} minutos` : 'em bolus direto';
  return { total, u: unit, vol, txt: `Administrar ${nf(vol, 1)} mL ${quando}.`, rec: `${d.at.v} ${d.at.u} (dose final: ${nf(total, 1)} ${unit})` };
}

function fillSelects() {
  $('cat').innerHTML = ORDEM.map(c => `<option>${esc(c)}</option>`).join('');
  $('cat').value = S.cat;
  const nomes = Object.keys(DROGAS[S.cat]).sort((a, b) => a.localeCompare(b, 'pt'));
  $('drug').innerHTML = nomes.map(n => `<option>${esc(n)}</option>`).join('');
  if (!S.drug || !DROGAS[S.cat][S.drug]) S.drug = nomes[0];
  $('drug').value = S.drug;
}

function defaultFinalVolume(d) {
  const recipe = CalcCore.normalizeRecipe(d.dil[0], d);
  return Number.isFinite(recipe.finalVolume) && recipe.finalVolume > 0 ? recipe.finalVolume : Math.max(250, d.ap.v || 1);
}

function resetDrug() {
  const d = cur();
  S.dil = 0; S.qtd = 1; S.ataque = false; S.dose = d.r[0];
  S.vf = defaultFinalVolume(d);
  build();
}

function build() {
  const d = cur();
  let h = '';
  if (S.prep === 'padrao') {
    h += `<label for="dil">Preparo cadastrado</label><select id="dil">${d.dil.map((x, i) => `<option value="${i}">${esc(x.nome || x[0])}</option>`).join('')}</select>`;
  } else {
    h += `<label for="qtd">Quantidade de ${esc(d.ap.f === 'frasco' ? 'frasco' : 'ampola')}s</label><input id="qtd" type="number" min="1" max="100" step="1" value="${S.qtd}">
      <label>Sugestões de volume final</label><div class="sug" id="sug"></div>
      <label for="vf">Volume final da solução (mL, incluindo o fármaco)</label><input id="vf" type="number" min="0.1" max="2000" step="0.1" value="${S.vf}">`;
  }
  h += `<label for="dose">Dose de manutenção desejada (${esc(d.u)})</label><input id="dose" type="number" inputmode="decimal" min="0" step="any" value="${S.dose}">
    <div class="sug" style="margin-top:4px">
      <button type="button" id="btnDoseMin">Dose mín: ${nfClean(d.r[0])} ${esc(d.u)}</button>
      <button type="button" id="btnDoseMax">Dose máx: ${nfClean(d.r[1])} ${esc(d.u)}</button>
    </div>`;
  $('dyn').innerHTML = h;

  if ($('dil')) { $('dil').value = S.dil; $('dil').oninput = e => { S.dil = +e.target.value; update(); }; }
  if ($('qtd')) {
    $('qtd').oninput = e => { S.qtd = CalcCore.number(e.target.value); sug(); update(); };$('vf').oninput = e => { S.vf = CalcCore.number(e.target.value); update(); };
    sug();
  }
  $('dose').oninput = e => { S.dose = CalcCore.number(e.target.value); update(); };
  if ($('btnDoseMin')) $('btnDoseMin').onclick = () => { S.dose = d.r[0];$('dose').value = S.dose; update(); };
  if ($('btnDoseMax')) $('btnDoseMax').onclick = () => { S.dose = d.r[1];$('dose').value = S.dose; update(); };

  update();
}

function sug() {
  const a = cur().ap, medVolume = a.v * S.qtd, targets = [100, 250, 500, 1000].filter(v => v > medVolume);
  $('sug').innerHTML = targets.length
    ? targets.map(v => `<button type="button" data-v="${v}">Volume final: ${nf(v, 1)} mL</button>`).join('')
    : '<span class="mut">Defina um volume final maior que o volume do fármaco.</span>';
  $('sug').querySelectorAll('button').forEach(b => b.onclick = () => { S.vf = +b.dataset.v; $('vf').value = S.vf; update(); });
}

function update() {
  const { d, mu, conc, desc, recipe } = context(), p = peso(), dose = CalcCore.number(S.dose);
  const weightValid = CalcCore.weightState($('peso').value).valid;
  const drugVol = d.ap.v * (S.prep === 'custom' ? S.qtd : 1);
  const recipeValid = Number.isFinite(conc) && conc > 0 && Number.isFinite(recipe.finalVolume) && recipe.finalVolume > 0 && recipe.finalVolume >= drugVol;
  const doseValid = Number.isFinite(dose) && dose >= 0;
  const needP = kgOf(d.u);
  let error = '';

  if (!recipeValid) error = 'Preparo inválido: volume final deve ser positivo e superior ao volume do fármaco.';
  else if (needP && !weightValid) error = 'Informe um peso válido (1 a 300 kg) para o cálculo.';
  else if (!doseValid) error = 'Informe uma dose numérica válida.';

  const rate = recipeValid && doseValid ? vazao(dose, d.u, conc) : NaN;

  if (error) {
    $('vaz').textContent = '—';$('status').innerHTML = `<span class="err">${esc(error)}</span>`;
    $('calcDetails').innerHTML = 'Cálculo suspenso até o ajuste dos dados.';
  } else {
    const s = status(dose, d.r);
    $('vaz').textContent = nf(rate, 1) + ' mL/h';$('status').innerHTML = `<span class="tag ${s[0]}">${s[1]}</span>`;
    $('calcDetails').innerHTML = `Dose ${nfClean(dose, 3)} ${esc(d.u)} ÷ conc. ${nfClean(conc, 3)} ${esc(mu)}/mL${kgOf(d.u) ? ` × peso ${nf(p, 1)} kg` : ''}${minOf(d.u) ? ' × 60 min/h' : ''} = <b>${nf(rate, 1)} mL/h</b>.`;
  }

  let ab = '';
  if (d.at) {
    const attackNeedsWeight = d.at.u.toLowerCase().includes('/kg');
    if (attackNeedsWeight && !weightValid) ab = '<div class="warn">Informe o peso válido para calcular a dose de ataque.</div>';
    else if (recipeValid) {
      const a = ataque(d, conc, mu);
      ab = `<label style="display:flex;gap:8px;align-items:center;font-weight:600;margin-top:10px"><input type="checkbox" id="chkAt" style="width:auto" ${S.ataque ? 'checked' : ''}> Calcular dose de ataque (bolus)</label>`;
      if (S.ataque && a) ab += `<div class="info" style="margin-top:6px"><p><b>Ataque recomendado:</b> ${esc(a.rec)}</p></div><div class="warn">${esc(a.txt)}</div>`;
    }
  }
  $('ataqueBox').innerHTML = ab;
  if ($('chkAt'))$('chkAt').onchange = e => { S.ataque = e.target.checked; update(); };

  // Aba lateral com o formato estrito
  $('side').innerHTML = `<strong>Informações da solução</strong>
    <p><b>Solvente:</b> ${esc(d.s)}</p>
    <p><b>Preparo:</b> <b>${esc(desc)}</b></p>
    <p><b>Volume final da solução:</b> ${Number.isFinite(recipe.finalVolume) ? nfClean(recipe.finalVolume) + ' mL' : '—'}</p>
    <p><b>Faixa usual cadastrada:</b> ${nfClean(d.r[0])} a ${nfClean(d.r[1])} ${esc(d.u)}</p>
    <p><b>Concentração calculada:</b> ${Number.isFinite(conc) ? nfClean(conc, 3) : '—'} ${mu}/mL</p>
    <p class="mut">Peso considerado: ${kgOf(d.u) ? (p ? nf(p, 1) + ' kg' : 'não informado') : 'não se aplica'}</p>
    ${d.f ? '<div class="warn">Fotossensível: proteger da luz (equipo e frasco âmbar).</div>' : ''}`;

  $('add').disabled = !!error || !doseValid;
}

/* Copiar Prescrição */
$('btnCopy').onclick = () => {
  const { d, desc, recipe } = context(), dose = CalcCore.number(S.dose), p = peso();
  const rate = vazao(dose, d.u, recipe.concentration);
  if (!Number.isFinite(rate)) { alert('Preencha os dados corretamente para copiar a prescrição.'); return; }
  const texto = `${d.name.toUpperCase()}
• Preparo: ${desc} (${d.s})
• Volume Final: ${nfClean(recipe.finalVolume)} mL (Concentração: ${nfClean(recipe.concentration, 2)} ${baseUnit(d.u)}/mL)
• Programação na BIC: ${nf(rate, 1)} mL/h
• Dose Meta: ${nfClean(dose, 3)} ${d.u}${kgOf(d.u) ? ` (Peso: ${nf(p, 1)} kg)` : ''}`;
  navigator.clipboard.writeText(texto).then(() => {
    const b = $('btnCopy'); const old = b.textContent;
    b.textContent = '✓ Prescrição copiada!';
    setTimeout(() => b.textContent = old, 2000);
  }).catch(() => alert(texto));
};

/* Plano Terapêutico */
function addItem() {
  const { d, mu, conc, desc, recipe } = context(), weightValid = CalcCore.weightState($('peso').value).valid;
  const needP = CalcCore.needsWeight(d.u, S.ataque && d.at ? d.at.u : '');
  const dose = CalcCore.number(S.dose);
  if (!Number.isFinite(conc) || conc <= 0 || !Number.isFinite(recipe.finalVolume) || recipe.finalVolume <= 0 || !Number.isFinite(dose) || dose < 0 || (needP && !weightValid)) return;
  const a = S.ataque ? ataque(d, conc, mu) : null;
  plan.push({
    id: ++uid, cat: S.cat, droga: S.drug, dose, unid: d.u, conc, mu,
    vazao: vazao(dose, d.u, conc), preparo: desc, volumeFinal: recipe.finalVolume,
    ataqueMeta: a && d.at ? { v: d.at.v, u: d.at.u, t: d.at.t } : null, r: [...d.r]
  });
  renderPlan();
}

function renderPlan() {
  const pn = $('pNome').value.trim() || 'Paciente não identificado';
  $('ident').textContent = `${pn} · ${$('pIdade').value || '—'} anos · ${peso() || '—'} kg · ${$('pAlt').value || '—'} cm`;
  if (!plan.length) {
    $('plan').innerHTML = '<p class="mut">Nenhuma droga no plano. Configure a infusão acima e clique em “Adicionar ao plano terapêutico”.</p>';
    return;
  }
  let h = '';
  ORDEM.forEach(c => {
    const its = plan.filter(i => i.cat === c);
    if (!its.length) return;
    h += `<h3>${esc(c)}</h3>`;
    its.forEach(it => {
      const s = status(it.dose, it.r), formula = CalcCore.infusionRate(it.dose, it.unid, it.conc, $('peso').value);
      h += `<div class="item" data-id="${it.id}">
        <div class="top">
          <div>
            <h4>${esc(it.droga)}</h4>
            <div class="mut"><b>Preparo:</b> ${esc(it.preparo)} · Volume final: ${nfClean(it.volumeFinal)} mL · ${nfClean(it.conc, 2)} ${it.mu}/mL</div>
            <div>Dose prescrita: <b id="ds${it.id}">${nfClean(it.dose, 3)}</b> ${esc(it.unid)} <span class="tag ${s[0]}" id="st${it.id}">${s[1]}</span></div>
          </div>
          <button class="btn del" data-id="${it.id}">Excluir</button>
        </div>
        <div style="margin-top:6px">Vazão calculada: <b style="font-size:1.3rem;color:var(--acc)" id="vz${it.id}">${Number.isFinite(formula) ? nf(formula, 1) + ' mL/h' : '— (verifique peso)'}</b></div>
        <label for="rate${it.id}">Ajustar vazão na BIC (mL/h)</label>
        <div style="display:flex;gap:6px">
          <input id="rate${it.id}" type="number" min="0" step="0.1" value="${Number.isFinite(it.vazao) ? it.vazao : ''}" style="max-width:140px">
          <button class="btn applyRate" data-id="${it.id}" type="button">Recalcular dose a partir da vazão</button>
        </div>
      </div>`;
    });
  });
  $('plan').innerHTML = h;

  $('plan').querySelectorAll('.applyRate').forEach(b => b.onclick = () => {
    const it = plan.find(i => i.id == b.dataset.id), rate = CalcCore.number($('rate' + it.id).value);
    if (!Number.isFinite(rate) || rate < 0) { alert('Informe uma vazão válida.'); return; }
    const newDose = CalcCore.doseFromRate(rate, it.conc, it.unid, $('peso').value);
    if (!Number.isFinite(newDose)) { alert('Não foi possível calcular: informe um peso válido.'); return; }
    it.vazao = rate; it.dose = newDose;
    renderPlan();
  });

  $('plan').querySelectorAll('.del').forEach(b => b.onclick = () => {
    plan = plan.filter(i => i.id != b.dataset.id);
    renderPlan();
  });
}

function setMode(plano) {
  S.plano = plano;
  $('tRef').setAttribute('aria-selected', !plano);
  $('tPlan').setAttribute('aria-selected', plano);$('ficha').hidden = !plano;
  $('planPanel').hidden = !plano;
  $('add').hidden = !plano;
  if (plano) renderPlan();
}

function setPrep(p) {
  S.prep = p;
  if (p === 'custom') S.vf = defaultFinalVolume(cur());
  $('mPad').setAttribute('aria-pressed', p === 'padrao');$('mCus').setAttribute('aria-pressed', p === 'custom');
  build();
}

$('tRef').onclick = () => setMode(false);$('tPlan').onclick = () => setMode(true);
$('mPad').onclick = () => setPrep('padrao');$('mCus').onclick = () => setPrep('custom');

$('cat').onchange = e => { S.cat = e.target.value; S.drug = ''; fillSelects(); resetDrug(); };
$('drug').onchange = e => { S.drug = e.target.value; resetDrug(); };$('peso').oninput = () => {
  plan.forEach(it => { it.vazao = CalcCore.infusionRate(it.dose, it.unid, it.conc, $('peso').value); });
  update();
  if (S.plano) renderPlan();
};
['pNome', 'pIdade', 'pAlt'].forEach(id => $(id).oninput = renderPlan);$('add').onclick = addItem;
$('clear').onclick = () => {
  if (!plan.length || confirm('Limpar o plano terapêutico e os dados do paciente?')) {
    plan = [];
    ['pNome', 'pIdade', 'pAlt'].forEach(id => $(id).value = '');$('peso').value = '70';
    S.ataque = false;
    update();
    renderPlan();
  }
};

// Registro do Service Worker (Offline PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Registro de ServiceWorker falhou:', err);
    });
  });
}

fillSelects();
resetDrug();