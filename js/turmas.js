// ============================================================
// Etapa 3 — Cadastro de turmas, disciplinas e alunos
//
// "Escola" é um CAMPO DE TEXTO na própria turma (igual ao Vistos.exe
// desktop) — não é uma entidade separada com navegação própria. Isso
// evita o erro de hierarquia rígida que já causou problema antes
// (ver working-notes.md: "Disciplina as mandatory hierarchy mistake").
// A tela apenas AGRUPA visualmente as turmas pelo texto da escola.
// ============================================================

const painelTurmas = document.getElementById("painel-turmas");

// Data de hoje no FUSO LOCAL do navegador, não em UTC — usada em todos os
// módulos para "data de hoje" (nova chamada, prazo vencido, transferência…).
// new Date().toISOString() sempre devolve a data em UTC: no Brasil
// (UTC-3), depois de ~21h o relógio local já virou o dia seguinte em UTC,
// então usar toISOString() direto grava a data ERRADA (amanhã) em vez de
// hoje. Essas duas funções convertem usando o fuso local do dispositivo.
function dataParaIsoLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
function hojeLocalISO() {
  return dataParaIsoLocal(new Date());
}

const estadoTurmas = {
  turmas: [],           // todas as turmas do usuário {id, nome, escola, ...}
  turmaAtual: null,      // {id, nome, escola}
  disciplinasDaTurma: [],
  alunosDaTurma: [],
  resumoPendencias: {},  // { turmaId: quantidade de "faltante" em aberto }
  termoBuscaAlunos: "",
  carregado: false,      // true assim que a 1ª leitura de turmas chega (local ou servidor) — usado pra diferenciar "ainda carregando" de "realmente não tem turma nenhuma"
};

let unsubTurmas = null;
let unsubDisciplinas = null;
let unsubAlunos = null;
let unsubResumoPendencias = null;

// Disciplinas ainda não salvas, escolhidas durante a criação de uma
// turma nova (antes de a turma existir no Firestore).
let disciplinasTempNovaTurma = [];
let mostrandoSubFormDisciplina = false;

async function initTurmas() {
  await sincronizarContagensDisciplinas();

  if (unsubTurmas) unsubTurmas();
  unsubTurmas = db.collection("turmas").orderBy("nome").onSnapshot((snap) => {
    estadoTurmas.turmas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    estadoTurmas.carregado = true;
    renderPainelTurmas();
    // Se o Visto estiver aberto no momento em que a 1ª leitura chega, atualiza
    // a barra lateral dele também (ela só troca de "carregando" pra lista
    // quando o painel é re-renderizado).
    if (typeof painelVisto !== "undefined" && painelVisto && painelVisto.style.display !== "none") {
      renderVisto();
    }
  });

  // Soma, por turma, quantos "faltante" existem em aberto somando o
  // pendentesPorTurma de cada atividade — dá o selo de pendências na
  // lista de Turmas, sem precisar baixar os vistos, um por um.
  if (unsubResumoPendencias) unsubResumoPendencias();
  unsubResumoPendencias = db.collection("atividades").onSnapshot((snap) => {
    const resumo = {};
    snap.docs.forEach((d) => {
      const pend = d.data().pendentesPorTurma || {};
      Object.keys(pend).forEach((turmaId) => {
        resumo[turmaId] = (resumo[turmaId] || 0) + (pend[turmaId] || 0);
      });
    });
    estadoTurmas.resumoPendencias = resumo;
    renderPainelTurmas();
  });

  renderPainelTurmas();
}

// Backfill único: garante que toda turma tenha o campo qtdDisciplinas
// (usado para colorir o cartão de verde/vermelho). Turmas que já têm
// o campo são ignoradas — roda rápido depois da primeira vez.
async function sincronizarContagensDisciplinas() {
  try {
    const turmasSnap = await db.collection("turmas").get();
    for (const t of turmasSnap.docs) {
      const discSnap = await t.ref.collection("disciplinas").get();

      if (t.data().qtdDisciplinas === undefined) {
        await t.ref.update({ qtdDisciplinas: discSnap.size });
      }

      // Backfill dos campos normalizados, usados para localizar disciplinas
      // da mesma escola/nome em outras turmas mesmo com maiúscula/espaço
      // diferente na digitação original.
      for (const dd of discSnap.docs) {
        const dados = dd.data();
        const ajuste = {};
        if (dados.nomeNormalizado === undefined && dados.nome) {
          ajuste.nomeNormalizado = dados.nome.trim().toLowerCase();
        }
        if (dados.escolaNormalizado === undefined && dados.escola) {
          ajuste.escolaNormalizado = dados.escola.trim().toLowerCase();
        }
        if (Object.keys(ajuste).length > 0) {
          await dd.ref.update(ajuste);
        }
      }
    }
  } catch (err) {
    console.warn("Sincronização de contagem de disciplinas falhou (não é crítico):", err);
  }
}

