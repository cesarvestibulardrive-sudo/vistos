// ============================================================
// Etapa 5d — Pesos & Relatório
//
// Motor de nota final: junta Visto + Seminário (ponderados por peso),
// aplica o desconto por frequência (Chamada) e calcula a menção (ou
// porcentagem) final. Diferente dos outros módulos, aqui o cálculo é
// "sob demanda" (botão Atualizar) em vez de reativo o tempo todo —
// evita múltiplas assinaturas simultâneas só para montar um relatório.
//
// Faixas de menção são as mesmas já cadastradas na disciplina
// (turmas.js → faixasMencao {I,R,B,MB}, cada valor é o mínimo da
// faixa) — não duplicamos essa configuração aqui.
// ============================================================

const painelRelatorio = document.getElementById("painel-relatorio");

const estadoPesos = {
  escola: null,
  turmaId: null,
  disciplinas: [],
  disciplinaId: null,
  alunos: [],
  carregando: false,
  carregado: false,
  atividades: [],       // [{id, tipo:'visto'|'seminario', nome, data, ref}]
  pesosConfig: { selecionadas: [] },
  faixas: null,
  sistemaAvaliacao: "mencao",
  freqPorAluno: {},     // alunoId -> % ou null
  linhasCalculadas: [], // [{aluno, notaBruta, notaFinal, mencaoBruta, mencaoFinal, nivelDesconto, ocorrencias, detalhe}]
};

function initPesos() {
  renderPesos();
}

function turmasDaEscolaSelecionadaPesos() {
  if (!estadoPesos.escola) return [];
  return estadoTurmas.turmas.filter((t) => (t.escola || "") === estadoPesos.escola);
}

function mudarEscolaPesos(escola) {
  estadoPesos.escola = escola || null;
  estadoPesos.turmaId = null;
  estadoPesos.disciplinas = [];
  estadoPesos.disciplinaId = null;
  estadoPesos.carregado = false;
  renderPesos();
}

async function mudarTurmaPesos(id) {
  estadoPesos.turmaId = id || null;
  estadoPesos.disciplinaId = null;
  estadoPesos.carregado = false;
  if (!id) { renderPesos(); return; }

  const discSnap = await db.collection("turmas").doc(id).collection("disciplinas").orderBy("nome").get();
  estadoPesos.disciplinas = discSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const alunosSnap = await db.collection("turmas").doc(id).collection("alunos").orderBy("nome").get();
  estadoPesos.alunos = alunosSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => (a.status || "ativo") === "ativo");

  renderPesos();
}

function mudarDisciplinaPesos(id) {
  estadoPesos.disciplinaId = id || null;
  estadoPesos.carregado = false;
  renderPesos();
  if (id) atualizarNotasPesos();
}

// ---------- faixas de menção (direto na disciplina) ----------

function salvarFaixasPesos() {
  const r = Number(document.getElementById("input-faixa-r-pesos").value);
  const b = Number(document.getElementById("input-faixa-b-pesos").value);
  const mb = Number(document.getElementById("input-faixa-mb-pesos").value);
  if (!(r > 0 && b > r && mb > b && mb <= 100)) {
    alert("Os valores precisam ser crescentes (0 < R < B < MB ≤ 100).");
    return;
  }
  db.collection("turmas").doc(estadoPesos.turmaId).collection("disciplinas").doc(estadoPesos.disciplinaId)
    .update({ faixasMencao: { I: 0, R: r, B: b, MB: mb } })
    .then(() => atualizarNotasPesos())
    .catch((err) => alert("Erro ao salvar: " + err.message));
}

// ---------- carregar atividades + vistos + pesos + chamadas ----------

