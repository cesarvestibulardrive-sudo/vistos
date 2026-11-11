// ============================================================
// Etapa 5a — Chamada (frequência)
//
// Segue o mesmo padrão de seleção "escola (texto) → turma" já usado
// em visto.js. A chamada é por TURMA (não por disciplina — a
// frequência é única, independente da matéria), guardada como
// subcoleção turmas/{turmaId}/chamadas/{data}. Usar a própria data
// (YYYY-MM-DD) como ID do documento evita duplicar chamada no mesmo
// dia sem precisar de uma consulta extra.
// ============================================================

const painelChamada = document.getElementById("painel-chamada");

const estadoChamada = {
  escola: null,
  turmaId: null,
  alunos: [],
  chamadas: [],
  chamadaAtualId: null,
  termoBuscaAlunos: "",
};

let unsubChamadaAlunos = null;
let unsubChamadas = null;

function initChamada() {
  renderChamada();
}

function turmasDaEscolaSelecionadaChamada() {
  if (!estadoChamada.escola) return [];
  return estadoTurmas.turmas.filter((t) => (t.escola || "") === estadoChamada.escola);
}

function limparListenersChamada(quais) {
  if (quais.includes("alunos") && unsubChamadaAlunos) { unsubChamadaAlunos(); unsubChamadaAlunos = null; }
  if (quais.includes("chamadas") && unsubChamadas) { unsubChamadas(); unsubChamadas = null; }
}

function mudarEscolaChamada(escola) {
  estadoChamada.escola = escola || null;
  estadoChamada.turmaId = null;
  estadoChamada.alunos = [];
  estadoChamada.chamadas = [];
  estadoChamada.chamadaAtualId = null;
  limparListenersChamada(["alunos", "chamadas"]);
  renderChamada();
}

function mudarTurmaChamada(id) {
  estadoChamada.turmaId = id || null;
  estadoChamada.chamadaAtualId = null;
  estadoChamada.termoBuscaAlunos = "";
  limparListenersChamada(["alunos", "chamadas"]);

  if (!id) { renderChamada(); return; }

  unsubChamadaAlunos = db.collection("turmas").doc(id).collection("alunos").orderBy("nome").onSnapshot((snap) => {
    estadoChamada.alunos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => (a.status || "ativo") === "ativo");
    renderChamada();
  });

  unsubChamadas = db.collection("turmas").doc(id).collection("chamadas").orderBy("data", "desc").onSnapshot((snap) => {
    estadoChamada.chamadas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderChamada();
  });

  renderChamada();
}

