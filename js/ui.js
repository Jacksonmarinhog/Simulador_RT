/*
 * Camada de apresentação. Não calcula nada.
 *
 * Este arquivo existe para que js/app.js — que contém as regras fiscais da
 * LC 214/2025 — permaneça intocado. Tudo aqui é acessibilidade e navegação:
 * nenhuma alíquota, fórmula ou decisão de regime é lida, copiada ou reescrita.
 *
 *  1. Linha do tempo dos anos: descobre o intervalo perguntando ao próprio
 *     app.js (caminha pelos botões ‹ › que já existem) e depois aciona esses
 *     mesmos botões. A máquina de estado do ano continua sendo a do app.js.
 *  2. aria-pressed nos toggles, espelhando a classe .active que o app.js define.
 */
(function(){
  'use strict';

  /* ---------- 1. Linha do tempo dos anos ---------- */
  function setupYears(){
    var prev = document.getElementById('yearPrev');
    var next = document.getElementById('yearNext');
    var label = document.getElementById('yearLabel');
    var rail = document.getElementById('yearTimeline');
    var caption = document.getElementById('yearCaption');
    if(!prev || !next || !label || !rail) return;

    function currentYear(){
      var n = parseInt(String(label.textContent).replace(/\D.*$/, ''), 10);
      return isNaN(n) ? null : n;
    }
    function note(){
      var s = label.querySelector('small');
      return s ? s.textContent : '';
    }

    // Descobre o intervalo caminhando com os próprios controles do app.js,
    // em vez de repetir a lista de anos aqui (que sairia de sincronia).
    var start = currentYear();
    if(start === null) return;

    var guard = 0;
    while(!prev.disabled && guard++ < 40) prev.click();
    var years = [currentYear()];
    guard = 0;
    while(!next.disabled && guard++ < 40){ next.click(); years.push(currentYear()); }
    guard = 0;
    while(currentYear() > start && !prev.disabled && guard++ < 40) prev.click();

    rail.textContent = '';
    years.forEach(function(y){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = y;
      b.setAttribute('aria-pressed', String(y === start));
      b.addEventListener('click', function(){
        var delta = y - currentYear();
        var btn = delta > 0 ? next : prev;
        var n = Math.abs(delta), i = 0;
        while(i++ < n && !btn.disabled) btn.click();
      });
      rail.appendChild(b);
    });

    function sync(){
      var y = currentYear();
      Array.prototype.forEach.call(rail.children, function(b){
        b.setAttribute('aria-pressed', String(parseInt(b.textContent, 10) === y));
      });
      if(caption){
        caption.textContent = '';
        var strong = document.createElement('b');
        strong.textContent = y;
        caption.appendChild(strong);
        caption.appendChild(document.createTextNode(' · ' + note()));
      }
    }
    sync();
    new MutationObserver(sync).observe(label, {childList:true, subtree:true, characterData:true});
  }

  /* ---------- 2. aria-pressed nos toggles ---------- */
  function setupToggles(){
    var groups = ['#tipoToggle', '#regimeToggle', '#regimeIbsToggle', '#simplesModeToggle'];
    groups.forEach(function(sel){
      var wrap = document.querySelector(sel);
      if(!wrap) return;
      var btns = wrap.querySelectorAll('button');
      function sync(){
        Array.prototype.forEach.call(btns, function(b){
          b.setAttribute('aria-pressed', String(b.classList.contains('active')));
        });
      }
      sync();
      Array.prototype.forEach.call(btns, function(b){
        new MutationObserver(sync).observe(b, {attributes:true, attributeFilter:['class']});
      });
    });
  }

  try { setupYears(); } catch(e){ console.error('ui: linha do tempo falhou', e); }
  try { setupToggles(); } catch(e){ console.error('ui: toggles falharam', e); }
})();