async function atualizarNotasPesos() {
  estadoPesos.carregando = true;
  renderPesos();

  try {
    const disciplina = estadoPesos.disciplinas.find((d) => d.id === estadoPesos.disciplinaId);
    estadoPesos.sistemaAvaliacao = disciplina.sistemaAvaliacao || "mencao";
    estadoPesos.faixas = disciplina.faixasMencao || { I: 0, R: 40, B: 60, MB: 80 };

    // --- atividades de Visto desta disciplina, nesta turma ---
    const vistoSnap = await db.collection("atividades")
      .where("turmaIds", "array-contains", estadoPesos.turmaId)
      .get();
    const atividadesVisto = vistoSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => normalizarNome(a.disciplinaNome) === normalizarNome(disciplina.nome));

    for (const a of atividadesVisto) {
      const vSnap = await db.collection("atividades").doc(a.id).collection("vistos")
        .where("turmaId", "==", estadoPesos.turmaId).get();
      a._vistosPorAluno = {};
      vSnap.docs.forEach((d) => { a._vistosPorAluno[d.data().alunoId] = d.data(); });
    }

    // --- atividades em grupo desta disciplina, nesta turma ---
    const semSnap = await db.collection("atividadesSeminario")
      .where("turmaId", "==", estadoPesos.turmaId).get();
    const atividadesSeminario = semSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => normalizarNome(a.disciplinaNome) === normalizarNome(disciplina.nome));

    estadoPesos.atividades = [
      ...atividadesVisto.map((a) => ({ id: a.id, tipo: "visto", nome: a.titulo, data: a.data, ref: a })),
      ...atividadesSeminario.map((a) => ({ id: a.id, tipo: "seminario", nome: a.nome, data: a.dataApresentacao, ref: a })),
    ];

    // --- pesos salvos (cria peso=1 para quem ainda não tem) ---
    const pesosRef = db.collection("turmas").doc(estadoPesos.turmaId).collection("pesos").doc(estadoPesos.disciplinaId);
    const pesosDoc = await pesosRef.get();
    let selecionadas = pesosDoc.exists ? (pesosDoc.data().selecionadas || []) : [];
    let mudouPesos = false;
    estadoPesos.atividades.forEach((a) => {
      if (!selecionadas.find((s) => s.atividadeId === a.id)) {
        selecionadas.push({ atividadeId: a.id, tipo: a.tipo, peso: 1 });
        mudouPesos = true;
      }
    });
    if (mudouPesos) await pesosRef.set({ selecionadas });
    estadoPesos.pesosConfig = { selecionadas };

    // --- chamadas (frequência, vale para a turma inteira) ---
    const chamadasSnap = await db.collection("turmas").doc(estadoPesos.turmaId).collection("chamadas").get();
    const chamadas = chamadasSnap.docs.map((d) => d.data());

    estadoPesos.freqPorAluno = {};
    estadoPesos.alunos.forEach((al) => {
      if (chamadas.length === 0) { estadoPesos.freqPorAluno[al.id] = null; return; }
      let presencas = 0;
      chamadas.forEach((c) => { if ((c.registros || {})[al.id] === "presente") presencas++; });
      estadoPesos.freqPorAluno[al.id] = (presencas / chamadas.length) * 100;
    });

    calcularLinhasPesos();
    estadoPesos.carregado = true;
  } catch (err) {
    alert("Erro ao carregar notas: " + err.message);
  }
  estadoPesos.carregando = false;
  renderPesos();
}

// ---------- motor de nota ----------

function notaAlunoNaAtividadePesos(aluno, a) {
  if (a.tipo === "visto") {
    const v = (a.ref._vistosPorAluno || {})[aluno.id];
    if (!v || v.notaBruta === null || v.notaBruta === undefined) return { nota: 0, ocorrencia: null, lancado: false };
    const nota = v.notaFinal ?? v.notaBruta;
    if (v.notaBruta === 0) {
      return {
        nota: 0,
        ocorrencia: { atividade: a.nome, motivo: v.materialEsquecido ? "Esqueceu o material" : "Não entregue / recusa" },
        lancado: true,
      };
    }
    return { nota, ocorrencia: null, lancado: true };
  } else {
    const grupo = (a.ref.grupos || []).find((g) => g.alunosIds.includes(aluno.id));
    if (!grupo) return { nota: 0, ocorrencia: null, lancado: false };
    return { nota: calcularMediaGrupoSeminario(a.ref, grupo.id), ocorrencia: null, lancado: true };
  }
}

