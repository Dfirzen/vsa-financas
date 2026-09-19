window.AnalysisUI = (()=>{
    let getSnapshot, openChat, latest=null, busy=false, refreshId=0;
    const el=id=>document.getElementById(id);
    const money=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Indisponível';
    const safe=s=>DOMPurify.sanitize(marked.parse(s||''),{FORBID_TAGS:['img','style','iframe'],FORBID_ATTR:['style']});
    const topics={overview:'Panorama da carteira',performance:'Entender meu resultado',income:'Minha renda de proventos',goals:'Meu progresso nas metas'};
    function showReport(){
        if(!latest)return;
        el('ai-analysis-content').innerHTML=safe(latest.analysis);
        el('analysis-report-title').textContent=topics[latest.topic]||topics.overview;
        el('analysis-report-date').textContent=`Gerada em ${new Date(latest.createdAt).toLocaleString('pt-BR')} · filtro: ${latest.snapshot.filter}. Retrato dos dados naquele momento.`;
    }
    async function refresh(){
        if(!getSnapshot)return;
        const id=++refreshId;
        try{
            const snapshot=await getSnapshot();if(id!==refreshId)return;
            for(const [key,value] of [['cost',snapshot.totals.cost],['value',snapshot.totals.marketValue],['income',snapshot.totals.income]])el('analysis-'+key).textContent=money(value);
            const date=snapshot.latestTrade;el('analysis-data-date').textContent=date?`Última compra/venda importada: ${date.slice(6)}/${date.slice(4,6)}/${date.slice(0,4)}. Filtro: ${snapshot.filter}.`:'Importe um extrato B3 para analisar sua carteira.';
            el('analysis-stale').textContent=latest&&JSON.stringify(latest.snapshot)!==JSON.stringify(snapshot)?'Os dados ou o filtro mudaram desde esta análise. Gere novamente para usar o retrato atual.':'';
        }catch(e){el('analysis-status').textContent='Não foi possível carregar os dados da análise.';}
    }
    async function generate(topic){
        if(busy)return;busy=true;
        const buttons=Array.from(document.querySelectorAll('[data-analysis-topic]'));buttons.forEach(b=>b.disabled=true);
        el('analysis-status').textContent='Preparando o retrato da carteira…';
        try{
            const snapshot=await getSnapshot();
            if(!snapshot.positions.length&&!snapshot.monthly.length)throw Error('Importe suas movimentações B3 antes de gerar uma análise.');
            el('analysis-status').textContent='A Kaguya está analisando seus dados…';
            const data=await window.api.aiAnalyze({snapshot,analysisType:topic});
            if(data.error)throw Error(data.error);
            if(typeof data.analysis!=='string'||!data.analysis.trim())throw Error('A IA não retornou uma análise. Tente novamente.');
            latest={analysis:data.analysis,topic,snapshot,createdAt:new Date().toISOString()};showReport();
            try{localStorage.setItem('vsa-analysis-v1',JSON.stringify(latest));}catch(_){/* The current result remains visible if local storage is full. */}
            el('analysis-status').textContent='Análise concluída.';await refresh();
        }catch(e){el('analysis-status').textContent=e.message;}
        finally{busy=false;buttons.forEach(b=>b.disabled=false);}
    }
    function init(snapshotProvider,chat){
        getSnapshot=snapshotProvider;openChat=chat;
        const banner=el('ai-setup-banner');
        el('analise').replaceChildren();if(banner)el('analise').append(banner);
        const content=document.createElement('div');content.innerHTML=`<div class="goals-hero"><div><span class="goals-eyebrow">KAGUYA · SUA CARTEIRA EM CONTEXTO</span><h2>Entenda o que seus números dizem</h2><p>Resultados, renda e metas explicados a partir do seu extrato.</p></div><img src="assets/kaguya/kaguya_curiosa_avatar.png" alt="Kaguya" width="86" height="86" style="border-radius:50%;object-fit:cover;"></div>
            <p class="goal-context" id="analysis-data-date"></p><div class="analysis-summary"><div><small>Custo das posições</small><strong id="analysis-cost">—</strong></div><div><small>Valor de mercado</small><strong id="analysis-value">—</strong></div><div><small>Proventos no filtro</small><strong id="analysis-income">—</strong></div></div>
            <p class="goal-note">O resumo considera ativos importados da B3, sem saldo em conta ou cadastros manuais. Ao pedir uma análise, o app envia esse retrato e suas metas ao provedor de IA configurado. Requer internet e usa sua API.</p>
            <div class="analysis-questions">${Object.entries(topics).map(([key,title])=>`<button class="goal-card" data-analysis-topic="${key}"><strong>${title}</strong><span>${{overview:'Como estão patrimônio, renda e objetivos?',performance:'O que explica ganhos e perdas?',income:'Quanto recebi e como minha renda evoluiu?',goals:'Estou avançando no meu plano?'}[key]}</span></button>`).join('')}</div>
            <div class="analysis-toolbar"><button class="btn-outline btn-sm" id="analysis-chat">Conversar com a Kaguya</button><span id="analysis-status" role="status" aria-live="polite"></span></div>
            <article class="goal-card analysis-report"><h3 id="analysis-report-title">Sua análise</h3><p class="goal-note" id="analysis-report-date"></p><p class="goal-note" id="analysis-stale"></p><div class="formatted-ai-content" id="ai-analysis-content"><p>Escolha uma pergunta acima. A Kaguya vai explicar os dados calculados pelo aplicativo, indicando o período e o que ainda não é possível concluir.</p></div></article>`;
        el('analise').append(content);
        content.addEventListener('click',e=>{const button=e.target.closest('[data-analysis-topic]');if(button)generate(button.dataset.analysisTopic);});
        el('analysis-chat').onclick=()=>openChat();
        window.api.aiStatus().then(status=>{if(banner)banner.classList.toggle('hidden',status.configured);}).catch(()=>{});
        try{const saved=JSON.parse(localStorage.getItem('vsa-analysis-v1'));if(saved?.snapshot?.schema==='vsa-analysis-v1'&&typeof saved.analysis==='string'&&saved.createdAt){latest=saved;showReport();}}catch(_){}
        refresh();
    }
    function lastReport(){return latest?{topic:latest.topic,text:latest.analysis,createdAt:latest.createdAt,filter:latest.snapshot.filter}:null;}
    return {init,refresh,lastReport};
})();
