// ============================================================
// Etapa 5b — Ocorrências Disciplinares
//
// Mesma seleção escola → turma do Visto/Chamada. Guardado como
// subcoleção turmas/{turmaId}/ocorrencias/{id}. O catálogo de tipos
// é fixo (igual ao Vistos.exe) e define também a cor do selo pela
// gravidade.
// ============================================================

const painelOcorrencia = document.getElementById("painel-ocorrencia");

// "categoria" agrupa os tipos por dimensão de comportamento — é o que
// alimenta o Relatório Atitudinal (resumo por categoria, não só por
// gravidade). Pensado pra cobrir o que a coordenação costuma pedir:
// relação com o professor, com os colegas, entrega de material,
// participação e pontualidade — além das regras gerais da escola.
// Os três primeiros são os eixos principais pedidos pelo professor
// (relação professor-aluno, aluno-aluno, aluno-aula) — aparecem primeiro
// em toda listagem/relatório. Os demais continuam existindo como apoio.
const CATEGORIAS_OCORRENCIA = {
  relacao_professor: { label: "Relação professor-aluno", icone: "🧑‍🏫" },
  relacao_colegas: { label: "Relação aluno-aluno", icone: "🤝" },
  relacao_aula: { label: "Relação aluno-aula", icone: "🙋" },
  entrega_material: { label: "Entrega de material/tarefas", icone: "🎒" },
  pontualidade: { label: "Pontualidade e assiduidade", icone: "⏰" },
  regras: { label: "Regras e disciplina geral", icone: "📋" },
  geral: { label: "Comportamento geral", icone: "⭐" },
};