function buscarAlunoChamada(valor) {
  estadoChamada.termoBuscaAlunos = valor;
  renderChamada();
  const campo = document.querySelector("#painel-chamada .campo-busca");
  if (campo) {
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
}

// ---------- Criar / excluir chamada ----------

function abrirNovaChamada() {
  const hoje = hojeLocalISO();
  abrirModal(`
    <h3>Nova chamada</h3>
    <div class="campo-form">
      <label>Data</label>
      <input type="date" id="input-data-chamada" value="${hoje}" />
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="criarChamada()">Criar</button>
    </div>
  `);
  document.getElementById("input-data-chamada").focus();
}

async function criarChamada() {
  const data = document.getElementById("input-data-chamada").value;
  if (!data) {
    alert("Escolha uma data.");
    return;
  }
  const ref = db.collection("turmas").doc(estadoChamada.turmaId).collection("chamadas").doc(data);
  try {
    const doc = await ref.get();
    if (doc.exists) {
      alert("Já existe uma chamada para essa data.");
      return;
    }
    await ref.set({ data, registros: {}, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });
    fecharModal();
    selecionarChamada(data);
  } catch (err) {
    alert("Erro ao criar chamada: " + err.message);
  }
}

function confirmarExclusaoChamada(id) {
  abrirModal(`
    <h3>Excluir chamada</h3>
    <p>Tem certeza que deseja excluir a chamada de ${formatarDataBrTurmas(id)}?</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirChamada('${id}')">Excluir</button>
    </div>
  `);
}

function excluirChamada(id) {
  db.collection("turmas").doc(estadoChamada.turmaId).collection("chamadas").doc(id).delete()
    .then(() => {
      fecharModal();
      if (estadoChamada.chamadaAtualId === id) estadoChamada.chamadaAtualId = null;
    })
    .catch((err) => alert("Erro ao excluir: " + err.message));
}

function selecionarChamada(id) {
  estadoChamada.chamadaAtualId = id;
  renderChamada();
}

function voltarListaChamadas() {
  estadoChamada.chamadaAtualId = null;
  renderChamada();
}

// Clicar de novo no mesmo status desfaz a marcação daquele aluno nesse
// dia (volta para "não lançado") — igual ao Vistos.exe.
function marcarPresenca(alunoId, status) {
  const chamada = estadoChamada.chamadas.find((c) => c.id === estadoChamada.chamadaAtualId);
  if (!chamada) return;
  const atual = (chamada.registros || {})[alunoId];
  const campo = `registros.${alunoId}`;
  const dados = {};
  dados[campo] = atual === status ? firebase.firestore.FieldValue.delete() : status;

  db.collection("turmas").doc(estadoChamada.turmaId).collection("chamadas").doc(chamada.id).update(dados)
    .catch((err) => alert("Erro: " + err.message));
}

// ---------- Resumo de faltas ----------

function calcularResumoFaltas() {
  return estadoChamada.alunos
    .map((al) => {
      let faltas = 0, justificadas = 0;
      estadoChamada.chamadas.forEach((c) => {
        const st = (c.registros || {})[al.id];
        if (st === "falta") faltas++;
        else if (st === "justificada") justificadas++;
      });
      return { aluno: al, faltas, justificadas };
    })
    .sort((a, b) => b.faltas - a.faltas);
}

// ---------- Exportar CSV ----------

function exportarFrequenciaCsv() {
  if (estadoChamada.chamadas.length === 0) {
    alert("Nenhuma chamada registrada ainda.");
    return;
  }
  const total = estadoChamada.chamadas.length;
  const cabecalho = ["Aluno", "Presenças", "Faltas", "Faltas justificadas", "Total de chamadas", "% de frequência"];
  const linhas = estadoChamada.alunos.map((al) => {
    let presencas = 0, faltas = 0, justificadas = 0;
    estadoChamada.chamadas.forEach((c) => {
      const st = (c.registros || {})[al.id];
      if (st === "presente") presencas++;
      else if (st === "falta") faltas++;
      else if (st === "justificada") justificadas++;
    });
    const pct = total > 0 ? ((presencas / total) * 100).toFixed(1).replace(".", ",") : "-";
    return [al.nome, String(presencas), String(faltas), String(justificadas), String(total), pct];
  });
  const csv = [cabecalho, ...linhas]
    .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoChamada.turmaId);
  const nomeSugerido = `frequencia-${(turma ? turma.nome : "turma").replace(/[\\/:*?"<>|]/g, "_")}.csv`;
  const blob = new Blob(["﻿" + csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeSugerido;
  a.click();
}

// ---------- Relatório PDF (impressão) ----------

function gerarRelatorioFrequenciaPdf() {
  if (estadoChamada.chamadas.length === 0) {
    alert("Nenhuma chamada registrada ainda.");
    return;
  }
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoChamada.turmaId);
  const total = estadoChamada.chamadas.length;
  const dataGeracao = new Date().toLocaleDateString("pt-BR");
  const linhas = estadoChamada.alunos.map((al) => {
    let presencas = 0, faltas = 0, justificadas = 0;
    estadoChamada.chamadas.forEach((c) => {
      const st = (c.registros || {})[al.id];
      if (st === "presente") presencas++;
      else if (st === "falta") faltas++;
      else if (st === "justificada") justificadas++;
    });
    const pct = total > 0 ? ((presencas / total) * 100).toFixed(1) + "%" : "-";
    return { nome: al.nome, presencas, faltas, justificadas, pct };
  });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 12pt; }
    h1 { text-align:center; font-size:16pt; margin-bottom:2px; }
    .escola { text-align:center; font-size:10.5pt; color:#555; font-style:italic; margin-bottom:4px; }
    .meta { text-align:center; font-size:9.5pt; color:#777; margin-bottom:18px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; }
    th, td { border:1px solid #ccc; padding:7px 10px; font-size:10.5pt; text-align:left; }
    th { background:#EEF2F7; font-weight:700; }
    td.center, th.center { text-align:center; }
    .assinatura { margin-top:60px; display:flex; justify-content:center; }
    .assinatura .bloco { text-align:center; width:340px; }
    .assinatura .linha { border-top:1px solid #333; margin-bottom:6px; }
    .rodape { margin-top:24px; font-size:9pt; text-align:right; color:#555; }
  </style></head><body>
    <h1>Relatório de Frequência — ${escaparHtml(turma ? turma.nome : "")}</h1>
    ${turma && turma.escola ? `<div class="escola">${escaparHtml(turma.escola)}</div>` : ""}
    <div class="meta">${dataGeracao} · ${total} chamada(s) registrada(s)</div>
    <table>
      <thead><tr><th>Aluno</th><th class="center">Presenças</th><th class="center">Faltas</th><th class="center">Faltas justificadas</th><th class="center">% de frequência</th></tr></thead>
      <tbody>
        ${linhas.map((l) => `<tr>
          <td>${escaparHtml(l.nome)}</td>
          <td class="center">${l.presencas}</td>
          <td class="center">${l.faltas}</td>
          <td class="center">${l.justificadas}</td>
          <td class="center">${l.pct}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="assinatura">
      <div class="bloco">
        <div class="linha"></div>
        <div>Professor(a) responsável</div>
      </div>
    </div>
    <div class="rodape">Relatório gerado automaticamente pelo sistema Vistos.</div>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

// ---------- Renderização ----------

function formatarDataLongaChamada(iso) {
  const [y, m, d] = (iso || "").split("-");
  if (!y) return iso || "";
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function rotuloStatusChamada(status) {
  if (status === "presente") return { texto: "✓ Presente", classe: "sel-presente" };
  if (status === "falta") return { texto: "✕ Falta", classe: "sel-falta" };
  if (status === "justificada") return { texto: "📄 Justificada", classe: "sel-justificada" };
  return { texto: "Não lançado", classe: "" };
}

function renderChamada() {
  let html = `<div class="selecao-visto">`;

  const escolas = [...new Set(estadoTurmas.turmas.map((t) => t.escola).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  html += `<select id="select-escola-chamada" onchange="mudarEscolaChamada(this.value)">
    <option value="">Selecione a escola…</option>`;
  escolas.forEach((e) => {
    html += `<option value="${escaparHtml(e)}" ${e === estadoChamada.escola ? "selected" : ""}>${escaparHtml(e)}</option>`;
  });
  html += `</select>`;

  html += `<select id="select-turma-chamada" onchange="mudarTurmaChamada(this.value)" ${estadoChamada.escola ? "" : "disabled"}>
    <option value="">Selecione a turma…</option>`;
  turmasDaEscolaSelecionadaChamada().forEach((t) => {
    html += `<option value="${t.id}" ${t.id === estadoChamada.turmaId ? "selected" : ""}>${escaparHtml(t.nome)}</option>`;
  });
  html += `</select>`;
  html += `</div>`;

  if (!estadoChamada.turmaId) {
    html += `<p class="vazio-aviso">Selecione escola e turma para ver ou lançar chamadas.</p>`;
    painelChamada.innerHTML = html;
    return;
  }

  if (estadoChamada.chamadaAtualId) {
    html += renderDetalheChamada();
    painelChamada.innerHTML = html;
    return;
  }

  // ----- resumo de faltas -----
  if (estadoChamada.chamadas.length > 0) {
    const resumo = calcularResumoFaltas();
    html += `<div class="coluna-titulo"><h2>Resumo de faltas</h2></div>`;
    html += `<div class="lista-cartoes">`;
    resumo.forEach((l) => {
      html += `
        <div class="item-cartao" style="cursor:default;">
          <span class="nome-item">${escaparHtml(l.aluno.nome)}</span>
          <span class="acoes-item">
            ${l.faltas > 0 ? `<span class="selo-chamada sel-falta">${l.faltas} falta(s)</span>` : ""}
            ${l.justificadas > 0 ? `<span class="selo-chamada sel-justificada">${l.justificadas} justif.</span>` : ""}
            ${l.faltas === 0 && l.justificadas === 0 ? `<span class="selo-chamada sel-presente">0 faltas</span>` : ""}
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  // ----- lista de chamadas -----
  html += `
    <div class="coluna-titulo" style="margin-top:20px;">
      <h2>Chamadas</h2>
      <div style="display:flex; gap:8px;">
        ${estadoChamada.chamadas.length > 0 ? `
          <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="exportarFrequenciaCsv()">Exportar CSV</button>
          <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="gerarRelatorioFrequenciaPdf()">Relatório PDF</button>
        ` : ""}
        <button class="btn-add" onclick="abrirNovaChamada()">+ Nova chamada</button>
      </div>
    </div>
  `;

  if (estadoChamada.chamadas.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma chamada registrada ainda nesta turma.</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoChamada.chamadas.forEach((c) => {
      const presentes = estadoChamada.alunos.filter((a) => (c.registros || {})[a.id] === "presente").length;
      const faltas = estadoChamada.alunos.filter((a) => (c.registros || {})[a.id] === "falta").length;
      html += `
        <div class="atividade-card" onclick="selecionarChamada('${c.id}')">
          <span class="acoes-atividade-card">
            <button onclick="event.stopPropagation(); confirmarExclusaoChamada('${c.id}')" title="Excluir chamada">🗑</button>
          </span>
          <div class="atividade-titulo">${formatarDataLongaChamada(c.id)}</div>
          <div class="atividade-prazo">${presentes} presente(s) · ${faltas} falta(s)</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  painelChamada.innerHTML = html;
}

function renderDetalheChamada() {
  const chamada = estadoChamada.chamadas.find((c) => c.id === estadoChamada.chamadaAtualId);
  if (!chamada) { estadoChamada.chamadaAtualId = null; return renderChamada(); }

  let html = `
    <div class="trilha-navegacao">
      <a onclick="voltarListaChamadas()">Chamadas</a> › ${formatarDataLongaChamada(chamada.id)}
    </div>
    <h2 style="font-family:'Fraunces',serif; color:var(--acento);">Chamada de ${formatarDataLongaChamada(chamada.id)}</h2>
  `;

  if (estadoChamada.alunos.length > 8) {
    html += `<input type="text" class="campo-busca" placeholder="Buscar aluno…" value="${escaparHtml(estadoChamada.termoBuscaAlunos)}" oninput="buscarAlunoChamada(this.value)" />`;
  }

  const termo = estadoChamada.termoBuscaAlunos.trim().toLowerCase();
  const alunosFiltrados = termo
    ? estadoChamada.alunos.filter((a) => a.nome.toLowerCase().includes(termo))
    : estadoChamada.alunos;

  if (estadoChamada.alunos.length === 0) {
    html += `<p class="vazio-aviso">Esta turma ainda não tem alunos cadastrados.</p>`;
  } else if (alunosFiltrados.length === 0) {
    html += `<p class="vazio-aviso">Nenhum aluno encontrado para "${escaparHtml(termo)}".</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    alunosFiltrados.forEach((aluno) => {
      const status = (chamada.registros || {})[aluno.id];
      const info = rotuloStatusChamada(status);
      html += `
        <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="nome-item">${escaparHtml(aluno.nome)}</span>
            <span class="selo-chamada ${info.classe}">${info.texto}</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="status-botao st-100 ${status === "presente" ? "ativo" : ""}" onclick="marcarPresenca('${aluno.id}','presente')">Presente</button>
            <button class="status-botao st-0 ${status === "falta" ? "ativo" : ""}" onclick="marcarPresenca('${aluno.id}','falta')">Falta</button>
            <button class="status-botao st-50 ${status === "justificada" ? "ativo" : ""}" onclick="marcarPresenca('${aluno.id}','justificada')">Justificada</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  return html;
}
