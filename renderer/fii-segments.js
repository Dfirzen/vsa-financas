(function(root,factory){
    const api=factory();
    if(typeof module==='object'&&module.exports)module.exports=api;else root.FiiSegments=api;
})(globalThis,function(){
    'use strict';
    // Classificação ampla usada apenas para organizar a carteira. O usuário pode
    // substituir qualquer ticker por meio de appConfig.fii_segment_overrides.
    const PAPER=new Set(['KNCR11','KNSC11','MXRF11','CPTS11','IRDM11','RECR11','VGIR11','RBRR11','CVBI11','HGCR11','MCCI11','XPCI11']);
    const FOF=new Set(['BCFF11','KFOF11','RFOF11','HFOF11','MGFF11','OUFF11','RBFF11']);
    const HYBRID=new Set(['HGLG11','KNRI11','JSRE11','RBRP11','ALZR11']);
    const DEVELOPMENT=new Set(['TGAR11','GARE11','GAME11']);
    const BRICK=new Set(['BTLG11','HGRE11','HGRU11','TRXF11','VISC11','XPML11','HGBS11','HSML11','MALL11','PVBI11','VILG11','XPLG11','BRCO11','LVBI11','GGRC11','RECT11','RBRL11']);
    const order=['Tijolo','Papel e recebíveis','Fundo de fundos','Híbrido','Desenvolvimento','Não classificado'];
    const icons={'Tijolo':'🏢','Papel e recebíveis':'📄','Fundo de fundos':'🧺','Híbrido':'🔀','Desenvolvimento':'🏗️','Não classificado':'❔'};
    function baseTicker(ticker){return String(ticker||'').toUpperCase().trim().replace(/(?:12|13)$/,'11');}
    function classify(ticker,overrides={}){
        const raw=String(ticker||'').toUpperCase().trim(),base=baseTicker(raw);
        if(overrides&&typeof overrides[raw]==='string'&&overrides[raw].trim())return overrides[raw].trim();
        if(overrides&&typeof overrides[base]==='string'&&overrides[base].trim())return overrides[base].trim();
        if(PAPER.has(base))return 'Papel e recebíveis';if(FOF.has(base))return 'Fundo de fundos';if(HYBRID.has(base))return 'Híbrido';if(DEVELOPMENT.has(base))return 'Desenvolvimento';if(BRICK.has(base))return 'Tijolo';return 'Não classificado';
    }
    function group(fiiCategory={},overrides={}){
        const groups={};
        const ensure=name=>groups[name]||(groups[name]={total:0,investedTotal:0,ativos:{},specialAtivos:{}});
        for(const [ticker,asset] of Object.entries(fiiCategory.ativos||{})){if(!(asset.quant>0||asset.totalVal>0))continue;const g=ensure(classify(ticker,overrides));g.ativos[ticker]=asset;g.total+=Number(asset.totalVal)||0;g.investedTotal+=Number(asset.investedVal)||0;}
        for(const [ticker,asset] of Object.entries(fiiCategory.specialAtivos||{})){if(!(asset.quant>0))continue;ensure(classify(ticker,overrides)).specialAtivos[ticker]=asset;}
        const names=Object.keys(groups).sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'pt-BR');});
        const categories=Object.fromEntries(names.map(name=>[name,groups[name]]));
        return {categories,total:Object.values(categories).reduce((sum,g)=>sum+g.total,0)};
    }
    return {classify,group,icons};
});
