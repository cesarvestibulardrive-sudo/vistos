// ============================================================
// Etapa 5c — Seminário / Atividade em Grupo
//
// Mesma seleção escola → turma → disciplina do Visto. Cada atividade
// em grupo é um documento independente por turma (os grupos e
// avaliações não são compartilhados entre turmas — só a definição
// pode ser "duplicada" para servir de ponto de partida em outra
// turma com a mesma disciplina, igual ao Vistos.exe).
// ============================================================

const painelSeminario = document.getElementById("painel-seminario");

const TIPOS_ATIVIDADE_GRUPO = {
  seminario: { label: "Seminário", icone: "🎤", rotuloData: "Data de apresentação", descricao: "Apresentação oral de um tema pesquisado pelo grupo, com tempo cronometrado e critérios de avaliação." },
  laboratorio: { label: "Laboratório/Relatório", icone: "🧪", rotuloData: "Data da aula prática", descricao: "Atividade prática (experimento) seguida da entrega de um relatório técnico escrito." },
  projeto: { label: "Projeto/Pesquisa", icone: "📚", rotuloData: "Data de entrega", descricao: "Investigação aprofundada sobre um tema, entregue como texto, banner ou outro produto final." },
  debate: { label: "Debate", icone: "🗣️", rotuloData: "Data do debate", descricao: "Grupos defendem posições opostas sobre um tema, com direito a réplica e tréplica." },
  feira: { label: "Feira de Ciências/Exposição", icone: "🔬", rotuloData: "Data da exposição", descricao: "Apresentação de um projeto ou protótipo em estande, para visitação de colegas, professores ou público." },
  estudoCaso: { label: "Estudo de Caso", icone: "📊", rotuloData: "Data de apresentação", descricao: "Análise em grupo de uma situação-problema real ou hipotética, com discussão e proposta de solução." },
  teatro: { label: "Peça Teatral/Dramatização", icone: "🎭", rotuloData: "Data da apresentação", descricao: "Encenação de uma cena ou história relacionada ao conteúdo estudado." },
  maquete: { label: "Maquete/Protótipo", icone: "🏗️", rotuloData: "Data de entrega", descricao: "Construção de um modelo físico ou protótipo que represente um conceito estudado." },
  oficina: { label: "Oficina/Workshop", icone: "🛠️", rotuloData: "Data da oficina", descricao: "Atividade prática colaborativa conduzida pelo próprio grupo para ensinar algo aos colegas." },
  olimpiada: { label: "Olimpíada Científica", icone: "🏆", rotuloData: "Data da prova", descricao: "Preparação de equipe para participar de olimpíadas científicas (Matemática, Física, Química, Astronomia, Robótica, etc.)." },
};
function infoTipoAtividadeGrupo(tipo) {
  return TIPOS_ATIVIDADE_GRUPO[tipo] || TIPOS_ATIVIDADE_GRUPO.seminario;
}

const estadoSeminario = {
  escola: null,
  turmaId: null,
  disciplinas: [],
  disciplinaId: null,
  alunos: [],
  atividades: [],
  atividadeAtualId: null,
  abaDetalhe: "grupos", // grupos | criterios | avaliacao
};

let unsubSeminarioDisciplinas = null;
let unsubSeminarioAlunos = null;
let unsubSeminarioAtividades = null;

// ---- cronômetro (estado local, só persiste quando confirmado) ----
let timerSeg = 0, timerInterval = null, timerRodando = false;
let grupoIdParaTimer = null, criterioIdParaTimer = null;

function initSeminario() {
  renderSeminario();
}

function turmasDaEscolaSelecionadaSeminario() {
  if (!estadoSeminario.escola) return [];
  return estadoTurmas.turmas.filter((t) => (t.escola || "") === estadoSeminario.escola);
}

function limparListenersSeminario(quais) {
  if (quais.includes("disciplinas") && unsubSeminarioDisciplinas) { unsubSeminarioDisciplinas(); unsubSeminarioDisciplinas = null; }
  if (quais.includes("alunos") && unsubSeminarioAlunos) { unsubSeminarioAlunos(); unsubSeminarioAlunos = null; }
  if (quais.includes("atividades") && unsubSeminarioAtividades) { unsubSeminarioAtividades(); unsubSeminarioAtividades = null; }
}

function mudarEscolaSeminario(escola) {
  estadoSeminario.escola = escola || null;
  estadoSeminario.turmaId = null;
  estadoSeminario.disciplinas = [];
  estadoSeminario.disciplinaId = null;
  estadoSeminario.atividades = [];
  estadoSeminario.atividadeAtualId = null;
  limparListenersSeminario(["disciplinas", "alunos", "atividades"]);
  renderSeminario();
}

function mudarTurmaSeminario(id) {
  estadoSeminario.turmaId = id || null;
  estadoSeminario.disciplinas = [];
  estadoSeminario.disciplinaId = null;
  estadoSeminario.atividades = [];
  estadoSeminario.atividadeAtualId = null;
  limparListenersSeminario(["disciplinas", "alunos", "atividades"]);

  if (!id) { renderSeminario(); return; }

  unsubSeminarioDisciplinas = db.collection("turmas").doc(id).collection("disciplinas").orderBy("nome").onSnapshot((snap) => {
    estadoSeminario.disciplinas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSeminario();
  });

  unsubSeminarioAlunos = db.collection("turmas").doc(id).collection("alunos").orderBy("nome").onSnapshot((snap) => {
    estadoSeminario.alunos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => (a.status || "ativo") === "ativo");
    renderSeminario();
  });

  renderSeminario();
}

