(function(root,factory){
    const api=factory(typeof module==='object'&&module.exports?require('./goals-core'):root.GoalsCore);
    if(typeof module==='object'&&module.exports)module.exports=api;else root.AnalysisCore=api;
})(globalThis,function(Goals){
    const finite = n => Number.isFinite(n)?n:null;
    function build(state={},rent={},metas=[],year='Todos',now=new Date()){
        const income=state.yieldTransactions||[];
        const positions=[];
        for(const [category,c] of Object.entries(state.categories||{})) for(const [ticker,a] of Object.entries(c.ativos||{})) {
            if(!(a.quant>0))continue;
            const cost=finite(a.investedVal),value=a.quoteUnavailable?null:finite(a.totalVal);
            positions.push({ticker,category,quantity:a.quant,averagePrice:finite(a.avgPrice),price:a.quoteUnavailable?null:finite(a.currentPrice),cost,value,
                priceGain:value!==null&&cost!==null?value-cost:null,income:income.filter(t=>t.ticker===ticker).reduce((s,t)=>s+t.valTotal,0)});
        }
        const complete=(positions.length>0||(state.investTransactions||[]).length>0)&&positions.every(p=>p.value!==null&&p.cost!==null)&&!state.invalidHistory;
        const cost=positions.reduce((s,p)=>s+(p.cost||0),0),value=positions.reduce((s,p)=>s+(p.value||0),0);
        const received=income.reduce((s,t)=>s+t.valTotal,0);
        const selected=year==='Todos'?now.getFullYear():Number(year);
        const goals=metas.map(m=>{const r=Goals.evaluate(m,state,now,selected);return {id:m.id,title:m.title,kind:r.meta.kind,metric:r.meta.metric,year:r.year,configuredTarget:r.meta.value_target,periodTarget:r.target,current:r.value,status:r.status,monthsEquivalent:r.meta.kind==='recurring'?r.equivalent:null,method:r.note};});
        const months=Object.keys(rent.monthlyReturns||{}).sort().filter(m=>year==='Todos'||m.startsWith(String(year)));
        const compound=(data,keys)=>{let p=1;for(const m of keys){if(!Number.isFinite(data?.[m]))return null;p*=1+data[m]/100;}return keys.length?(p-1)*100:null;};
        const benchmarks={};
        for(const key of ['CDI','IPCA','IBOV']){
            const end=months.filter(m=>Number.isFinite(rent.indices?.[key]?.[m])).at(-1);
            const common=months.filter(m=>end&&m<=end);
            benchmarks[key]={from:common[0]||null,through:end||null,portfolio:state.invalidHistory?null:compound(rent.monthlyReturns,common),index:compound(rent.indices?.[key],common)};
        }
        const monthlyIncome={};for(const t of income)monthlyIncome[t.monthKey]=(monthlyIncome[t.monthKey]||0)+t.valTotal;
        return {schema:'vsa-analysis-v1',asOf:now.toLocaleDateString('sv-SE'),filter:year,
            scope:'Somente posições e movimentações importadas da B3. Exclui saldo em conta e ativos manuais.',
            limitations:['Compras podem incluir reinvestimentos; não são necessariamente dinheiro novo.','Resultado em reais combina valorização das posições com vendas e proventos do filtro; não é taxa de retorno.','Rentabilidade é Modified Dietz mensal aproximado, com proventos; o mês atual é parcial.','O primeiro mês da carteira pode ser parcial; índices usam o mês completo.','Cotações podem vir do cache; a data deste retrato não garante cotação em tempo real.','Sem pesquisa de notícias, fundamentos, cotações externas ou adequação de produtos pela IA.'],
            invalidHistory:!!state.invalidHistory,completeQuotes:complete,
            latestTrade:(state.investTransactions||[]).map(t=>t.sortDate).sort().at(-1)||null,
            latestIncome:income.map(t=>t.sortDate).sort().at(-1)||null,
            totals:{cost:state.invalidHistory?null:cost,marketValue:complete?value:null,priceGain:complete?value-cost:null,income:received,realizedGain:finite(state.realizedGain||0),combinedResult:complete?value-cost+received+(state.realizedGain||0):null},
            positions,monthlyIncome,goals,performance:{from:months[0]||null,through:months.at(-1)||null,cumulative:state.invalidHistory?null:compound(rent.monthlyReturns,months),benchmarks},
            monthly:months.slice(-36).map(m=>state.invalidHistory?{month:m,return:null}:({month:m,...(rent.audit?.[m]||{}),return:finite(rent.monthlyReturns[m])}))};
    }
    return {build};
});
