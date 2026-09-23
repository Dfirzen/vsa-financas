(function(root,factory){
    const api=factory();
    if(typeof module==='object'&&module.exports)module.exports=api;else root.HealthCore=api;
})(globalThis,function(){
    'use strict';
    const finite=n=>Number.isFinite(n)?n:null;
    const round=(n,d=2)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
    const monthLabel=key=>key&&key.length===6?`${key.slice(4)}/${key.slice(0,4)}`:'—';
    function normalizeRules(input={}){
        const asset=Number(input.maxAssetPercent),category=Number(input.maxCategoryPercent),months=Number(input.incomeMonths);
        return {
            maxAssetPercent:Number.isFinite(asset)&&asset>=5&&asset<=100?asset:25,
            maxCategoryPercent:Number.isFinite(category)&&category>=10&&category<=100?category:80,
            incomeMonths:Number.isInteger(months)&&months>=1&&months<=12?months:3
        };
    }
    function priorMonths(now,count){
        const out=[];
        for(let i=count;i>=1;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`);}
        return out;
    }
    function build(state={},rulesInput={},now=new Date()){
        const rules=normalizeRules(rulesInput),positions=[];
        for(const [category,c] of Object.entries(state.categories||{})) for(const [ticker,a] of Object.entries(c.ativos||{})){
            if(!(a.quant>0))continue;
            const cost=finite(a.investedVal),value=a.quoteUnavailable?null:finite(a.totalVal);
            positions.push({ticker,category,quantity:a.quant,cost,value,priceGain:value!==null&&cost!==null?value-cost:null,quoteUnavailable:!!a.quoteUnavailable});
        }
        const valued=positions.filter(p=>p.value!==null&&p.value>=0),marketValue=valued.reduce((s,p)=>s+p.value,0);
        valued.forEach(p=>p.weight=marketValue>0?p.value/marketValue*100:0);
        const categories={};for(const p of valued)categories[p.category]=(categories[p.category]||0)+p.value;
        const allocation=Object.entries(categories).map(([name,value])=>({name,value,weight:marketValue>0?value/marketValue*100:0})).sort((a,b)=>b.value-a.value);
        const ranked=[...valued].sort((a,b)=>b.value-a.value),largestAsset=ranked[0]||null,largestCategory=allocation[0]||null;
        const yields=state.allYields||state.yieldTransactions||[],monthlyIncome={};
        for(const t of yields){if(t.monthKey&&Number.isFinite(t.valTotal))monthlyIncome[t.monthKey]=(monthlyIncome[t.monthKey]||0)+t.valTotal;}
        const incomeKeys=priorMonths(now,rules.incomeMonths),incomeValues=incomeKeys.map(month=>({month,value:monthlyIncome[month]||0}));
        const incomeTotal=incomeValues.reduce((s,m)=>s+m.value,0),incomeAverage=incomeTotal/rules.incomeMonths;
        const byTicker={};for(const t of yields){if(!t.ticker||!Number.isFinite(t.valTotal))continue;byTicker[t.ticker]=(byTicker[t.ticker]||0)+t.valTotal;}
        const incomeLeaders=Object.entries(byTicker).map(([ticker,value])=>({ticker,value})).sort((a,b)=>b.value-a.value).slice(0,5);
        const contributions=positions.filter(p=>p.priceGain!==null).sort((a,b)=>b.priceGain-a.priceGain);
        const quoteIssues=positions.filter(p=>p.quoteUnavailable).map(p=>p.ticker);
        const quoteStatuses=state.quoteStatuses||{};
        const staleQuotes=positions.filter(p=>quoteStatuses[p.ticker]?.stale||quoteStatuses[p.ticker]?.refreshFailed).map(p=>p.ticker);
        const signals=[];
        if(!positions.length)signals.push({id:'data',level:'info',title:'Importe sua carteira',detail:'A Central de Saúde será preenchida depois da leitura do extrato B3.'});
        else if(state.invalidHistory)signals.push({id:'data',level:'critical',title:'Histórico requer conferência',detail:'Há eventos inválidos ou arquivos que não puderam ser lidos. Rentabilidade e custos podem ficar incompletos.'});
        else if(quoteIssues.length)signals.push({id:'data',level:'warning',title:`${quoteIssues.length} cotação(ões) indisponível(is)`,detail:`Sem valor de mercado confiável para ${quoteIssues.join(', ')}.`});
        else if(staleQuotes.length)signals.push({id:'data',level:'warning',title:`${staleQuotes.length} cotação(ões) precisam de atualização`,detail:`Última atualização falhou ou está vencida para ${staleQuotes.join(', ')}.`});
        else signals.push({id:'data',level:'ok',title:'Dados conciliados',detail:'Histórico reconhecido e posições atuais com cotação disponível.'});
        if(largestAsset)signals.push({id:'asset',level:largestAsset.weight>rules.maxAssetPercent?'warning':'ok',title:`Maior posição: ${largestAsset.ticker}`,detail:`${round(largestAsset.weight)}% da carteira; seu limite pessoal é ${rules.maxAssetPercent}%.`});
        if(largestCategory)signals.push({id:'category',level:largestCategory.weight>rules.maxCategoryPercent?'warning':'ok',title:`Maior classe: ${largestCategory.name}`,detail:`${round(largestCategory.weight)}% da carteira; seu limite pessoal é ${rules.maxCategoryPercent}%.`});
        signals.push({id:'income',level:incomeTotal>0?'ok':'info',title:incomeTotal>0?`Renda média: ${round(incomeAverage)}`:'Sem proventos na janela recente',detail:`Média dos ${rules.incomeMonths} últimos meses completos (${incomeKeys.map(monthLabel).join(', ')}).`});
        const levels={critical:0,warning:0,ok:0,info:0};signals.forEach(s=>levels[s.level]++);
        const latestTrade=(state.investTransactions||[]).map(t=>t.sortDate).filter(Boolean).sort().at(-1)||null;
        const latestIncome=yields.map(t=>t.sortDate).filter(Boolean).sort().at(-1)||null;
        return {schema:'vsa-health-v1',rules,positions:ranked,marketValue,allocation,largestAsset,largestCategory,signals,levels,
            data:{invalidHistory:!!state.invalidHistory,quoteIssues,staleQuotes,latestTrade,latestIncome},
            income:{months:incomeValues,total:incomeTotal,average:incomeAverage,leaders:incomeLeaders},
            contributions:{positive:contributions.filter(p=>p.priceGain>0).slice(0,5),negative:contributions.filter(p=>p.priceGain<0).reverse().slice(0,5)}};
    }
    return {build,normalizeRules};
});