function mudarDisciplinaSeminario(id) {
  estadoSeminario.disciplinaId = id || null;
  estadoSeminario.atividadeAtualId = null;
  limparListenersSeminario(["atividades"]);

  if (!id) { renderSeminario(); return; }

  const disciplina = estadoSeminario.disciplinas.find((d) => d.id === id);

  unsubSeminarioAtividades = db.collection("atividadesSeminario")
    .where("turmaId", "==", estadoSeminario.turmaId)
    .onSnapshot((snap) => {
      estadoSeminario.atividades = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => normalizarNome(a.disciplinaNome) === normalizarNome(disciplina.nome))
        .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      renderSeminario();
    });

  renderSeminario();
}

function atividadeAtualSeminario() {
  return estadoSeminario.atividades.find((a) => a.id === estadoSeminario.atividadeAtualId);
}

function abrirAtividadeSeminario(id) {
  estadoSeminario.atividadeAtualId = id;
  estadoSeminario.abaDetalhe = "grupos";
  renderSeminario();
}
function voltarListaSeminario() {
  estadoSeminario.atividadeAtualId = null;
  renderSeminario();
}
function trocarAbaSeminario(aba) {
  estadoSeminario.abaDetalhe = aba;
  renderSeminario();
}

// ---------- CRUD de atividade ----------

function abrirNovaAtividadeSeminario() {
  abrirModal(`
    <h3>Nova atividade em grupo</h3>
    <div class="campo-form">
      <label>Tipo</label>
      <select id="input-tipo-ativ-seminario" onchange="atualizarInfoTipoSeminario()">
        ${Object.keys(TIPOS_ATIVIDADE_GRUPO).map((k) => `<option value="${k}" ${k === "seminario" ? "selected" : ""}>${TIPOS_ATIVIDADE_GRUPO[k].icone} ${TIPOS_ATIVIDADE_GRUPO[k].label}</option>`).join("")}
      </select>
      <p id="descricao-tipo-seminario" class="vazio-aviso" style="padding:6px 0 0;"></p>
    </div>
    <div class="campo-form">
      <label>Nome da atividade</label>
      <input type="text" id="input-nome-ativ-seminario" placeholder="Ex: Seminário - Tabela Periódica" />
    </div>
    <div class="campo-form">
      <label>Descrição (opcional)</label>
      <textarea id="input-descricao-ativ-seminario"></textarea>
    </div>
    <div class="campo-form">
      <label id="label-data-ativ-seminario">Data de apresentação</label>
      <input type="date" id="input-data-apresentacao-seminario" />
    </div>
    <div class="campo-form">
      <label>Entrega do relatório (opcional)</label>
      <input type="date" id="input-data-relatorio-seminario" />
    </div>
    <div class="campo-form">
      <label>Materiais necessários (opcional)</label>
      <textarea id="input-materiais-seminario" placeholder="Ex: cartolina, data show, apostila..."></textarea>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarAtividadeSeminario()">Criar atividade</button>
    </div>
  `);
  atualizarInfoTipoSeminario();
  document.getElementById("input-nome-ativ-seminario").focus();
}

function atualizarInfoTipoSeminario() {
  const tipo = document.getElementById("input-tipo-ativ-seminario").value;
  const info = infoTipoAtividadeGrupo(tipo);
  document.getElementById("descricao-tipo-seminario").textContent = info.descricao;
  document.getElementById("label-data-ativ-seminario").textContent = info.rotuloData;
}

function salvarAtividadeSeminario() {
  const tipoAtividade = document.getElementById("input-tipo-ativ-seminario").value;
  const nome = document.getElementById("input-nome-ativ-seminario").value.trim();
  const descricao = document.getElementById("input-descricao-ativ-seminario").value.trim();
  const dataApresentacao = document.getElementById("input-data-apresentacao-seminario").value || null;
  const dataEntregaRelatorio = document.getElementById("input-data-relatorio-seminario").value || null;
  const materiaisNecessarios = document.getElementById("input-materiais-seminario").value.trim();
  if (!nome) {
    alert("Informe o nome da atividade.");
    return;
  }
  const disciplina = estadoSeminario.disciplinas.find((d) => d.id === estadoSeminario.disciplinaId);

  db.collection("atividadesSeminario").add({
    turmaId: estadoSeminario.turmaId,
    disciplinaNome: disciplina.nome,
    tipoAtividade, nome, descricao, dataApresentacao, dataEntregaRelatorio, materiaisNecessarios,
    grupos: [], criterios: [], avaliacoes: {},
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  }).then((ref) => {
    fecharModal();
    abrirAtividadeSeminario(ref.id);
  }).catch((err) => alert("Erro ao criar: " + err.message));
}

