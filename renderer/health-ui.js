(function(){
    'use strict';
    const KEY='vsa-health-rules-v1';
    const money=value=>(Number(value)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const percent=value=>`${(Number(value)||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
    const date=value=>value&&value.length===8?`${value.slice(6)}/${value.slice(4,6)}/${value.slice(0,4)}`:'—';
    function readRules(){try{return HealthCore.normalizeRules(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{return HealthCore.normalizeRules();}}
    function saveRules(rules){localStorage.setItem(KEY,JSON.stringify(HealthCore.normalizeRules(rules)));}
    function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
    function renderList(id,items,value,label){const root=document.getElementById(id);if(!root)return;root.replaceChildren();if(!items.length){root.append(node('p','health-empty','Ainda não há dados suficientes.'));return;}for(const item of items){const row=node('div','health-rank-row');const left=node('div');left.append(node('strong','',label(item)),node('small','',item.category||''));row.append(left,node('span','',value(item)));root.append(row);}}
    function render(){
        const root=document.getElementById('health-center');if(!root)return;
        const report=HealthCore.build(window.dashboardState||{},readRules());window.healthReport=report;
        const status=document.getElementById('health-overview-status');
        const attention=report.levels.critical+report.levels.warning;
        status.textContent=!report.positions.length?'Aguardando carteira':attention?`${attention} ponto${attention===1?'':'s'} para acompanhar`:'Indicadores dentro das suas regras';
        status.dataset.level=report.levels.critical?'critical':report.levels.warning?'warning':report.positions.length?'ok':'info';
        document.getElementById('health-market-value').textContent=report.marketValue?money(report.marketValue):'—';
        document.getElementById('health-position-count').textContent=String(report.positions.length);
        document.getElementById('health-income-average').textContent=money(report.income.average);
        document.getElementById('health-data-date').textContent=date(report.data.latestTrade);
        const signals=document.getElementById('health-signals');signals.replaceChildren();
        for(const signal of report.signals){const card=node('article',`health-signal ${signal.level}`);card.append(node('span','health-signal-dot',''),node('div',''));card.lastChild.append(node('strong','',signal.title),node('p','',signal.detail));signals.append(card);}
        const allocation=document.getElementById('health-allocation');allocation.replaceChildren();
        for(const item of report.allocation){const row=node('div','health-allocation-row');const heading=node('div','health-allocation-heading');heading.append(node('strong','',item.name),node('span','',`${money(item.value)} · ${percent(item.weight)}`));const track=node('div','health-allocation-track');const fill=node('span');fill.style.width=`${Math.min(100,item.weight)}%`;track.append(fill);row.append(heading,track);allocation.append(row);}
        if(!report.allocation.length)allocation.append(node('p','health-empty','Importe um extrato para visualizar a alocação.'));
        renderList('health-positive',report.contributions.positive,i=>money(i.priceGain),i=>i.ticker);
        renderList('health-negative',report.contributions.negative,i=>money(i.priceGain),i=>i.ticker);
        renderList('health-income-leaders',report.income.leaders,i=>money(i.value),i=>i.ticker);
        document.getElementById('health-latest-income').textContent=date(report.data.latestIncome);
        const rules=report.rules;document.getElementById('health-max-asset').value=rules.maxAssetPercent;document.getElementById('health-max-category').value=rules.maxCategoryPercent;document.getElementById('health-income-months').value=rules.incomeMonths;
    }
    function init(){
        document.getElementById('health-save-rules')?.addEventListener('click',()=>{saveRules({maxAssetPercent:Number(document.getElementById('health-max-asset').value),maxCategoryPercent:Number(document.getElementById('health-max-category').value),incomeMonths:Number(document.getElementById('health-income-months').value)});render();});
        render();
    }
    window.HealthUI={render,readRules};
    document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
