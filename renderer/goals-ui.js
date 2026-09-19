window.GoalsUI = (() => {
    let metas = [], changed = () => {};
    const el = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const groups = [['recurring','01','Meus compromissos','Um ritmo para continuar. Valores extras contam para o acumulado, sem encerrar o compromisso.'],['annual','02','Objetivos do ano','Cada objetivo tem seu próprio ano e valor. Atingir o alvo não muda seu compromisso mensal.'],['milestone','03','Marcos de longo prazo','Seu próximo patamar, sem uma data obrigatória para chegar.']];
    function refresh() {
        if (!el('goals-groups')) return;
        const state = window.dashboardState || {};
        const selected = window.globalYear && window.globalYear !== 'Todos' ? +window.globalYear : new Date().getFullYear();
        const results = metas.map(m => GoalsCore.evaluate(m,state,new Date(),selected));
        changed(results.map(r=>({...r.meta,value_current:r.value,status:r.meta.kind==='recurring'?'in_progress':r.reached?'completed':'in_progress'})));
        el('goals-context').textContent = `Compromissos: ${selected}. Patrimônio acompanha o filtro global; marcos de renda usam meses completos. Compras seguem as datas do extrato, que pode levar alguns dias para registrar operações novas.`;
        el('goals-groups').innerHTML = groups.map(([kind,num,title,description]) => `<section class="goal-section"><header><span class="goal-section-number">${num}</span><div><h3>${title}</h3><p>${description}</p></div></header><div class="goal-grid">${results.filter(r=>r.meta.kind===kind).map(card).join('') || '<p class="goal-empty">Nenhuma meta neste grupo. Use “Nova meta” para começar.</p>'}</div></section>`).join('');
    }
    function card(r) {
        const m = r.meta;
        if (m.kind === 'annual' && window.globalYear !== 'Todos' && Number(window.globalYear) < m.year) return `<article class="goal-card annual"><h4>${esc(m.title)} · ${m.year}</h4><p class="goal-note">Selecione “Todos os anos” no filtro global para carregar as compras deste objetivo.</p><button class="goal-action" data-goal-edit="${esc(m.id)}">Editar</button><button class="goal-action" data-goal-delete="${esc(m.id)}">Excluir</button></article>`;
        const recurring = m.kind === 'recurring';
        const detail = recurring ? `<div class="goal-stats"><div><small>Planejado até agora</small><strong>${money(r.target)}</strong></div><div><small>Equivalência do acumulado</small><strong>${r.equivalent.toFixed(1)} meses</strong></div><div><small>${r.value >= r.target ? 'Acima do planejado' : 'Falta para o planejado'}</small><strong>${money(Math.abs(r.value-r.target))}</strong></div></div><p class="goal-note">Referência de ${money(m.value_target)}/mês desde o mês ${m.start_month}. A equivalência não é saldo disponível nem garantia de aportes futuros.</p>` : `<div class="goal-stats"><div><small>Objetivo</small><strong>${money(m.value_target)}</strong></div><div><small>Faltam</small><strong>${money(Math.max(0,r.target-r.value))}</strong></div></div>`;
        const calendar = recurring && m.metric === 'purchases' ? `<details class="goal-history"><summary>Ver compras mês a mês · ${r.year}</summary><div class="goal-months">${r.purchases.map((n,i)=>`<div class="${i>=r.elapsed || i+1<m.start_month ? 'future' : n>=m.value_target ? 'met' : ''}"><small>${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}</small><strong>${i>=r.elapsed ? '—' : money(n)}</strong><span>${i>=r.elapsed ? 'Ainda não chegou' : i+1<m.start_month ? 'Antes do início' : n>=m.value_target ? 'Meta do mês atingida' : n ? 'Compras registradas' : 'Sem compras no extrato'}</span></div>`).join('')}</div></details>` : '';
        return `<article class="goal-card ${m.kind}" data-meta-id="${esc(m.id)}"><div class="goal-card-top"><span class="goal-status ${r.reached?'reached':''}">${esc(r.status)}${m.kind==='annual'?' · '+r.year:''}</span><div><button class="goal-action" data-goal-edit="${esc(m.id)}" aria-label="Editar ${esc(m.title)}">Editar</button><button class="goal-action" data-goal-delete="${esc(m.id)}" aria-label="Excluir ${esc(m.title)}">Excluir</button></div></div><h4>${esc(m.title)}</h4><div class="goal-amount">${money(r.value)}</div><p class="goal-caption">${recurring ? 'Acumulado no período do compromisso' : m.metric==='income' ? 'Renda mensal média recebida' : m.metric==='wealth' ? 'Patrimônio importado' : 'Progresso do objetivo'}</p><div class="goal-track" role="progressbar" aria-label="Progresso de ${esc(m.title)}" aria-valuenow="${Math.round(Math.min(100,r.percent))}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0,Math.min(100,r.percent))}%"></span></div>${detail}<p class="goal-note">${esc(r.note)}</p>${calendar}</article>`;
    }
    async function load() {
        try { metas = (await window.api.getMetas()).map(m=>GoalsCore.normalize(m)); refresh(); }
        catch(e) { el('goals-context').textContent='Não foi possível carregar as metas: '+e.message; }
    }
    function editorFields() {
        const kind = el('edit-meta-kind').value;
        for (const option of el('edit-meta-metric').options) option.disabled = kind!=='milestone' && ['income','wealth'].includes(option.value);
        if (el('edit-meta-metric').selectedOptions[0].disabled) el('edit-meta-metric').value='purchases';
        el('goal-year-field').hidden = kind!=='annual';
        el('goal-start-field').hidden = kind!=='recurring';
        el('goal-current-field').hidden = el('edit-meta-metric').value!=='manual';
        el('goal-editor-hint').textContent = kind==='recurring' ? 'O valor objetivo é mensal. O compromisso permanece ativo mesmo quando você está adiantado. Alterar esse valor recalcula o período exibido.' : kind==='annual' ? 'O valor objetivo vale para o ano inteiro e é independente do compromisso mensal.' : 'Sem prazo obrigatório. Renda usa até três meses completos; patrimônio usa posições importadas.';
    }
    function edit(id) {
        const m = metas.find(m=>m.id===id) || GoalsCore.normalize({id:'',title:'',kind:'recurring',metric:'purchases',value_target:500,value_current:0});
        el('modal-title').textContent = id ? 'Editar meta' : 'Nova meta';
        for (const [field,value] of Object.entries({id:m.id,name:m.title,target:m.value_target,kind:m.kind,metric:m.metric,year:m.year,start:m.start_month,current:m.value_current || 0})) el('edit-meta-'+field).value=value;
        el('goal-editor-error').textContent=''; editorFields(); el('meta-modal').classList.remove('hidden'); el('edit-meta-name').focus();
    }
    async function remove(id) {
        if (!confirm('Excluir esta meta? Seus investimentos e extratos serão preservados.')) return;
        try { await window.api.deleteMeta(id); await load(); } catch(e) { el('goals-context').textContent=e.message; }
    }
    function init(onChange) {
        changed=onChange;
        el('metas').innerHTML = `<div class="goals-hero"><div><span class="goals-eyebrow">SEU PLANO, NO SEU RITMO</span><h2>Construindo o seu futuro</h2><p>Reconheça o que já fez. Escolha o próximo passo.</p></div><button class="btn-primary" id="btn-create-meta">+ Nova meta</button></div><p id="goals-context" class="goal-context" role="status"></p><div id="goals-groups"></div>`;
        el('btn-create-meta').onclick=()=>edit();
        el('goals-groups').addEventListener('click',event=>{
            const editButton=event.target.closest('[data-goal-edit]'); const deleteButton=event.target.closest('[data-goal-delete]');
            if(editButton) edit(editButton.dataset.goalEdit); if(deleteButton) remove(deleteButton.dataset.goalDelete);
        });
        el('edit-meta-kind').onchange=editorFields; el('edit-meta-metric').onchange=editorFields;
        el('btn-cancel-meta').onclick=()=>el('meta-modal').classList.add('hidden');
        el('btn-save-meta').onclick=async()=>{
            const button=el('btn-save-meta');
            const data={title:el('edit-meta-name').value.trim(),value_target:Number(el('edit-meta-target').value),kind:el('edit-meta-kind').value,metric:el('edit-meta-metric').value,year:Number(el('edit-meta-year').value),start_month:Number(el('edit-meta-start').value)};
            if(data.metric==='manual') data.value_current=Number(el('edit-meta-current').value);
            try {
                if(!data.title || !(data.value_target>0)) throw Error('Informe um título e um objetivo maior que zero.');
                GoalsCore.validate(data); button.disabled=true; button.textContent='Salvando…';
                const id=el('edit-meta-id').value;
                if(id) await window.api.updateMeta(id,data); else await window.api.createMeta(data);
                await load(); el('meta-modal').classList.add('hidden');
            } catch(e) { el('goal-editor-error').textContent=e.message; }
            finally {button.disabled=false;button.textContent='Salvar';}
        };
        window.editMeta=edit; window.deleteMeta=remove;
        return load();
    }
    return {init,load,refresh};
})();