function confirmarExclusaoAtividadeSeminario(id) {
  abrirModal(`
    <h3>Excluir atividade</h3>
    <p>Tem certeza que deseja excluir esta atividade em grupo? Grupos e avaliações lançados serão perdidos.</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirAtividadeSeminario('${id}')">Excluir</button>
    </div>
  `);
}
function excluirAtividadeSeminario(id) {
  db.collection("atividadesSeminario").doc(id).delete()
    .then(() => { fecharModal(); if (estadoSeminario.atividadeAtualId === id) estadoSeminario.atividadeAtualId = null; })
    .catch((err) => alert("Erro: " + err.message));
}

// ---------- duplicar para outras turmas ----------

async function abrirDuplicarAtividadeSeminario() {
  const ativ = atividadeAtualSeminario();
  abrirModal(`
    <h3>Duplicar para outras turmas</h3>
    <p class="vazio-aviso">Cria uma cópia da definição (nome, critérios, datas) em outra turma que também tenha a disciplina "${escaparHtml(ativ.disciplinaNome)}" — grupos e avaliações começam vazios lá.</p>
    <div id="lista-outras-turmas-seminario" class="campo-form">Buscando turmas...</div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="confirmarDuplicarAtividadeSeminario()">Duplicar</button>
    </div>
  `);

  try {
    const snap = await db.collectionGroup("disciplinas")
      .where("escolaNormalizado", "==", normalizarNome(estadoSeminario.escola))
      .where("nomeNormalizado", "==", normalizarNome(ativ.disciplinaNome))
      .get();
    const turmaIds = [...new Set(snap.docs.map((d) => d.data().turmaId).filter((tid) => tid && tid !== estadoSeminario.turmaId))];
    const container = document.getElementById("lista-outras-turmas-seminario");
    if (!container) return;
    if (turmaIds.length === 0) {
      container.innerHTML = `<p class="vazio-aviso">Nenhuma outra turma com esta disciplina.</p>`;
      return;
    }
    container.innerHTML = turmaIds.map((tid) => {
      const turma = estadoTurmas.turmas.find((t) => t.id === tid);
      return `<label style="display:flex; align-items:center; gap:6px; margin-bottom:6px; font-weight:400;">
        <input type="checkbox" value="${tid}" class="check-outra-turma-seminario" /> ${escaparHtml(turma ? turma.nome : "(turma não encontrada)")}
      </label>`;
    }).join("");
  } catch (err) {
    const container = document.getElementById("lista-outras-turmas-seminario");
    if (container) container.innerHTML = `<p class="vazio-aviso">Não foi possível buscar outras turmas (${escaparHtml(err.message)}).</p>`;
  }
}