async function atualizarContagemDisciplinas(turmaId) {
  try {
    const snap = await db.collection("turmas").doc(turmaId).collection("disciplinas").get();
    await db.collection("turmas").doc(turmaId).update({ qtdDisciplinas: snap.size });
  } catch (err) {
    console.warn("Não foi possível atualizar a contagem de disciplinas:", err);
  }
}

function renderPainelTurmas() {
  if (!estadoTurmas.turmaAtual) {
    renderListaTurmasAgrupada();
  } else {
    renderDetalheTurma();
  }
}

// ---------- Lista de turmas agrupada por escola (texto) ----------

function renderListaTurmasAgrupada() {
  let html = `
    <div class="coluna-titulo">
      <h2>Turmas</h2>
      <button class="btn-add" onclick="abrirFormTurma()">+ Nova turma</button>
    </div>
  `;

  if (estadoTurmas.turmas.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma turma cadastrada ainda.</p>`;
    painelTurmas.innerHTML = html;
    return;
  }

  const grupos = {};
  estadoTurmas.turmas.forEach((t) => {
    const chave = t.escola && t.escola.trim() ? t.escola.trim() : "(sem escola)";
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(t);
  });

  Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((escola) => {
    html += `<h3 class="grupo-escola-titulo">${escaparHtml(escola)} <span class="grupo-escola-contagem">· ${grupos[escola].length} turma(s)</span></h3>`;
    html += `<div class="turmas-grade">`;
    grupos[escola].forEach((turma) => {
      const qtd = turma.qtdDisciplinas || 0;
      const completa = qtd > 0;
      const pend = estadoTurmas.resumoPendencias[turma.id] || 0;
      html += `
        <div class="turma-tile ${completa ? "completa" : ""}" onclick="selecionarTurma('${turma.id}')" title="${completa ? qtd + " disciplina(s) cadastrada(s)" : "Sem disciplina cadastrada"}">
          ${pend > 0 ? `<span class="selo-pendencia">${pend}</span>` : ""}
          <span class="acoes-item">
            <button onclick="event.stopPropagation(); abrirFormTurma('${turma.id}')">✎</button>
            <button onclick="event.stopPropagation(); confirmarExclusaoTurma('${turma.id}')">🗑</button>
          </span>
          <span class="nome-item">${escaparHtml(turma.nome)}</span>
          <span class="subinfo-item">${completa ? qtd + " disciplina(s)" : "Sem disciplina"}</span>
        </div>
      `;
    });
    html += `</div>`;
  });

  painelTurmas.innerHTML = html;
}

function nomesDeEscolasConhecidas() {
  const nomes = new Set(estadoTurmas.turmas.map((t) => t.escola).filter(Boolean));
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function abrirFormTurma(id) {
  const turma = id ? estadoTurmas.turmas.find((t) => t.id === id) : null;
  const podeEditarProfessores = turma && (eWebmaster() || temPapel("direcao") || temPapel("coordenacao"));

  if (!turma) {
    disciplinasTempNovaTurma = [];
    mostrandoSubFormDisciplina = false;
  }

  abrirModal(`
    <h3>${turma ? "Editar turma" : "Nova turma"}</h3>
    <div class="campo-form">
      <label>Escola</label>
      <select id="input-escolaId-turma">
        <option value="">Selecione a escola…</option>
        ${estadoEscolas.escolas.map((e) => `<option value="${e.id}" ${turma && turma.escolaId === e.id ? "selected" : ""}>${escaparHtml(e.nome)}</option>`).join("")}
      </select>
      ${estadoEscolas.escolas.length === 0 ? `<p class="vazio-aviso" style="padding:4px 0 0;">Nenhuma escola cadastrada ainda — peça ao Webmaster para cadastrar em "Admin › Escolas".</p>` : ""}
    </div>
    <div class="campo-form">
      <label>Nome da turma</label>
      <input type="text" id="input-nome-turma" value="${turma ? escaparHtml(turma.nome) : ""}" placeholder="Ex: 3º Módulo Química Noturno" />
    </div>
    ${podeEditarProfessores ? `
    <div class="campo-form">
      <label>Professores responsáveis (um e-mail por linha)</label>
      <textarea id="input-professores-turma" placeholder="professor@gmail.com">${(turma.professoresEmails || []).join("\n")}</textarea>
    </div>
    ` : ""}
    ${!turma ? `
    <div class="campo-form">
      <label>Disciplinas desta turma</label>
      <div id="secao-disciplinas-temp"></div>
    </div>
    ` : ""}
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarTurma('${turma ? turma.id : ""}')">Salvar</button>
    </div>
  `);

  if (!turma) renderSecaoDisciplinasTemp();
}

// Seção "Disciplinas desta turma" dentro do modal de Nova turma — lista
// as já adicionadas (ainda em memória, não salvas) e alterna entre o
// botão "+ Adicionar disciplina" e o mini-formulário inline.
function renderSecaoDisciplinasTemp() {
  const container = document.getElementById("secao-disciplinas-temp");
  if (!container) return;

  let html = "";

  if (disciplinasTempNovaTurma.length > 0) {
    html += `<div style="margin-bottom:8px;">`;
    disciplinasTempNovaTurma.forEach((d, i) => {
      const sistemaLabel = d.sistemaAvaliacao === "mencao" ? "Menções" : "Porcentagem";
      html += `
        <div class="tag" style="width:100%; justify-content:space-between; margin-bottom:4px;">
          <span>${escaparHtml(d.nome)} — ${sistemaLabel}</span>
          <button type="button" onclick="removerDisciplinaTemp(${i})">✕</button>
        </div>
      `;
    });
    html += `</div>`;
  }

  if (mostrandoSubFormDisciplina) {
    html += `
      <div style="border:1px solid var(--linha); border-radius:8px; padding:10px; margin-bottom:4px;">
        <div class="campo-form" style="margin-bottom:8px;">
          <input type="text" id="input-nome-disc-temp" placeholder="Nome da disciplina" />
        </div>
        <div class="opcoes-radio" style="margin-bottom:10px;">
          <label><input type="radio" name="sistema-disc-temp" value="mencao" checked /> Menções</label>
          <label><input type="radio" name="sistema-disc-temp" value="porcentagem" /> Porcentagem</label>
        </div>
        <button type="button" class="btn-primario" style="padding:6px 14px; font-size:0.85rem;" onclick="confirmarAdicionarDisciplinaTemp()">Adicionar</button>
        <button type="button" class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="cancelarSubFormDisciplinaTemp()">Cancelar</button>
      </div>
    `;
  } else {
    html += `<button type="button" class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="mostrandoSubFormDisciplina = true; renderSecaoDisciplinasTemp();">+ Adicionar disciplina</button>`;
  }

  container.innerHTML = html;
  const inputNome = document.getElementById("input-nome-disc-temp");
  if (inputNome) inputNome.focus();
}

function cancelarSubFormDisciplinaTemp() {
  mostrandoSubFormDisciplina = false;
  renderSecaoDisciplinasTemp();
}

function removerDisciplinaTemp(indice) {
  disciplinasTempNovaTurma.splice(indice, 1);
  renderSecaoDisciplinasTemp();
}

function confirmarAdicionarDisciplinaTemp() {
  const nome = document.getElementById("input-nome-disc-temp").value.trim();
  if (!nome) {
    alert("Digite o nome da disciplina.");
    return;
  }
  const sistemaAvaliacao = document.querySelector('input[name="sistema-disc-temp"]:checked').value;
  disciplinasTempNovaTurma.push({ nome, sistemaAvaliacao });
  mostrandoSubFormDisciplina = false;
  renderSecaoDisciplinasTemp();
}

async function salvarTurma(id) {
  const escolaId = document.getElementById("input-escolaId-turma").value;
  const nome = document.getElementById("input-nome-turma").value.trim();
  if (!escolaId) {
    alert("Selecione a escola.");
    return;
  }
  if (!nome) {
    alert("Digite o nome da turma.");
    return;
  }
  const escola = nomeDaEscola(escolaId);
  const dados = { nome, escola, escolaId };

  const campoProfessores = document.getElementById("input-professores-turma");
  if (campoProfessores) {
    const professoresEmails = campoProfessores.value
      .split("\n")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (professoresEmails.length > 0) dados.professoresEmails = professoresEmails;
  }

  try {
    if (id) {
      const turmaAntes = estadoTurmas.turmas.find((t) => t.id === id);
      const escolaMudou = turmaAntes && (turmaAntes.escola || "") !== escola;

      await db.collection("turmas").doc(id).update(dados);

      // As disciplinas guardam escola/escolaNormalizado copiados da turma
      // (usados nas buscas "outras turmas compatíveis" do Visto e do
      // Seminário) — sem isso, renomear a escola da turma deixa essas
      // buscas comparando contra o nome antigo, silenciosamente.
      if (escolaMudou) {
        const discSnap = await db.collection("turmas").doc(id).collection("disciplinas").get();
        if (!discSnap.empty) {
          const loteDisc = db.batch();
          discSnap.docs.forEach((d) => {
            loteDisc.update(d.ref, { escola, escolaNormalizado: escola.trim().toLowerCase() });
          });
          await loteDisc.commit();
        }
      }
    } else {
      if (!dados.professoresEmails) dados.professoresEmails = [estadoUsuarioAtual.email];
      const novaRef = await db.collection("turmas").add({
        ...dados,
        qtdDisciplinas: disciplinasTempNovaTurma.length,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });

      if (disciplinasTempNovaTurma.length > 0) {
        const lote = db.batch();
        disciplinasTempNovaTurma.forEach((d) => {
          const discRef = novaRef.collection("disciplinas").doc();
          const dadosDisc = {
            nome: d.nome,
            nomeNormalizado: d.nome.trim().toLowerCase(),
            sistemaAvaliacao: d.sistemaAvaliacao,
            escola,
            escolaNormalizado: escola.trim().toLowerCase(),
            turmaId: novaRef.id,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          };
          if (d.sistemaAvaliacao === "mencao") {
            dadosDisc.faixasMencao = { I: 0, R: 40, B: 60, MB: 80 };
          }
          lote.set(discRef, dadosDisc);
        });
        await lote.commit();
      }

      disciplinasTempNovaTurma = [];
    }
    fecharModal();
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  }
}

function confirmarExclusaoTurma(id) {
  const turma = estadoTurmas.turmas.find((t) => t.id === id);
  abrirModal(`
    <h3>Excluir turma</h3>
    <p>Tem certeza que deseja excluir "${escaparHtml(turma.nome)}" (${escaparHtml(turma.escola || "")})? Isso também apaga os alunos e disciplinas cadastrados nela.</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirTurma('${id}')">Excluir</button>
    </div>
  `);
}

async function excluirTurma(id) {
  try {
    // Firestore não apaga subcoleções sozinho quando o documento pai é
    // excluído — tem que apagar cada uma explicitamente, senão o histórico
    // de chamada e os pesos configurados ficam órfãos no banco para sempre.
    const [alunosSnap, discSnap, chamadasSnap, pesosSnap] = await Promise.all([
      db.collection("turmas").doc(id).collection("alunos").get(),
      db.collection("turmas").doc(id).collection("disciplinas").get(),
      db.collection("turmas").doc(id).collection("chamadas").get(),
      db.collection("turmas").doc(id).collection("pesos").get(),
    ]);

    const todosDocs = [
      ...alunosSnap.docs, ...discSnap.docs, ...chamadasSnap.docs, ...pesosSnap.docs,
    ];
    for (let i = 0; i < todosDocs.length; i += 450) {
      const lote = db.batch();
      todosDocs.slice(i, i + 450).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
    await db.collection("turmas").doc(id).delete();

    await limparAtividadesOrfasDaTurma(id);

    fecharModal();
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

// Ao excluir uma turma, tira ela de qualquer atividade em que estava
// aplicada: se a turma era a única, apaga a atividade inteira (e seus
// vistos); se era uma entre várias, só remove essa turma da lista e
// apaga os vistos dela, mantendo a atividade intacta para as demais.
async function limparAtividadesOrfasDaTurma(turmaId) {
  try {
    const snap = await db.collection("atividades").where("turmaIds", "array-contains", turmaId).get();

    for (const doc of snap.docs) {
      const vistosSnap = await doc.ref.collection("vistos").where("turmaId", "==", turmaId).get();
      const turmaIds = doc.data().turmaIds || [];

      if (turmaIds.length <= 1) {
        const loteTotal = db.batch();
        const todosVistos = await doc.ref.collection("vistos").get();
        todosVistos.docs.forEach((v) => loteTotal.delete(v.ref));
        loteTotal.delete(doc.ref);
        await loteTotal.commit();
      } else {
        const lote = db.batch();
        vistosSnap.docs.forEach((v) => lote.delete(v.ref));
        lote.update(doc.ref, {
          turmaIds: firebase.firestore.FieldValue.arrayRemove(turmaId),
          [`pendentesPorTurma.${turmaId}`]: firebase.firestore.FieldValue.delete(),
        });
        await lote.commit();
      }
    }

    // Atividades de Seminário não são compartilhadas entre turmas (ao
    // contrário das de Visto) — cada uma pertence a uma única turma, então
    // ao excluir a turma a atividade inteira é apagada junto.
    const snapSeminario = await db.collection("atividadesSeminario").where("turmaId", "==", turmaId).get();
    if (!snapSeminario.empty) {
      const loteSeminario = db.batch();
      snapSeminario.docs.forEach((d) => loteSeminario.delete(d.ref));
      await loteSeminario.commit();
    }
  } catch (err) {
    console.warn("Não foi possível limpar atividades órfãs (não é crítico):", err);
  }
}

function selecionarTurma(id) {
  const turma = estadoTurmas.turmas.find((t) => t.id === id);
  estadoTurmas.turmaAtual = turma;
  estadoTurmas.termoBuscaAlunos = "";

  if (unsubDisciplinas) unsubDisciplinas();
  unsubDisciplinas = db.collection("turmas").doc(id).collection("disciplinas").orderBy("nome").onSnapshot((snap) => {
    estadoTurmas.disciplinasDaTurma = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPainelTurmas();
  });

  if (unsubAlunos) unsubAlunos();
  unsubAlunos = db.collection("turmas").doc(id).collection("alunos").orderBy("nome").onSnapshot((snap) => {
    estadoTurmas.alunosDaTurma = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPainelTurmas();
  });

  renderPainelTurmas();
}

function buscarAlunoTurma(valor) {
  estadoTurmas.termoBuscaAlunos = valor;
  renderPainelTurmas();
  // O innerHTML é recriado a cada letra digitada — sem isso, o campo
  // perderia o foco a cada tecla. Busca só DENTRO do painel de Turmas:
  // como a aba Visto também pode ter um campo de busca escondido na
  // mesma página, um seletor sem esse escopo pegava o campo errado e
  // fazia o foco sumir depois da primeira letra.
  const campo = document.querySelector("#painel-turmas .campo-busca");
  if (campo) {
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

function voltarParaListaTurmas() {
  estadoTurmas.termoBuscaAlunos = "";
  estadoTurmas.turmaAtual = null;
  if (unsubDisciplinas) unsubDisciplinas();
  if (unsubAlunos) unsubAlunos();
  renderPainelTurmas();
}

// ---------- Detalhe da turma (alunos + disciplinas) ----------

function renderDetalheTurma() {
  const t = estadoTurmas.turmaAtual;
  let html = `
    <div class="trilha-navegacao">
      <a onclick="voltarParaListaTurmas()">Turmas</a> › ${escaparHtml(t.escola || "")} › ${escaparHtml(t.nome)}
    </div>

    <div class="coluna-titulo">
      <h2>Disciplinas</h2>
      <button class="btn-add" onclick="abrirFormDisciplina()">+ Nova disciplina</button>
    </div>
  `;

  if (estadoTurmas.disciplinasDaTurma.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma disciplina cadastrada nesta turma ainda.</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoTurmas.disciplinasDaTurma.forEach((d) => {
      const sistemaLabel = d.sistemaAvaliacao === "mencao" ? "Menções (I/R/B/MB)" : "Porcentagem";
      html += `
        <div class="item-cartao" style="cursor:default;">
          <span>
            <span class="nome-item">${escaparHtml(d.nome)}</span><br/>
            <span class="subinfo-item">${sistemaLabel}</span>
          </span>
          <span class="acoes-item">
            <button onclick="abrirFormDisciplina('${d.id}')">✎</button>
            <button onclick="confirmarExclusaoDisciplina('${d.id}')">🗑</button>
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  const alunosAtivos = estadoTurmas.alunosDaTurma.filter((a) => (a.status || "ativo") === "ativo");
  const alunosTransferidos = estadoTurmas.alunosDaTurma.filter((a) => a.status === "transferido");

  html += `
    <div class="coluna-titulo">
      <h2>Alunos (${alunosAtivos.length})</h2>
      <div style="display:flex; gap:8px;">
        ${alunosAtivos.length > 0 ? `<button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="confirmarLimparAlunos()">Limpar todos</button>` : ""}
        <button class="btn-add" onclick="abrirFormAlunos()">+ Adicionar alunos</button>
      </div>
    </div>
  `;

  if (alunosAtivos.length > 5) {
    html += `<input type="text" class="campo-busca" placeholder="Buscar aluno…" value="${escaparHtml(estadoTurmas.termoBuscaAlunos)}" oninput="buscarAlunoTurma(this.value)" />`;
  }

  const termo = estadoTurmas.termoBuscaAlunos.trim().toLowerCase();
  const alunosFiltrados = termo
    ? alunosAtivos.filter((a) => a.nome.toLowerCase().includes(termo))
    : alunosAtivos;

  if (alunosAtivos.length === 0) {
    html += `<p class="vazio-aviso">Nenhum aluno cadastrado nesta turma ainda.</p>`;
  } else if (alunosFiltrados.length === 0) {
    html += `<p class="vazio-aviso">Nenhum aluno encontrado para "${escaparHtml(termo)}".</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    alunosFiltrados.forEach((a) => {
      html += `
        <div class="item-cartao" style="cursor:default;">
          <span class="nome-item">${escaparHtml(a.nome)}</span>
          <span class="acoes-item">
            <button onclick="abrirFormEditarAluno('${a.id}')" title="Editar nome">✎</button>
            <button onclick="abrirFormTransferir('${a.id}')" title="Transferir para outra turma/escola">↗</button>
            <button onclick="removerAluno('${a.id}')" title="Remover">🗑</button>
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  if (alunosTransferidos.length > 0) {
    html += `
      <div class="coluna-titulo" style="margin-top:20px;">
        <h2 style="font-size:0.95rem; opacity:0.8;">Alunos transferidos (${alunosTransferidos.length})</h2>
      </div>
      <div class="lista-cartoes">
    `;
    alunosTransferidos.forEach((a) => {
      const destino = a.transferidoPara || {};
      html += `
        <div class="item-cartao" style="cursor:default; opacity:0.7;">
          <span>
            <span class="nome-item">${escaparHtml(a.nome)}</span><br/>
            <span class="subinfo-item">Transferido para ${escaparHtml(destino.turmaNome || "?")} (${escaparHtml(destino.escola || "?")})${destino.data ? " em " + formatarDataBrTurmas(destino.data) : ""}</span>
          </span>
          <span class="acoes-item">
            <button onclick="restaurarAlunoTransferido('${a.id}')" title="Desfazer transferência">↩</button>
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  painelTurmas.innerHTML = html;
}

function formatarDataBrTurmas(dataIso) {
  const partes = (dataIso || "").split("-");
  if (partes.length !== 3) return dataIso || "";
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

// ---------- Disciplinas ----------

function abrirFormDisciplina(id) {
  const d = id ? estadoTurmas.disciplinasDaTurma.find((x) => x.id === id) : null;
  const sistema = d ? d.sistemaAvaliacao : "mencao";
  const faixas = (d && d.faixasMencao) || { I: 0, R: 40, B: 60, MB: 80 };

  abrirModal(`
    <h3>${d ? "Editar disciplina" : "Nova disciplina"}</h3>
    <div class="campo-form">
      <label>Nome da disciplina</label>
      <input type="text" id="input-nome-disciplina" value="${d ? escaparHtml(d.nome) : ""}" placeholder="Ex: Química, Física" />
    </div>
    <div class="campo-form">
      <label>Sistema de avaliação</label>
      <div class="opcoes-radio">
        <label><input type="radio" name="sistema-avaliacao" value="mencao" ${sistema === "mencao" ? "checked" : ""} onchange="alternarCamposSistema()" /> Menções (I/R/B/MB)</label>
        <label><input type="radio" name="sistema-avaliacao" value="porcentagem" ${sistema === "porcentagem" ? "checked" : ""} onchange="alternarCamposSistema()" /> Porcentagem</label>
      </div>
    </div>
    <div id="campos-faixas-mencao" class="campo-form" style="${sistema === "mencao" ? "" : "display:none;"}">
      <label>Nota mínima de cada menção (%)</label>
      <div class="grade-faixas">
        <div><label>I</label><input type="number" id="faixa-I" value="${faixas.I}" min="0" max="100" /></div>
        <div><label>R</label><input type="number" id="faixa-R" value="${faixas.R}" min="0" max="100" /></div>
        <div><label>B</label><input type="number" id="faixa-B" value="${faixas.B}" min="0" max="100" /></div>
        <div><label>MB</label><input type="number" id="faixa-MB" value="${faixas.MB}" min="0" max="100" /></div>
      </div>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarDisciplina('${d ? d.id : ""}')">Salvar</button>
    </div>
  `);
  document.getElementById("input-nome-disciplina").focus();
}

function alternarCamposSistema() {
  const sistema = document.querySelector('input[name="sistema-avaliacao"]:checked').value;
  document.getElementById("campos-faixas-mencao").style.display = sistema === "mencao" ? "" : "none";
}

function salvarDisciplina(id) {
  const nome = document.getElementById("input-nome-disciplina").value.trim();
  if (!nome) {
    alert("Digite o nome da disciplina.");
    return;
  }
  const sistemaAvaliacao = document.querySelector('input[name="sistema-avaliacao"]:checked').value;
  // "escola" (texto) e turmaId ficam salvos também na própria disciplina
  // para permitir localizar, na tela de Visto, outras turmas da mesma
  // escola que tenham uma disciplina com este mesmo nome — necessário
  // para aplicar uma atividade a várias turmas de uma vez.
  const dados = {
    nome,
    nomeNormalizado: nome.trim().toLowerCase(),
    sistemaAvaliacao,
    escola: estadoTurmas.turmaAtual.escola,
    escolaNormalizado: (estadoTurmas.turmaAtual.escola || "").trim().toLowerCase(),
    turmaId: estadoTurmas.turmaAtual.id,
  };

  if (sistemaAvaliacao === "mencao") {
    dados.faixasMencao = {
      I: Number(document.getElementById("faixa-I").value) || 0,
      R: Number(document.getElementById("faixa-R").value) || 0,
      B: Number(document.getElementById("faixa-B").value) || 0,
      MB: Number(document.getElementById("faixa-MB").value) || 0,
    };
  } else if (id) {
    // FieldValue.delete() só é permitido em update() de um documento que
    // já existe — numa criação nova (add), simplesmente não incluímos o
    // campo faixasMencao.
    dados.faixasMencao = firebase.firestore.FieldValue.delete();
  }

  const ref = db.collection("turmas").doc(estadoTurmas.turmaAtual.id).collection("disciplinas");
  const promessa = id
    ? ref.doc(id).update(dados)
    : ref.add({ ...dados, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });

  const turmaId = estadoTurmas.turmaAtual.id;
  promessa
    .then(() => {
      fecharModal();
      atualizarContagemDisciplinas(turmaId);
    })
    .catch((err) => alert("Erro ao salvar: " + err.message));
}

function confirmarExclusaoDisciplina(id) {
  const d = estadoTurmas.disciplinasDaTurma.find((x) => x.id === id);
  abrirModal(`
    <h3>Excluir disciplina</h3>
    <p>Tem certeza que deseja excluir "${escaparHtml(d.nome)}" desta turma?</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirDisciplina('${id}')">Excluir</button>
    </div>
  `);
}

function excluirDisciplina(id) {
  const turmaId = estadoTurmas.turmaAtual.id;
  db.collection("turmas").doc(turmaId).collection("disciplinas").doc(id).delete()
    .then(() => {
      fecharModal();
      atualizarContagemDisciplinas(turmaId);
    })
    .catch((err) => alert("Erro: " + err.message));
}

// ---------- Alunos ----------

function abrirFormAlunos() {
  abrirModal(`
    <h3>Adicionar alunos</h3>
    <div class="campo-form">
      <label>Cole a lista de alunos (um nome por linha)</label>
      <textarea id="input-lista-alunos" placeholder="Ana Silva
Bruno Souza
Carla Lima"></textarea>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarAlunos()">Adicionar</button>
    </div>
  `);
  document.getElementById("input-lista-alunos").focus();
}

// Remove uma numeração no início da linha, se houver: "12 - Nome",
// "12) Nome", "12. Nome", "12 Nome" → vira só "Nome".
function removerNumeracaoInicial(linha) {
  return linha.replace(/^\s*\d+\s*[-.)]?\s*/, "").trim();
}

// Considera nome válido: sem nenhum dígito, e com pelo menos uma
// palavra "de nome" (só letras/acentos/hífen/apóstrofo, 2+ letras) —
// ou uma única palavra com 3 ou mais letras (nome único).
function pareceNomeValido(nome) {
  if (!nome || /\d/.test(nome)) return false;
  const padraoPalavra = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]*$/;
  const palavras = nome.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return false;
  if (!palavras.every((p) => padraoPalavra.test(p))) return false;
  if (palavras.length === 1 && palavras[0].length < 3) return false;
  return true;
}

async function salvarAlunos() {
  const texto = document.getElementById("input-lista-alunos").value;
  const todasLinhas = texto
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const candidatos = todasLinhas.map(removerNumeracaoInicial);
  const nomes = [];
  const ignoradas = [];

  candidatos.forEach((nome, i) => {
    if (pareceNomeValido(nome)) {
      nomes.push(nome);
    } else {
      ignoradas.push(todasLinhas[i]);
    }
  });

  if (nomes.length === 0) {
    alert("Nenhum nome válido encontrado no texto colado.");
    return;
  }

  if (ignoradas.length > 0) {
    const confirmar = confirm(
      `${nomes.length} nome(s) serão adicionados.\n` +
      `${ignoradas.length} linha(s) foram ignoradas por não parecerem nomes ` +
      `(ex: "${ignoradas[0]}"). Provavelmente vieram de outra coluna colada junto ` +
      `(números, notas, etc.).\n\n` +
      `Continuar mesmo assim?`
    );
    if (!confirmar) return;
  }

  try {
    const ref = db.collection("turmas").doc(estadoTurmas.turmaAtual.id).collection("alunos");
    const lote = db.batch();
    nomes.forEach((nome) => {
      const novoDoc = ref.doc();
      lote.set(novoDoc, { nome, status: "ativo", criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
    });
    await lote.commit();
    fecharModal();
  } catch (err) {
    alert("Erro ao adicionar alunos: " + err.message);
  }
}

function abrirFormEditarAluno(id) {
  const aluno = estadoTurmas.alunosDaTurma.find((a) => a.id === id);
  abrirModal(`
    <h3>Editar aluno</h3>
    <div class="campo-form">
      <label>Nome</label>
      <input type="text" id="input-editar-nome-aluno" value="${escaparHtml(aluno.nome)}" />
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarEdicaoAluno('${id}')">Salvar</button>
    </div>
  `);
  document.getElementById("input-editar-nome-aluno").focus();
}

function salvarEdicaoAluno(id) {
  const nome = document.getElementById("input-editar-nome-aluno").value.trim();
  if (!nome) {
    alert("Digite o nome do aluno.");
    return;
  }
  db.collection("turmas").doc(estadoTurmas.turmaAtual.id).collection("alunos").doc(id).update({ nome })
    .then(fecharModal)
    .catch((err) => alert("Erro ao salvar: " + err.message));
}

function abrirFormTransferir(id) {
  const aluno = estadoTurmas.alunosDaTurma.find((a) => a.id === id);
  const escolas = nomesDeEscolasConhecidas();

  abrirModal(`
    <h3>Transferir aluno</h3>
    <p>Transferir "${escaparHtml(aluno.nome)}" para outra turma (pode ser da mesma escola ou de outra). O histórico de vistos dele fica preservado na turma atual.</p>
    <div class="campo-form">
      <label>Escola de destino</label>
      <select id="select-escola-destino" onchange="atualizarTurmasDestino()">
        <option value="">Selecione…</option>
        ${escolas.map((e) => `<option value="${escaparHtml(e)}">${escaparHtml(e)}</option>`).join("")}
      </select>
    </div>
    <div class="campo-form">
      <label>Turma de destino</label>
      <select id="select-turma-destino" disabled>
        <option value="">Selecione a escola primeiro…</option>
      </select>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="confirmarTransferencia('${id}')">Transferir</button>
    </div>
  `);
}

function atualizarTurmasDestino() {
  const escola = document.getElementById("select-escola-destino").value;
  const selectTurma = document.getElementById("select-turma-destino");

  if (!escola) {
    selectTurma.innerHTML = `<option value="">Selecione a escola primeiro…</option>`;
    selectTurma.disabled = true;
    return;
  }

  const turmasDaEscola = estadoTurmas.turmas.filter(
    (t) => t.escola === escola && t.id !== estadoTurmas.turmaAtual.id
  );

  if (turmasDaEscola.length === 0) {
    selectTurma.innerHTML = `<option value="">Nenhuma outra turma nesta escola</option>`;
    selectTurma.disabled = true;
    return;
  }

  selectTurma.innerHTML =
    `<option value="">Selecione…</option>` +
    turmasDaEscola.map((t) => `<option value="${t.id}">${escaparHtml(t.nome)}</option>`).join("");
  selectTurma.disabled = false;
}

async function confirmarTransferencia(alunoId) {
  const escolaDestino = document.getElementById("select-escola-destino").value;
  const turmaDestinoId = document.getElementById("select-turma-destino").value;

  if (!escolaDestino || !turmaDestinoId) {
    alert("Escolha a escola e a turma de destino.");
    return;
  }

  const aluno = estadoTurmas.alunosDaTurma.find((a) => a.id === alunoId);
  const turmaDestino = estadoTurmas.turmas.find((t) => t.id === turmaDestinoId);
  const turmaOrigem = estadoTurmas.turmaAtual;
  const hoje = hojeLocalISO();

  try {
    const lote = db.batch();

    const novoAlunoRef = db.collection("turmas").doc(turmaDestinoId).collection("alunos").doc();
    lote.set(novoAlunoRef, {
      nome: aluno.nome,
      status: "ativo",
      transferidoDe: { turmaId: turmaOrigem.id, turmaNome: turmaOrigem.nome, escola: turmaOrigem.escola, data: hoje },
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const alunoOrigemRef = db.collection("turmas").doc(turmaOrigem.id).collection("alunos").doc(alunoId);
    lote.update(alunoOrigemRef, {
      status: "transferido",
      transferidoPara: { turmaId: turmaDestinoId, turmaNome: turmaDestino.nome, escola: escolaDestino, data: hoje },
    });

    await lote.commit();
    fecharModal();
  } catch (err) {
    alert("Erro ao transferir: " + err.message);
  }
}

function restaurarAlunoTransferido(id) {
  db.collection("turmas").doc(estadoTurmas.turmaAtual.id).collection("alunos").doc(id).update({
    status: "ativo",
    transferidoPara: firebase.firestore.FieldValue.delete(),
  }).catch((err) => alert("Erro ao restaurar: " + err.message));
}

function removerAluno(id) {
  db.collection("turmas").doc(estadoTurmas.turmaAtual.id).collection("alunos").doc(id).delete()
    .catch((err) => alert("Erro: " + err.message));
}

function confirmarLimparAlunos() {
  abrirModal(`
    <h3>Limpar todos os alunos</h3>
    <p>Isso vai excluir os ${estadoTurmas.alunosDaTurma.length} alunos cadastrados nesta turma. Essa ação não pode ser desfeita. Deseja continuar?</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="limparAlunos()">Excluir todos</button>
    </div>
  `);
}

async function limparAlunos() {
  try {
    const ref = db.collection("turmas").doc(estadoTurmas.turmaAtual.id).collection("alunos");
    const snap = await ref.get();
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const lote = db.batch();
      docs.slice(i, i + 450).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
    fecharModal();
  } catch (err) {
    alert("Erro ao limpar: " + err.message);
  }
}

// ---------- Utilitário ----------

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
