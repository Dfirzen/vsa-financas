(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GoalsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const definitions = {
        aporte_mensal: ['recurring','purchases'], aporte_anual: ['annual','purchases'],
        renda_mensal: ['milestone','income'], patrimonio: ['milestone','wealth']
    };
    function normalize(meta, year = new Date().getFullYear()) {
        const [kind, metric] = definitions[meta.id] || ['milestone','manual'];
        return {...meta, kind: meta.kind || kind, metric: meta.metric || metric,
            year: Number(meta.year) || year, start_month: Number(meta.start_month) || 1};
    }
    function validate(data) {
        if (data.kind !== undefined && !['recurring','annual','milestone'].includes(data.kind)) throw Error('Tipo de meta inválido.');
        if (data.metric !== undefined && !['purchases','income','wealth','manual'].includes(data.metric)) throw Error('Indicador inválido.');
        if (data.kind && data.metric && data.kind !== 'milestone' && !['purchases','manual'].includes(data.metric)) throw Error('Use um marco de longo prazo para patrimônio ou renda.');
        for (const [key,min,max] of [['year',2000,2100],['start_month',1,12]]) {
            if (data[key] !== undefined && (!Number.isInteger(Number(data[key])) || Number(data[key]) < min || Number(data[key]) > max)) throw Error('Período inválido.');
        }
    }
    function evaluate(raw, state = {}, now = new Date(), selectedYear = now.getFullYear()) {
        const meta = normalize(raw, now.getFullYear());
        const year = meta.kind === 'annual' ? meta.year : Number(selectedYear);
        const elapsed = year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth()+1 : 0;
        const txs = state.investTransactions || [];
        const purchases = Array.from({length:12}, (_,i) => txs.filter(t => t.type === 'buy' && t.monthKey === `${year}${String(i+1).padStart(2,'0')}` && i < elapsed).reduce((s,t)=>s+t.value,0));
        const active = Math.max(0, elapsed - meta.start_month + 1);
        const total = purchases.slice(meta.start_month-1,elapsed).reduce((s,n)=>s+n,0);
        let value = Number(meta.value_current) || 0;
        let note = 'Progresso informado por você.';
        if (meta.metric === 'purchases') { value = total; note = 'Compras importadas; podem incluir reinvestimentos. Não representam necessariamente dinheiro novo.'; }
        if (meta.metric === 'wealth') {
            value = Object.values(state.categories || {}).reduce((s,c)=>s+(c.total||0),0);
            note = 'Valor de mercado das posições importadas no filtro global. Não inclui saldo em conta nem cadastros manuais.';
        }
        if (meta.metric === 'income') {
            const end = year < now.getFullYear() ? new Date(year,11,1) : new Date(now.getFullYear(),now.getMonth()-1,1);
            const all = state.allYields || state.yieldTransactions || [];
            const first = [...txs,...all].map(t=>t.monthKey).sort()[0];
            const months = Array.from({length:3},(_,i)=>{const d=new Date(end.getFullYear(),end.getMonth()-2+i,1);return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;}).filter(m=>first && m>=first);
            value = months.length ? all.filter(t=>months.includes(t.monthKey)).reduce((s,t)=>s+t.valTotal,0)/months.length : 0;
            note = months.length ? `Média de ${months.length} meses completos (${months[0].slice(4)}/${months[0].slice(0,4)} a ${months.at(-1).slice(4)}/${months.at(-1).slice(0,4)}), incluindo meses sem recebimentos. Não é previsão.` : 'Aguardando o primeiro mês completo de histórico.';
        }
        const target = meta.value_target * (meta.kind === 'recurring' ? active : 1);
        const reached = target > 0 && value >= target;
        return {meta,year,elapsed,active,purchases,total,value,target,note,reached,
            percent: target > 0 ? value/target*100 : 0,
            equivalent: meta.value_target > 0 ? value/meta.value_target : 0,
            status: meta.kind === 'recurring' ? (!active ? 'Ainda não iniciou' : reached ? 'Em dia no acumulado' : 'Em construção') : reached ? 'Objetivo atingido' : 'Em construção'};
    }
    return {normalize,validate,evaluate};
});
