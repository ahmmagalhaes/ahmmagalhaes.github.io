/* Controlador de Interface do Usuário - Dual Cards + Slider de Titulação */
const $ = id => document.getElementById(id);

const S = {
  plano: false,
  cat: ORDEM[0],
  drug: '',
  prep: 'padrao',
  dil: 0,
  qtd: 1,
  vf: 250,
  dose: 0,
  rate: 0,
  lastEdited: 'dose',
  ataque: false
};
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
const doseReversa = (rate, unid, conc) => CalcCore.doseFromRate(rate, conc, unid, $('peso').value);

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
  S.dil = 0; S.qtd = 1; S.ataque = false;
  S.dose = d.r[0];
  S.lastEdited = 'dose';
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

  // Dual Cards com Slider Integrado na Caixa da Bomba (BIC)
  h += `<div class="dual-cards">
      <div class="calc-card active-source" id="cardDose">
        <div>
          <div class="card-head">
            <span class="card-title">Dose Clínica</span>
            <span class="mode-badge" id="badgeDose">Dose Alvo</span>
          </div>
          <div class="input-big-wrap">
            <input id="dose" type="number" inputmode="decimal" min="0" step="any" value="${S.dose}" aria-label="Dose clínica">
            <span class="unit-label">${esc(d.u)}</span>
          </div>
        </div>
        <div class="card-foot">
          <div id="status"></div>
          <div class="quick-chips">
            <button type="button" id="btnDoseMin">Mín: ${nfClean(d.r[0])}</button>
            <button type="button" id="btnDoseMax">Máx: ${nfClean(d.r[1])}</button>
          </div>
        </div>
      </div>

      <div class="swap-divider">
        <div class="swap-circle" title="Sincronização automática bidirecional">⇄</div>
      </div>

      <div class="calc-card computed-target" id="cardRate">
        <div>
          <div class="card-head">
            <span class="card-title">Vazão na Bomba (BIC)</span>
            <span class="mode-badge" id="badgeRate">Vazão Calculada</span>
          </div>
          <div class="input-big-wrap">
            <input id="rateInput" type="number" inputmode="decimal" min="0" step="0.1" value="" aria-label="Vazão em mL/h">
            <span class="unit-label">mL/h</span>
          </div>
        </div>
        <div class="card-foot">
          <div class="range-wrap">
            <input id="rateSlider" type="range" min="0" max="100" step="0.5" value="0" aria-label="Deslizar vazão na bomba">
            <div class="range-labels">
              <span>0 mL/h</span>
              <span id="sliderUsualHint">Faixa usual: —</span>
              <span id="sliderMaxLabel">100 mL/h</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  $('dyn').innerHTML = h;

  if ($('dil')) {$('dil').value = S.dil;
    $('dil').oninput = e => { S.dil = +e.target.value; update('context'); };
  }
  if ($('qtd')) {
    $('qtd').oninput = e => { S.qtd = CalcCore.number(e.target.value); sug(); update('context'); };$('vf').oninput = e => { S.vf = CalcCore.number(e.target.value); update('context'); };
    sug();
  }

  $('dose').oninput = e => {
    S.dose = CalcCore.number(e.target.value);
    S.lastEdited = 'dose';
    update('dose');
  };

  $('rateInput').oninput = e => {
    S.rate = CalcCore.number(e.target.value);
    S.lastEdited = 'rate';
    update('rate');
  };

  // Evento do Slider de Vazão
  $('rateSlider').oninput = e => {
    S.rate = CalcCore.number(e.target.value);
    S.lastEdited = 'rate';
    if ($('rateInput'))$('rateInput').value = S.rate;
    update('slider');
  };

  $('btnDoseMin').onclick = () => {
    S.dose = d.r[0]; S.lastEdited = 'dose';
    $('dose').value = S.dose;
    update('dose');
  };

  $('btnDoseMax').onclick = () => {
    S.dose = d.r[1]; S.lastEdited = 'dose';
    $('dose').value = S.dose;
    update('dose');
  };

  update('dose');
}

function sug() {
  const a = cur().ap, medVolume = a.v * S.qtd, targets = [100, 250, 500, 1000].filter(v => v > medVolume);
  $('sug').innerHTML = targets.length
    ? targets.map(v => `<button type="button" data-v="${v}">Volume final: ${nf(v, 1)} mL</button>`).join('')
    : '<span class="mut">Defina um volume final maior que o volume do fármaco.</span>';
  $('sug').querySelectorAll('button').forEach(b => b.onclick = () => { S.vf = +b.dataset.v; $('vf').value = S.vf; update('context'); });
}

function updateCardVisuals() {
  const cDose = $('cardDose'), cRate =$('cardRate');
  const bDose = $('badgeDose'), bRate =$('badgeRate');
  if (!cDose || !cRate) return;

  if (S.lastEdited === 'rate') {
    cRate.className = 'calc-card active-source';
    cDose.className = 'calc-card computed-target';
    bRate.textContent = 'Fixado na BIC';
    bDose.textContent = 'Dose Calculada';
  } else {
    cDose.className = 'calc-card active-source';
    cRate.className = 'calc-card computed-target';
    bDose.textContent = 'Dose Alvo';
    bRate.textContent = 'Vazão Calculada';
  }
}

/* Configura dinamicamente o limite e o passo do Slider conforme a droga, peso e concentração */
function syncSliderBounds(d, conc, currentRate, canCalc) {
  const slider = $('rateSlider');
  if (!slider) return;
  slider.disabled = !canCalc;
  if (!canCalc) {
    $('sliderUsualHint').textContent = 'Faixa usual: —';
    return;
  }

  const rMin = vazao(d.r[0], d.u, conc);
  const rMax = vazao(d.r[1], d.u, conc);

  // Teto inteligente: 1.5x a vazão máxima usual (arredondado para múltiplo de 5)
  let maxLimit = Number.isFinite(rMax) && rMax > 0 ? Math.ceil((rMax * 1.5) / 5) * 5 : 100;
  maxLimit = Math.max(10, maxLimit);

  // Se o médico digitou manualmente uma vazão maior que o teto do slider, expande a escala
  if (Number.isFinite(currentRate) && currentRate > maxLimit) {
    maxLimit = Math.ceil(currentRate / 10) * 10;
  }

  // Passo fino para drogas de baixa vazão e passo de 0.5 mL/h para vazões maiores
  const step = maxLimit <= 20 ? 0.1 : 0.5;

  slider.max = maxLimit;
  slider.step = step;
  if (document.activeElement !== slider) {
    slider.value = Number.isFinite(currentRate) && currentRate >= 0 ? currentRate : 0;
  }

  $('sliderMaxLabel').textContent = `${nfClean(maxLimit, 0)} mL/h`;
  if (Number.isFinite(rMin) && Number.isFinite(rMax)) {
    $('sliderUsualHint').textContent = `Usual: ${nf(rMin, 1)}–${nf(rMax, 1)} mL/h`;
  }
}

function update(source = 'context') {
  const { d, mu, conc, desc, recipe } = context(), p = peso();
  const weightValid = CalcCore.weightState($('peso').value).valid;
  const drugVol = d.ap.v * (S.prep === 'custom' ? S.qtd : 1);
  const recipeValid = Number.isFinite(conc) && conc > 0 && Number.isFinite(recipe.finalVolume) && recipe.finalVolume > 0 && recipe.finalVolume >= drugVol;
  const needP = kgOf(d.u);
  const canCalc = recipeValid && (!needP || weightValid);

  const effectiveSource = source === 'context' ? S.lastEdited : (source === 'slider' ? 'rate' : source);
  updateCardVisuals();

  if (effectiveSource === 'rate') {
    const rVal = CalcCore.number(S.rate);
    if (canCalc && Number.isFinite(rVal) && rVal >= 0) {
      S.dose = doseReversa(rVal, d.u, conc);
      if ($('dose') && document.activeElement !== $('dose')) {$('dose').value = Number.isFinite(S.dose) ? Number(S.dose.toFixed(3)) : '';
      }
    } else {
      S.dose = NaN;
      if ($('dose') && document.activeElement !== $('dose'))$('dose').value = '';
    }
  } else {
    const dVal = CalcCore.number(S.dose);
    if (canCalc && Number.isFinite(dVal) && dVal >= 0) {
      S.rate = vazao(dVal, d.u, conc);
      if ($('rateInput') && document.activeElement !== $('rateInput')) {$('rateInput').value = Number.isFinite(S.rate) ? Number(S.rate.toFixed(1)) : '';
      }
    } else {
      S.rate = NaN;
      if ($('rateInput') && document.activeElement !== $('rateInput'))$('rateInput').value = '';
    }
  }

  const dose = CalcCore.number(S.dose);
  const rate = CalcCore.number(S.rate);
  syncSliderBounds(d, conc, rate, canCalc);

  const doseValid = Number.isFinite(dose) && dose >= 0;
  const rateValid = Number.isFinite(rate) && rate >= 0;

  let error = '';
  if (!recipeValid) error = 'Preparo inválido: volume final deve ser positivo e superior ao volume do fármaco.';
  else if (needP && !weightValid) error = 'Informe um peso válido (1 a 300 kg) para o cálculo.';
  else if (!doseValid || !rateValid) error = 'Informe um valor numérico válido.';

  if (error) {
    if ($('vaz')) $('vaz').textContent = '';$('status').innerHTML = `<span class="err" style="font-size:0.82rem">${esc(error)}</span>`;
    $('calcDetails').innerHTML = `<span class="err">${esc(error)}</span>`;
  } else {
    if ($('vaz'))$('vaz').hidden = true;
    const s = status(dose, d.r);
    $('status').innerHTML = `<span class="tag ${s[0]}">${s[1]}</span>`;
    if (S.lastEdited === 'rate') {
      $('calcDetails').innerHTML = `<b>Auditoria (BIC → Dose):</b> ${nf(rate, 1)} mL/h × ${nfClean(conc, 2)} ${esc(mu)}/mL${kgOf(d.u) ? ` ÷ ${nf(p, 1)} kg` : ''}${minOf(d.u) ? ' ÷ 60 min/h' : ''} = <b>${nfClean(dose, 3)} ${esc(d.u)}</b>`;
    } else {
      $('calcDetails').innerHTML = `<b>Auditoria (Dose → BIC):</b> ${nfClean(dose, 3)} ${esc(d.u)} ÷ ${nfClean(conc, 2)} ${esc(mu)}/mL${kgOf(d.u) ? ` × ${nf(p, 1)} kg` : ''}${minOf(d.u) ? ' × 60 min/h' : ''} = <b>${nf(rate, 1)} mL/h</b>`;
    }
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
  if ($('chkAt'))$('chkAt').onchange = e => { S.ataque = e.target.checked; update('context'); };

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
  const { d, desc, recipe } = context(), dose = CalcCore.number(S.dose), rate = CalcCore.number(S.rate), p = peso();
  if (!Number.isFinite(rate) || !Number.isFinite(dose)) { alert('Preencha os dados corretamente para copiar a prescrição.'); return; }
  const texto = `${d.name.toUpperCase()}
