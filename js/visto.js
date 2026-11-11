// ============================================================
// Etapa 4 — Visto das atividades
//
// "Escola" aqui também é o campo de texto da turma (não uma coleção
// separada) — ver js/turmas.js para o motivo.
// ============================================================

const painelVisto = document.getElementById("painel-visto");

const estadoVisto = {
  escola: null,          // texto da escola selecionada
  turmaId: null,
  disciplinas: [],
  disciplinaId: null,
  alunos: [],
  atividades: [],
  atividadeAtual: null,
  vistos: {}, // alunoId -> { notaBruta, materialEsquecido, novaData, notaFinal }
  termoBuscaAlunos: "",
  termoBuscaTurmas: "",
  modoSelecaoVarios: false,
  selecionados: new Set(),
  ordemAlunos: "nome",       // nome | pendentes | nota-desc | nota-asc
  apenasFaltando: false,
  alunoAtivoTeclado: null,   // id do aluno "selecionado" pro atalho de teclado
  vistosCarregados: false,   // true assim que o 1º snapshot de "vistos" da atividade chega
};

// Paleta decorativa dos avatares — reaproveita os pares cor-forte/cor-suave
// já existentes no style.css (se adaptam sozinhos ao modo escuro).
const PALETA_AVATAR_VISTO = [
  { bg: "var(--acento-suave)", fg: "var(--acento)" },
  { bg: "var(--alerta-suave)", fg: "var(--alerta)" },
  { bg: "var(--erro-suave)", fg: "var(--erro)" },
  { bg: "var(--roxo-suave)", fg: "var(--roxo)" },
  { bg: "var(--azul-suave)", fg: "var(--azul)" },
  { bg: "var(--rosa-suave)", fg: "var(--rosa)" },
  { bg: "var(--sucesso-suave)", fg: "var(--sucesso)" },
];
// Paleta do Bootstrap (sem importar a biblioteca toda) — uma cor por
// escola, na ordem alfabética das escolas na barra lateral.
const CORES_ESCOLA_VISTO = [
  "#0d6efd", // primary
  "#198754", // success
  "#fd7e14", // orange
  "#6f42c1", // purple
  "#d63384", // pink
  "#0dcaf0", // info
  "#20c997", // teal
  "#6610f2", // indigo
  "#dc3545", // danger
];
function corDaEscolaVisto(indice) {
  return CORES_ESCOLA_VISTO[indice % CORES_ESCOLA_VISTO.length];
}

function iniciaisAluno(nome) {
  const partes = (nome || "").trim().split(/\s+/);
  const a = partes[0] ? partes[0][0] : "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase();
}
// Cartão inteiro colorido (não só uma tarjinha no topo):
//   preto   = "Não fez / Recusa" (nota 0) — e também o cinza vira preto
//             sozinho se passar do prazo sem reposição
//   cinza   = esqueceu a apostila/material, ainda dentro do prazo da nova data
//   amarelo → verde conforme a nota: 25% amarelo, 50% amarelo-esverdeado,
//             75% mais verde que amarelo, 100% (Entregue) verde puro
//   branco  = ainda não foi avaliado, sem nenhuma marcação
function classeStatusCartaoVisto(v) {
  const semNotaAinda = !v || v.notaBruta === null || v.notaBruta === undefined;

  if (v && v.notaBruta === 0) return "cartao-nao-fez";

  if (v && v.materialEsquecido && semNotaAinda) {
    const prazoEfetivo = v.novaData || (estadoVisto.atividadeAtual && estadoVisto.atividadeAtual.prazo);
    if (prazoEfetivo && hojeLocalISO() > prazoEfetivo) return "cartao-nao-fez";
    return "cartao-material";
  }

  if (semNotaAinda) return "cartao-pendente";

  if (v.notaBruta === 25) return "cartao-nota-25";
  if (v.notaBruta === 50) return "cartao-nota-50";
  if (v.notaBruta === 75) return "cartao-nota-75";
  return "cartao-nota-100"; // 100% (Entregue) e qualquer outro valor lançado
}

// Ícone por status, além da cor — não depende só de enxergar a cor do
// cartão pra saber o que é (acessibilidade e leitura rápida à distância).
function iconeStatusCartaoVisto(statusClasse) {
  switch (statusClasse) {
    case "cartao-nota-100": return "bi-check-circle-fill";
    case "cartao-nota-75":
    case "cartao-nota-50":
    case "cartao-nota-25": return "bi-check-circle";
    case "cartao-nao-fez": return "bi-x-circle-fill";
    case "cartao-material": return "bi-box-seam-fill";
    default: return "bi-dash-circle"; // cartao-pendente
  }
}

let unsubVistoDisciplinas = null;
let unsubVistoAlunos = null;
let unsubVistoAtividades = null;
let unsubVistoVistos = null;

// Compara nomes de disciplina ignorando maiúsculas/minúsculas e espaços
// nas pontas — evita falhas silenciosas quando o mesmo nome foi digitado
// de formas ligeiramente diferentes em turmas diferentes (ex: "Ciências"
// vs "ciências " com espaço a mais).
function normalizarNome(texto) {
  return (texto || "").trim().toLowerCase();
}

function limparListenersVisto(quais) {
  if (quais.includes("disciplinas") && unsubVistoDisciplinas) { unsubVistoDisciplinas(); unsubVistoDisciplinas = null; }
  if (quais.includes("alunos") && unsubVistoAlunos) { unsubVistoAlunos(); unsubVistoAlunos = null; }
  if (quais.includes("atividades") && unsubVistoAtividades) { unsubVistoAtividades(); unsubVistoAtividades = null; }
  if (quais.includes("vistos") && unsubVistoVistos) { unsubVistoVistos(); unsubVistoVistos = null; }
}

function initVisto() {
  renderVisto();
}