// Cada tipo tem uma "frase" — um pedaço de texto pronto (sem sujeito),
// pensado pra encaixar depois do nome do aluno e montar um parágrafo
// corrido automaticamente: "{Nome} " + frase1 + ", " + frase2 + " e " +
// frase3 + ". " — é o texto que vai pro comentário/PDF/relatório da
// coordenação assim que o professor toca nos botões, sem precisar digitar.
const TIPOS_OCORRENCIA = {
  // Relação professor-aluno — eixo principal 1
  desrespeito_professor: { label: "Desrespeito ao professor", icone: "🗣️", gravidade: "grave", categoria: "relacao_professor", frase: "desrespeitou o professor durante a aula" },
  discussao_professor: { label: "Discussão/atrito com o professor", icone: "💢", gravidade: "media", categoria: "relacao_professor", frase: "teve uma discussão/atrito com o professor" },
  nao_aceita_orientacao: { label: "Não aceita orientações do professor", icone: "🙅", gravidade: "media", categoria: "relacao_professor", frase: "não aceitou as orientações dadas pelo professor" },
  ignora_instrucao: { label: "Ignora instruções dadas em sala", icone: "🙉", gravidade: "leve", categoria: "relacao_professor", frase: "ignorou instruções dadas em sala" },
  debocha_professor: { label: "Deboche diante de correções/chamadas de atenção", icone: "😏", gravidade: "media", categoria: "relacao_professor", frase: "debochou diante de uma correção/chamada de atenção" },
  boa_relacao_professor: { label: "Boa relação com o professor", icone: "🙌", gravidade: "positiva", categoria: "relacao_professor", frase: "demonstrou boa relação com o professor" },
  busca_ajuda_professor: { label: "Busca ajuda do professor quando tem dúvida", icone: "🙋‍♂️", gravidade: "positiva", categoria: "relacao_professor", frase: "buscou ajuda do professor quando teve dúvida" },
  respeitoso_professor: { label: "Demonstra respeito e cordialidade", icone: "😊", gravidade: "positiva", categoria: "relacao_professor", frase: "demonstrou respeito e cordialidade com o professor" },
  receptivo_feedback: { label: "Aceita bem feedback e correções", icone: "👍", gravidade: "positiva", categoria: "relacao_professor", frase: "aceitou bem o feedback e as correções recebidas" },
  // Relação aluno-aluno — eixo principal 2
  conflito: { label: "Conflito com colega", icone: "🤝", gravidade: "media", categoria: "relacao_colegas", frase: "teve um conflito com um colega" },
  desrespeito_colega: { label: "Desrespeito a colega", icone: "😠", gravidade: "media", categoria: "relacao_colegas", frase: "desrespeitou um colega" },
  agressividade_colega: { label: "Agressividade verbal com colegas", icone: "😡", gravidade: "grave", categoria: "relacao_colegas", frase: "teve um episódio de agressividade verbal com colegas" },
  provocacao_colega: { label: "Provoca ou implica com colegas", icone: "😒", gravidade: "media", categoria: "relacao_colegas", frase: "provocou/implicou com colegas" },
  exclusao_colega: { label: "Exclui colegas de atividades em grupo", icone: "🚷", gravidade: "media", categoria: "relacao_colegas", frase: "excluiu colegas de uma atividade em grupo" },
  possivel_bullying: { label: "Possível vítima de implicância/bullying (atenção)", icone: "🆘", gravidade: "grave", categoria: "relacao_colegas", frase: "pode estar sofrendo implicância/bullying de colegas (merece atenção da coordenação)" },
  isolamento_social: { label: "Isolamento social / dificuldade de interagir", icone: "🚪", gravidade: "leve", categoria: "relacao_colegas", frase: "demonstrou isolamento social / dificuldade de interagir com colegas" },
  dificuldade_trabalho_grupo: { label: "Dificuldade de trabalhar em grupo", icone: "🧩", gravidade: "leve", categoria: "relacao_colegas", frase: "teve dificuldade de trabalhar em grupo" },
  colaboracao_colegas: { label: "Boa convivência/colaboração com colegas", icone: "🤗", gravidade: "positiva", categoria: "relacao_colegas", frase: "teve boa convivência e colaborou com os colegas" },
  ajuda_colegas: { label: "Ajuda colegas com dificuldades", icone: "💞", gravidade: "positiva", categoria: "relacao_colegas", frase: "ajudou colegas com dificuldades" },
  lideranca_positiva: { label: "Exerce liderança positiva no grupo", icone: "🌟", gravidade: "positiva", categoria: "relacao_colegas", frase: "exerceu liderança positiva no grupo" },
  // Relação aluno-aula — eixo principal 3 (comportamento/engajamento em sala)
  conversa_excessiva: { label: "Conversa excessiva durante a aula", icone: "🗯️", gravidade: "leve", categoria: "relacao_aula", frase: "conversou excessivamente durante a aula" },
  atrapalha_aula: { label: "Atrapalha o andamento da aula", icone: "🌀", gravidade: "media", categoria: "relacao_aula", frase: "atrapalhou o andamento da aula" },
  celular_aula: { label: "Uso indevido de celular em aula", icone: "📱", gravidade: "leve", categoria: "relacao_aula", frase: "usou o celular de forma indevida em aula" },
  desligado_aula: { label: "Dorme ou se desliga da aula", icone: "😴", gravidade: "leve", categoria: "relacao_aula", frase: "dormiu/se desligou durante a aula" },
  sai_sem_autorizacao: { label: "Sai de sala sem autorização", icone: "🚪", gravidade: "media", categoria: "relacao_aula", frase: "saiu de sala sem autorização" },
  recusa_atividade: { label: "Recusa-se a realizar atividades propostas", icone: "✋", gravidade: "media", categoria: "relacao_aula", frase: "recusou-se a realizar a atividade proposta" },
  participacao_ativa: { label: "Participação ativa nas aulas", icone: "🙋", gravidade: "positiva", categoria: "relacao_aula", frase: "participou ativamente da aula" },
  falta_participacao: { label: "Falta de interesse/participação", icone: "💤", gravidade: "leve", categoria: "relacao_aula", frase: "demonstrou falta de interesse/participação na aula" },
  concentracao_foco: { label: "Demonstra concentração e foco", icone: "🎯", gravidade: "positiva", categoria: "relacao_aula", frase: "demonstrou concentração e foco na aula" },
  perguntas_pertinentes: { label: "Participa com perguntas pertinentes", icone: "💡", gravidade: "positiva", categoria: "relacao_aula", frase: "participou com perguntas pertinentes" },
  // Entrega de material/tarefas
  material_incompleto: { label: "Não trouxe o material", icone: "🎒", gravidade: "leve", categoria: "entrega_material", frase: "não trouxe o material solicitado" },
  tarefa_atrasada: { label: "Tarefa entregue com atraso", icone: "⏳", gravidade: "leve", categoria: "entrega_material", frase: "entregou a tarefa com atraso" },
  tarefa_nao_entregue: { label: "Tarefa não entregue", icone: "📭", gravidade: "media", categoria: "entrega_material", frase: "não entregou a tarefa" },
  // Pontualidade e assiduidade
  atraso: { label: "Atraso", icone: "⏰", gravidade: "leve", categoria: "pontualidade", frase: "chegou atrasado(a)" },
  pontualidade_exemplar: { label: "Pontualidade exemplar", icone: "⏱️", gravidade: "positiva", categoria: "pontualidade", frase: "teve pontualidade exemplar" },
  // Regras e disciplina geral
  advertencia_verbal: { label: "Advertência verbal", icone: "🗣️", gravidade: "leve", categoria: "regras", frase: "recebeu uma advertência verbal" },
  uniforme: { label: "Uso incorreto do uniforme", icone: "👕", gravidade: "leve", categoria: "regras", frase: "fez uso incorreto do uniforme" },
  celular: { label: "Uso indevido de celular", icone: "📱", gravidade: "leve", categoria: "regras", frase: "fez uso indevido do celular" },
  indisciplina: { label: "Indisciplina em sala", icone: "⚠️", gravidade: "media", categoria: "regras", frase: "teve um episódio de indisciplina em sala" },
  advertencia_escrita: { label: "Advertência escrita", icone: "📝", gravidade: "media", categoria: "regras", frase: "recebeu uma advertência escrita" },
  suspensao: { label: "Suspensão", icone: "🚫", gravidade: "grave", categoria: "regras", frase: "foi suspenso(a)" },
  // Comportamento geral
  elogio: { label: "Elogio / comportamento exemplar", icone: "⭐", gravidade: "positiva", categoria: "geral", frase: "teve um comportamento exemplar, merecendo elogio" },
  outro: { label: "Outro", icone: "📌", gravidade: "media", categoria: "geral", frase: "apresentou uma situação atitudinal registrada à parte" },
};
function infoTipoOcorrencia(tipo) {
  return TIPOS_OCORRENCIA[tipo] || TIPOS_OCORRENCIA.outro;
}
function infoCategoriaOcorrencia(categoria) {
  return CATEGORIAS_OCORRENCIA[categoria] || CATEGORIAS_OCORRENCIA.geral;
}
// Monta as <option> do seletor de tipo agrupadas por categoria (<optgroup>)
// — com quase 20 tipos, uma lista corrida ficaria difícil de escanear.
function optionsTipoOcorrenciaAgrupadas(tipoSelecionado) {
  let html = "";
  Object.keys(CATEGORIAS_OCORRENCIA).forEach((catKey) => {
    const tiposDaCategoria = Object.keys(TIPOS_OCORRENCIA).filter((k) => TIPOS_OCORRENCIA[k].categoria === catKey);
    if (tiposDaCategoria.length === 0) return;
    html += `<optgroup label="${escaparHtml(infoCategoriaOcorrencia(catKey).label)}">`;
    tiposDaCategoria.forEach((k) => {
      html += `<option value="${k}" ${k === tipoSelecionado ? "selected" : ""}>${TIPOS_OCORRENCIA[k].icone} ${escaparHtml(TIPOS_OCORRENCIA[k].label)}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}
function seloClasseGravidade(gravidade) {
  if (gravidade === "positiva") return "sel-presente";
  if (gravidade === "leve") return "sel-leve";
  if (gravidade === "grave") return "sel-falta";
  return "sel-justificada"; // media
}

const estadoOcorrencia = {
  escola: null,
  turmaId: null,
  alunos: [],
  ocorrencias: [],
  filtroAlunoId: "",
  aba: "historico", // "historico" | "resumo" | "atitudinal"
  editandoId: null,
  observacoesAtitudinal: {}, // alunoId -> texto livre digitado antes de exportar (só na sessão, não salvo no Firestore)
};

let unsubOcorrenciaAlunos = null;
let unsubOcorrencias = null;

function initOcorrencia() {
  renderOcorrencia();
}

function turmasDaEscolaSelecionadaOcorrencia() {
  if (!estadoOcorrencia.escola) return [];
  return estadoTurmas.turmas.filter((t) => (t.escola || "") === estadoOcorrencia.escola);
}

function limparListenersOcorrencia(quais) {
  if (quais.includes("alunos") && unsubOcorrenciaAlunos) { unsubOcorrenciaAlunos(); unsubOcorrenciaAlunos = null; }
  if (quais.includes("ocorrencias") && unsubOcorrencias) { unsubOcorrencias(); unsubOcorrencias = null; }
}

function mudarEscolaOcorrencia(escola) {
  estadoOcorrencia.escola = escola || null;
  estadoOcorrencia.turmaId = null;
  estadoOcorrencia.alunos = [];
  estadoOcorrencia.ocorrencias = [];
  estadoOcorrencia.filtroAlunoId = "";
  limparListenersOcorrencia(["alunos", "ocorrencias"]);
  renderOcorrencia();
}

function mudarTurmaOcorrencia(id) {
  estadoOcorrencia.turmaId = id || null;
  estadoOcorrencia.filtroAlunoId = "";
  limparListenersOcorrencia(["alunos", "ocorrencias"]);

  if (!id) { renderOcorrencia(); return; }

  unsubOcorrenciaAlunos = db.collection("turmas").doc(id).collection("alunos").orderBy("nome").onSnapshot((snap) => {
    estadoOcorrencia.alunos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => (a.status || "ativo") === "ativo");
    renderOcorrencia();
  });

  unsubOcorrencias = db.collection("turmas").doc(id).collection("ocorrencias").onSnapshot((snap) => {
    estadoOcorrencia.ocorrencias = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    renderOcorrencia();
  });

  renderOcorrencia();
}

function trocarAbaOcorrencia(aba) {
  estadoOcorrencia.aba = aba;
  renderOcorrencia();
}

function filtrarPorAlunoOcorrencia(alunoId) {
  estadoOcorrencia.filtroAlunoId = alunoId;
  renderOcorrencia();
}

function verHistoricoDoAluno(alunoId) {
  estadoOcorrencia.filtroAlunoId = alunoId;
  estadoOcorrencia.aba = "historico";
  renderOcorrencia();
}

function verRelatorioAtitudinalDoAluno(alunoId) {
  estadoOcorrencia.filtroAlunoId = alunoId;
  estadoOcorrencia.aba = "atitudinal";
  renderOcorrencia();
}

// ---------- criar / editar ----------

function abrirNovaOcorrencia() {
  estadoOcorrencia.editandoId = null;
  const hoje = hojeLocalISO();
  const preSelecionado = estadoOcorrencia.filtroAlunoId ? [estadoOcorrencia.filtroAlunoId] : [];

  abrirModal(`
    <h3>Nova ocorrência</h3>
    <div class="campo-form">
      <label>Data</label>
      <input type="date" id="input-data-ocorrencia" value="${hoje}" />
    </div>
    <div class="campo-form">
      <label>Tipo</label>
      <select id="input-tipo-ocorrencia">
        ${optionsTipoOcorrenciaAgrupadas("indisciplina")}
      </select>
    </div>
    <div class="campo-form">
      <label>Descrição (opcional)</label>
      <textarea id="input-descricao-ocorrencia" placeholder="Detalhes do ocorrido…"></textarea>
    </div>
    <div class="campo-form">
      <label><input type="checkbox" id="input-comunicado-ocorrencia" style="width:auto; margin-right:6px;" /> Responsável já foi comunicado</label>
    </div>
    <div class="campo-form">
      <label>Alunos</label>
      <div style="display:flex; gap:8px; margin-bottom:6px;">
        <button type="button" class="btn-secundario" style="padding:4px 10px; font-size:0.8rem;" onclick="document.querySelectorAll('.chk-aluno-ocorrencia').forEach(c=>c.checked=true)">Selecionar todos</button>
        <button type="button" class="btn-secundario" style="padding:4px 10px; font-size:0.8rem;" onclick="document.querySelectorAll('.chk-aluno-ocorrencia').forEach(c=>c.checked=false)">Limpar</button>
      </div>
      <div style="max-height:200px; overflow-y:auto; border:1px solid var(--linha); border-radius:8px; padding:8px;">
        ${estadoOcorrencia.alunos.map((a) => `
          <label style="display:block; padding:4px 0;">
            <input type="checkbox" class="chk-aluno-ocorrencia" value="${a.id}" ${preSelecionado.includes(a.id) ? "checked" : ""} style="width:auto; margin-right:8px;" />
            ${escaparHtml(a.nome)}
          </label>
        `).join("") || "<p class='vazio-aviso'>Nenhum aluno ativo nesta turma.</p>"}
      </div>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarOcorrencia()">Salvar ocorrência</button>
    </div>
  `);
}

function editarOcorrencia(id) {
  const o = estadoOcorrencia.ocorrencias.find((x) => x.id === id);
  if (!o) return;
  const aluno = estadoOcorrencia.alunos.find((a) => a.id === o.alunoId);
  estadoOcorrencia.editandoId = id;

  abrirModal(`
    <h3>Editar ocorrência</h3>
    <p class="vazio-aviso" style="margin-bottom:10px;">${escaparHtml(aluno ? aluno.nome : "(aluno removido)")}</p>
    <div class="campo-form">
      <label>Data</label>
      <input type="date" id="input-data-ocorrencia" value="${o.data}" />
    </div>
    <div class="campo-form">
      <label>Tipo</label>
      <select id="input-tipo-ocorrencia">
        ${optionsTipoOcorrenciaAgrupadas(o.tipo)}
      </select>
    </div>
    <div class="campo-form">
      <label>Descrição (opcional)</label>
      <textarea id="input-descricao-ocorrencia">${escaparHtml(o.descricao || "")}</textarea>
    </div>
    <div class="campo-form">
      <label><input type="checkbox" id="input-comunicado-ocorrencia" ${o.comunicadoResponsavel ? "checked" : ""} style="width:auto; margin-right:6px;" /> Responsável já foi comunicado</label>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarOcorrencia()">Salvar alterações</button>
    </div>
  `);
}

function salvarOcorrencia() {
  const data = document.getElementById("input-data-ocorrencia").value;
  const tipo = document.getElementById("input-tipo-ocorrencia").value;
  const descricao = document.getElementById("input-descricao-ocorrencia").value.trim();
  const comunicadoResponsavel = document.getElementById("input-comunicado-ocorrencia").checked;
  if (!data) {
    alert("Escolha a data.");
    return;
  }

  const ref = db.collection("turmas").doc(estadoOcorrencia.turmaId).collection("ocorrencias");

  if (estadoOcorrencia.editandoId) {
    ref.doc(estadoOcorrencia.editandoId).update({ data, tipo, descricao, comunicadoResponsavel })
      .then(fecharModal)
      .catch((err) => alert("Erro ao salvar: " + err.message));
    return;
  }

  const idsSelecionados = Array.from(document.querySelectorAll(".chk-aluno-ocorrencia:checked")).map((c) => c.value);
  if (idsSelecionados.length === 0) {
    alert("Selecione ao menos um aluno.");
    return;
  }

  const lote = db.batch();
  idsSelecionados.forEach((alunoId) => {
    const novoDoc = ref.doc();
    lote.set(novoDoc, {
      alunoId, data, tipo, descricao, comunicadoResponsavel,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
  lote.commit().then(fecharModal).catch((err) => alert("Erro ao salvar: " + err.message));
}

// ---------- Apontamento rápido na ficha do aluno ----------
//
// Diferente de "Nova ocorrência" (que pede pra escolher alunos numa
// lista — feito pra lançar a mesma coisa pra turma toda), isso aqui é
// pensado pra ficha de UM aluno só: clica no problema, escreve o
// comentário, salva — fica gravado pra sempre em
// turmas/{turma}/ocorrencias, igual qualquer outra ocorrência, e já
// aparece na ficha e entra no relatório pra coordenação.
// Os três primeiros eixos são os principais pedidos pelo professor
// (relação professor-aluno, aluno-aluno, aluno-aula) — aparecem
// primeiro na grade de botões. Os demais continuam como apoio.
const ORDEM_EIXOS_SELECAO_ATITUDINAL = [
  "relacao_professor", "relacao_colegas", "relacao_aula",
  "entrega_material", "pontualidade", "regras", "geral",
];

// Grade de botões (em vez de um <select>) pra poder tocar em vários
// problemas/comportamentos de uma vez — cada botão tocado vira um
// apontamento salvo na ficha ao confirmar, todos com a mesma data e
// o mesmo comentário (se o professor escrever um).
function abrirApontamentoAtitudinal(alunoId, tipoPreSelecionado) {
  const aluno = estadoOcorrencia.alunos.find((a) => a.id === alunoId);
  if (!aluno) return;
  const hoje = hojeLocalISO();

  let gradeHtml = "";
  ORDEM_EIXOS_SELECAO_ATITUDINAL.forEach((catKey) => {
    const tiposDaCategoria = Object.keys(TIPOS_OCORRENCIA).filter((k) => TIPOS_OCORRENCIA[k].categoria === catKey);
    if (tiposDaCategoria.length === 0) return;
    const infoCat = infoCategoriaOcorrencia(catKey);
    gradeHtml += `<div class="campo-form"><label style="font-weight:700;">${infoCat.icone} ${escaparHtml(infoCat.label)}</label>`;
    gradeHtml += `<div class="grade-botoes-atitudinal-eixo">`;
    tiposDaCategoria.forEach((k) => {
      const t = TIPOS_OCORRENCIA[k];
      gradeHtml += `
        <button type="button" class="botao-tipo-atitudinal ${k === tipoPreSelecionado ? "ativo" : ""}" data-tipo="${k}" onclick="this.classList.toggle('ativo'); atualizarParagrafoApontamento();">
          ${t.icone} ${escaparHtml(t.label)}
        </button>
      `;
    });
    gradeHtml += `</div></div>`;
  });

  const paragrafoInicial = montarParagrafoAtitudinal(aluno.nome, tipoPreSelecionado ? [tipoPreSelecionado] : []);

  abrirModal(`
    <h3>Apontamento — ${escaparHtml(aluno.nome)}</h3>
    <input type="hidden" id="input-apontamento-aluno-id" value="${alunoId}" />
    <input type="hidden" id="input-apontamento-aluno-nome" value="${escaparHtml(aluno.nome)}" />
    <p class="vazio-aviso" style="margin-top:0;">Toque em quantos problemas/comportamentos se aplicarem — pode escolher mais de um.</p>
    ${gradeHtml}
    <div class="campo-form">
      <label>Texto gerado pro relatório (atualiza sozinho conforme você toca nos botões)</label>
      <div id="paragrafo-gerado-apontamento" class="preview-paragrafo-atitudinal">${escaparHtml(paragrafoInicial) || "Toque nos problemas/comportamentos acima pra gerar o texto automaticamente."}</div>
    </div>
    <div class="campo-form">
      <label>Comentário adicional (opcional — some depois do texto gerado)</label>
      <textarea id="input-descricao-ocorrencia" placeholder="Contexto extra, combinados feitos com o aluno…"></textarea>
    </div>
    <div class="campo-form">
      <label>Data</label>
      <input type="date" id="input-data-ocorrencia" value="${hoje}" />
    </div>
    <div class="campo-form">
      <label><input type="checkbox" id="input-comunicado-ocorrencia" style="width:auto; margin-right:6px;" /> Responsável já foi comunicado</label>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarApontamentoAtitudinal()">Salvar na ficha</button>
    </div>
  `);
}

// Monta um parágrafo corrido a partir do nome do aluno + as frases prontas
// de cada tipo marcado — é esse texto que entra no comentário salvo e,
// por tabela, no relatório/PDF enviado pra coordenação.
function montarParagrafoAtitudinal(nomeAluno, tipos) {
  if (!tipos || tipos.length === 0) return "";
  const frases = tipos.map((k) => (infoTipoOcorrencia(k)).frase || infoTipoOcorrencia(k).label.toLowerCase());
  const juncao = frases.length === 1
    ? frases[0]
    : frases.slice(0, -1).join(", ") + " e " + frases[frases.length - 1];
  return `${nomeAluno} ${juncao}.`;
}

// Atualiza a prévia do parágrafo toda vez que um botão é tocado.
function atualizarParagrafoApontamento() {
  const area = document.getElementById("paragrafo-gerado-apontamento");
  if (!area) return;
  const nomeEl = document.getElementById("input-apontamento-aluno-nome");
  const nomeAluno = nomeEl ? nomeEl.value : "";
  const marcados = Array.from(document.querySelectorAll(".botao-tipo-atitudinal.ativo")).map((el) => el.dataset.tipo);
  const paragrafo = montarParagrafoAtitudinal(nomeAluno, marcados);
  area.textContent = paragrafo || "Toque nos problemas/comportamentos acima pra gerar o texto automaticamente.";
}

function salvarApontamentoAtitudinal() {
  const alunoId = document.getElementById("input-apontamento-aluno-id").value;
  const nomeAluno = document.getElementById("input-apontamento-aluno-nome").value;
  const marcados = Array.from(document.querySelectorAll(".botao-tipo-atitudinal.ativo")).map((el) => el.dataset.tipo);
  if (marcados.length === 0) {
    alert("Toque em pelo menos um problema/comportamento.");
    return;
  }
  const data = document.getElementById("input-data-ocorrencia").value;
  const comentarioExtra = document.getElementById("input-descricao-ocorrencia").value.trim();
  const comunicadoResponsavel = document.getElementById("input-comunicado-ocorrencia").checked;
  if (!data) {
    alert("Escolha a data.");
    return;
  }

  const paragrafo = montarParagrafoAtitudinal(nomeAluno, marcados);
  const descricao = comentarioExtra ? `${paragrafo} ${comentarioExtra}` : paragrafo;

  const lote = db.batch();
  marcados.forEach((tipo) => {
    const ref = db.collection("turmas").doc(estadoOcorrencia.turmaId).collection("ocorrencias").doc();
    lote.set(ref, {
      alunoId, data, tipo, descricao, comunicadoResponsavel,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  lote.commit()
    .then(() => {
      fecharModal();
      // volta pra ficha desse aluno já com os apontamentos novos
      verRelatorioAtitudinalDoAluno(alunoId);
    })
    .catch((err) => alert("Erro ao salvar: " + err.message));
}

// ---------- Professor(a) responsável (assinatura do relatório) ----------
//
// Nome e disciplina que aparecem no bloco de assinatura do PDF. Fica
// salvo só neste aparelho (localStorage) — cada professor que usa o
// Vistos configura o seu próprio, uma vez só.
function configurarProfessorResponsavel() {
  const nome = localStorage.getItem("vistos_nome_professor") || "";
  const tipo = localStorage.getItem("vistos_tipo_professor") || "";
  abrirModal(`
    <h3>Professor(a) responsável</h3>
    <p class="vazio-aviso" style="margin-top:0;">Aparece na assinatura do relatório em PDF. Fica salvo neste aparelho.</p>
    <div class="campo-form">
      <label>Nome completo</label>
      <input type="text" id="input-nome-professor" value="${escaparHtml(nome)}" placeholder="Ex: Cesar Lopes Pereira do Amaral" />
    </div>
    <div class="campo-form">
      <label>Disciplina / tipo de professor</label>
      <input type="text" id="input-tipo-professor" value="${escaparHtml(tipo)}" placeholder="Ex: Professor de Ciências, Professor de Física…" />
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarProfessorResponsavel()">Salvar</button>
    </div>
  `);
}

function salvarProfessorResponsavel() {
  const nome = document.getElementById("input-nome-professor").value.trim();
  const tipo = document.getElementById("input-tipo-professor").value.trim();
  if (!nome) {
    alert("Informe o nome do professor.");
    return;
  }
  localStorage.setItem("vistos_nome_professor", nome);
  localStorage.setItem("vistos_tipo_professor", tipo);
  fecharModal();
  renderOcorrencia();
}

// ---------- Observação geral da ficha (persistida no próprio aluno) ----------
//
// Fica gravada em turmas/{turma}/alunos/{aluno}.notaAtitudinalGeral —
// sobrevive a recarregar a página e troca de dispositivo, igual o
// resto dos dados do Vistos. O buffer local (estadoOcorrencia.observacoesAtitudinal)
// existe só pra não perder o que o professor está digitando antes de
// clicar em salvar.
function atualizarObservacaoAtitudinal(alunoId, texto) {
  estadoOcorrencia.observacoesAtitudinal[alunoId] = texto;
}

function salvarObservacaoAtitudinalNoBanco(alunoId) {
  const texto = (estadoOcorrencia.observacoesAtitudinal[alunoId] || "").trim();
  const indicador = document.getElementById("indicador-salvo-observacao-atitudinal");
  db.collection("turmas").doc(estadoOcorrencia.turmaId).collection("alunos").doc(alunoId).update({
    notaAtitudinalGeral: texto,
    notaAtitudinalAtualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  })
    .then(() => { if (indicador) { indicador.textContent = "✓ Salvo na ficha"; indicador.style.opacity = "1"; } })
    .catch((err) => alert("Erro ao salvar observação: " + err.message));
}

function confirmarExclusaoOcorrencia(id) {
  abrirModal(`
    <h3>Excluir ocorrência</h3>
    <p>Tem certeza que deseja excluir esta ocorrência?</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirOcorrencia('${id}')">Excluir</button>
    </div>
  `);
}

function excluirOcorrencia(id) {
  db.collection("turmas").doc(estadoOcorrencia.turmaId).collection("ocorrencias").doc(id).delete()
    .then(fecharModal)
    .catch((err) => alert("Erro: " + err.message));
}

// ---------- relatório PDF ----------

function gerarRelatorioOcorrenciasPdf() {
  const ocorrencias = estadoOcorrencia.ocorrencias
    .filter((o) => !estadoOcorrencia.filtroAlunoId || o.alunoId === estadoOcorrencia.filtroAlunoId)
    .slice()
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""));

  if (ocorrencias.length === 0) {
    alert("Nenhuma ocorrência para incluir no relatório.");
    return;
  }

  const turma = estadoTurmas.turmas.find((t) => t.id === estadoOcorrencia.turmaId);
  const alunoFiltro = estadoOcorrencia.filtroAlunoId ? estadoOcorrencia.alunos.find((a) => a.id === estadoOcorrencia.filtroAlunoId) : null;
  const titulo = alunoFiltro ? `Ficha de Ocorrências — ${alunoFiltro.nome}` : `Relatório de Ocorrências — ${turma ? turma.nome : ""}`;
  const dataGeracao = new Date().toLocaleDateString("pt-BR");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 12pt; }
    h1 { text-align:center; font-size:16pt; margin-bottom:2px; }
    .escola { text-align:center; font-size:10.5pt; color:#555; font-style:italic; margin-bottom:4px; }
    .meta { text-align:center; font-size:9.5pt; color:#777; margin-bottom:18px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; }
    th, td { border:1px solid #ccc; padding:7px 10px; font-size:10pt; text-align:left; }
    th { background:#EEF2F7; font-weight:700; }
    td.center, th.center { text-align:center; }
    .assinatura { margin-top:55px; display:flex; justify-content:center; }
    .assinatura .bloco { text-align:center; width:340px; }
    .assinatura .linha { border-top:1px solid #333; margin-bottom:6px; }
    .rodape { margin-top:24px; font-size:9pt; text-align:right; color:#555; }
  </style></head><body>
    <h1>${escaparHtml(titulo)}</h1>
    ${turma && turma.escola ? `<div class="escola">${escaparHtml(turma.escola)}</div>` : ""}
    <div class="meta">${dataGeracao}</div>
    <table>
      <thead><tr>
        <th>Data</th>${alunoFiltro ? "" : "<th>Aluno</th>"}<th>Tipo</th><th>Descrição</th><th class="center">Responsável comunicado</th>
      </tr></thead>
      <tbody>
        ${ocorrencias.map((o) => {
          const aluno = estadoOcorrencia.alunos.find((a) => a.id === o.alunoId);
          const info = infoTipoOcorrencia(o.tipo);
          return `<tr>
            <td>${formatarDataBrTurmas(o.data)}</td>
            ${alunoFiltro ? "" : `<td>${escaparHtml(aluno ? aluno.nome : "-")}</td>`}
            <td>${info.icone} ${escaparHtml(info.label)}</td>
            <td>${escaparHtml(o.descricao || "-")}</td>
            <td class="center">${o.comunicadoResponsavel ? "Sim" : "Não"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="assinatura">
      <div class="bloco">
        <div class="linha"></div>
        ${(() => {
          const nomeProfessor = (localStorage.getItem("vistos_nome_professor") || "").trim();
          const tipoProfessor = (localStorage.getItem("vistos_tipo_professor") || "").trim();
          if (!nomeProfessor) return `<div>Professor(a) responsável</div>`;
          return `<div style="font-weight:700;">${escaparHtml(nomeProfessor)}</div><div style="font-size:9.5pt;">${escaparHtml(tipoProfessor || "Professor(a) responsável")}</div>`;
        })()}
      </div>
    </div>
    <div class="rodape">Relatório gerado automaticamente pelo sistema Vistos.</div>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

// ---------- renderização ----------

function renderOcorrencia() {
  let html = `<div class="selecao-visto">`;

  const escolas = [...new Set(estadoTurmas.turmas.map((t) => t.escola).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  html += `<select id="select-escola-ocorrencia" onchange="mudarEscolaOcorrencia(this.value)">
    <option value="">Selecione a escola…</option>`;
  escolas.forEach((e) => {
    html += `<option value="${escaparHtml(e)}" ${e === estadoOcorrencia.escola ? "selected" : ""}>${escaparHtml(e)}</option>`;
  });
  html += `</select>`;

  html += `<select id="select-turma-ocorrencia" onchange="mudarTurmaOcorrencia(this.value)" ${estadoOcorrencia.escola ? "" : "disabled"}>
    <option value="">Selecione a turma…</option>`;
  turmasDaEscolaSelecionadaOcorrencia().forEach((t) => {
    html += `<option value="${t.id}" ${t.id === estadoOcorrencia.turmaId ? "selected" : ""}>${escaparHtml(t.nome)}</option>`;
  });
  html += `</select>`;
  html += `</div>`;

  if (!estadoOcorrencia.turmaId) {
    html += `<p class="vazio-aviso">Selecione escola e turma para ver ou lançar ocorrências.</p>`;
    painelOcorrencia.innerHTML = html;
    return;
  }

  html += `
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="btn-secundario ${estadoOcorrencia.aba === "historico" ? "aba-ativa-tab" : ""}" onclick="trocarAbaOcorrencia('historico')">Histórico</button>
      <button class="btn-secundario ${estadoOcorrencia.aba === "resumo" ? "aba-ativa-tab" : ""}" onclick="trocarAbaOcorrencia('resumo')">Resumo por aluno</button>
      <button class="btn-secundario ${estadoOcorrencia.aba === "atitudinal" ? "aba-ativa-tab" : ""}" onclick="trocarAbaOcorrencia('atitudinal')">📄 Relatório atitudinal</button>
    </div>
  `;

  if (estadoOcorrencia.aba === "resumo") {
    html += renderResumoOcorrencias();
  } else if (estadoOcorrencia.aba === "atitudinal") {
    html += renderRelatorioAtitudinal();
  } else {
    html += renderHistoricoOcorrencias();
  }

  painelOcorrencia.innerHTML = html;
}

function renderResumoOcorrencias() {
  const linhas = estadoOcorrencia.alunos.map((al) => {
    const doAluno = estadoOcorrencia.ocorrencias.filter((o) => o.alunoId === al.id);
    const porGravidade = { leve: 0, media: 0, grave: 0, positiva: 0 };
    doAluno.forEach((o) => {
      const g = infoTipoOcorrencia(o.tipo).gravidade;
      porGravidade[g] = (porGravidade[g] || 0) + 1;
    });
    return { aluno: al, total: doAluno.length, porGravidade };
  }).sort((a, b) => b.total - a.total);

  let html = `<div class="lista-cartoes">`;
  if (linhas.length === 0) {
    html += `<p class="vazio-aviso">Nenhum aluno ativo nesta turma.</p>`;
  } else {
    linhas.forEach((l) => {
      html += `
        <div class="item-cartao" style="cursor:pointer;" onclick="verHistoricoDoAluno('${l.aluno.id}')">
          <span class="nome-item">${escaparHtml(l.aluno.nome)} <span class="subinfo-item">(${l.total || 0})</span></span>
          <span class="acoes-item">
            ${l.porGravidade.grave ? `<span class="selo-chamada sel-falta">${l.porGravidade.grave} grave(s)</span>` : ""}
            ${l.porGravidade.media ? `<span class="selo-chamada sel-justificada">${l.porGravidade.media} média(s)</span>` : ""}
            ${l.porGravidade.leve ? `<span class="selo-chamada sel-leve">${l.porGravidade.leve} leve(s)</span>` : ""}
            ${l.porGravidade.positiva ? `<span class="selo-chamada sel-presente">${l.porGravidade.positiva} elogio(s)</span>` : ""}
            <button onclick="event.stopPropagation(); verRelatorioAtitudinalDoAluno('${l.aluno.id}')" title="Relatório atitudinal">📄</button>
          </span>
        </div>
      `;
    });
  }
  html += `</div>`;
  return html;
}

function renderHistoricoOcorrencias() {
  const alunoFiltro = estadoOcorrencia.filtroAlunoId ? estadoOcorrencia.alunos.find((a) => a.id === estadoOcorrencia.filtroAlunoId) : null;
  const botaoRelatorio = alunoFiltro ? `📄 Ficha de ${escaparHtml(alunoFiltro.nome)} (PDF)` : "📄 Relatório da turma (PDF)";

  let html = `
    <div class="coluna-titulo">
      <select id="select-filtro-aluno-ocorrencia" onchange="filtrarPorAlunoOcorrencia(this.value)" style="max-width:220px;">
        <option value="">Todos os alunos</option>
        ${estadoOcorrencia.alunos.map((a) => `<option value="${a.id}" ${a.id === estadoOcorrencia.filtroAlunoId ? "selected" : ""}>${escaparHtml(a.nome)}</option>`).join("")}
      </select>
      <div style="display:flex; gap:8px;">
        <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="gerarRelatorioOcorrenciasPdf()">${botaoRelatorio}</button>
        <button class="btn-add" onclick="abrirNovaOcorrencia()">+ Nova ocorrência</button>
      </div>
    </div>
  `;

  const lista = estadoOcorrencia.ocorrencias.filter((o) => !estadoOcorrencia.filtroAlunoId || o.alunoId === estadoOcorrencia.filtroAlunoId);

  if (lista.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma ocorrência registrada.</p>`;
    return html;
  }

  html += `<div class="lista-cartoes">`;
  lista.forEach((o) => {
    const aluno = estadoOcorrencia.alunos.find((a) => a.id === o.alunoId);
    const info = infoTipoOcorrencia(o.tipo);
    html += `
      <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <span>
            <span class="nome-item">${escaparHtml(aluno ? aluno.nome : "(aluno removido)")}</span><br/>
            <span class="subinfo-item">${formatarDataBrTurmas(o.data)}</span>
          </span>
          <span class="acoes-item">
            <span class="selo-chamada ${seloClasseGravidade(info.gravidade)}">${info.icone} ${escaparHtml(info.label)}</span>
            <button onclick="editarOcorrencia('${o.id}')" title="Editar">✎</button>
            <button onclick="confirmarExclusaoOcorrencia('${o.id}')" title="Excluir">🗑</button>
          </span>
        </div>
        ${o.descricao ? `<p style="font-size:0.85rem; margin:4px 0 0;">${escaparHtml(o.descricao)}</p>` : ""}
        ${o.comunicadoResponsavel ? `<p class="subinfo-item" style="margin:2px 0 0;">✓ responsável comunicado</p>` : ""}
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

// ---------- Relatório Atitudinal ----------
//
// Diferente do histórico (que lista ocorrências soltas), esse relatório
// agrupa tudo por CATEGORIA de comportamento (relação com professor,
// colegas, entrega de material, participação, pontualidade, regras) —
// é o formato que a coordenação costuma pedir: "como está o
// comportamento desse aluno". Gera um PDF e abre o compartilhamento
// nativo do celular (WhatsApp, e-mail etc.) direto.

function ocorrenciasAtitudinaisDoAluno(alunoId) {
  // nome mantido curto de propósito — só usado internamente aqui embaixo
  return estadoOcorrencia.ocorrencias
    .filter((o) => o.alunoId === alunoId)
    .slice()
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

function resumoPorCategoriaOcorrencias(ocorrenciasDoAluno) {
  const porCategoria = {};
  Object.keys(CATEGORIAS_OCORRENCIA).forEach((cat) => {
    porCategoria[cat] = { positiva: 0, leve: 0, media: 0, grave: 0, total: 0 };
  });
  ocorrenciasDoAluno.forEach((o) => {
    const info = infoTipoOcorrencia(o.tipo);
    const cat = info.categoria || "geral";
    if (!porCategoria[cat]) porCategoria[cat] = { positiva: 0, leve: 0, media: 0, grave: 0, total: 0 };
    porCategoria[cat][info.gravidade] = (porCategoria[cat][info.gravidade] || 0) + 1;
    porCategoria[cat].total++;
  });
  return porCategoria;
}

function renderRelatorioAtitudinal() {
  if (!estadoOcorrencia.filtroAlunoId) {
    let html = `<div class="coluna-titulo"><h2 style="margin:0;">Relatório atitudinal</h2></div>`;
    if (estadoOcorrencia.alunos.length === 0) {
      html += `<p class="vazio-aviso">Nenhum aluno ativo nesta turma.</p>`;
      return html;
    }
    html += `<p class="vazio-aviso" style="margin-bottom:10px;">Escolha um aluno para ver o relatório atitudinal:</p>`;
    html += `<div class="lista-cartoes">`;
    estadoOcorrencia.alunos.forEach((a) => {
      html += `<div class="item-cartao" style="cursor:pointer;" onclick="verRelatorioAtitudinalDoAluno('${a.id}')"><span class="nome-item">${escaparHtml(a.nome)}</span></div>`;
    });
    html += `</div>`;
    return html;
  }

  const aluno = estadoOcorrencia.alunos.find((a) => a.id === estadoOcorrencia.filtroAlunoId);
  if (!aluno) {
    estadoOcorrencia.filtroAlunoId = "";
    return `<p class="vazio-aviso">Aluno não encontrado nesta turma.</p>`;
  }

  const ocorrenciasDoAluno = ocorrenciasAtitudinaisDoAluno(aluno.id);
  const porCategoria = resumoPorCategoriaOcorrencias(ocorrenciasDoAluno);
  // O buffer local só é inicializado da 1ª vez que a ficha é aberta nesta
  // sessão — depois disso, o que o professor está digitando manda, até
  // ele clicar em "Salvar" (que grava em turmas/{turma}/alunos/{aluno}).
  if (estadoOcorrencia.observacoesAtitudinal[aluno.id] === undefined) {
    estadoOcorrencia.observacoesAtitudinal[aluno.id] = aluno.notaAtitudinalGeral || "";
  }
  const observacao = estadoOcorrencia.observacoesAtitudinal[aluno.id] || "";
  const nomeProfessor = localStorage.getItem("vistos_nome_professor") || "";
  const tipoProfessor = localStorage.getItem("vistos_tipo_professor") || "";

  let html = `
    <div class="coluna-titulo">
      <select id="select-filtro-aluno-ocorrencia" onchange="verRelatorioAtitudinalDoAluno(this.value)" style="max-width:220px;">
        ${estadoOcorrencia.alunos.map((a) => `<option value="${a.id}" ${a.id === aluno.id ? "selected" : ""}>${escaparHtml(a.nome)}</option>`).join("")}
      </select>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-add" onclick="abrirApontamentoAtitudinal('${aluno.id}')">+ Apontar problema atitudinal</button>
      </div>
    </div>
    <div class="coluna-titulo" style="margin-top:-4px; flex-wrap:wrap;">
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="compartilharRelatorioAtitudinalPdf('${aluno.id}')">📄⬇️ Baixar relatório em PDF</button>
      </div>
      <span class="subinfo-item" style="display:block; margin-top:2px;">
        ✍️ ${nomeProfessor ? `${escaparHtml(nomeProfessor)}${tipoProfessor ? " — " + escaparHtml(tipoProfessor) : ""}` : "Assinatura do professor(a) não configurada ainda."}
        <a href="#" onclick="event.preventDefault(); configurarProfessorResponsavel();" style="color: var(--acento); margin-left:4px;">${nomeProfessor ? "editar" : "configurar"}</a>
      </span>
    </div>
  `;

  if (ocorrenciasDoAluno.length === 0) {
    html += `<p class="vazio-aviso">Nenhum apontamento registrado para ${escaparHtml(aluno.nome)} ainda. Clique em "+ Apontar problema atitudinal" pra começar a ficha dele.</p>`;
  } else {
    html += `<div class="lista-cartoes" style="margin-bottom:16px;">`;
    Object.keys(CATEGORIAS_OCORRENCIA).forEach((cat) => {
      const r = porCategoria[cat];
      const infoCat = infoCategoriaOcorrencia(cat);
      if (!r || r.total === 0) return;
      // tipo "representante" da categoria, pra já abrir o apontamento
      // rápido com um valor plausível pré-selecionado
      const tipoRepresentante = Object.keys(TIPOS_OCORRENCIA).find((k) => TIPOS_OCORRENCIA[k].categoria === cat);
      html += `
        <div class="item-cartao" style="cursor:pointer; flex-direction:column; align-items:stretch; gap:4px;" onclick="abrirApontamentoAtitudinal('${aluno.id}', '${tipoRepresentante}')" title="Clique pra apontar mais um problema nesta categoria">
          <span class="nome-item">${infoCat.icone} ${escaparHtml(infoCat.label)} <span class="subinfo-item">(${r.total})</span></span>
          <span class="acoes-item">
            ${r.positiva ? `<span class="selo-chamada sel-presente">${r.positiva} positiva(s)</span>` : ""}
            ${r.grave ? `<span class="selo-chamada sel-falta">${r.grave} grave(s)</span>` : ""}
            ${r.media ? `<span class="selo-chamada sel-justificada">${r.media} média(s)</span>` : ""}
            ${r.leve ? `<span class="selo-chamada sel-leve">${r.leve} leve(s)</span>` : ""}
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `
    <div class="campo-form">
      <label>Observações gerais da ficha (fica salva, entra no PDF)</label>
      <textarea id="input-observacao-atitudinal" placeholder="Qualquer contexto extra que ajude a coordenação a entender o comportamento do aluno…" oninput="atualizarObservacaoAtitudinal('${aluno.id}', this.value)">${escaparHtml(observacao)}</textarea>
      <div style="display:flex; align-items:center; gap:10px; margin-top:6px;">
        <button class="btn-secundario" style="padding:5px 12px; font-size:0.82rem;" onclick="salvarObservacaoAtitudinalNoBanco('${aluno.id}')">💾 Salvar observação na ficha</button>
        <span id="indicador-salvo-observacao-atitudinal" class="subinfo-item" style="opacity:0; transition: opacity 0.3s;">✓ Salvo na ficha</span>
      </div>
    </div>
  `;

  if (ocorrenciasDoAluno.length > 0) {
    html += `<h3 style="margin-top:18px;">Histórico detalhado (todos os apontamentos)</h3>`;
    html += `<div class="lista-cartoes">`;
    ocorrenciasDoAluno.slice().reverse().forEach((o) => {
      const info = infoTipoOcorrencia(o.tipo);
      html += `
        <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <span class="subinfo-item">${formatarDataBrTurmas(o.data)}</span>
            <span class="acoes-item">
              <span class="selo-chamada ${seloClasseGravidade(info.gravidade)}">${info.icone} ${escaparHtml(info.label)}</span>
              <button onclick="editarOcorrencia('${o.id}')" title="Editar">✎</button>
              <button onclick="confirmarExclusaoOcorrencia('${o.id}')" title="Excluir">🗑</button>
            </span>
          </div>
          ${o.descricao ? `<p style="font-size:0.85rem; margin:0;">${escaparHtml(o.descricao)}</p>` : ""}
        </div>
      `;
    });
    html += `</div>`;
  }

  return html;
}

// Gera o PDF com jsPDF + AutoTable (carregados via CDN em index.html) e
// tenta abrir o compartilhamento nativo do celular; se o navegador não
// suportar compartilhar arquivo (ex: desktop), cai pro download normal.
async function compartilharRelatorioAtitudinalPdf(alunoId) {
  const aluno = estadoOcorrencia.alunos.find((a) => a.id === alunoId);
  if (!aluno) return;
  if (typeof window.jspdf === "undefined") {
    alert("Não foi possível carregar o gerador de PDF. Verifique sua conexão com a internet e tente de novo.");
    return;
  }

  const turma = estadoTurmas.turmas.find((t) => t.id === estadoOcorrencia.turmaId);
  const ocorrenciasDoAluno = ocorrenciasAtitudinaisDoAluno(aluno.id);
  // Prioriza o que está salvo na ficha (Firestore); só cai pro buffer
  // local se o professor digitou algo e ainda não clicou em "Salvar".
  const observacao = (aluno.notaAtitudinalGeral || estadoOcorrencia.observacoesAtitudinal[aluno.id] || "").trim();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Layout seguindo as normas ABNT: margens 3cm (esquerda/topo) e 2cm
  // (direita/base), fonte Arial (Helvetica — o equivalente padrão
  // embutido no gerador de PDF), corpo de texto justificado com
  // espaçamento 1,5 entre linhas, e tudo em preto.
  const margemEsq = 30;
  const margemDir = 20;
  const margemTopo = 30;
  const margemBase = 20;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const larguraUtil = larguraPagina - margemEsq - margemDir;
  const centro = larguraPagina / 2;
  let y = margemTopo;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  function novaPaginaSeNecessario(alturaNecessaria) {
    if (y + alturaNecessaria > alturaPagina - margemBase) {
      doc.addPage();
      y = margemTopo;
    }
  }

  function escreverTitulo(texto) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(texto.toUpperCase(), centro, y, { align: "center" });
    y += 3;
    doc.setLineWidth(0.6);
    doc.line(margemEsq, y, larguraPagina - margemDir, y);
    y += 1.3;
    doc.setLineWidth(0.2);
    doc.line(margemEsq, y, larguraPagina - margemDir, y);
    y += 10;
  }

  function escreverSecao(texto) {
    novaPaginaSeNecessario(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(texto.toUpperCase(), margemEsq, y);
    y += 2;
    doc.setLineWidth(0.2);
    doc.line(margemEsq, y, larguraPagina - margemDir, y);
    y += 7;
  }

  // Formata uma data (ISO ou Date) por extenso, ex: "24 de outubro de 2026"
  function formatarDataPorExtenso(data) {
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const d = data instanceof Date ? data : new Date(data);
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // Escreve "Rótulo: " em negrito seguido do valor em texto normal, na
  // mesma linha — dá um acabamento mais formal que a linha toda normal.
  function escreverCampoRotulado(rotulo, valor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(rotulo, margemEsq, y);
    const larguraRotulo = doc.getTextWidth(rotulo);
    doc.setFont("helvetica", "normal");
    doc.text(valor, margemEsq + larguraRotulo, y);
    y += 6.5;
  }

  // Parágrafo corrido justificado, com espaçamento 1,5 entre linhas
  // (regra ABNT pro corpo do texto).
  function escreverParagrafoJustificado(texto, tamanho) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tamanho || 12);
    const linhas = doc.splitTextToSize(texto, larguraUtil);
    const alturaLinha = (tamanho || 12) * 0.53; // ~1,5 de espaçamento em mm
    novaPaginaSeNecessario(linhas.length * alturaLinha);
    doc.text(linhas, margemEsq, y, { align: "justify", maxWidth: larguraUtil });
    y += linhas.length * alturaLinha + 5;
  }

  // Cabeçalho institucional
  if (turma && turma.escola) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(turma.escola.toUpperCase(), centro, y, { align: "center" });
    y += 7;
  }
  escreverTitulo("Relatório Atitudinal do Aluno");

  escreverCampoRotulado("Aluno(a): ", aluno.nome);
  if (turma) escreverCampoRotulado("Turma: ", turma.nome);
  escreverCampoRotulado("Data de emissão: ", formatarDataPorExtenso(new Date()));
  y += 4;

  // Parágrafo de abertura — enquadramento institucional do relatório,
  // antes de entrar no histórico propriamente dito.
  escreverParagrafoJustificado(
    `O presente relatório tem como finalidade registrar, de forma objetiva, o acompanhamento atitudinal do(a) aluno(a) ${aluno.nome} ao longo do período letivo, com base nos apontamentos realizados em sala de aula.`,
    12
  );

  // Histórico de ocorrências — um parágrafo por DATA (não por categoria
  // nem por nível de gravidade), agrupando no mesmo parágrafo todos os
  // apontamentos daquele dia, sem repetir a data a cada item.
  escreverSecao("1. Histórico de ocorrências");

  if (ocorrenciasDoAluno.length === 0) {
    escreverParagrafoJustificado("Nenhuma ocorrência atitudinal foi registrada no período considerado.", 12);
  } else {
    const porData = new Map();
    ocorrenciasDoAluno.forEach((o) => {
      if (!porData.has(o.data)) porData.set(o.data, []);
      porData.get(o.data).push(o);
    });
    const datasOrdenadas = Array.from(porData.keys()).sort();

    datasOrdenadas.forEach((data) => {
      const dataFmt = formatarDataBrTurmas(data);
      const fragmentos = [];
      const comentariosExtras = [];

      porData.get(data).forEach((o) => {
        const info = infoTipoOcorrencia(o.tipo);
        const descricao = (o.descricao || "").trim();
        // Quando o apontamento já foi salvo como frase pronta (gerada pelos
        // botões de seleção múltipla), a descrição já começa com o nome do
        // aluno — aproveita só a parte depois do nome pra juntar com os
        // outros apontamentos do mesmo dia, em vez de repetir tudo.
        const jaEhFraseProntaComNome = descricao.toLowerCase().startsWith(aluno.nome.toLowerCase());
        if (jaEhFraseProntaComNome) {
          const resto = descricao.slice(aluno.nome.length).trim().replace(/\.$/, "");
          if (resto) fragmentos.push(resto);
        } else {
          fragmentos.push(info.frase || info.label.toLowerCase());
          if (descricao) comentariosExtras.push(descricao);
        }
      });

      if (fragmentos.length === 0) return;
      const juncao = fragmentos.length === 1
        ? fragmentos[0]
        : fragmentos.slice(0, -1).join(", ") + " e " + fragmentos[fragmentos.length - 1];
      let paragrafo = `Em ${dataFmt}, ${aluno.nome} ${juncao}.`;
      if (comentariosExtras.length) paragrafo += " " + comentariosExtras.join(" ");
      escreverParagrafoJustificado(paragrafo, 11.5);
    });
  }

  // Consideração (observações/avaliação geral do professor)
  if (observacao) {
    escreverSecao("2. Consideração");
    escreverParagrafoJustificado(observacao, 12);
  }

  // Frase de encerramento formal, antes da assinatura
  const nomeProfessor = (localStorage.getItem("vistos_nome_professor") || "").trim();
  const tipoProfessor = (localStorage.getItem("vistos_tipo_professor") || "").trim();
  novaPaginaSeNecessario(nomeProfessor ? 32 : 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Por ser expressão da verdade, firmo o presente relatório.", centro, y, { align: "center" });
  y += 10;

  // Bloco de assinatura
  doc.setLineWidth(0.3);
  doc.line(centro - 40, y, centro + 40, y);
  y += 5;
  if (nomeProfessor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(nomeProfessor, centro, y, { align: "center" });
    y += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(tipoProfessor || "Professor(a) responsável", centro, y, { align: "center" });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Professor(a) responsável", centro, y, { align: "center" });
  }

  // Numeração de página + rodapé de marca em todas as páginas
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(`Página ${p} de ${totalPaginas}`, larguraPagina - margemDir, 15, { align: "right" });
    doc.setFontSize(8);
    doc.text("Desenvolvido por Cesar Amaral", centro, alturaPagina - 10, { align: "center" });
  }

  const nomeArquivo = `relatorio-atitudinal-${aluno.nome.replace(/[^a-zA-Z0-9À-ÖØ-öø-ÿ -]/g, "").trim() || "aluno"}.pdf`;
  const blobPdf = doc.output("blob");

  // Sempre baixa o arquivo direto — o professor decide depois, por fora
  // do app, pra quem vai mandar (WhatsApp, e-mail etc.).
  const url = URL.createObjectURL(blobPdf);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