• Preparo: ${desc} (${d.s})
• Volume Final: ${nfClean(recipe.finalVolume)} mL (Concentração: ${nfClean(recipe.concentration, 2)} ${baseUnit(d.u)}/mL)
• Programação na BIC: ${nf(rate, 1)} mL/h
• Dose Efetiva: ${nfClean(dose, 3)} ${d.u}${kgOf(d.u) ? ` (Peso: ${nf(p, 1)} kg)` : ''}`;
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
  const dose = CalcCore.number(S.dose), rate = CalcCore.number(S.rate);
  if (!Number.isFinite(conc) || conc <= 0 || !Number.isFinite(recipe.finalVolume) || recipe.finalVolume <= 0 || !Number.isFinite(dose) || dose < 0 || (needP && !weightValid)) return;
  const a = S.ataque ? ataque(d, conc, mu) : null;
  plan.push({
    id: ++uid, cat: S.cat, droga: S.drug, dose, unid: d.u, conc, mu,
    vazao: rate, preparo: desc, volumeFinal: recipe.finalVolume,
    ataqueMeta: a && d.at ? { v: d.at.v, u: d.at.u, t: d.at.t } : null, r: [...d.r]
  });
  renderPlan();
}

function renderPlan() {
  const pn = $('pNome').value.trim() || 'Paciente não identificado';
  const idVal = $('pIdade').value ? `${esc($('pIdade').value)} anos` : '—';
  const pVal = peso() ? `${nf(peso(), 1)} kg` : '—';
  const altVal = $('pAlt').value ? `${esc($('pAlt').value)} cm` : '—';

  $('ident').innerHTML = `
    <div class="patient-name">${esc(pn)}</div>
    <div class="patient-metrics">
      <span class="metric-pill">Peso: <b>${pVal}</b></span>
      <span class="metric-pill">Idade: <b>${idVal}</b></span>
      <span class="metric-pill">Altura: <b>${altVal}</b></span>
    </div>`;

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
      const s = status(it.dose, it.r);
      const rMaxPlan = vazao(it.r[1], it.unid, it.conc);
      const maxSliderPlan = Number.isFinite(rMaxPlan) && rMaxPlan > 0 ? Math.max(10, Math.ceil((rMaxPlan * 1.5) / 5) * 5, Math.ceil((it.vazao || 0) / 10) * 10) : 100;
      const stepPlan = maxSliderPlan <= 20 ? 0.1 : 0.5;

      h += `<div class="item" data-id="${it.id}">
        <div class="top">
          <div>
            <h4>${esc(it.droga)}</h4>
            <div class="mut"><b>Preparo:</b> ${esc(it.preparo)} · Volume final: ${nfClean(it.volumeFinal)} mL · ${nfClean(it.conc, 2)} ${it.mu}/mL</div>
          </div>
          <button class="btn del" data-id="${it.id}" type="button">Excluir</button>
        </div>
        <div class="dual-cards" style="margin-top:10px">
          <div class="calc-card active-source">
            <div class="card-head"><span class="card-title">Dose</span></div>
            <div class="input-big-wrap" style="margin-bottom:0">
              <input id="pDose${it.id}" class="plan-dose" data-id="${it.id}" type="number" inputmode="decimal" min="0" step="any" value="${Number.isFinite(it.dose) ? Number(it.dose.toFixed(3)) : ''}">
              <span class="unit-label">${esc(it.unid)}</span>
            </div>
          </div>
          <div class="swap-divider"><div class="swap-circle">⇄</div></div>
          <div class="calc-card computed-target">
            <div class="card-head"><span class="card-title">Vazão na BIC</span></div>
            <div class="input-big-wrap" style="margin-bottom:6px">
              <input id="pRate${it.id}" class="plan-rate" data-id="${it.id}" type="number" inputmode="decimal" min="0" step="0.1" value="${Number.isFinite(it.vazao) ? Number(it.vazao.toFixed(1)) : ''}">
              <span class="unit-label">mL/h</span>
            </div>
            <div class="range-wrap">
              <input id="pSlider${it.id}" class="plan-slider" data-id="${it.id}" type="range" min="0" max="${maxSliderPlan}" step="${stepPlan}" value="${Number.isFinite(it.vazao) ? it.vazao : 0}">
            </div>
          </div>
        </div>
        <div style="margin-top:8px"><span class="tag ${s[0]}" id="st${it.id}">${s[1]}</span> <span class="mut">(faixa: ${nfClean(it.r[0])} a ${nfClean(it.r[1])} ${esc(it.unid)})</span></div>
      </div>`;
    });
  });
  $('plan').innerHTML = h;

  $('plan').querySelectorAll('.plan-dose').forEach(inp => inp.oninput = e => {
    const it = plan.find(i => i.id == e.target.dataset.id);
    const val = CalcCore.number(e.target.value);
    it.dose = val;
    it.vazao = CalcCore.infusionRate(val, it.unid, it.conc, $('peso').value);
    const rInp = $('pRate' + it.id), sInp =$('pSlider' + it.id);
    if (rInp) rInp.value = Number.isFinite(it.vazao) ? Number(it.vazao.toFixed(1)) : '';
    if (sInp && Number.isFinite(it.vazao)) {
      if (it.vazao > Number(sInp.max)) sInp.max = Math.ceil(it.vazao / 10) * 10;
      sInp.value = it.vazao;
    }
    const st = $('st' + it.id);
    if (st && Number.isFinite(val)) {
      const s = status(val, it.r);
      st.className = `tag ${s[0]}`; st.textContent = s[1];
    }
  });

  const syncFromPlanRate = (id, val, sourceType) => {
    const it = plan.find(i => i.id == id);
    it.vazao = val;
    it.dose = CalcCore.doseFromRate(val, it.conc, it.unid, $('peso').value);
    const dInp = $('pDose' + it.id), rInp = $('pRate' + it.id), sInp =$('pSlider' + it.id);
    if (dInp) dInp.value = Number.isFinite(it.dose) ? Number(it.dose.toFixed(3)) : '';
    if (sourceType === 'slider' && rInp) rInp.value = Number.isFinite(val) ? Number(val.toFixed(1)) : '';
    if (sourceType === 'input' && sInp && Number.isFinite(val)) {
      if (val > Number(sInp.max)) sInp.max = Math.ceil(val / 10) * 10;
      sInp.value = val;
    }
    const st = $('st' + it.id);
    if (st && Number.isFinite(it.dose)) {
      const s = status(it.dose, it.r);
      st.className = `tag ${s[0]}`; st.textContent = s[1];
    }
  };

  $('plan').querySelectorAll('.plan-rate').forEach(inp => inp.oninput = e => {
    syncFromPlanRate(e.target.dataset.id, CalcCore.number(e.target.value), 'input');
  });

  $('plan').querySelectorAll('.plan-slider').forEach(inp => inp.oninput = e => {
    syncFromPlanRate(e.target.dataset.id, CalcCore.number(e.target.value), 'slider');
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
  update('context');
  if (S.plano) renderPlan();
};
['pNome', 'pIdade', 'pAlt'].forEach(id => $(id).oninput = renderPlan);$('add').onclick = addItem;
$('clear').onclick = () => {
  if (!plan.length || confirm('Limpar o plano terapêutico e os dados do paciente?')) {
    plan = [];
    ['pNome', 'pIdade', 'pAlt'].forEach(id => $(id).value = '');$('peso').value = '70';
    S.ataque = false;
    update('context');
    renderPlan();
  }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Registro de ServiceWorker falhou:', err);
    });
  });
}

fillSelects();
resetDrug();