function ordemMencao() { return ["I", "R", "B", "MB"]; }

function calcularMencaoPesos(faixas, nota) {
  const ordem = ordemMencao();
  for (let i = ordem.length - 1; i >= 0; i--) {
    const min = faixas[ordem[i]] ?? 0;
    if (nota >= min) return ordem[i];
  }
  return "I";
}

function proximoLimiteMencao(faixas, mencao) {
  const ordem = ordemMencao();
  const idx = ordem.indexOf(mencao);
  if (idx === ordem.length - 1) return 100.0001;
  return faixas[ordem[idx + 1]] ?? 100;
}

function nivelDescontoFrequenciaPesos(freqPct) {
  if (freqPct === null || freqPct === undefined) return 0;
  if (freqPct >= 75) return 0;
  if (freqPct >= 50) return 1;
  return 2;
}

function calcularLinhasPesos() {
  const faixas = estadoPesos.faixas;
  estadoPesos.linhasCalculadas = estadoPesos.alunos.map((al) => {
    let somaPesoNota = 0, somaPeso = 0;
    const ocorrencias = [];
    const detalhe = [];
    estadoPesos.pesosConfig.selecionadas.forEach((s) => {
      if (s.peso <= 0) return;
      const a = estadoPesos.atividades.find((x) => x.id === s.atividadeId);
      if (!a) return;
      const r = notaAlunoNaAtividadePesos(al, a);
      somaPesoNota += r.nota * s.peso;
      somaPeso += s.peso;
      if (r.ocorrencia) ocorrencias.push(r.ocorrencia);
      detalhe.push({ nome: a.nome, peso: s.peso, nota: r.nota, lancado: r.lancado });
    });
    const notaBruta = somaPeso > 0 ? somaPesoNota / somaPeso : 0;
    const freqPct = estadoPesos.freqPorAluno[al.id];
    const nivelDesconto = nivelDescontoFrequenciaPesos(freqPct);
    const mencaoBruta = calcularMencaoPesos(faixas, notaBruta);

    let notaFinal = notaBruta, mencaoFinal = mencaoBruta;
    if (nivelDesconto > 0) {
      const ordem = ordemMencao();
      const idx = Math.max(0, ordem.indexOf(mencaoBruta) - nivelDesconto);
      mencaoFinal = ordem[idx];
      if (mencaoFinal !== mencaoBruta) {
        const min = faixas[mencaoFinal] ?? 0;
        const max = proximoLimiteMencao(faixas, mencaoFinal) - 0.01;
        notaFinal = Math.max(min, Math.min(notaBruta, max));
      }
    }

    return { aluno: al, notaBruta, notaFinal, mencaoBruta, mencaoFinal, freqPct, nivelDesconto, ocorrencias, detalhe };
  });
}

// ---------- editar peso ----------

function editarPesoAtividade(atividadeId, valor) {
  const peso = Number(valor) || 0;
  const selecionadas = estadoPesos.pesosConfig.selecionadas.map((s) => (s.atividadeId === atividadeId ? { ...s, peso } : s));
  estadoPesos.pesosConfig.selecionadas = selecionadas;
  db.collection("turmas").doc(estadoPesos.turmaId).collection("pesos").doc(estadoPesos.disciplinaId)
    .set({ selecionadas })
    .then(() => { calcularLinhasPesos(); renderPesos(); })
    .catch((err) => alert("Erro ao salvar peso: " + err.message));
}

// ---------- exportar CSV ----------