function buscarAlunoVisto(valor) {
  estadoVisto.termoBuscaAlunos = valor;
  renderVisto();
  const campo = document.querySelector("#painel-visto .visto-conteudo .campo-busca");
  if (campo) {
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

function buscarTurmaSidebarVisto(valor) {
  estadoVisto.termoBuscaTurmas = valor;
  renderVisto();
  const campo = document.querySelector("#painel-visto .campo-busca-turma-visto");
  if (campo) {
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

// Seleciona a turma direto pela barra lateral — já resolve a escola dela
// sozinho (não depende mais de escolher escola antes, num combo à parte).
function selecionarTurmaVisto(turmaId) {
  const turma = estadoTurmas.turmas.find((t) => t.id === turmaId);
  if (!turma) return;
  estadoVisto.escola = turma.escola || null;
  mudarTurmaVisto(turmaId);
}

function turmasDaEscolaSelecionada() {
  if (!estadoVisto.escola) return [];
  return estadoTurmas.turmas.filter((t) => (t.escola || "") === estadoVisto.escola);
}

// ---------- Seleção: escola (texto) → turma → disciplina ----------

function mudarEscolaVisto(escola) {
  estadoVisto.escola = escola || null;
  estadoVisto.turmaId = null;
  estadoVisto.disciplinas = [];
  estadoVisto.disciplinaId = null;
  estadoVisto.atividades = [];
  estadoVisto.atividadeAtual = null;
  limparListenersVisto(["disciplinas", "alunos", "atividades", "vistos"]);
  renderVisto();
}

function mudarTurmaVisto(id) {
  estadoVisto.turmaId = id || null;
  estadoVisto.termoBuscaAlunos = "";
  estadoVisto.disciplinas = [];
  estadoVisto.disciplinaId = null;
  estadoVisto.atividades = [];
  estadoVisto.atividadeAtual = null;
  estadoVisto.vistosCarregados = false;
  estadoVisto.modoSelecaoVarios = false;
  estadoVisto.selecionados = new Set();
  limparListenersVisto(["disciplinas", "alunos", "atividades", "vistos"]);

  if (!id) { renderVisto(); return; }

  unsubVistoDisciplinas = db.collection("turmas").doc(id).collection("disciplinas").orderBy("nome").onSnapshot((snap) => {
    estadoVisto.disciplinas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderVisto();
  });

  unsubVistoAlunos = db.collection("turmas").doc(id).collection("alunos").orderBy("nome").onSnapshot((snap) => {
    // Quem foi transferido não aparece mais pra lançar visto nesta turma —
    // o histórico dele nas atividades já lançadas continua preservado.
    estadoVisto.alunos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => (a.status || "ativo") === "ativo");
    renderVisto();
  });

  renderVisto();
}

function mudarDisciplinaVisto(id) {
  estadoVisto.disciplinaId = id || null;
  estadoVisto.atividadeAtual = null;
  limparListenersVisto(["atividades", "vistos"]);

  if (!id) { renderVisto(); return; }

  const disciplina = estadoVisto.disciplinas.find((d) => d.id === id);

  unsubVistoAtividades = db.collection("atividades")
    .where("turmaIds", "array-contains", estadoVisto.turmaId)
    .onSnapshot((snap) => {
      estadoVisto.atividades = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => normalizarNome(a.disciplinaNome) === normalizarNome(disciplina.nome))
        .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      renderVisto();
    });

  renderVisto();
}

// ---------- Atividades ----------

function selecionarAtividade(id) {
  estadoVisto.atividadeAtual = estadoVisto.atividades.find((a) => a.id === id);
  estadoVisto.vistos = {};
  estadoVisto.vistosCarregados = false;
  estadoVisto.termoBuscaAlunos = "";
  estadoVisto.modoSelecaoVarios = false;
  estadoVisto.selecionados = new Set();
  if (unsubVistoVistos) unsubVistoVistos();

  unsubVistoVistos = db.collection("atividades").doc(id).collection("vistos")
    .where("turmaId", "==", estadoVisto.turmaId)
    .onSnapshot((snap) => {
      const mapa = {};
      snap.docs.forEach((d) => { mapa[d.data().alunoId] = d.data(); });
      estadoVisto.vistos = mapa;
      estadoVisto.vistosCarregados = true;
      renderVisto();
      aplicarVencimentoAutomatico();
    });

  renderVisto();
}

// Se a atividade (ou a nova data de um aluno com "material") já passou
// e o aluno ainda está "Faltante" (nunca marcado), vira "Não fez" (0%)
// sozinho — igual ao Vistos.exe. Isso não conta como penalidade extra:
// é só o significado padrão de "não entregou até o prazo".
function aplicarVencimentoAutomatico() {
  if (!estadoVisto.atividadeAtual) return;
  const hoje = hojeLocalISO();

  estadoVisto.alunos.forEach((aluno) => {
    const v = estadoVisto.vistos[aluno.id];
    if (!v) return;
    if (v.notaBruta !== null && v.notaBruta !== undefined) return; // já tem nota, não mexe

    const prazoEfetivo = (v.materialEsquecido && v.novaData) ? v.novaData : estadoVisto.atividadeAtual.prazo;
    if (!prazoEfetivo || hoje <= prazoEfetivo) return;

    const docId = `${estadoVisto.turmaId}_${aluno.id}`;
    const lote = db.batch();
    lote.update(db.collection("atividades").doc(estadoVisto.atividadeAtual.id).collection("vistos").doc(docId), {
      notaBruta: 0,
      notaFinal: 0,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
    lote.update(db.collection("atividades").doc(estadoVisto.atividadeAtual.id), {
      [`pendentesPorTurma.${estadoVisto.turmaId}`]: firebase.firestore.FieldValue.increment(-1),
    });
    lote.commit().catch(() => {});
  });
}

// ---------- Manutenção global (roda uma vez em todas as turmas) ----------
//
// aplicarVencimentoAutomatico() só corrige a atividade que está aberta na
// tela. Esta função varre TODAS as atividades de TODAS as turmas e:
//   1) quem passou do prazo sem nenhuma nota lançada vira "Não fez" (0%);
//   2) quem tinha o desconto antigo de 20 pontos por material esquecido
//      (de antes desse desconto ser removido) tem a nota corrigida para
//      valer cheia.
// É seguro rodar mais de uma vez — quem já está certo não é tocado.
async function executarManutencaoVistoGlobal() {
  const confirmar = confirm(
    "Isso revisa TODAS as atividades de TODAS as turmas:\n\n" +
    "• Quem passou do prazo sem nenhuma nota lançada vira \"Não fez\" (0%).\n" +
    "• Quem tinha o desconto antigo de material esquecido tem a nota corrigida para valer cheia.\n\n" +
    "Pode levar alguns segundos. Continuar?"
  );
  if (!confirmar) return;

  const hoje = hojeLocalISO();
  let corrigidosVencimento = 0;
  let corrigidosDesconto = 0;

  try {
    const atividadesSnap = await db.collection("atividades").get();

    for (const atDoc of atividadesSnap.docs) {
      const atividade = atDoc.data();
      const vistosSnap = await atDoc.ref.collection("vistos").get();
      if (vistosSnap.empty) continue;

      const deltaPorTurma = {};
      let lote = db.batch();
      let opsNoLote = 0;

      for (const vDoc of vistosSnap.docs) {
        const v = vDoc.data();
        let mudou = false;
        const dados = { atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() };

        const prazoEfetivo = (v.materialEsquecido && v.novaData) ? v.novaData : atividade.prazo;
        const semNotaAinda = v.notaBruta === null || v.notaBruta === undefined;

        if (semNotaAinda && prazoEfetivo && hoje > prazoEfetivo) {
          dados.notaBruta = 0;
          dados.notaFinal = 0;
          deltaPorTurma[v.turmaId] = (deltaPorTurma[v.turmaId] || 0) - 1;
          corrigidosVencimento++;
          mudou = true;
        } else if (v.materialEsquecido && !semNotaAinda) {
          const notaFinalAtual = v.notaFinal ?? v.notaBruta;
          if (notaFinalAtual !== v.notaBruta) {
            dados.notaFinal = v.notaBruta;
            corrigidosDesconto++;
            mudou = true;
          }
        }

        if (mudou) {
          lote.update(vDoc.ref, dados);
          opsNoLote++;
        }

        if (opsNoLote >= 400) {
          await lote.commit();
          lote = db.batch();
          opsNoLote = 0;
        }
      }
      if (opsNoLote > 0) await lote.commit();

      const turmasComDelta = Object.keys(deltaPorTurma);
      if (turmasComDelta.length > 0) {
        const atualizacao = {};
        turmasComDelta.forEach((tid) => {
          atualizacao[`pendentesPorTurma.${tid}`] = firebase.firestore.FieldValue.increment(deltaPorTurma[tid]);
        });
        await atDoc.ref.update(atualizacao);
      }
    }

    alert(
      `Manutenção concluída.\n\n` +
      `${corrigidosVencimento} viraram "Não fez" por prazo vencido.\n` +
      `${corrigidosDesconto} tiveram a nota corrigida (desconto de material removido).`
    );
    renderVisto();
  } catch (err) {
    alert("Erro durante a manutenção: " + err.message);
  }
}

function confirmarExclusaoAtividade(id) {
  const a = estadoVisto.atividades.find((x) => x.id === id);
  const aplicadaEmVarias = a.turmaIds.length > 1;

  if (!aplicadaEmVarias) {
    abrirModalAlunoVisto(`
      <div class="modal-header">
        <h5 class="modal-title">Excluir atividade</h5>
        <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
      </div>
      <div class="modal-body">
        <p>Tem certeza que deseja excluir "${escaparHtml(a.titulo)}"? Isso apaga também os vistos lançados dela.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Cancelar</button>
        <button class="btn btn-danger" onclick="excluirAtividadeCompleta('${id}')">Excluir</button>
      </div>
    `);
    return;
  }

  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">Excluir atividade</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <p>"${escaparHtml(a.titulo)}" está aplicada em ${a.turmaIds.length} turmas. O que você quer fazer?</p>
      <div class="d-grid gap-2">
        <button class="btn btn-primary" onclick="excluirAtividadeDeUmaTurma('${id}')">Excluir só desta turma</button>
        <button class="btn btn-danger" onclick="excluirAtividadeCompleta('${id}')">Excluir de todas as ${a.turmaIds.length} turmas</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Cancelar</button>
    </div>
  `);
}

// Depois de excluir (total ou parcialmente), limpa o estado em memória e
// atualiza a tela na hora — sem depender só do Firestore avisar em tempo
// real, que pode atrasar visualmente.
function limparAtividadeExcluidaDaTela(id) {
  if (estadoVisto.atividadeAtual && estadoVisto.atividadeAtual.id === id) {
    estadoVisto.atividadeAtual = null;
    estadoVisto.vistos = {};
    if (unsubVistoVistos) { unsubVistoVistos(); unsubVistoVistos = null; }
  }
  estadoVisto.atividades = estadoVisto.atividades.filter((a) => a.id !== id);
  fecharModalAlunoVisto();
  renderVisto();
}

async function excluirAtividadeCompleta(id) {
  try {
    const vistosSnap = await db.collection("atividades").doc(id).collection("vistos").get();
    const docs = vistosSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const lote = db.batch();
      docs.slice(i, i + 450).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
    await db.collection("atividades").doc(id).delete();
    limparAtividadeExcluidaDaTela(id);
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

// Remove só a turma atual da atividade: tira o vínculo (turmaIds) e apaga
// só os vistos dessa turma — as outras turmas continuam com a atividade
// normalmente.
async function excluirAtividadeDeUmaTurma(id) {
  try {
    const turmaId = estadoVisto.turmaId;
    const vistosSnap = await db.collection("atividades").doc(id).collection("vistos")
      .where("turmaId", "==", turmaId).get();

    const lote = db.batch();
    vistosSnap.docs.forEach((d) => lote.delete(d.ref));
    lote.update(db.collection("atividades").doc(id), {
      turmaIds: firebase.firestore.FieldValue.arrayRemove(turmaId),
      [`pendentesPorTurma.${turmaId}`]: firebase.firestore.FieldValue.delete(),
    });
    await lote.commit();

    limparAtividadeExcluidaDaTela(id);
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

function abrirFormEditarAtividade(id) {
  const a = estadoVisto.atividades.find((x) => x.id === id);
  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">Editar atividade</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <div class="mb-2">
        <label class="form-label" for="input-editar-data-atividade">Data</label>
        <input type="date" class="form-control" id="input-editar-data-atividade" value="${a.data || ""}" />
      </div>
      <div class="mb-2">
        <label class="form-label" for="input-editar-titulo-atividade">Nome da atividade</label>
        <input type="text" class="form-control" id="input-editar-titulo-atividade" value="${escaparHtml(a.titulo)}" />
      </div>
      <div class="mb-2">
        <label class="form-label" for="input-editar-descricao-atividade">Descrição da atividade (opcional)</label>
        <textarea class="form-control" id="input-editar-descricao-atividade">${escaparHtml(a.descricao || "")}</textarea>
      </div>
      <div class="mb-2">
        <label class="form-label" for="input-editar-prazo-atividade">Prazo final de entrega (opcional)</label>
        <input type="date" class="form-control" id="input-editar-prazo-atividade" value="${a.prazo || ""}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEdicaoAtividade('${id}')">Salvar</button>
    </div>
  `);
  document.getElementById("input-editar-titulo-atividade").focus();
}

function salvarEdicaoAtividade(id) {
  const titulo = document.getElementById("input-editar-titulo-atividade").value.trim();
  if (!titulo) {
    alert("Digite o título da atividade.");
    return;
  }
  const prazo = document.getElementById("input-editar-prazo-atividade").value || null;
  const hoje = hojeLocalISO();

  if (prazo && prazo < hoje) {
    const confirmar = confirm(
      "Esse prazo já passou. Ao salvar, todo aluno que ainda não tem nota lançada " +
      "(em qualquer turma desta atividade) vira \"Não fez\" automaticamente na próxima vez " +
      "que essa atividade for aberta. Quer continuar mesmo assim?"
    );
    if (!confirmar) return;
  }

  const dados = {
    titulo,
    data: document.getElementById("input-editar-data-atividade").value || null,
    descricao: document.getElementById("input-editar-descricao-atividade").value.trim(),
    prazo,
  };
  db.collection("atividades").doc(id).update(dados)
    .then(() => {
      // Atualiza também em memória, pra refletir na hora sem esperar o
      // Firestore avisar.
      const a = estadoVisto.atividades.find((x) => x.id === id);
      if (a) Object.assign(a, dados);
      if (estadoVisto.atividadeAtual && estadoVisto.atividadeAtual.id === id) {
        Object.assign(estadoVisto.atividadeAtual, dados);
      }
      fecharModalAlunoVisto();
      renderVisto();
    })
    .catch((err) => alert("Erro ao salvar: " + err.message));
}

async function abrirFormAtividade() {
  const disciplina = estadoVisto.disciplinas.find((d) => d.id === estadoVisto.disciplinaId);
  const hoje = hojeLocalISO();

  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">Nova atividade — ${escaparHtml(disciplina.nome)}</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <div class="mb-2">
        <label class="form-label" for="input-data-atividade">Data</label>
        <input type="date" class="form-control" id="input-data-atividade" value="${hoje}" />
      </div>
      <div class="mb-2">
        <label class="form-label" for="input-titulo-atividade">Nome da atividade</label>
        <input type="text" class="form-control" id="input-titulo-atividade" placeholder="Ex: Lista 3 - Estequiometria" />
      </div>
      <div class="mb-2">
        <label class="form-label" for="input-descricao-atividade">Descrição da atividade (opcional)</label>
        <textarea class="form-control" id="input-descricao-atividade" placeholder="Detalhes, orientações, o que deve ser entregue..."></textarea>
      </div>
      <div class="mb-2">
        <label class="form-label" for="input-prazo-atividade">Prazo final de entrega (opcional, pode definir depois)</label>
        <input type="date" class="form-control" id="input-prazo-atividade" />
        <div class="form-text">Vale para todos os alunos da atividade. Depois dessa data, todo aluno sem a entrega registrada — pendente ou nem lançada ainda — vira "Não fez" automaticamente.</div>
      </div>
      <div class="mb-2">
        <label class="form-label">Aplicar também a outras turmas com "${escaparHtml(disciplina.nome)}"</label>
        <div id="lista-outras-turmas">
          <span class="text-muted small">Buscando turmas...</span>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarAtividade()">Salvar</button>
    </div>
  `);
  document.getElementById("input-titulo-atividade").focus();

  await carregarOutrasTurmasCompativeis(disciplina.nome);
}

async function carregarOutrasTurmasCompativeis(nomeDisciplina) {
  const container = document.getElementById("lista-outras-turmas");
  try {
    const snap = await db.collectionGroup("disciplinas")
      .where("escolaNormalizado", "==", normalizarNome(estadoVisto.escola))
      .where("nomeNormalizado", "==", normalizarNome(nomeDisciplina))
      .get();

    const turmaIds = [...new Set(
      snap.docs.map((d) => d.data().turmaId).filter((tid) => tid && tid !== estadoVisto.turmaId)
    )];

    if (!document.getElementById("lista-outras-turmas")) return; // modal já foi fechado

    if (turmaIds.length === 0) {
      container.innerHTML = `<span class="text-muted small">Nenhuma outra turma com esta disciplina cadastrada nesta escola (ou ela foi cadastrada antes desta função existir — reabra e salve a disciplina de novo para aparecer aqui).</span>`;
      return;
    }

    let html = "";
    turmaIds.forEach((tid) => {
      const turma = estadoTurmas.turmas.find((t) => t.id === tid);
      const nomeTurma = turma ? turma.nome : "(turma não encontrada)";
      html += `<div class="form-check">
        <input type="checkbox" value="${tid}" class="form-check-input check-outra-turma" id="chk-turma-${tid}" />
        <label class="form-check-label" for="chk-turma-${tid}">${escaparHtml(nomeTurma)}</label>
      </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    if (container) {
      // O Firestore costuma incluir um link para criar o índice que falta
      // direto na mensagem de erro — torna esse link clicável em vez de
      // deixar o usuário copiar um texto que pode ficar cortado na tela.
      const linkIndice = (err.message || "").match(/https:\/\/console\.firebase\.google\.com\S*/);
      if (linkIndice) {
        container.innerHTML = `<span class="text-muted small">
          O Firestore ainda precisa de um índice para essa busca (só na primeira vez).
          <a href="${linkIndice[0]}" target="_blank" rel="noopener">Clique aqui para criar o índice</a>,
          espere alguns segundos, feche esta janela e clique em "+ Nova atividade" de novo.
        </span>`;
      } else {
        container.innerHTML = `<span class="text-muted small">Não foi possível buscar outras turmas (${escaparHtml(err.message)}). A atividade será criada só para esta turma.</span>`;
      }
    }
  }
}

async function salvarAtividade() {
  const titulo = document.getElementById("input-titulo-atividade").value.trim();
  if (!titulo) {
    alert("Digite o título da atividade.");
    return;
  }
  const data = document.getElementById("input-data-atividade").value || null;
  const descricao = document.getElementById("input-descricao-atividade").value.trim();
  const prazo = document.getElementById("input-prazo-atividade").value || null;
  const disciplina = estadoVisto.disciplinas.find((d) => d.id === estadoVisto.disciplinaId);
  const outrasTurmas = Array.from(document.querySelectorAll(".check-outra-turma:checked")).map((c) => c.value);
  const turmaIds = [estadoVisto.turmaId, ...outrasTurmas];

  try {
    // Primeiro reúne os alunos de cada turma envolvida, pra já saber quantos
    // "pendentes" cada turma começa tendo (todos, já que a atividade é nova).
    // Também junta os professoresEmails de cada turma envolvida — usado
    // pelas regras de segurança do Firestore pra decidir quem acessa esta
    // atividade (ver firestore.rules).
    const turmaPrincipal = estadoTurmas.turmas.find((t) => t.id === estadoVisto.turmaId);
    const professoresEmailsSet = new Set(turmaPrincipal && turmaPrincipal.professoresEmails ? turmaPrincipal.professoresEmails : []);

    const alunosPorTurma = {};
    for (const tid of turmaIds) {
      if (tid === estadoVisto.turmaId) {
        alunosPorTurma[tid] = estadoVisto.alunos;
      } else {
        const turmaDoc = await db.collection("turmas").doc(tid).get();
        (turmaDoc.data().professoresEmails || []).forEach((em) => professoresEmailsSet.add(em));
        alunosPorTurma[tid] = (await db.collection("turmas").doc(tid).collection("alunos").get()).docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => (a.status || "ativo") === "ativo");
      }
    }

    const pendentesPorTurma = {};
    turmaIds.forEach((tid) => { pendentesPorTurma[tid] = alunosPorTurma[tid].length; });

    const atividadeRef = await db.collection("atividades").add({
      escola: estadoVisto.escola,
      escolaId: (turmaPrincipal && turmaPrincipal.escolaId) || null,
      professoresEmails: Array.from(professoresEmailsSet),
      disciplinaNome: disciplina.nome,
      titulo,
      data,
      descricao,
      prazo,
      turmaIds,
      pendentesPorTurma,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Monta a lista de vistos "faltante" (um por aluno por turma envolvida).
    const operacoes = [];
    turmaIds.forEach((tid) => {
      alunosPorTurma[tid].forEach((aluno) => {
        operacoes.push({
          ref: atividadeRef.collection("vistos").doc(`${tid}_${aluno.id}`),
          dados: {
            turmaId: tid,
            alunoId: aluno.id,
            notaBruta: null,
            materialEsquecido: false,
            novaData: null,
            notaFinal: null,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          },
        });
      });
    });

    for (let i = 0; i < operacoes.length; i += 450) {
      const lote = db.batch();
      operacoes.slice(i, i + 450).forEach((op) => lote.set(op.ref, op.dados));
      await lote.commit();
    }

    fecharModalAlunoVisto();
    mostrarToastVisto("Atividade criada");
  } catch (err) {
    alert("Erro ao salvar atividade: " + err.message);
  }
}

// ---------- Marcação de nota e do "esqueceu material" ----------

function salvarVisto(alunoId, mudancas) {
  const atual = estadoVisto.vistos[alunoId] || { notaBruta: null, materialEsquecido: false, novaData: null };
  const novo = { ...atual, ...mudancas };

  // Sem penalidade por ter esquecido o material/entregue depois — entregando
  // na nova data combinada, a nota vale cheia, igual a quem entregou na hora.
  const notaFinal = (novo.notaBruta === null || novo.notaBruta === undefined)
    ? null
    : novo.notaBruta;

  // Ajusta o contador de pendências da turma: só muda quando a nota passa
  // de "sem nota" para "com nota" (ou o contrário, ao desfazer).
  const tinhaNotaAntes = atual.notaBruta !== null && atual.notaBruta !== undefined;
  const temNotaAgora = novo.notaBruta !== null && novo.notaBruta !== undefined;
  let deltaPendencia = 0;
  if (!tinhaNotaAntes && temNotaAgora) deltaPendencia = -1;
  if (tinhaNotaAntes && !temNotaAgora) deltaPendencia = 1;

  const docId = `${estadoVisto.turmaId}_${alunoId}`;
  const lote = db.batch();
  lote.set(db.collection("atividades").doc(estadoVisto.atividadeAtual.id).collection("vistos").doc(docId), {
    turmaId: estadoVisto.turmaId,
    alunoId,
    notaBruta: novo.notaBruta ?? null,
    materialEsquecido: !!novo.materialEsquecido,
    novaData: novo.novaData || null,
    notaFinal,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (deltaPendencia !== 0) {
    lote.update(db.collection("atividades").doc(estadoVisto.atividadeAtual.id), {
      [`pendentesPorTurma.${estadoVisto.turmaId}`]: firebase.firestore.FieldValue.increment(deltaPendencia),
    });
  }
  lote.commit().catch((err) => alert("Erro ao salvar: " + err.message));
}

function marcarNota(alunoId, valor) {
  const atual = estadoVisto.vistos[alunoId] || {};
  const anterior = atual.notaBruta === undefined ? null : atual.notaBruta;
  const novaNotaBruta = atual.notaBruta === valor ? null : valor;
  salvarVisto(alunoId, { notaBruta: novaNotaBruta });
  mostrarToastVisto(novaNotaBruta === null ? "Nota removida" : "Nota salva: " + novaNotaBruta, {
    aoDesfazer: () => salvarVisto(alunoId, { notaBruta: anterior }),
  });
}

function toggleMaterial(alunoId) {
  const atual = estadoVisto.vistos[alunoId] || {};
  if (atual.materialEsquecido) {
    salvarVisto(alunoId, { materialEsquecido: false, novaData: null });
    mostrarToastVisto("Material desmarcado");
  } else {
    abrirModalNovaData(alunoId);
  }
}

function somarDias(dataIsoBase, dias) {
  const base = dataIsoBase ? new Date(dataIsoBase + "T00:00:00") : new Date();
  base.setDate(base.getDate() + dias);
  return dataParaIsoLocal(base);
}

function abrirModalNovaData(alunoId) {
  const sugestao = somarDias(estadoVisto.atividadeAtual.prazo, 7);
  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">Esqueceu o material</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <p>Proponha uma nova data de entrega para este aluno. Entregando até essa nova data, a nota vale cheia — sem nenhum desconto por ter perdido a data original.</p>
      <label class="form-label" for="input-nova-data-material">Nova data de entrega</label>
      <input type="date" class="form-control" id="input-nova-data-material" value="${sugestao}" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarMaterialEsquecido('${alunoId}')">Confirmar</button>
    </div>
  `);
  document.getElementById("input-nova-data-material").focus();
}

function confirmarMaterialEsquecido(alunoId) {
  const novaData = document.getElementById("input-nova-data-material").value;
  if (!novaData) {
    alert("Escolha uma data.");
    return;
  }
  salvarVisto(alunoId, { materialEsquecido: true, novaData });
  fecharModalAlunoVisto();
  mostrarToastVisto("Nova data registrada: " + formatarDataBr(novaData));
}

// ---------- Grade de alunos: menu rápido e seleção em lote ----------

function abrirMenuStatusAluno(alunoId) {
  const aluno = estadoVisto.alunos.find((a) => a.id === alunoId);
  if (!aluno) return;
  const v = estadoVisto.vistos[alunoId] || {};
  const notaBruta = v.notaBruta ?? null;
  const materialEsquecido = !!v.materialEsquecido;

  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">${escaparHtml(aluno.nome)}</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <p class="vazio-aviso" style="padding:0 0 14px;">${escaparHtml(estadoVisto.atividadeAtual.titulo)}</p>
      <div class="d-grid gap-2">
        <button class="btn status-botao st-100 ${notaBruta === 100 ? "ativo" : ""}" onclick="marcarNota('${alunoId}',100); fecharModalAlunoVisto();">Entregue</button>
        <button class="btn status-botao st-75 ${notaBruta === 75 ? "ativo" : ""}" onclick="marcarNota('${alunoId}',75); fecharModalAlunoVisto();">75%</button>
        <button class="btn status-botao st-50 ${notaBruta === 50 ? "ativo" : ""}" onclick="marcarNota('${alunoId}',50); fecharModalAlunoVisto();">50%</button>
        <button class="btn status-botao st-25 ${notaBruta === 25 ? "ativo" : ""}" onclick="marcarNota('${alunoId}',25); fecharModalAlunoVisto();">25%</button>
        <button class="btn status-botao st-0 ${notaBruta === 0 ? "ativo" : ""}" onclick="marcarNota('${alunoId}',0); fecharModalAlunoVisto();">Não fez / Recusa</button>
        <button class="btn status-botao st-material ${materialEsquecido ? "ativo" : ""}" onclick="fecharModalAlunoVisto(); toggleMaterial('${alunoId}');">Material</button>
        <button class="btn btn-outline-secondary" onclick="verHistoricoAluno('${alunoId}')"><i class="bi bi-clock-history"></i> Ver histórico na disciplina</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Fechar</button>
    </div>
  `);
}

// Histórico do aluno: nota dele em cada atividade já cadastrada para esta
// disciplina/turma (não só a atividade aberta no momento).
async function verHistoricoAluno(alunoId) {
  const aluno = estadoVisto.alunos.find((a) => a.id === alunoId);
  if (!aluno) return;

  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">Histórico — ${escaparHtml(aluno.nome)}</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body text-center">
      <div class="spinner-border" role="status"><span class="visually-hidden">Carregando…</span></div>
    </div>
  `);

  try {
    const docId = `${estadoVisto.turmaId}_${alunoId}`;
    const leituras = await Promise.all(
      estadoVisto.atividades.map(async (a) => {
        const snap = await db.collection("atividades").doc(a.id).collection("vistos").doc(docId).get();
        return { atividade: a, visto: snap.exists ? snap.data() : null };
      })
    );

    const linhas = leituras
      .map(({ atividade, visto }) => {
        const nota = visto && visto.notaBruta !== null && visto.notaBruta !== undefined ? visto.notaBruta : null;
        const material = visto && visto.materialEsquecido;
        let celulaNota;
        if (nota === null) {
          celulaNota = `<span class="text-muted">—</span>`;
        } else {
          celulaNota = `<span class="badge ${nota === 100 ? "text-bg-success" : nota === 0 ? "text-bg-danger" : "text-bg-warning"}">${nota}${material ? ' · <i class="bi bi-box-seam"></i>' : ""}</span>`;
        }
        return `<tr><td>${escaparHtml(atividade.titulo)}</td><td class="text-end">${celulaNota}</td></tr>`;
      })
      .join("");

    abrirModalAlunoVisto(`
      <div class="modal-header">
        <h5 class="modal-title">Histórico — ${escaparHtml(aluno.nome)}</h5>
        <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
      </div>
      <div class="modal-body">
        <table class="table table-sm align-middle">
          <thead><tr><th>Atividade</th><th class="text-end">Nota</th></tr></thead>
          <tbody>${linhas || `<tr><td colspan="2">Nenhuma atividade cadastrada nesta disciplina ainda.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline-secondary" onclick="abrirMenuStatusAluno('${alunoId}')"><i class="bi bi-arrow-left"></i> Voltar</button>
        <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Fechar</button>
      </div>
    `);
  } catch (err) {
    fecharModalAlunoVisto();
    alert("Erro ao buscar histórico: " + err.message);
  }
}

function mudarOrdemAlunosVisto(valor) {
  estadoVisto.ordemAlunos = valor;
  renderVisto();
}

function alternarApenasFaltandoVisto(valor) {
  estadoVisto.apenasFaltando = valor;
  renderVisto();
}

function alternarModoSelecaoVisto() {
  estadoVisto.modoSelecaoVarios = !estadoVisto.modoSelecaoVarios;
  estadoVisto.selecionados = new Set();
  renderVisto();
}

function alternarSelecaoAlunoVisto(alunoId) {
  if (estadoVisto.selecionados.has(alunoId)) estadoVisto.selecionados.delete(alunoId);
  else estadoVisto.selecionados.add(alunoId);
  renderVisto();
}

async function aplicarNotaEmLote(valor) {
  const ids = Array.from(estadoVisto.selecionados);
  if (ids.length === 0) return;

  const lote = db.batch();
  let deltaPendencia = 0;
  ids.forEach((alunoId) => {
    const atual = estadoVisto.vistos[alunoId] || {};
    const materialEsquecido = !!atual.materialEsquecido;
    const notaFinal = valor;
    const tinhaNotaAntes = atual.notaBruta !== null && atual.notaBruta !== undefined;
    if (!tinhaNotaAntes) deltaPendencia -= 1;

    const docId = `${estadoVisto.turmaId}_${alunoId}`;
    lote.set(db.collection("atividades").doc(estadoVisto.atividadeAtual.id).collection("vistos").doc(docId), {
      turmaId: estadoVisto.turmaId,
      alunoId,
      notaBruta: valor,
      materialEsquecido,
      novaData: atual.novaData || null,
      notaFinal,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
  if (deltaPendencia !== 0) {
    lote.update(db.collection("atividades").doc(estadoVisto.atividadeAtual.id), {
      [`pendentesPorTurma.${estadoVisto.turmaId}`]: firebase.firestore.FieldValue.increment(deltaPendencia),
    });
  }

  try {
    await lote.commit();
    const quantidade = ids.length;
    estadoVisto.modoSelecaoVarios = false;
    estadoVisto.selecionados = new Set();
    renderVisto();
    mostrarToastVisto(`Nota aplicada a ${quantidade} aluno(s)`);
  } catch (err) {
    alert("Erro ao aplicar em lote: " + err.message);
  }
}

// ---------- Renderização ----------

// Barra lateral com as turmas (agrupadas por escola) — acesso rápido direto
// à turma, sem precisar passar por uma caixa de escola separada antes.
function renderSidebarTurmasVisto() {
  let html = `<div class="visto-sidebar">`;

  html += `<button type="button" class="btn btn-sm btn-outline-secondary btn-secundario w-100 mb-2 busca-rapida-btn" onclick="abrirBuscaRapidaVisto()">
    <i class="bi bi-search"></i> Busca rápida <kbd class="busca-rapida-kbd">Ctrl K</kbd>
  </button>`;

  if (estadoTurmas.turmas.length > 6) {
    html += `<input type="text" class="form-control campo-busca campo-busca-turma-visto mb-2" placeholder="Buscar turma…" value="${escaparHtml(estadoVisto.termoBuscaTurmas)}" oninput="buscarTurmaSidebarVisto(this.value)" />`;
  }

  html += `<div class="list-group list-group-flush visto-sidebar-lista">`;

  const termo = estadoVisto.termoBuscaTurmas.trim().toLowerCase();
  const turmasFiltradas = termo
    ? estadoTurmas.turmas.filter((t) => t.nome.toLowerCase().includes(termo) || (t.escola || "").toLowerCase().includes(termo))
    : estadoTurmas.turmas;

  if (turmasFiltradas.length === 0 && !estadoTurmas.carregado) {
    html += `
      <div class="d-flex align-items-center gap-2 text-muted" style="padding:10px 4px;">
        <div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Carregando…</span></div>
        <span style="font-size:0.85rem;">Carregando turmas…</span>
      </div>
    `;
  } else if (turmasFiltradas.length === 0) {
    html += `<div class="alert alert-light vazio-aviso" style="padding:8px 4px;">Nenhuma turma encontrada.</div>`;
  } else {
    const grupos = {};
    turmasFiltradas.forEach((t) => {
      const chave = t.escola && t.escola.trim() ? t.escola.trim() : "(sem escola)";
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(t);
    });

    Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((escola, idxEscola) => {
      const cor = corDaEscolaVisto(idxEscola);
      html += `<div class="visto-sidebar-grupo-titulo" style="color:${cor};"><span class="visto-sidebar-ponto" style="background:${cor};"></span>${escaparHtml(escola)}</div>`;
      grupos[escola].forEach((t) => {
        const ativa = t.id === estadoVisto.turmaId;
        const pend = estadoTurmas.resumoPendencias[t.id] || 0;
        html += `
          <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center visto-sidebar-item ${ativa ? "ativa" : ""}" style="border-left-color:${cor};" onclick="selecionarTurmaVisto('${t.id}')">
            <span>${escaparHtml(t.nome)}</span>
            ${pend > 0 ? `<span class="badge rounded-pill visto-sidebar-selo">${pend}</span>` : ""}
          </button>
        `;
      });
    });
  }

  html += `</div></div>`;
  return html;
}

// O modal e o toast do Visto só são criados UMA VEZ (não a cada renderVisto).
// Antes eles ficavam dentro do innerHTML recriado em toda atualização — e
// como qualquer gravação no Firestore (ex: marcar uma nota) dispara um
// re-render, o toast de confirmação era destruído no meio da animação
// (parecia "subir e sumir" de repente) e um modal aberto podia fechar
// sozinho se outra atualização chegasse enquanto o professor editava.
function garantirModalEToastVisto() {
  if (document.getElementById("modal-aluno-visto")) return;
  const extra = document.createElement("div");
  extra.innerHTML = `
    <div class="modal fade" id="modal-aluno-visto" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" id="modal-aluno-visto-conteudo"></div>
      </div>
    </div>
    <div class="modal-backdrop fade" id="modal-backdrop-visto" style="display:none;" onclick="fecharModalAlunoVisto()"></div>
    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 1080;">
      <div id="toast-visto" class="toast align-items-center text-bg-dark border-0" role="status" aria-live="polite" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body" id="toast-visto-corpo"></div>
        </div>
      </div>
    </div>
  `;
  while (extra.firstChild) painelVisto.appendChild(extra.firstChild);
}

// Animação FLIP (First-Last-Invert-Play): quando a ordenação dos cartões
// muda (ex: "quem falta primeiro" e um aluno acabou de ser lançado), o
// cartão desliza suavemente até a nova posição em vez de simplesmente
// sumir e reaparecer no lugar novo.
function capturarRectsCartoesVisto() {
  const mapa = new Map();
  document.querySelectorAll("#painel-visto .grade-alunos-visto .cartao-aluno-visto").forEach((el) => {
    mapa.set(el.dataset.alunoId, el.getBoundingClientRect());
  });
  return mapa;
}
function animarFlipCartoesVisto(rectsAntes) {
  if (!rectsAntes || rectsAntes.size === 0) return;
  document.querySelectorAll("#painel-visto .grade-alunos-visto .cartao-aluno-visto").forEach((el) => {
    const antes = rectsAntes.get(el.dataset.alunoId);
    if (!antes) return;
    const depois = el.getBoundingClientRect();
    const dx = antes.left - depois.left;
    const dy = antes.top - depois.top;
    if (!dx && !dy) return;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect(); // força o navegador a aplicar antes de animar
    requestAnimationFrame(() => {
      el.style.transition = "transform 220ms ease";
      el.style.transform = "";
    });
  });
}

function renderVisto() {
  const rectsAntes = capturarRectsCartoesVisto();
  let layout = painelVisto.querySelector(":scope > .visto-layout");
  if (!layout) {
    layout = document.createElement("div");
    layout.className = "visto-layout";
    painelVisto.insertBefore(layout, painelVisto.firstChild);
  }
  layout.innerHTML = `
    ${renderSidebarTurmasVisto()}
    <div class="visto-conteudo">${renderConteudoVisto()}</div>
  `;
  garantirModalEToastVisto();
  animarFlipCartoesVisto(rectsAntes);
}

// ---------- Atalhos de teclado: selecionar e lançar nota sem o mouse ----------

function ativarCartaoTeclado(alunoId) {
  estadoVisto.alunoAtivoTeclado = alunoId;
  atualizarDestaqueCartaoTeclado();
}

function atualizarDestaqueCartaoTeclado() {
  document.querySelectorAll("#painel-visto .cartao-aluno-visto").forEach((el) => {
    el.classList.toggle("cartao-ativo-teclado", el.dataset.alunoId === estadoVisto.alunoAtivoTeclado);
  });
}

function moverAtivoTecladoVisto(delta) {
  const ids = Array.from(document.querySelectorAll("#painel-visto .grade-alunos-visto .cartao-aluno-visto"))
    .map((el) => el.dataset.alunoId);
  if (ids.length === 0) return;
  let idx = ids.indexOf(estadoVisto.alunoAtivoTeclado);
  idx = idx === -1 ? 0 : Math.max(0, Math.min(ids.length - 1, idx + delta));
  estadoVisto.alunoAtivoTeclado = ids[idx];
  atualizarDestaqueCartaoTeclado();
  const el = document.querySelector(`#painel-visto .cartao-aluno-visto[data-aluno-id="${estadoVisto.alunoAtivoTeclado}"]`);
  if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Atalhos só valem com a aba Visto visível, uma atividade aberta, e sem o
// professor digitando em algum campo de texto ou com um modal aberto.
document.addEventListener("keydown", (e) => {
  if (!painelVisto || painelVisto.style.display === "none") return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    abrirBuscaRapidaVisto();
    return;
  }

  if (!estadoVisto.atividadeAtual) return;

  const alvo = e.target;
  const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
  if (digitando) return;

  const modalVistoAberto = document.getElementById("modal-aluno-visto")?.classList.contains("show");
  if (modalVistoAberto) return;

  if (e.key === "Escape") {
    estadoVisto.alunoAtivoTeclado = null;
    atualizarDestaqueCartaoTeclado();
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moverAtivoTecladoVisto(1); return; }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moverAtivoTecladoVisto(-1); return; }

  if (!estadoVisto.alunoAtivoTeclado) return;

  const mapaNotasTeclado = { "1": 100, "2": 75, "3": 50, "4": 25 };
  if (mapaNotasTeclado[e.key] !== undefined) {
    e.preventDefault();
    marcarNota(estadoVisto.alunoAtivoTeclado, mapaNotasTeclado[e.key]);
    moverAtivoTecladoVisto(1);
    return;
  }
  if (e.key.toLowerCase() === "n") {
    e.preventDefault();
    marcarNota(estadoVisto.alunoAtivoTeclado, 0);
    moverAtivoTecladoVisto(1);
    return;
  }
  if (e.key.toLowerCase() === "m") {
    e.preventDefault();
    toggleMaterial(estadoVisto.alunoAtivoTeclado);
    return;
  }
});

// ---------- Busca rápida global (Ctrl+K) ----------

function abrirBuscaRapidaVisto() {
  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title"><i class="bi bi-search"></i> Busca rápida</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <input type="text" class="form-control mb-2" id="input-busca-rapida-visto" placeholder="Turma, atividade ou aluno…" oninput="renderResultadosBuscaRapidaVisto(this.value)" />
      <div id="resultados-busca-rapida-visto"></div>
    </div>
  `);
  const campo = document.getElementById("input-busca-rapida-visto");
  if (campo) campo.focus();
  renderResultadosBuscaRapidaVisto("");
}

function renderResultadosBuscaRapidaVisto(valor) {
  const termo = (valor || "").trim().toLowerCase();
  const alvo = document.getElementById("resultados-busca-rapida-visto");
  if (!alvo) return;

  if (!termo) {
    alvo.innerHTML = `<p class="vazio-aviso" style="padding:6px 0;">Digite pra buscar turmas, atividades da turma aberta e alunos da atividade aberta.</p>`;
    return;
  }

  const turmasAchadas = (estadoTurmas.turmas || [])
    .filter((t) => t.nome.toLowerCase().includes(termo) || (t.escola || "").toLowerCase().includes(termo))
    .slice(0, 6);
  const atividadesAchadas = estadoVisto.atividades
    .filter((a) => (a.titulo || "").toLowerCase().includes(termo))
    .slice(0, 6);
  const alunosAchados = estadoVisto.alunos
    .filter((a) => (a.nome || "").toLowerCase().includes(termo))
    .slice(0, 6);

  if (turmasAchadas.length + atividadesAchadas.length + alunosAchados.length === 0) {
    alvo.innerHTML = `<p class="vazio-aviso" style="padding:6px 0;">Nada encontrado para "${escaparHtml(valor)}".</p>`;
    return;
  }

  let html = "";
  if (turmasAchadas.length) {
    html += `<div class="busca-rapida-grupo-titulo">Turmas</div>`;
    turmasAchadas.forEach((t) => {
      html += `<button type="button" class="list-group-item list-group-item-action busca-rapida-item" onclick="selecionarTurmaVisto('${t.id}'); fecharModalAlunoVisto();"><i class="bi bi-door-open"></i> ${escaparHtml(t.nome)} <span class="text-muted small">${t.escola ? "— " + escaparHtml(t.escola) : ""}</span></button>`;
    });
  }
  if (atividadesAchadas.length) {
    html += `<div class="busca-rapida-grupo-titulo">Atividades (turma aberta)</div>`;
    atividadesAchadas.forEach((a) => {
      html += `<button type="button" class="list-group-item list-group-item-action busca-rapida-item" onclick="selecionarAtividade('${a.id}'); fecharModalAlunoVisto();"><i class="bi bi-clipboard-check"></i> ${escaparHtml(a.titulo)}</button>`;
    });
  }
  if (alunosAchados.length) {
    html += `<div class="busca-rapida-grupo-titulo">Alunos (atividade aberta)</div>`;
    alunosAchados.forEach((a) => {
      html += `<button type="button" class="list-group-item list-group-item-action busca-rapida-item" onclick="irParaAlunoVisto('${a.id}')"><i class="bi bi-person"></i> ${escaparHtml(a.nome)}</button>`;
    });
  }
  alvo.innerHTML = html;
}

function irParaAlunoVisto(alunoId) {
  fecharModalAlunoVisto();
  ativarCartaoTeclado(alunoId);
  setTimeout(() => {
    const el = document.querySelector(`#painel-visto .cartao-aluno-visto[data-aluno-id="${alunoId}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("cartao-flash-destaque");
      setTimeout(() => el.classList.remove("cartao-flash-destaque"), 1200);
    }
  }, 60);
}

// Modal próprio do Visto, usando os componentes reais do Bootstrap (não o
// modal genérico compartilhado com o resto do app em modal.js) — por isso
// controlamos show/hide manualmente aqui, sem precisar do JS do Bootstrap.
function abrirModalAlunoVisto(innerHtml) {
  const modalEl = document.getElementById("modal-aluno-visto");
  const corpo = document.getElementById("modal-aluno-visto-conteudo");
  const backdrop = document.getElementById("modal-backdrop-visto");
  if (!modalEl || !corpo) return;
  corpo.innerHTML = innerHtml;
  modalEl.classList.add("show");
  modalEl.style.display = "block";
  modalEl.removeAttribute("aria-hidden");
  if (backdrop) {
    backdrop.style.display = "block";
    backdrop.classList.add("show");
  }
}

function fecharModalAlunoVisto() {
  const modalEl = document.getElementById("modal-aluno-visto");
  const backdrop = document.getElementById("modal-backdrop-visto");
  if (modalEl) {
    modalEl.classList.remove("show");
    modalEl.style.display = "none";
    modalEl.setAttribute("aria-hidden", "true");
  }
  if (backdrop) {
    backdrop.classList.remove("show");
    backdrop.style.display = "none";
  }
}

// Toast leve de confirmação (só CSS do Bootstrap — sem carregar o JS dele,
// pra manter o Visto isolado do resto do app com o mínimo de peso extra).
// Opcionalmente ganha um botão "Desfazer" quando a ação passa um
// aoDesfazer() — nesse caso fica visível um pouco mais tempo.
let timeoutToastVisto = null;
let _toastVistoDesfazer = null;
function mostrarToastVisto(mensagem, opcoes) {
  const toast = document.getElementById("toast-visto");
  const corpo = document.getElementById("toast-visto-corpo");
  if (!toast || !corpo) return;
  _toastVistoDesfazer = (opcoes && opcoes.aoDesfazer) || null;
  corpo.innerHTML = `<span>${escaparHtml(mensagem)}</span>` + (
    _toastVistoDesfazer
      ? ` <button type="button" class="btn btn-sm btn-link p-0 ms-2 toast-desfazer-btn" onclick="executarDesfazerToastVisto()">Desfazer</button>`
      : ""
  );
  toast.classList.add("show");
  clearTimeout(timeoutToastVisto);
  timeoutToastVisto = setTimeout(() => {
    toast.classList.remove("show");
    _toastVistoDesfazer = null;
  }, _toastVistoDesfazer ? 4200 : 1800);
}

function executarDesfazerToastVisto() {
  if (_toastVistoDesfazer) {
    _toastVistoDesfazer();
    _toastVistoDesfazer = null;
  }
  const toast = document.getElementById("toast-visto");
  if (toast) toast.classList.remove("show");
  clearTimeout(timeoutToastVisto);
}

function renderConteudoVisto() {
  if (!estadoVisto.turmaId) {
    return `<div class="alert alert-light vazio-aviso">Selecione uma turma na lista ao lado para ver ou lançar vistos.</div>`;
  }

  let html = `<select class="form-select mb-2" id="select-disciplina-visto" onchange="mudarDisciplinaVisto(this.value)">
    <option value="">Selecione a disciplina…</option>`;
  estadoVisto.disciplinas.forEach((d) => {
    html += `<option value="${d.id}" ${d.id === estadoVisto.disciplinaId ? "selected" : ""}>${escaparHtml(d.nome)}</option>`;
  });
  html += `</select>`;

  html += `<p style="margin:10px 0 18px;">
    <a href="#" onclick="event.preventDefault(); executarManutencaoVistoGlobal();" style="font-size:0.78rem; color: var(--tinta-suave);">
      <i class="bi bi-wrench-adjustable"></i> Corrigir vistos antigos de todas as turmas (prazo vencido → Não fez, e remover desconto de material)
    </a>
  </p>`;

  if (!estadoVisto.disciplinaId) {
    return html + `<div class="alert alert-light vazio-aviso">Selecione a disciplina para ver ou lançar atividades.</div>`;
  }

  html += `
    <div class="coluna-titulo">
      <h2>Atividades</h2>
      <button class="btn btn-sm btn-primary btn-add" onclick="abrirFormAtividade()"><i class="bi bi-plus-lg"></i> Nova atividade</button>
    </div>
  `;

  if (estadoVisto.atividades.length === 0) {
    html += `<div class="alert alert-light vazio-aviso">Nenhuma atividade cadastrada ainda para esta disciplina, nesta turma.</div>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoVisto.atividades.forEach((a) => {
      const selecionada = estadoVisto.atividadeAtual && estadoVisto.atividadeAtual.id === a.id;
      const outrasTurmas = a.turmaIds.length > 1 ? ` · aplicada a ${a.turmaIds.length} turmas` : "";
      html += `
        <div class="card card-body atividade-card ${selecionada ? "selecionada" : ""}" onclick="selecionarAtividade('${a.id}')">
          <span class="acoes-atividade-card">
            <button class="btn btn-sm btn-light" onclick="event.stopPropagation(); abrirFormEditarAtividade('${a.id}')" title="Editar atividade"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-light" onclick="event.stopPropagation(); confirmarExclusaoAtividade('${a.id}')" title="Excluir atividade"><i class="bi bi-trash"></i></button>
          </span>
          <div class="atividade-titulo">${escaparHtml(a.titulo)}</div>
          <div class="atividade-prazo">${a.data ? formatarDataBr(a.data) + " · " : ""}${a.prazo ? "Prazo: " + formatarDataBr(a.prazo) : "Sem prazo definido"}${outrasTurmas}</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  if (estadoVisto.atividadeAtual) {
    html += `<h2 style="font-family:'Fraunces',serif; color:var(--acento); margin-top:24px;">Alunos — ${escaparHtml(estadoVisto.atividadeAtual.titulo)}</h2>`;
    if (estadoVisto.atividadeAtual.descricao) {
      html += `<p style="font-size:0.85rem; opacity:0.8; margin-top:-8px;">${escaparHtml(estadoVisto.atividadeAtual.descricao)}</p>`;
    }
    html += renderResumoProgresso();
    html += `<div class="d-flex gap-2 flex-wrap mb-3">
      <button class="btn btn-sm btn-outline-secondary btn-secundario" onclick="confirmarMarcarTodosEntregue()"><i class="bi bi-check2-all"></i> Marcar quem falta como Entregue</button>
      <button class="btn btn-sm btn-outline-secondary btn-secundario" onclick="exportarAtividadeCsv()"><i class="bi bi-download"></i> Exportar CSV</button>
    </div>`;

    html += `<div class="d-flex gap-2 align-items-center flex-wrap mb-2">`;
    if (estadoVisto.alunos.length > 5) {
      html += `<input type="text" class="form-control campo-busca" style="flex:1; min-width:180px; margin-bottom:0;" placeholder="Buscar aluno…" value="${escaparHtml(estadoVisto.termoBuscaAlunos)}" oninput="buscarAlunoVisto(this.value)" />`;
    }
    html += `<button class="btn btn-sm btn-outline-secondary btn-secundario ${estadoVisto.modoSelecaoVarios ? "aba-ativa-tab active" : ""}" style="white-space:nowrap;" onclick="alternarModoSelecaoVisto()">${estadoVisto.modoSelecaoVarios ? '<i class="bi bi-x-lg"></i> Cancelar seleção' : '<i class="bi bi-check2-square"></i> Selecionar vários'}</button>`;
    html += `</div>`;

    html += `<div class="d-flex gap-2 align-items-center flex-wrap mb-3">
      <select class="form-select form-select-sm" style="width:auto;" onchange="mudarOrdemAlunosVisto(this.value)">
        <option value="nome" ${estadoVisto.ordemAlunos === "nome" ? "selected" : ""}>Ordenar: nome (Nº)</option>
        <option value="pendentes" ${estadoVisto.ordemAlunos === "pendentes" ? "selected" : ""}>Ordenar: quem falta primeiro</option>
        <option value="nota-desc" ${estadoVisto.ordemAlunos === "nota-desc" ? "selected" : ""}>Ordenar: maior nota primeiro</option>
        <option value="nota-asc" ${estadoVisto.ordemAlunos === "nota-asc" ? "selected" : ""}>Ordenar: menor nota primeiro</option>
      </select>
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="chk-apenas-faltando-visto" ${estadoVisto.apenasFaltando ? "checked" : ""} onchange="alternarApenasFaltandoVisto(this.checked)">
        <label class="form-check-label" for="chk-apenas-faltando-visto" style="font-size:0.85rem;">Só quem falta lançar</label>
      </div>
    </div>`;

    const termo = estadoVisto.termoBuscaAlunos.trim().toLowerCase();
    let alunosFiltrados = termo
      ? estadoVisto.alunos.filter((a) => a.nome.toLowerCase().includes(termo))
      : estadoVisto.alunos.slice();

    if (estadoVisto.apenasFaltando) {
      alunosFiltrados = alunosFiltrados.filter((a) => {
        const v = estadoVisto.vistos[a.id];
        return !v || v.notaBruta === null || v.notaBruta === undefined;
      });
    }

    if (estadoVisto.ordemAlunos !== "nome") {
      alunosFiltrados = alunosFiltrados.slice().sort((a, b) => {
        const va = estadoVisto.vistos[a.id];
        const vb = estadoVisto.vistos[b.id];
        const notaA = va && va.notaBruta !== null && va.notaBruta !== undefined ? va.notaBruta : null;
        const notaB = vb && vb.notaBruta !== null && vb.notaBruta !== undefined ? vb.notaBruta : null;
        if (estadoVisto.ordemAlunos === "pendentes") {
          if (notaA === null && notaB !== null) return -1;
          if (notaA !== null && notaB === null) return 1;
          return 0;
        }
        // nota-desc / nota-asc — quem não tem nota fica sempre por último
        if (notaA === null && notaB === null) return 0;
        if (notaA === null) return 1;
        if (notaB === null) return -1;
        return estadoVisto.ordemAlunos === "nota-desc" ? notaB - notaA : notaA - notaB;
      });
    }

    if (estadoVisto.alunos.length === 0) {
      html += `<div class="alert alert-light vazio-aviso">Esta turma ainda não tem alunos cadastrados.</div>`;
    } else if (!estadoVisto.vistosCarregados) {
      html += renderEsqueletoCartoesVisto();
    } else if (alunosFiltrados.length === 0) {
      html += `<div class="alert alert-light vazio-aviso">Nenhum aluno encontrado para "${escaparHtml(termo)}".</div>`;
    } else {
      html += `<div class="grade-alunos-visto">`;
      alunosFiltrados.forEach((aluno) => {
        const idxOriginal = estadoVisto.alunos.findIndex((a) => a.id === aluno.id);
        const cor = PALETA_AVATAR_VISTO[idxOriginal % PALETA_AVATAR_VISTO.length];
        const v = estadoVisto.vistos[aluno.id];
        const statusClasse = classeStatusCartaoVisto(v);
        const selecionado = estadoVisto.selecionados.has(aluno.id);
        const aoClicar = estadoVisto.modoSelecaoVarios
          ? `alternarSelecaoAlunoVisto('${aluno.id}')`
          : `abrirMenuStatusAluno('${aluno.id}')`;

        const notaBruta = v ? v.notaBruta : null;
        const botoesNotaRapida = estadoVisto.modoSelecaoVarios ? "" : `
          <div class="btn-group notas-rapidas-card" onclick="event.stopPropagation();">
            <button class="btn btn-sm nota-rapida-botao ${notaBruta === 100 ? "ativo n100" : ""}" title="Entregue — nota 100" onclick="marcarNota('${aluno.id}',100)">100</button>
            <button class="btn btn-sm nota-rapida-botao ${notaBruta === 75 ? "ativo n75" : ""}" title="Entregue com desconto — nota 75" onclick="marcarNota('${aluno.id}',75)">75</button>
            <button class="btn btn-sm nota-rapida-botao ${notaBruta === 50 ? "ativo n50" : ""}" title="Entregue com desconto — nota 50" onclick="marcarNota('${aluno.id}',50)">50</button>
            <button class="btn btn-sm nota-rapida-botao ${notaBruta === 25 ? "ativo n25" : ""}" title="Entregue com desconto — nota 25" onclick="marcarNota('${aluno.id}',25)">25</button>
            <button class="btn btn-sm nota-rapida-botao ${notaBruta === 0 ? "ativo n0" : ""}" title="Não fez / recusou" onclick="marcarNota('${aluno.id}',0)">NF</button>
            <button class="btn btn-sm nota-rapida-botao nota-rapida-material ${v && v.materialEsquecido ? "ativo" : ""}" onclick="toggleMaterial('${aluno.id}')" title="Esqueceu material"><i class="bi bi-box-seam"></i></button>
          </div>
        `;

        const ativoTeclado = aluno.id === estadoVisto.alunoAtivoTeclado;
        html += `
          <div class="card cartao-aluno-visto ${statusClasse} ${selecionado ? "selecionado-lote" : ""} ${ativoTeclado ? "cartao-ativo-teclado" : ""}" data-aluno-id="${aluno.id}" onclick="ativarCartaoTeclado('${aluno.id}'); ${aoClicar}">
            <span class="status-icone-cartao-visto"><i class="bi ${iconeStatusCartaoVisto(statusClasse)}"></i></span>
            ${selecionado ? `<span class="marca-selecao-lote">✓</span>` : ""}
            <span class="avatar-aluno-visto" style="background:${cor.bg}; color:${cor.fg};">${iniciaisAluno(aluno.nome)}</span>
            <span class="nome-aluno-visto">${escaparHtml(aluno.nome)}</span>
            <span class="numero-aluno-visto">Nº ${idxOriginal + 1}</span>
            ${botoesNotaRapida}
          </div>
        `;
      });
      html += `</div>`;
    }

    if (estadoVisto.modoSelecaoVarios && estadoVisto.selecionados.size > 0) {
      html += `
        <div class="barra-selecao-lote">
          <span><strong>${estadoVisto.selecionados.size}</strong> selecionado(s) — aplicar:</span>
          <div class="btn-group status-botoes">
            <button class="btn btn-sm status-botao st-100" onclick="aplicarNotaEmLote(100)">Entregue</button>
            <button class="btn btn-sm status-botao st-75" onclick="aplicarNotaEmLote(75)">75%</button>
            <button class="btn btn-sm status-botao st-50" onclick="aplicarNotaEmLote(50)">50%</button>
            <button class="btn btn-sm status-botao st-25" onclick="aplicarNotaEmLote(25)">25%</button>
            <button class="btn btn-sm status-botao st-0" onclick="aplicarNotaEmLote(0)">Não fez</button>
          </div>
        </div>
      `;
    }
  }

  return html;
}

// "Esqueleto" dos cartões enquanto o 1º snapshot de vistos da atividade
// ainda não chegou — dá a sensação de carregamento rápido, em vez de uma
// tela vazia ou um spinner solto.
function renderEsqueletoCartoesVisto() {
  const quantidade = Math.min(estadoVisto.alunos.length, 8);
  let html = `<div class="grade-alunos-visto" aria-hidden="true">`;
  for (let i = 0; i < quantidade; i++) {
    html += `
      <div class="card cartao-aluno-visto cartao-esqueleto">
        <span class="esqueleto-bloco esqueleto-avatar"></span>
        <span class="esqueleto-bloco esqueleto-linha-nome"></span>
        <span class="esqueleto-bloco esqueleto-linha-numero"></span>
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

function confirmarMarcarTodosEntregue() {
  const faltantes = estadoVisto.alunos.filter((a) => {
    const v = estadoVisto.vistos[a.id];
    return !v || v.notaBruta === null || v.notaBruta === undefined;
  });
  if (faltantes.length === 0) {
    alert("Não há ninguém faltando marcar nesta atividade.");
    return;
  }
  abrirModalAlunoVisto(`
    <div class="modal-header">
      <h5 class="modal-title">Marcar quem falta como Entregue</h5>
      <button type="button" class="btn-close" onclick="fecharModalAlunoVisto()"></button>
    </div>
    <div class="modal-body">
      <p>Isso marca ${faltantes.length} aluno(s) que ainda estão "Falta" como Entregue (100%). Quem já tem nota lançada não é alterado. Deseja continuar?</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModalAlunoVisto()">Cancelar</button>
      <button class="btn btn-primary" onclick="marcarTodosEntregue()">Marcar todos</button>
    </div>
  `);
}

async function marcarTodosEntregue() {
  try {
    const faltantes = estadoVisto.alunos.filter((a) => {
      const v = estadoVisto.vistos[a.id];
      return !v || v.notaBruta === null || v.notaBruta === undefined;
    });

    const lote = db.batch();
    faltantes.forEach((aluno) => {
      const v = estadoVisto.vistos[aluno.id] || {};
      const materialEsquecido = !!v.materialEsquecido;
      const notaFinal = 100;
      const docId = `${estadoVisto.turmaId}_${aluno.id}`;
      lote.set(db.collection("atividades").doc(estadoVisto.atividadeAtual.id).collection("vistos").doc(docId), {
        turmaId: estadoVisto.turmaId,
        alunoId: aluno.id,
        notaBruta: 100,
        materialEsquecido,
        novaData: v.novaData || null,
        notaFinal,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    lote.update(db.collection("atividades").doc(estadoVisto.atividadeAtual.id), {
      [`pendentesPorTurma.${estadoVisto.turmaId}`]: firebase.firestore.FieldValue.increment(-faltantes.length),
    });
    await lote.commit();
    fecharModalAlunoVisto();
    mostrarToastVisto(`${faltantes.length} aluno(s) marcado(s) como Entregue`, {
      aoDesfazer: () => {
        const loteDesfazer = db.batch();
        faltantes.forEach((aluno) => {
          const docId = `${estadoVisto.turmaId}_${aluno.id}`;
          loteDesfazer.update(
            db.collection("atividades").doc(estadoVisto.atividadeAtual.id).collection("vistos").doc(docId),
            { notaBruta: null, notaFinal: null, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }
          );
        });
        loteDesfazer.update(db.collection("atividades").doc(estadoVisto.atividadeAtual.id), {
          [`pendentesPorTurma.${estadoVisto.turmaId}`]: firebase.firestore.FieldValue.increment(faltantes.length),
        });
        loteDesfazer.commit().catch(() => {});
      },
    });
  } catch (err) {
    alert("Erro ao marcar: " + err.message);
  }
}

function exportarAtividadeCsv() {
  const a = estadoVisto.atividadeAtual;
  const linhas = [["Aluno", "Nota bruta (%)", "Esqueceu material", "Nota final (%)"]];

  estadoVisto.alunos.forEach((aluno) => {
    const v = estadoVisto.vistos[aluno.id] || {};
    linhas.push([
      aluno.nome,
      v.notaBruta ?? "",
      v.materialEsquecido ? "Sim" : "Não",
      v.notaFinal ?? "",
    ]);
  });

  const csv = linhas
    .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  // \ufeff no início ajuda o Excel a reconhecer acentos (UTF-8 com BOM).
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const nomeArquivo = (a.titulo || "atividade").replace(/[^a-zA-Z0-9À-ÖØ-öø-ÿ -]/g, "").trim() || "atividade";
  link.href = url;
  link.download = `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderResumoProgresso() {
  const total = estadoVisto.alunos.length;
  if (total === 0) return "";

  let lancados = 0;
  let material = 0;
  estadoVisto.alunos.forEach((aluno) => {
    const v = estadoVisto.vistos[aluno.id];
    const temNota = v && v.notaBruta !== null && v.notaBruta !== undefined;
    if (temNota) lancados++;
    // Só conta como "pendente" quem ainda não entregou na nova data —
    // quem já entregou (ou foi marcado "Não fez") não está mais esperando.
    if (v && v.materialEsquecido && !temNota) material++;
  });

  const faltam = total - lancados;
  const pct = Math.round((lancados / total) * 100);
  return `
    <div class="progress mb-1" style="height: 8px;" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar ${faltam === 0 ? "bg-success" : ""}" style="width: ${pct}%;"></div>
    </div>
    <p style="font-size:0.85rem; opacity:0.85; margin: 0 0 14px;">
      <strong>${lancados}</strong> de <strong>${total}</strong> lançados
      ${faltam > 0 ? `· <span style="color: var(--erro);">${faltam} faltando</span>` : "· tudo lançado ✓"}
      ${material > 0 ? `· ${material} com material pendente` : ""}
    </p>
  `;
}

function formatarDataBr(dataIso) {
  const partes = dataIso.split("-");
  if (partes.length !== 3) return dataIso;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}