function confirmarDuplicarAtividadeSeminario() {
  const ativ = atividadeAtualSeminario();
  const idsSelecionados = Array.from(document.querySelectorAll(".check-outra-turma-seminario:checked")).map((c) => c.value);
  if (idsSelecionados.length === 0) {
    alert("Selecione ao menos uma turma.");
    return;
  }
  const lote = db.batch();
  idsSelecionados.forEach((tid) => {
    const novoRef = db.collection("atividadesSeminario").doc();
    const criteriosCopiados = (ativ.criterios || []).map((c) => ({ ...c, id: gerarIdLocal() }));
    lote.set(novoRef, {
      turmaId: tid,
      disciplinaNome: ativ.disciplinaNome,
      tipoAtividade: ativ.tipoAtividade,
      nome: ativ.nome,
      descricao: ativ.descricao || "",
      dataApresentacao: ativ.dataApresentacao || null,
      dataEntregaRelatorio: ativ.dataEntregaRelatorio || null,
      materiaisNecessarios: ativ.materiaisNecessarios || "",
      grupos: [], criterios: criteriosCopiados, avaliacoes: {},
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
  lote.commit().then(() => {
    fecharModal();
    alert(`Atividade duplicada para ${idsSelecionados.length} turma(s).`);
  }).catch((err) => alert("Erro ao duplicar: " + err.message));
}

function gerarIdLocal() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- grupos ----------

function alunosAlocadosSeminario(ativ) {
  const set = new Set();
  (ativ.grupos || []).forEach((g) => g.alunosIds.forEach((id) => set.add(id)));
  return set;
}

function salvarCampoAtividadeSeminario(campo, valor) {
  db.collection("atividadesSeminario").doc(estadoSeminario.atividadeAtualId).update({ [campo]: valor })
    .catch((err) => alert("Erro: " + err.message));
}

function sortearGruposSeminario() {
  const ativ = atividadeAtualSeminario();
  const n = Math.max(2, Math.min(15, Number(prompt("Em quantos grupos dividir?", "4")) || 4));
  if ((ativ.grupos || []).some((g) => g.alunosIds.length) && !confirm("Isso vai reorganizar todos os alunos em novos grupos, apagando a divisão atual. Continuar?")) return;

  const embaralhados = estadoSeminario.alunos.slice().sort(() => Math.random() - 0.5);
  const novosGrupos = Array.from({ length: n }, (_, i) => ({ id: gerarIdLocal(), nome: `Grupo ${i + 1}`, alunosIds: [] }));
  embaralhados.forEach((al, i) => novosGrupos[i % n].alunosIds.push(al.id));
  salvarCampoAtividadeSeminario("grupos", novosGrupos);
}

function adicionarGrupoVazioSeminario() {
  const ativ = atividadeAtualSeminario();
  const grupos = (ativ.grupos || []).concat([{ id: gerarIdLocal(), nome: `Grupo ${(ativ.grupos || []).length + 1}`, alunosIds: [] }]);
  salvarCampoAtividadeSeminario("grupos", grupos);
}

function renomearGrupoSeminario(gid, nome) {
  const ativ = atividadeAtualSeminario();
  const grupos = ativ.grupos.map((g) => (g.id === gid ? { ...g, nome: nome || g.nome } : g));
  salvarCampoAtividadeSeminario("grupos", grupos);
}
function excluirGrupoSeminario(gid) {
  const ativ = atividadeAtualSeminario();
  const grupos = ativ.grupos.filter((g) => g.id !== gid);
  const avaliacoes = { ...ativ.avaliacoes };
  delete avaliacoes[gid];
  db.collection("atividadesSeminario").doc(ativ.id).update({ grupos, avaliacoes })
    .catch((err) => alert("Erro: " + err.message));
}
function removerDoGrupoSeminario(gid, alunoId) {
  const ativ = atividadeAtualSeminario();
  const grupos = ativ.grupos.map((g) => (g.id === gid ? { ...g, alunosIds: g.alunosIds.filter((id) => id !== alunoId) } : g));
  salvarCampoAtividadeSeminario("grupos", grupos);
}
function adicionarAoGrupoSeminario(gid) {
  const sel = document.getElementById("sel-grupo-" + gid);
  const alunoId = sel.value;
  if (!alunoId) return;
  const ativ = atividadeAtualSeminario();
  const grupos = ativ.grupos.map((g) => (g.id === gid ? { ...g, alunosIds: [...g.alunosIds, alunoId] } : g));
  salvarCampoAtividadeSeminario("grupos", grupos);
}

// ---------- critérios ----------

function adicionarCriterioSeminario() {
  const ativ = atividadeAtualSeminario();
  const criterios = (ativ.criterios || []).concat([{ id: gerarIdLocal(), nome: "Novo critério", tipo: "percentual" }]);
  salvarCampoAtividadeSeminario("criterios", criterios);
}
function editarCriterioSeminario(cid, campo, valor) {
  const ativ = atividadeAtualSeminario();
  const criterios = ativ.criterios.map((c) => (c.id === cid ? { ...c, [campo]: valor } : c));
  salvarCampoAtividadeSeminario("criterios", criterios);
}
function excluirCriterioSeminario(cid) {
  const ativ = atividadeAtualSeminario();
  const criterios = ativ.criterios.filter((c) => c.id !== cid);
  salvarCampoAtividadeSeminario("criterios", criterios);
}

// ---------- avaliação ----------

function calcularMediaGrupoSeminario(ativ, gid) {
  const av = (ativ.avaliacoes || {})[gid] || {};
  const criterios = ativ.criterios || [];
  if (!criterios.length) return 0;
  const notas = criterios.map((c) => {
    const v = av[c.id];
    if (v == null) return 0;
    if (c.tipo === "tempo") return v.nota != null ? v.nota : 0;
    return v;
  });
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

function avaliarPercentualSeminario(gid, cid, valor) {
  const ativ = atividadeAtualSeminario();
  const avaliacoes = JSON.parse(JSON.stringify(ativ.avaliacoes || {}));
  if (!avaliacoes[gid]) avaliacoes[gid] = {};
  if (avaliacoes[gid][cid] === valor) delete avaliacoes[gid][cid];
  else avaliacoes[gid][cid] = valor;
  salvarCampoAtividadeSeminario("avaliacoes", avaliacoes);
}

function calcularNotaTempoSeminario(segundos, criterio) {
  const min = criterio.tempoMin, max = criterio.tempoMax, desconto = criterio.descontoPercentual || 0;
  if (min == null || max == null) return 100;
  if (segundos >= min && segundos <= max) return 100;
  return Math.max(0, 100 - desconto);
}

// ---------- cronômetro ----------

function abrirCronometroSeminario(gid, cid) {
  grupoIdParaTimer = gid;
  criterioIdParaTimer = cid;
  const ativ = atividadeAtualSeminario();
  const c = ativ.criterios.find((x) => x.id === cid);
  const existente = (ativ.avaliacoes[gid] || {})[cid];
  timerSeg = 0;
  timerRodando = false;
  clearInterval(timerInterval);

  abrirModal(`
    <h3>Cronômetro — ${escaparHtml(c.nome)}</h3>
    <p class="vazio-aviso">Faixa ideal: ${c.tempoMin ?? "?"}s a ${c.tempoMax ?? "?"}s. Fora da faixa, desconto de ${c.descontoPercentual ?? 0}% na nota.</p>
    ${existente && existente.tempoSegundos != null ? `<p class="vazio-aviso">Tempo já registrado: ${existente.tempoSegundos}s (nota ${existente.nota}%).</p>` : ""}
    <div style="text-align:center; font-size:2.4rem; font-family:'Fraunces',serif; margin:14px 0;" id="timer-display-seminario">00:00</div>
    <div style="display:flex; gap:8px; justify-content:center; margin-bottom:14px;">
      <button class="btn-secundario" onclick="iniciarTimerSeminario()">▶ Iniciar</button>
      <button class="btn-secundario" onclick="pausarTimerSeminario()">⏸ Pausar</button>
      <button class="btn-secundario" onclick="zerarTimerSeminario()">⟲ Zerar</button>
    </div>
    <div class="campo-form">
      <label>Tempo (segundos) — pode ajustar manualmente</label>
      <input type="number" id="input-tempo-manual-seminario" value="${existente ? existente.tempoSegundos : ""}" />
    </div>
    <div class="acoes-modal">
      ${existente ? `<button class="btn-secundario" style="color:var(--erro);" onclick="removerAvaliacaoTempoSeminario()">Remover avaliação</button>` : ""}
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="confirmarTimerSeminario()">Confirmar</button>
    </div>
  `);
}
function atualizarDisplayTimerSeminario() {
  const el = document.getElementById("timer-display-seminario");
  if (!el) return;
  const m = Math.floor(timerSeg / 60).toString().padStart(2, "0");
  const s = (timerSeg % 60).toString().padStart(2, "0");
  el.textContent = `${m}:${s}`;
}
function iniciarTimerSeminario() {
  if (timerRodando) return;
  timerRodando = true;
  timerInterval = setInterval(() => {
    timerSeg++;
    atualizarDisplayTimerSeminario();
    const campo = document.getElementById("input-tempo-manual-seminario");
    if (campo) campo.value = timerSeg;
  }, 1000);
}
function pausarTimerSeminario() { timerRodando = false; clearInterval(timerInterval); }
function zerarTimerSeminario() {
  pausarTimerSeminario();
  timerSeg = 0;
  atualizarDisplayTimerSeminario();
  const campo = document.getElementById("input-tempo-manual-seminario");
  if (campo) campo.value = "";
}
function confirmarTimerSeminario() {
  pausarTimerSeminario();
  const manual = document.getElementById("input-tempo-manual-seminario").value;
  const tempoSegundos = manual !== "" ? Number(manual) : timerSeg;
  const ativ = atividadeAtualSeminario();
  const c = ativ.criterios.find((x) => x.id === criterioIdParaTimer);
  const nota = calcularNotaTempoSeminario(tempoSegundos, c);
  const avaliacoes = JSON.parse(JSON.stringify(ativ.avaliacoes || {}));
  if (!avaliacoes[grupoIdParaTimer]) avaliacoes[grupoIdParaTimer] = {};
  avaliacoes[grupoIdParaTimer][criterioIdParaTimer] = { tempoSegundos, nota };
  salvarCampoAtividadeSeminario("avaliacoes", avaliacoes);
  fecharModal();
}
function removerAvaliacaoTempoSeminario() {
  const ativ = atividadeAtualSeminario();
  const avaliacoes = JSON.parse(JSON.stringify(ativ.avaliacoes || {}));
  if (avaliacoes[grupoIdParaTimer]) delete avaliacoes[grupoIdParaTimer][criterioIdParaTimer];
  salvarCampoAtividadeSeminario("avaliacoes", avaliacoes);
  fecharModal();
}

// ---------- aviso (mural / whatsapp) ----------

const SEPARADOR_AVISO_SEMINARIO = "▬▬▬▬▬▬▬▬▬▬";

function montarTextoAvisoSeminario(ativ) {
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoSeminario.turmaId);
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const info = infoTipoAtividadeGrupo(ativ.tipoAtividade);

  let texto = `📌 *AVISO — ${turma ? turma.nome : ""}*\n`;
  if (turma && turma.escola) texto += `_${turma.escola}_\n`;
  texto += `${SEPARADOR_AVISO_SEMINARIO}\n`;
  texto += `${info.icone} *${info.label}: ${ativ.nome}*\n`;
  if (ativ.descricao) texto += `📋 ${ativ.descricao}\n`;

  const datas = [];
  if (ativ.dataApresentacao) datas.push(`${info.rotuloData}: ${formatarDataBrTurmas(ativ.dataApresentacao)}`);
  if (ativ.dataEntregaRelatorio) datas.push(`Entrega do relatório: ${formatarDataBrTurmas(ativ.dataEntregaRelatorio)}`);
  if (datas.length) {
    texto += `${SEPARADOR_AVISO_SEMINARIO}\n🗓️ *Datas importantes:*\n`;
    datas.forEach((d) => { texto += `• ${d}\n`; });
  }

  texto += `${SEPARADOR_AVISO_SEMINARIO}\n👥 *Grupos/Temas:*\n`;
  if (ativ.grupos && ativ.grupos.length) {
    ativ.grupos.forEach((g) => {
      texto += `\n*${g.nome}*\n`;
      if (g.alunosIds.length) {
        g.alunosIds.forEach((id) => {
          const aluno = estadoSeminario.alunos.find((a) => a.id === id);
          if (aluno) texto += `• ${aluno.nome}\n`;
        });
      } else {
        texto += `(sem integrantes)\n`;
      }
    });
  } else {
    texto += `Os grupos ainda não foram definidos.\n`;
  }

  if (ativ.criterios && ativ.criterios.length) {
    texto += `${SEPARADOR_AVISO_SEMINARIO}\n📐 *Vocês serão avaliados em:*\n`;
    ativ.criterios.forEach((c) => { texto += `• ${c.nome}\n`; });
  }

  texto += `${SEPARADOR_AVISO_SEMINARIO}\n`;
  texto += ativ.materiaisNecessarios ? `🎒 *Não esqueçam de trazer:*\n${ativ.materiaisNecessarios}\n` : `⚠️ Não esqueçam de trazer o material necessário no dia.\n`;
  texto += `${SEPARADOR_AVISO_SEMINARIO}\n_Gerado em ${dataHoje}_`;
  return texto;
}

function abrirAvisoSeminario() {
  const ativ = atividadeAtualSeminario();
  const texto = montarTextoAvisoSeminario(ativ);
  abrirModal(`
    <h3>Aviso — ${escaparHtml(ativ.nome)}</h3>
    <div class="campo-form">
      <textarea id="texto-aviso-seminario" style="min-height:260px; font-family:monospace; font-size:0.82rem;">${escaparHtml(texto)}</textarea>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Fechar</button>
      <button class="btn-secundario" onclick="copiarAvisoSeminario()">Copiar texto</button>
      <button class="btn-primario" onclick="gerarPdfMuralSeminario()">Gerar PDF do mural</button>
    </div>
  `);
}
async function copiarAvisoSeminario() {
  const texto = document.getElementById("texto-aviso-seminario").value;
  try {
    await navigator.clipboard.writeText(texto);
    alert("Texto copiado! Já pode colar no WhatsApp.");
  } catch (e) {
    const area = document.getElementById("texto-aviso-seminario");
    area.select();
    document.execCommand("copy");
    alert("Texto copiado!");
  }
}
function gerarPdfMuralSeminario() {
  const ativ = atividadeAtualSeminario();
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoSeminario.turmaId);
  const info = infoTipoAtividadeGrupo(ativ.tipoAtividade);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page { size: A4 portrait; margin: 18mm; }
    body { font-family: 'Georgia', 'Times New Roman', serif; color: #23342e; }
    h1 { text-align:center; font-size: 26pt; margin-bottom:4px; }
    h2 { text-align:center; font-size: 14pt; font-weight:normal; color:#555; margin-top:0; }
    .data { text-align:center; font-size:11pt; color:#777; margin-bottom: 20px; }
    .descricao { font-size:12pt; text-align:center; margin-bottom:20px; color:#333; }
    h3 { font-size:15pt; border-bottom: 2px solid #2b4a6b; padding-bottom:4px; margin-top:26px; }
    ul { font-size: 13pt; line-height: 1.9; }
    .vazio { color:#777; font-size:12pt; }
  </style></head><body>
    <h1>📌 AVISO</h1>
    <h2>${escaparHtml(turma ? turma.nome : "")}${turma && turma.escola ? " — " + escaparHtml(turma.escola) : ""} — ${info.label}: ${escaparHtml(ativ.nome)}</h2>
    <div class="data">
      Gerado em ${dataHoje}
      ${ativ.dataApresentacao ? " • " + info.rotuloData + ": " + formatarDataBrTurmas(ativ.dataApresentacao) : ""}
      ${ativ.dataEntregaRelatorio ? " • Entrega do relatório: " + formatarDataBrTurmas(ativ.dataEntregaRelatorio) : ""}
    </div>
    ${ativ.descricao ? `<div class="descricao">${escaparHtml(ativ.descricao)}</div>` : ""}
    <h3>👥 Grupos/Temas</h3>
    ${(ativ.grupos && ativ.grupos.length) ? ativ.grupos.map((g) => `
      <p style="margin-bottom:4px;"><strong>${escaparHtml(g.nome)}</strong></p>
      <ul style="margin-top:0;">
        ${g.alunosIds.length ? g.alunosIds.map((id) => {
          const aluno = estadoSeminario.alunos.find((a) => a.id === id);
          return aluno ? `<li>${escaparHtml(aluno.nome)}</li>` : "";
        }).join("") : '<li class="vazio">(sem integrantes)</li>'}
      </ul>
    `).join("") : '<p class="vazio">Os grupos ainda não foram definidos.</p>'}
    ${(ativ.criterios && ativ.criterios.length) ? `
      <h3>📐 Vocês serão avaliados em</h3>
      <ul>${ativ.criterios.map((c) => `<li>${escaparHtml(c.nome)}</li>`).join("")}</ul>
    ` : ""}
    <h3>🎒 Levar no dia</h3>
    <p>${ativ.materiaisNecessarios ? escaparHtml(ativ.materiaisNecessarios) : "Material necessário para a atividade."}</p>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

// ---------- renderização ----------

function renderSeminario() {
  let html = `<div class="selecao-visto">`;

  const escolas = [...new Set(estadoTurmas.turmas.map((t) => t.escola).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  html += `<select id="select-escola-seminario" onchange="mudarEscolaSeminario(this.value)">
    <option value="">Selecione a escola…</option>
    ${escolas.map((e) => `<option value="${escaparHtml(e)}" ${e === estadoSeminario.escola ? "selected" : ""}>${escaparHtml(e)}</option>`).join("")}
  </select>`;

  html += `<select id="select-turma-seminario" onchange="mudarTurmaSeminario(this.value)" ${estadoSeminario.escola ? "" : "disabled"}>
    <option value="">Selecione a turma…</option>
    ${turmasDaEscolaSelecionadaSeminario().map((t) => `<option value="${t.id}" ${t.id === estadoSeminario.turmaId ? "selected" : ""}>${escaparHtml(t.nome)}</option>`).join("")}
  </select>`;

  html += `<select id="select-disciplina-seminario" onchange="mudarDisciplinaSeminario(this.value)" ${estadoSeminario.turmaId ? "" : "disabled"}>
    <option value="">Selecione a disciplina…</option>
    ${estadoSeminario.disciplinas.map((d) => `<option value="${d.id}" ${d.id === estadoSeminario.disciplinaId ? "selected" : ""}>${escaparHtml(d.nome)}</option>`).join("")}
  </select>`;
  html += `</div>`;

  if (!estadoSeminario.disciplinaId) {
    html += `<p class="vazio-aviso">Selecione escola, turma e disciplina para ver ou criar atividades em grupo.</p>`;
    painelSeminario.innerHTML = html;
    return;
  }

  if (estadoSeminario.atividadeAtualId) {
    html += renderDetalheSeminario();
    painelSeminario.innerHTML = html;
    return;
  }

  html += `
    <div class="coluna-titulo">
      <h2>Atividades em grupo</h2>
      <button class="btn-add" onclick="abrirNovaAtividadeSeminario()">+ Nova atividade</button>
    </div>
  `;

  if (estadoSeminario.atividades.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma atividade em grupo cadastrada ainda.</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoSeminario.atividades.forEach((a) => {
      const info = infoTipoAtividadeGrupo(a.tipoAtividade);
      html += `
        <div class="atividade-card" onclick="abrirAtividadeSeminario('${a.id}')">
          <span class="acoes-atividade-card">
            <button onclick="event.stopPropagation(); confirmarExclusaoAtividadeSeminario('${a.id}')" title="Excluir">🗑</button>
          </span>
          <div class="atividade-titulo">${info.icone} ${escaparHtml(a.nome)}</div>
          <div class="atividade-prazo">
            ${(a.grupos || []).length} grupo(s) · ${(a.criterios || []).length} critério(s)
            ${a.dataApresentacao ? " · " + info.rotuloData + ": " + formatarDataBrTurmas(a.dataApresentacao) : ""}
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  painelSeminario.innerHTML = html;
}

function renderDetalheSeminario() {
  const ativ = atividadeAtualSeminario();
  if (!ativ) { estadoSeminario.atividadeAtualId = null; return renderSeminario(); }
  const info = infoTipoAtividadeGrupo(ativ.tipoAtividade);

  let html = `
    <div class="trilha-navegacao">
      <a onclick="voltarListaSeminario()">Atividades</a> › ${escaparHtml(ativ.nome)}
    </div>
    <div class="coluna-titulo">
      <h2>${info.icone} ${escaparHtml(ativ.nome)}</h2>
      <div style="display:flex; gap:8px;">
        <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="abrirDuplicarAtividadeSeminario()">Duplicar p/ outra turma</button>
        <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="abrirAvisoSeminario()">📣 Aviso</button>
      </div>
    </div>
    ${ativ.descricao ? `<p class="vazio-aviso">${escaparHtml(ativ.descricao)}</p>` : ""}
    <div style="display:flex; gap:8px; margin:14px 0;">
      <button class="btn-secundario ${estadoSeminario.abaDetalhe === "grupos" ? "aba-ativa-tab" : ""}" onclick="trocarAbaSeminario('grupos')">Grupos</button>
      <button class="btn-secundario ${estadoSeminario.abaDetalhe === "criterios" ? "aba-ativa-tab" : ""}" onclick="trocarAbaSeminario('criterios')">Critérios</button>
      <button class="btn-secundario ${estadoSeminario.abaDetalhe === "avaliacao" ? "aba-ativa-tab" : ""}" onclick="trocarAbaSeminario('avaliacao')">Avaliação</button>
    </div>
  `;

  if (estadoSeminario.abaDetalhe === "grupos") html += renderGruposSeminario(ativ);
  else if (estadoSeminario.abaDetalhe === "criterios") html += renderCriteriosSeminario(ativ);
  else html += renderAvaliacaoSeminario(ativ);

  return html;
}

function renderGruposSeminario(ativ) {
  const alocados = alunosAlocadosSeminario(ativ);
  const semGrupo = estadoSeminario.alunos.filter((a) => !alocados.has(a.id));

  let html = `
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <button class="btn-secundario" onclick="sortearGruposSeminario()">🎲 Sortear grupos</button>
      <button class="btn-secundario" onclick="adicionarGrupoVazioSeminario()">+ Grupo vazio</button>
    </div>
    <p class="vazio-aviso">Sem grupo: ${semGrupo.length ? semGrupo.map((a) => escaparHtml(a.nome)).join(", ") : "todos os alunos já estão em algum grupo."}</p>
  `;

  html += `<div class="lista-cartoes">`;
  (ativ.grupos || []).forEach((g) => {
    html += `
      <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <input type="text" value="${escaparHtml(g.nome)}" onchange="renomearGrupoSeminario('${g.id}', this.value)" style="background:transparent; border:none; font-weight:700; font-family:'Fraunces',serif; color:var(--tinta); font-size:1rem; width:60%;" />
          <button class="btn-secundario" style="padding:4px 10px; font-size:0.78rem;" onclick="excluirGrupoSeminario('${g.id}')">Excluir grupo</button>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${g.alunosIds.map((id) => {
            const al = estadoSeminario.alunos.find((a) => a.id === id);
            if (!al) return "";
            return `<span class="tag">${escaparHtml(al.nome)} <button onclick="removerDoGrupoSeminario('${g.id}','${id}')">✕</button></span>`;
          }).join("")}
        </div>
        <div style="display:flex; gap:6px;">
          <select id="sel-grupo-${g.id}" style="flex:1;">
            <option value="">Adicionar aluno...</option>
            ${semGrupo.map((a) => `<option value="${a.id}">${escaparHtml(a.nome)}</option>`).join("")}
          </select>
          <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="adicionarAoGrupoSeminario('${g.id}')">Adicionar</button>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  if (!ativ.grupos || !ativ.grupos.length) html += `<p class="vazio-aviso">Nenhum grupo criado ainda. Sorteie automaticamente ou adicione grupos vazios.</p>`;
  return html;
}

function renderCriteriosSeminario(ativ) {
  let html = `<div class="lista-cartoes">`;
  (ativ.criterios || []).forEach((c) => {
    html += `
      <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:8px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" value="${escaparHtml(c.nome)}" onchange="editarCriterioSeminario('${c.id}','nome',this.value)" style="flex:1;" />
          <select onchange="editarCriterioSeminario('${c.id}','tipo',this.value)" style="width:auto;">
            <option value="percentual" ${c.tipo === "percentual" ? "selected" : ""}>Percentual (0/25/50/75/100)</option>
            <option value="tempo" ${c.tipo === "tempo" ? "selected" : ""}>Tempo (cronômetro)</option>
          </select>
          <button class="btn-secundario" style="padding:4px 10px;" onclick="excluirCriterioSeminario('${c.id}')">🗑</button>
        </div>
        ${c.tipo === "tempo" ? `
          <div style="display:flex; gap:8px;">
            <input type="number" placeholder="Mín (s)" value="${c.tempoMin ?? ""}" onchange="editarCriterioSeminario('${c.id}','tempoMin',Number(this.value))" style="width:100px;" />
            <input type="number" placeholder="Máx (s)" value="${c.tempoMax ?? ""}" onchange="editarCriterioSeminario('${c.id}','tempoMax',Number(this.value))" style="width:100px;" />
            <input type="number" placeholder="Desconto %" value="${c.descontoPercentual ?? ""}" onchange="editarCriterioSeminario('${c.id}','descontoPercentual',Number(this.value))" style="width:110px;" />
          </div>
        ` : ""}
      </div>
    `;
  });
  html += `</div>`;
  html += `<button class="btn-add" style="margin-top:12px;" onclick="adicionarCriterioSeminario()">+ Novo critério</button>`;
  if (!ativ.criterios || !ativ.criterios.length) html = `<p class="vazio-aviso">Nenhum critério cadastrado. Adicione ao menos um.</p>` + html;
  return html;
}

function renderAvaliacaoSeminario(ativ) {
  if (!ativ.grupos || !ativ.grupos.length || !ativ.criterios || !ativ.criterios.length) {
    return `<p class="vazio-aviso">Cadastre grupos e critérios antes de avaliar.</p>`;
  }
  let html = `<div class="lista-cartoes">`;
  ativ.grupos.forEach((g) => {
    const av = ativ.avaliacoes[g.id] || {};
    const nomes = g.alunosIds.map((id) => estadoSeminario.alunos.find((a) => a.id === id)?.nome).filter(Boolean).join(", ");
    html += `
      <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:10px; width:100%;">
        <div>
          <strong style="font-family:'Fraunces',serif;">${escaparHtml(g.nome)}</strong>
          <p class="subinfo-item">${escaparHtml(nomes) || "Sem integrantes"}</p>
        </div>
        ${ativ.criterios.map((c) => {
          const valor = av[c.id];
          if (c.tipo === "tempo") {
            const tempo = valor && valor.tempoSegundos != null ? valor.tempoSegundos : null;
            const nota = valor && valor.nota != null ? valor.nota : null;
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                  <strong>${escaparHtml(c.nome)}</strong>
                  <div class="subinfo-item">Faixa ideal: ${c.tempoMin ?? "?"}s–${c.tempoMax ?? "?"}s${tempo != null ? ` · registrado: ${tempo}s → ${nota}%` : ""}</div>
                </div>
                <button class="btn-secundario" style="padding:6px 12px; font-size:0.8rem;" onclick="abrirCronometroSeminario('${g.id}','${c.id}')">⏱ ${tempo != null ? "Editar" : "Cronometrar"}</button>
              </div>
            `;
          }
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <strong>${escaparHtml(c.nome)}</strong>
              <div style="display:flex; gap:4px;">
                ${[0, 25, 50, 75, 100].map((o) => `<button class="status-botao ${o <= 25 ? "st-0" : o <= 75 ? "st-50" : "st-100"} ${valor === o ? "ativo" : ""}" style="padding:5px 9px; font-size:0.75rem;" onclick="avaliarPercentualSeminario('${g.id}','${c.id}',${o})">${o}%</button>`).join("")}
              </div>
            </div>
          `;
        }).join("")}
        <div style="text-align:right; font-weight:700; color:var(--acento);">Média do grupo: ${calcularMediaGrupoSeminario(ativ, g.id).toFixed(1)}%</div>
      </div>
    `;
  });
  html += `</div>`;
  return html;
}
