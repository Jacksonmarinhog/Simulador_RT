(function(){
  'use strict';

  /* ---------------- Config: reform schedule ---------------- */
  // Simplified, editable-by-design reference schedule based on LC 214/2025.
  // IBS from 2029 on is modeled as a share of the CURRENT ICMS rate the user entered
  // (icms_ibs(year) = icmsAtual * rampIn[year]; icms_efetivo(year) = icmsAtual * (1-rampIn[year])).
  var YEARS = [2026,2027,2028,2029,2030,2031,2032,2033];
  var IBS_PLENO = 0.187; // alíquota de referência nacional do IBS (CGIBS, Resolução nº 14, 29/07/2026) — fixa, não depende do ICMS/ISS de cada empresa
  var YEAR_META = {
    2026:{cbs:0.009, ibsRamp:0, icmsRamp:0, pcExtinct:false, real:false, note:'ano de teste · CBS 0,9% / IBS 0,1%, compensados'},
    2027:{cbs:0.092, ibsRamp:0, icmsRamp:0, pcExtinct:true,  real:true,  note:'fim de PIS/COFINS · CBS entra em vigor'},
    2028:{cbs:0.092, ibsRamp:0, icmsRamp:0, pcExtinct:true,  real:true,  note:'consolidação · CBS já em regime pleno'},
    2029:{cbs:0.092, ibsRamp:0.10, icmsRamp:0.10, pcExtinct:true, real:true, note:'IBS começa a substituir o ICMS (10%)'},
    2030:{cbs:0.092, ibsRamp:0.20, icmsRamp:0.20, pcExtinct:true, real:true, note:'IBS sobe, ICMS cai (20%)'},
    2031:{cbs:0.092, ibsRamp:0.30, icmsRamp:0.30, pcExtinct:true, real:true, note:'IBS sobe, ICMS cai (30%)'},
    2032:{cbs:0.092, ibsRamp:0.40, icmsRamp:0.40, pcExtinct:true, real:true, note:'último ano de transição do ICMS (40%)'},
    2033:{cbs:0.092, ibsRamp:1.00, icmsRamp:1.00, pcExtinct:true, real:true, note:'sistema pleno · ICMS extinto'}
  };
  var yearIndex = 1; // default 2027

  var state = { regime:'simples', simplesMode:'padrao', tipo:'servico', ibsRegime:'regular' };
  function ibsRegimeMultiplier(){
    if(state.ibsRegime === 'dif60') return 0.40;
    if(state.ibsRegime === 'dif30') return 0.70;
    return 1.0; // regular (e ponto de partida para 'especifico', tratado à parte na exibição)
  }
  var fmtBRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  var fmtPct = function(v){ return (v*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2}) + '%'; };

  /* ---------------- Gate form ---------------- */
  var gateForm = document.getElementById('gateForm');
  var fields = ['nome','cnpj','tel','email'];

  function maskCNPJ(v){
    v = v.replace(/\D/g,'').slice(0,14);
    v = v.replace(/^(\d{2})(\d)/,'$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/,'.$1/$2');
    v = v.replace(/(\d{4})(\d)/,'$1-$2');
    return v;
  }
  document.getElementById('cnpj').addEventListener('input', function(e){
    e.target.value = maskCNPJ(e.target.value);
  });
  document.getElementById('tel').addEventListener('input', function(e){
    var v = e.target.value.replace(/\D/g,'').slice(0,11);
    if(v.length > 6){ v = '('+v.slice(0,2)+') '+v.slice(2,7)+'-'+v.slice(7); }
    else if(v.length > 2){ v = '('+v.slice(0,2)+') '+v.slice(2); }
    e.target.value = v;
  });

  function fireLeadAlert(payload){
    // Hook point for the sales alert discussed with the agency: fire the moment
    // the gate is completed, before (or instead of) waiting for the full simulation.
    // Wire this to your CRM / WhatsApp API endpoint. Left as a no-op stub here.
    // Example:
    // fetch('https://SEU-WEBHOOK/leads', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    console.log('[lead:gate-complete]', payload);
  }

  gateForm.addEventListener('submit', function(e){
    e.preventDefault();
    try {
      var valid = true;
      var vals = {};
      fields.forEach(function(f){
        var input = document.getElementById(f);
        var wrap = document.getElementById('f-'+f);
        var v = input.value.trim();
        var ok = true;
        if(f === 'nome') ok = v.length > 2;
        if(f === 'cnpj') ok = v.replace(/\D/g,'').length === 14;
        if(f === 'tel') ok = v.replace(/\D/g,'').length >= 10;
        if(f === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        wrap.classList.toggle('invalid', !ok);
        if(!ok) valid = false;
        vals[f] = v;
      });
      if(!valid) return;

      try { fireLeadAlert(vals); } catch(errAlert){ console.error('fireLeadAlert failed', errAlert); }

      var hero = document.querySelector('.hero');
      if(hero) hero.style.display = 'none';
      var sim = document.getElementById('simSection');
      if(sim){
        sim.classList.add('active');
        if(typeof sim.scrollIntoView === 'function'){
          try { sim.scrollIntoView({behavior:'smooth', block:'start'}); } catch(errScroll){}
        }
      }
    } catch(errSubmit){
      console.error('Gate form submit failed', errSubmit);
    }
  });

  /* ---------------- Regime toggle ---------------- */
  var regimeBtns = document.querySelectorAll('#regimeToggle button');
  regimeBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      regimeBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      state.regime = btn.getAttribute('data-regime');
      toggleFields();
      compute();
    });
  });

  var tipoBtns = document.querySelectorAll('#tipoToggle button');
  tipoBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      tipoBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      state.tipo = btn.getAttribute('data-tipo');
      toggleFields();
      compute();
    });
  });

  var ibsRegimeBtns = document.querySelectorAll('#regimeIbsToggle button');
  ibsRegimeBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      ibsRegimeBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      state.ibsRegime = btn.getAttribute('data-ibsregime');
      compute();
    });
  });

  function toggleFields(){
    try { toggleFieldsInner(); } catch(errToggle){ console.error('toggleFields() failed', errToggle); }
  }
  function toggleFieldsInner(){
    var isSimples = state.regime === 'simples';
    var isServico = state.tipo === 'servico';

    document.getElementById('dasField').classList.toggle('hidden', !isSimples);
    document.querySelectorAll('.icmsVendaField, .pcVendaField').forEach(function(el){
      el.classList.toggle('hidden', isSimples);
    });
    // ICMS credit-on-purchase only makes sense for goods (ISS has no equivalent credit chain).
    document.querySelector('.icmsCompraField').classList.toggle('hidden', isSimples || isServico);
    document.querySelector('.pcCompraField').classList.toggle('hidden', isSimples);

    document.getElementById('simplesModeField').classList.toggle('hidden', !isSimples);
    // O regime diferenciado/específico só se aplica a quem apura IBS/CBS por fora: Presumido, Real, ou Simples híbrido.
    var applicaRegimeIbs = !isSimples || (isSimples && state.simplesMode === 'hibrido');
    document.getElementById('regimeIbsField').classList.toggle('hidden', !applicaRegimeIbs);
    document.querySelectorAll('.hibridoFields').forEach(function(el){
      el.classList.toggle('hidden', !(isSimples && state.simplesMode === 'hibrido'));
    });

    if(state.regime === 'real'){
      document.getElementById('pcVenda').value = 9.65;
      document.getElementById('pcCompra').value = 9.65;
    } else if(state.regime === 'presumido'){
      document.getElementById('pcVenda').value = 3.65;
      document.getElementById('pcCompra').value = 0;
    }

    // Labels and defaults that flip between "produto" (ICMS, goods) and "serviço" (ISS, labor).
    document.getElementById('icmsVendaLabel').textContent = isServico ? 'ISS na venda' : 'ICMS na venda';
    document.getElementById('icmsVendaNote').textContent = isServico
      ? 'Alíquota do seu município — costuma ficar entre 2% e 5%.'
      : 'Alíquota do seu estado — costuma ficar entre 17% e 20%.';
    document.getElementById('a-icms-label').textContent = isServico ? 'ISS' : 'ICMS';
    document.getElementById('r-icms-label').textContent = isServico ? 'ISS' : 'ICMS';
    document.getElementById('custoLabel').textContent = isServico
      ? 'Seu custo para entregar o serviço (mão de obra, insumos, terceiros)'
      : 'Custo do produto (o que você paga para comprar)';
    document.getElementById('descricaoLabel').textContent = isServico ? 'Qual serviço você vende' : 'Qual produto você vende';
    document.getElementById('descricao').placeholder = isServico ? 'Ex: hora de consultoria, plano mensal' : 'Ex: produto revendido, unidade de mercadoria';
    document.getElementById('pcCompraLabel').textContent = isServico
      ? 'Crédito de PIS+COFINS sobre terceiros/insumos'
      : 'Crédito de PIS+COFINS na compra';

    var icmsVendaInput = document.getElementById('icmsVenda');
    if(!icmsVendaInput.dataset.touched){
      icmsVendaInput.value = isServico ? 5 : 18;
    }
  }
  document.getElementById('icmsVenda').addEventListener('input', function(e){ e.target.dataset.touched = '1'; });

  var simplesModeBtns = document.querySelectorAll('#simplesModeToggle button');
  simplesModeBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      simplesModeBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      state.simplesMode = btn.getAttribute('data-mode');
      toggleFields();
      compute();
    });
  });
  ['dasFracaoPC','dasFracaoICMS'].forEach(function(id){
    document.getElementById(id).addEventListener('input', compute);
  });

  /* ---------------- Year switcher ---------------- */
  var yearLabel = document.getElementById('yearLabel');
  function renderYearLabel(){
    try { renderYearLabelInner(); } catch(errYear){ console.error('renderYearLabel() failed', errYear); }
  }
  function renderYearLabelInner(){
    var y = YEARS[yearIndex];
    yearLabel.innerHTML = y + '<small>' + YEAR_META[y].note + '</small>';
    document.getElementById('yearPrev').disabled = yearIndex === 0;
    document.getElementById('yearNext').disabled = yearIndex === YEARS.length-1;
  }
  document.getElementById('yearPrev').addEventListener('click', function(){
    if(yearIndex > 0){ yearIndex--; renderYearLabel(); compute(); }
  });
  document.getElementById('yearNext').addEventListener('click', function(){
    if(yearIndex < YEARS.length-1){ yearIndex++; renderYearLabel(); compute(); }
  });

  /* ---------------- Inputs wiring ---------------- */
  var num = function(id){ var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : v; };

  var marginDriven = true;
  document.getElementById('margem').addEventListener('input', function(){ marginDriven = true; compute(); });
  document.getElementById('precoVenda').addEventListener('input', function(){
    if(document.getElementById('precoVenda').value !== ''){ marginDriven = false; }
    compute();
  });
  ['das','icmsVenda','pcVenda','custo','icmsCompra','pcCompra','descricao'].forEach(function(id){
    document.getElementById(id).addEventListener('input', compute);
  });

  /* ---------------- Core calculation ---------------- */
  function currentScenarioRate(){
    if(state.regime === 'simples'){
      return { total: num('das')/100, das: num('das')/100 };
    }
    var icms = num('icmsVenda')/100;
    var pc = num('pcVenda')/100;
    return { total: icms + pc, icms: icms, pc: pc };
  }

  function reformScenarioRate(atualRate){
    var meta = YEAR_META[YEARS[yearIndex]];
    if(state.regime === 'simples' && state.simplesMode === 'padrao'){
      // Composição interna do DAS muda (PIS/COFINS->CBS, ICMS/ISS->IBS) mas a carga total
      // permanece igual, conforme a LC 214/2025 preservou a LC 123/2006 (art. 516).
      return { porDentro: num('das')/100, das: num('das')/100, cbs:0, ibs:0, icms:0, pcApplies:false, mode:'padrao' };
    }
    if(state.regime === 'simples' && state.simplesMode === 'hibrido'){
      // Regime híbrido (LC 214/2025, art. 41, §3º): a parcela de IBS/CBS sai do DAS e passa a
      // ser apurada por fora, pelas regras do regime regular (não cumulativo, alíquota cheia).
      // Só existe como opção a partir de 2027 — em 2026 (teste) não há distinção do padrão.
      if(!meta.real){
        return { porDentro: num('das')/100, das: num('das')/100, cbs:0, ibs:0, icms:0, pcApplies:false, mode:'hibrido' };
      }
      var dasTotal = num('das')/100;
      var pcFracao = num('dasFracaoPC')/100;
      var icmsFracaoDAS = num('dasFracaoICMS')/100;
      var remanescente = dasTotal * (1 - pcFracao - icmsFracaoDAS); // IRPJ, CSLL, CPP etc. — o que sobra no DAS reduzido
      // CBS e IBS no híbrido seguem a mesma alíquota de referência nacional de quem já é Real/Presumido —
      // não são derivados da sua fatia de DAS, que só define o que sai da guia unificada.
      var regimeMultH = ibsRegimeMultiplier();
      var ibsH = IBS_PLENO * meta.ibsRamp * regimeMultH;
      var cbsH = meta.cbs * regimeMultH;
      var porDentroH = remanescente;
      return { porDentro: porDentroH, das: remanescente, cbs: cbsH, ibs: ibsH, icms: 0, pcApplies: false, mode:'hibrido' };
    }
    var icmsAtual = num('icmsVenda')/100;
    var icmsEfetivo = meta.real ? icmsAtual * (1 - meta.icmsRamp) : icmsAtual;
    var regimeMult = ibsRegimeMultiplier();
    var ibs = meta.real ? IBS_PLENO * meta.ibsRamp * regimeMult : 0;
    var cbs = meta.real ? meta.cbs * regimeMult : 0;
    var pcApplies = !meta.pcExtinct;
    // Only taxes that still compose their own base ("por dentro") enter the pricing formula.
    // CBS and IBS are excluded from the base by law (LC 214/2025, art. 12, §2º, I) — they are
    // calculated on top of the base price and added afterwards, never folded into it.
    var porDentro = icmsEfetivo + (pcApplies ? atualRate.pc : 0);
    return { porDentro: porDentro, cbs: cbs, ibs: ibs, icms: icmsEfetivo, pcApplies: pcApplies, mode:'geral' };
  }

  function creditOnPurchase(){
    if(state.regime === 'simples') return 0;
    var icmsCredit = state.tipo === 'servico' ? 0 : num('icmsCompra')/100; // ISS has no equivalent credit chain
    return icmsCredit + (num('pcCompra')/100);
  }

  function compute(){
    try { computeInner(); } catch(errCompute){ console.error('compute() failed', errCompute); }
  }
  function computeInner(){
    var custo = num('custo');
    var credit = creditOnPurchase();
    var custoFinal = custo * (1 - credit);
    if(custoFinal < 0) custoFinal = 0;

    var atualRate = currentScenarioRate();
    var reformRate = reformScenarioRate(atualRate);

    var precoVenda;
    var margem = num('margem')/100;
    if(marginDriven || document.getElementById('precoVenda').value === ''){
      var denom = 1 - atualRate.total - margem;
      precoVenda = denom > 0 ? custoFinal / denom : 0;
      document.getElementById('precoVenda').value = precoVenda ? precoVenda.toFixed(2) : '';
    } else {
      precoVenda = num('precoVenda');
    }

    // ---- Atual ----
    var aImpostos = precoVenda * atualRate.total;
    var aLucro = precoVenda - custoFinal - aImpostos;
    var aMargem = precoVenda > 0 ? aLucro / precoVenda : 0;

    document.getElementById('a-preco').textContent = fmtBRL.format(precoVenda||0);
    document.getElementById('a-custo').textContent = fmtBRL.format(custoFinal);
    document.getElementById('a-impostos').textContent = fmtBRL.format(aImpostos);
    document.getElementById('a-lucro').textContent = fmtBRL.format(aLucro);
    document.getElementById('a-lucro').className = 'lucro-val ' + (aLucro >= 0 ? 'good' : 'bad');
    document.getElementById('a-margem').textContent = 'margem ' + fmtPct(aMargem);

    var showDas = state.regime === 'simples';
    document.getElementById('a-line-das').classList.toggle('hidden', !showDas);
    document.getElementById('a-line-icms').classList.toggle('hidden', showDas);
    document.getElementById('a-line-pc').classList.toggle('hidden', showDas);
    if(showDas){
      document.getElementById('a-das').textContent = fmtBRL.format(precoVenda*atualRate.das) + ' ('+fmtPct(atualRate.das)+')';
    } else {
      document.getElementById('a-icms').textContent = fmtBRL.format(precoVenda*atualRate.icms) + ' ('+fmtPct(atualRate.icms)+')';
      document.getElementById('a-pc').textContent = fmtBRL.format(precoVenda*atualRate.pc) + ' ('+fmtPct(atualRate.pc)+')';
    }

    // ---- Reforma: preço base via taxas "por dentro" only, CBS/IBS somados "por fora" ----
    var denomR = 1 - reformRate.porDentro - margem;
    var precoBaseReforma = denomR > 0 ? custoFinal / denomR : 0;
    var cbsValor = precoBaseReforma * reformRate.cbs;
    var ibsValor = precoBaseReforma * reformRate.ibs;
    var porForaValor = cbsValor + ibsValor;
    var precoFinalReforma = precoBaseReforma + porForaValor;
    var impostosEmbutidos = precoBaseReforma * reformRate.porDentro;
    var rLucro = precoBaseReforma - custoFinal - impostosEmbutidos; // CBS/IBS is pass-through, doesn't erode margin when repassado
    var rMargem = precoBaseReforma > 0 ? rLucro / precoBaseReforma : 0;

    document.getElementById('r-preco').textContent = fmtBRL.format(precoBaseReforma||0);
    document.getElementById('r-custo').textContent = fmtBRL.format(custoFinal);
    document.getElementById('r-impostos').textContent = fmtBRL.format(impostosEmbutidos);
    document.getElementById('r-porfora').textContent = '+ ' + fmtBRL.format(porForaValor);
    document.getElementById('r-precofinal').textContent = fmtBRL.format(precoFinalReforma||0);
    document.getElementById('r-lucro').textContent = fmtBRL.format(rLucro);
    document.getElementById('r-lucro').className = 'lucro-val ' + (rLucro >= 0 ? 'good' : 'bad');
    document.getElementById('r-margem').textContent = 'margem ' + fmtPct(rMargem) + ' sobre o preço base (antes do CBS/IBS)';

    var isSimples = state.regime === 'simples';
    var isPadrao = isSimples && state.simplesMode === 'padrao';
    var isHibrido = isSimples && state.simplesMode === 'hibrido';
    var isGeral = !isSimples;

    document.getElementById('reformaCardTitle').textContent = isHibrido ? 'Com a reforma — Simples híbrido' : 'Com a reforma';
    document.getElementById('r-line-das').classList.toggle('hidden', !isSimples);
    document.getElementById('r-das-label').textContent = isHibrido ? 'DAS (parte que permanece)' : 'DAS';
    document.getElementById('r-line-icms').classList.toggle('hidden', !isGeral);
    document.getElementById('r-line-pc').classList.toggle('hidden', !isGeral);
    document.getElementById('r-line-porfora-head').classList.toggle('hidden', isPadrao);
    document.getElementById('r-line-cbs').classList.toggle('hidden', isPadrao);
    document.getElementById('r-line-ibs').classList.toggle('hidden', isPadrao);
    document.getElementById('poraforaNote').classList.toggle('hidden', isPadrao);

    if(isSimples){
      document.getElementById('r-das').textContent = fmtBRL.format(precoBaseReforma*reformRate.das) + ' ('+fmtPct(reformRate.das)+')';
    }
    if(isGeral){
      document.getElementById('r-icms').textContent = fmtBRL.format(precoBaseReforma*reformRate.icms) + ' ('+fmtPct(reformRate.icms)+')';
      var pcEl = document.getElementById('r-pc');
      if(reformRate.pcApplies){
        pcEl.textContent = fmtBRL.format(precoBaseReforma*atualRate.pc) + ' ('+fmtPct(atualRate.pc)+')';
        pcEl.classList.remove('na');
      } else {
        pcEl.textContent = 'Não aplicável';
        pcEl.classList.add('na');
      }
    }
    if(isGeral || isHibrido){
      document.getElementById('r-cbs').textContent = fmtBRL.format(cbsValor) + ' ('+fmtPct(reformRate.cbs)+')';
      document.getElementById('r-ibs').textContent = fmtBRL.format(ibsValor) + ' ('+fmtPct(reformRate.ibs)+')';
    }

    // ---- Impact reveal: the real-world question is what the client ends up paying ----
    var deltaPreco = precoFinalReforma - precoVenda;
    var deltaPrecoPct = precoVenda !== 0 ? deltaPreco/precoVenda : 0;
    var box = document.getElementById('impactBox');
    var icon = document.getElementById('impactIcon');
    var big = document.getElementById('impactBig');
    var small = document.getElementById('impactSmall');

    var isEspecifico = state.ibsRegime === 'especifico' && (isGeral || isHibrido);

    if(isEspecifico){
      box.className = 'impact';
      icon.textContent = '?';
      big.textContent = 'Seu setor tem regra própria — este simulador não calcula esse caso direito';
      small.textContent = 'Regimes específicos (financeiro, imobiliário, combustíveis, planos de saúde e outros) seguem cálculo próprio na LC 214/2025, não a redução percentual dos regimes diferenciados. O número certo pra você depende de olhar o seu caso com um especialista.';
    } else if(Math.abs(deltaPreco) < 0.01){
      box.className = 'impact';
      icon.textContent = '=';
      big.textContent = 'Impacto neutro nesse cenário';
      small.textContent = 'Com os números informados, o preço final muda pouco em ' + YEARS[yearIndex] + '. Vale revisar conforme o cronograma avança.';
    } else if(deltaPreco > 0){
      box.className = 'impact';
      icon.textContent = '!';
      big.textContent = 'Seu preço final precisa subir ' + fmtBRL.format(deltaPreco) + ' (' + fmtPct(Math.abs(deltaPrecoPct)) + ') para manter sua margem de ' + fmtPct(num('margem')/100) + ' em ' + YEARS[yearIndex];
      small.textContent = 'O CBS e o IBS são somados por fora, então não corroem sua margem sozinhos — mas se você não repassar esse valor ao preço, ele sai direto do seu lucro. É essa conversa com o cliente que precisa começar antes de 2027.';
    } else {
      box.className = 'impact positive';
      icon.textContent = '✓';
      big.textContent = 'Seu preço final pode cair ' + fmtBRL.format(Math.abs(deltaPreco)) + ' (' + fmtPct(Math.abs(deltaPrecoPct)) + ') mantendo sua margem de ' + fmtPct(num('margem')/100) + ' em ' + YEARS[yearIndex];
      small.textContent = 'Com os números informados, esse cenário reduz sua carga tributária embutida. Vale confirmar com um especialista antes de mudar preço.';
    }
  }

  document.getElementById('ctaWhats').addEventListener('click', function(){
    var msg = encodeURIComponent('Olá! Simulei o impacto da reforma tributária no site da Pretorian e quero falar com um especialista.');
    window.open('https://wa.me/5582900000000?text=' + msg, '_blank');
  });

  try { toggleFields(); renderYearLabel(); compute(); } catch(errInit){ console.error('Initial render failed', errInit); }
})();