function exportarNotasCsv() {
  if (!estadoPesos.carregado) return;
  const mencao = estadoPesos.sistemaAvaliacao !== "porcentagem";
  const cabecalho = mencao
    ? ["Aluno", "Frequência (%)", "Nota final (%)", "Menção", "Ocorrências"]
    : ["Aluno", "Frequência (%)", "Nota final (%)", "Ocorrências"];
  const linhas = estadoPesos.linhasCalculadas.map((l) => {
    const base = [l.aluno.nome, l.freqPct === null ? "" : l.freqPct.toFixed(1).replace(".", ","), l.notaFinal.toFixed(1).replace(".", ",")];
    if (mencao) base.push(l.mencaoFinal);
    base.push(String(l.ocorrencias.length));
    return base;
  });
  const csv = [cabecalho, ...linhas].map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoPesos.turmaId);
  const disciplina = estadoPesos.disciplinas.find((d) => d.id === estadoPesos.disciplinaId);
  const nomeSugerido = `notas-${(turma ? turma.nome : "turma")}-${(disciplina ? disciplina.nome : "")}`.replace(/[\\/:*?"<>|]/g, "_") + ".csv";
  const blob = new Blob(["﻿" + csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeSugerido;
  a.click();
}

// ---------- relatório / boletim PDF ----------

function fmtPctPesos(v) {
  if (v === null || v === undefined || isNaN(v)) return "-";
  return (Math.round(v * 100) / 100) + "%";
}

function gerarRelatorioTurmaPdf() {
  if (!estadoPesos.carregado) return;
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoPesos.turmaId);
  const disciplina = estadoPesos.disciplinas.find((d) => d.id === estadoPesos.disciplinaId);
  const dataGeracao = new Date().toLocaleDateString("pt-BR");
  const mencao = estadoPesos.sistemaAvaliacao !== "porcentagem";
  const atividades = estadoPesos.atividades;
  const comOcorrencia = estadoPesos.linhasCalculadas.filter((l) => l.ocorrencias.length);

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 11pt; }
    h1 { text-align:center; font-size:15pt; margin-bottom:2px; }
    .escola { text-align:center; font-size:10pt; color:#555; font-style:italic; margin-bottom:4px; }
    .meta { text-align:center; font-size:9pt; color:#777; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { border:1px solid #ccc; padding:5px 7px; font-size:9pt; text-align:left; }
    th { background:#EEF2F7; font-weight:700; }
    td.center, th.center { text-align:center; }
    .col-final { background:#f3f0e2 !important; font-weight:bold; }
    h3 { font-size:12pt; margin-top:20px; margin-bottom:6px; border-bottom:1px solid #999; padding-bottom:3px; }
    .legenda li { margin-bottom:4px; font-size:9.5pt; }
    .rodape { margin-top:20px; font-size:9pt; text-align:right; color:#555; }
  </style></head><body>
    <h1>Relatório de Desempenho — ${escaparHtml(turma ? turma.nome : "")} — ${escaparHtml(disciplina ? disciplina.nome : "")}</h1>
    ${turma && turma.escola ? `<div class="escola">${escaparHtml(turma.escola)}</div>` : ""}
    <div class="meta">${dataGeracao}</div>
    <table>
      <thead><tr>
        <th>Aluno</th>
        ${atividades.map((a, i) => `<th class="center">Ativ. ${i + 1}</th>`).join("")}
        <th class="center">Frequência</th>
        <th class="center col-final">Nota final</th>
      </tr></thead>
      <tbody>
        ${estadoPesos.linhasCalculadas.map((l) => `<tr>
          <td>${escaparHtml(l.aluno.nome)}</td>
          ${l.detalhe.map((d) => `<td class="center">${d.lancado ? fmtPctPesos(d.nota) : "-"}</td>`).join("")}
          <td class="center">${l.freqPct === null ? "—" : fmtPctPesos(l.freqPct)}</td>
          <td class="center col-final">${mencao ? l.mencaoFinal + " (" + fmtPctPesos(l.notaFinal) + ")" : fmtPctPesos(l.notaFinal)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <h3>Legenda das atividades avaliadas</h3>
    <ol class="legenda">
      ${atividades.map((a, i) => `<li><strong>Ativ. ${i + 1} — ${escaparHtml(a.nome)}</strong> (${a.tipo === "visto" ? "Visto" : "Atividade em grupo"}${a.data ? ", " + formatarDataBrTurmas(a.data) : ""})</li>`).join("")}
    </ol>
    ${mencao ? `<p class="legenda">Legenda de menções: I abaixo de ${estadoPesos.faixas.R}% · R ${estadoPesos.faixas.R}–${estadoPesos.faixas.B}% · B ${estadoPesos.faixas.B}–${estadoPesos.faixas.MB}% · MB acima de ${estadoPesos.faixas.MB}%</p>` : ""}
    <p class="legenda">Desconto por frequência: 75–100% não perde nada · 50–75% perde 1 nível · abaixo de 50% perde 2 níveis.</p>
    <h3>Ocorrências (notas zeradas)</h3>
    ${comOcorrencia.length ? `<ul class="legenda">${comOcorrencia.map((l) => `<li><strong>${escaparHtml(l.aluno.nome)}</strong>: ${l.ocorrencias.map((o) => escaparHtml(o.atividade) + " — " + escaparHtml(o.motivo)).join("; ")}</li>`).join("")}</ul>` : "<p>Nenhuma.</p>"}
    <div class="rodape">Relatório gerado automaticamente pelo sistema Vistos.</div>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

function gerarBoletimAlunoPdf(alunoId) {
  const l = estadoPesos.linhasCalculadas.find((x) => x.aluno.id === alunoId);
  if (!l) return;
  const turma = estadoTurmas.turmas.find((t) => t.id === estadoPesos.turmaId);
  const disciplina = estadoPesos.disciplinas.find((d) => d.id === estadoPesos.disciplinaId);
  const dataGeracao = new Date().toLocaleDateString("pt-BR");
  const mencao = estadoPesos.sistemaAvaliacao !== "porcentagem";
  const notaFormatada = mencao ? `${l.mencaoFinal} (${fmtPctPesos(l.notaFinal)})` : fmtPctPesos(l.notaFinal);

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #111; font-size: 12pt; }
    h1 { text-align:center; font-size:15pt; }
    .escola { text-align:center; font-size:10.5pt; color:#555; font-style:italic; }
    .nome-aluno { text-align:center; font-size:16pt; margin-top:18px; font-weight:bold; }
    .nota-final { text-align:center; margin:14px 0 8px; }
    .nota-final .valor { font-size:34pt; font-weight:bold; }
    .nota-final .rotulo { font-size:11pt; color:#555; }
    .freq-info { text-align:center; font-size:10.5pt; color:#555; margin-bottom:26px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; }
    th, td { border:1px solid #ccc; padding:6px 9px; font-size:10.5pt; text-align:left; }
    th { background:#EEF2F7; }
    td.center, th.center { text-align:center; }
    h3 { font-size:12pt; margin-top:22px; border-bottom:1px solid #999; padding-bottom:3px; }
  </style></head><body>
    <h1>Boletim Individual — ${escaparHtml(disciplina ? disciplina.nome : "")}</h1>
    ${turma && turma.escola ? `<div class="escola">${escaparHtml(turma.escola)}</div>` : ""}
    <div class="nome-aluno">${escaparHtml(l.aluno.nome)}</div>
    <div class="nota-final"><div class="valor">${notaFormatada}</div><div class="rotulo">Nota final</div></div>
    <div class="freq-info">Frequência: ${l.freqPct === null ? "sem chamada lançada" : fmtPctPesos(l.freqPct)}${l.nivelDesconto > 0 ? ` — nota rebaixada de ${l.mencaoBruta} para ${l.mencaoFinal} por frequência` : ""}</div>
    <h3>Detalhamento por atividade</h3>
    <table>
      <thead><tr><th>Atividade</th><th class="center">Nota</th></tr></thead>
      <tbody>${l.detalhe.map((d) => `<tr><td>${escaparHtml(d.nome)} (peso ${d.peso})</td><td class="center">${d.lancado ? fmtPctPesos(d.nota) : "não lançado"}</td></tr>`).join("")}</tbody>
    </table>
    <h3>Ocorrências</h3>
    ${l.ocorrencias.length ? `<ul>${l.ocorrencias.map((o) => `<li>${escaparHtml(o.atividade)} — ${escaparHtml(o.motivo)}</li>`).join("")}</ul>` : "<p>Nenhuma ocorrência registrada.</p>"}
    <p style="margin-top:50px; text-align:right; font-size:9pt; color:#555;">Relatório gerado automaticamente pelo sistema Vistos — ${dataGeracao}</p>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.print();
}

// ---------- renderização ----------

function renderPesos() {
  let html = `<div class="selecao-visto">`;
  const escolas = [...new Set(estadoTurmas.turmas.map((t) => t.escola).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  html += `<select id="select-escola-pesos" onchange="mudarEscolaPesos(this.value)">
    <option value="">Selecione a escola…</option>
    ${escolas.map((e) => `<option value="${escaparHtml(e)}" ${e === estadoPesos.escola ? "selected" : ""}>${escaparHtml(e)}</option>`).join("")}
  </select>`;
  html += `<select id="select-turma-pesos" onchange="mudarTurmaPesos(this.value)" ${estadoPesos.escola ? "" : "disabled"}>
    <option value="">Selecione a turma…</option>
    ${turmasDaEscolaSelecionadaPesos().map((t) => `<option value="${t.id}" ${t.id === estadoPesos.turmaId ? "selected" : ""}>${escaparHtml(t.nome)}</option>`).join("")}
  </select>`;
  html += `<select id="select-disciplina-pesos" onchange="mudarDisciplinaPesos(this.value)" ${estadoPesos.turmaId ? "" : "disabled"}>
    <option value="">Selecione a disciplina…</option>
    ${estadoPesos.disciplinas.map((d) => `<option value="${d.id}" ${d.id === estadoPesos.disciplinaId ? "selected" : ""}>${escaparHtml(d.nome)}</option>`).join("")}
  </select>`;
  html += `</div>`;

  if (!estadoPesos.disciplinaId) {
    html += `<p class="vazio-aviso">Selecione escola, turma e disciplina para calcular as notas finais.</p>`;
    painelRelatorio.innerHTML = html;
    return;
  }

  if (estadoPesos.carregando) {
    html += `<p class="vazio-aviso">Calculando…</p>`;
    painelRelatorio.innerHTML = html;
    return;
  }

  html += `<div style="display:flex; gap:8px; margin-bottom:16px;"><button class="btn-secundario" onclick="atualizarNotasPesos()">🔄 Atualizar notas</button></div>`;

  if (!estadoPesos.carregado) {
    painelRelatorio.innerHTML = html;
    return;
  }

  // --- faixas de menção ---
  if (estadoPesos.sistemaAvaliacao !== "porcentagem") {
    html += `
      <div class="coluna-titulo"><h2>Faixas de menção</h2></div>
      <div style="display:flex; gap:10px; align-items:flex-end; margin-bottom:18px; flex-wrap:wrap;">
        <div class="campo-form" style="width:90px;"><label>Mínimo R</label><input type="number" id="input-faixa-r-pesos" value="${estadoPesos.faixas.R}" /></div>
        <div class="campo-form" style="width:90px;"><label>Mínimo B</label><input type="number" id="input-faixa-b-pesos" value="${estadoPesos.faixas.B}" /></div>
        <div class="campo-form" style="width:90px;"><label>Mínimo MB</label><input type="number" id="input-faixa-mb-pesos" value="${estadoPesos.faixas.MB}" /></div>
        <button class="btn-primario" style="padding:8px 16px;" onclick="salvarFaixasPesos()">Salvar faixas</button>
      </div>
    `;
  }

  // --- pesos por atividade ---
  html += `<div class="coluna-titulo"><h2>Peso de cada atividade</h2></div>`;
  if (estadoPesos.atividades.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma atividade de Visto ou Seminário cadastrada ainda para esta disciplina.</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoPesos.atividades.forEach((a) => {
      const s = estadoPesos.pesosConfig.selecionadas.find((x) => x.atividadeId === a.id);
      html += `
        <div class="item-cartao" style="cursor:default;">
          <span class="nome-item">${a.tipo === "visto" ? "✓" : "👥"} ${escaparHtml(a.nome)}<br/><span class="subinfo-item">${a.data ? formatarDataBrTurmas(a.data) : ""}</span></span>
          <span class="acoes-item">
            <label style="font-weight:400; display:flex; align-items:center; gap:6px;">Peso
              <input type="number" value="${s ? s.peso : 1}" min="0" step="0.5" style="width:70px;" onchange="editarPesoAtividade('${a.id}', this.value)" />
            </label>
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  // --- tabela de notas ---
  html += `
    <div class="coluna-titulo" style="margin-top:20px;">
      <h2>Notas finais</h2>
      <div style="display:flex; gap:8px;">
        <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="exportarNotasCsv()">Exportar CSV</button>
        <button class="btn-secundario" style="padding:6px 14px; font-size:0.85rem;" onclick="gerarRelatorioTurmaPdf()">Relatório da turma (PDF)</button>
      </div>
    </div>
  `;

  const mencao = estadoPesos.sistemaAvaliacao !== "porcentagem";
  if (estadoPesos.linhasCalculadas.length === 0) {
    html += `<p class="vazio-aviso">Nenhum aluno nesta turma.</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoPesos.linhasCalculadas.forEach((l) => {
      const freqTexto = l.freqPct === null ? "sem chamada" : fmtPctPesos(l.freqPct);
      const avisoDesconto = l.nivelDesconto > 0 ? `<span class="selo-chamada sel-justificada" title="Rebaixou de ${l.mencaoBruta}">⚠️ -${l.nivelDesconto} nível(is) por frequência</span>` : "";
      html += `
        <div class="item-cartao" style="cursor:default;">
          <span class="nome-item">${escaparHtml(l.aluno.nome)}<br/><span class="subinfo-item">Frequência: ${freqTexto}</span></span>
          <span class="acoes-item">
            ${mencao
              ? `<span class="mencao-pesos mencao-${l.mencaoFinal}">${l.mencaoFinal}</span> <span class="subinfo-item">(${fmtPctPesos(l.notaFinal)})</span>`
              : `<strong>${fmtPctPesos(l.notaFinal)}</strong>`}
            ${avisoDesconto}
            <button class="btn-secundario" style="padding:5px 10px; font-size:0.78rem;" onclick="gerarBoletimAlunoPdf('${l.aluno.id}')">📄 Boletim</button>
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  const comOcorrencia = estadoPesos.linhasCalculadas.filter((l) => l.ocorrencias.length);
  html += `<div class="coluna-titulo" style="margin-top:20px;"><h2>Ocorrências (notas zeradas)</h2></div>`;
  if (comOcorrencia.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma.</p>`;
  } else {
    html += `<ul style="padding-left:18px;">`;
    comOcorrencia.forEach((l) => {
      html += `<li style="margin-bottom:6px; font-size:0.85rem;"><strong>${escaparHtml(l.aluno.nome)}</strong>: ${l.ocorrencias.map((o) => escaparHtml(o.atividade) + " — " + escaparHtml(o.motivo)).join("; ")}</li>`;
    });
    html += `</ul>`;
  }

  painelRelatorio.innerHTML = html;
}
