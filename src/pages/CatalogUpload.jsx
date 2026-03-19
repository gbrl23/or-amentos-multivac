import { useState, useRef, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { ChevronLeft } from 'lucide-react';

// ─── Colunas esperadas no CSV ────────────────────────────────────────────────
const EXPECTED_COLUMNS = [
  "linha","descricao_linha","ext1","item","detalhe",
  "vd_preco","un","al_ipi","cfiscal","peso",
  "comprimento","largura","altura","cubagem","qtd_min","id","ativo"
];

// ─── Parser CSV simples (lida com vírgulas dentro de aspas) ─────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

  return lines.slice(1).map(line => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { values.push(current); current = ""; continue; }
      current += char;
    }
    values.push(current);

    const row = {};
    headers.forEach((h, i) => {
      let val = (values[i] ?? "").trim();
      // converte numéricos (usa vírgula como decimal no CSV)
      if (["vd_preco","al_ipi","peso","comprimento","largura","altura","cubagem","qtd_min"].includes(h)) {
        val = parseFloat(val.replace(",", ".")) || 0;
      }
      if (h === "ativo") val = val === "true";
      row[h] = val;
    });
    return row;
  }).filter(r => r.ext1); // ignora linhas vazias
}

// ─── Componente ─────────────────────────────────────────────────────────────
export default function CatalogUpload() {
  const [stage, setStage] = useState("idle"); // idle | preview | uploading | done | error
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ inserted: 0, updated: 0, errors: [] });
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState("");
  const fileRef = useRef();

  const navigate = useNavigate();

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith(".csv")) {
      setErrorMsg("Arquivo deve ser .csv");
      setStage("error");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        if (!parsed.length) throw new Error("Arquivo vazio ou inválido.");
        setRows(parsed);
        setStage("preview");
        setErrorMsg("");
      } catch (err) {
        setErrorMsg(err.message);
        setStage("error");
      }
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onUpload = async () => {
    setStage("uploading");
    setProgress(0);
    const BATCH = 50;
    let inserted = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("lista_produtos")
        .upsert(batch, { onConflict: "ext1", ignoreDuplicates: false });

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        // estimativa simples (supabase não retorna contagem por upsert)
        inserted += batch.length;
      }
      setProgress(Math.round(((i + BATCH) / rows.length) * 100));
    }

    setResult({ inserted, updated, errors });
    setStage("done");
  };

  const reset = () => {
    setStage("idle");
    setRows([]);
    setFileName("");
    setProgress(0);
    setFilter("");
    setResult({ inserted: 0, updated: 0, errors: [] });
    setErrorMsg("");
  };

  const filtered = rows.filter(r =>
    !filter ||
    r.detalhe?.toLowerCase().includes(filter.toLowerCase()) ||
    r.ext1?.toLowerCase().includes(filter.toLowerCase()) ||
    r.descricao_linha?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl mx-auto rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[50vh] overflow-hidden relative bg-white pb-10">
        
        {/* HEADER EXTRA - VOLTAR */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center mb-6">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-500 hover:text-[#0071b4] font-medium transition"
          >
            <ChevronLeft size={20} />
            Voltar ao Dashboard
          </button>
        </div>

        <div className="px-8">
          <style>{css}</style>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Importação em Lote (CSV)</h3>
              <p className="text-sm text-gray-500 mt-0.5">Atualização massiva · Tabela <code className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600">lista_produtos</code></p>
            </div>
          </div>

          {/* ── IDLE: Drop Zone ── */}
      {stage === "idle" && (
        <div
          style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current.click()}
          className="catalog-dropzone"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div style={styles.dropIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0071b4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p style={styles.dropText}>Arraste o CSV aqui ou <span style={styles.link}>clique para selecionar</span></p>
          <p style={styles.dropHint}>Formato: exportação direta do Supabase · UTF-8</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {stage === "error" && (
        <div style={styles.errorBox}>
          <span style={styles.errorIcon}>✕</span>
          <div style={{ flex: 1 }}>
            <p style={styles.errorTitle}>Erro ao processar arquivo</p>
            <p style={styles.errorMsg}>{errorMsg}</p>
          </div>
          <button style={styles.btnSecondary} onClick={reset}>Tentar novamente</button>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {stage === "preview" && (
        <div>
          <div style={styles.previewHeader}>
            <div style={styles.previewInfo}>
              <span style={styles.fileTag}>{fileName}</span>
              <span style={styles.countBadge}>{rows.length} produtos</span>
            </div>
            <div style={styles.previewActions}>
              <input
                style={styles.searchInput}
                placeholder="Filtrar produtos..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button style={styles.btnSecondary} onClick={reset}>Cancelar</button>
              <button style={styles.btnPrimary} onClick={onUpload} className="catalog-btn-primary">
                Confirmar e Importar
              </button>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["LINHA","DESCRIÇÃO LINHA","CÓD. EXT","ITEM","PRODUTO","PREÇO","UN","IPI","ATIVO"].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd} className="catalog-table-row">
                    <td style={styles.td}><span style={styles.linhaTag}>{row.linha}</span></td>
                    <td style={styles.td}>{row.descricao_linha}</td>
                    <td style={{ ...styles.td, ...styles.mono }}>{row.ext1}</td>
                    <td style={{ ...styles.td, ...styles.mono }}>{row.item}</td>
                    <td style={{ ...styles.td, maxWidth: 280 }}>{row.detalhe}</td>
                    <td style={{ ...styles.td, ...styles.mono, textAlign: "right" }}>
                      R$ {Number(row.vd_preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td}>{row.un}</td>
                    <td style={styles.td}>{row.al_ipi}%</td>
                    <td style={styles.td}>
                      <span style={row.ativo ? styles.badgeOn : styles.badgeOff}>
                        {row.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <p style={styles.truncNote}>Exibindo 200 de {filtered.length} produtos filtrados.</p>
            )}
          </div>
        </div>
      )}

      {/* ── UPLOADING ── */}
      {stage === "uploading" && (
        <div style={styles.uploadingBox}>
          <p style={styles.uploadingTitle}>Importando catálogo...</p>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${Math.min(progress, 100)}%` }} className="catalog-progress-fill" />
          </div>
          <p style={styles.progressPct}>{Math.min(progress, 100)}%</p>
          <p style={styles.uploadingHint}>Não feche esta janela.</p>
        </div>
      )}

      {/* ── DONE ── */}
      {stage === "done" && (
        <div style={styles.doneBox}>
          <div style={styles.doneIcon}>✓</div>
          <h2 style={styles.doneTitle}>Importação concluída</h2>
          <div style={styles.doneStats}>
            <div style={styles.statCard}>
              <span style={styles.statNum}>{rows.length}</span>
              <span style={styles.statLabel}>produtos processados</span>
            </div>
            {result.errors.length > 0 && (
              <div style={{ ...styles.statCard, ...styles.statCardErr }}>
                <span style={styles.statNum}>{result.errors.length}</span>
                <span style={styles.statLabel}>erros</span>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div style={styles.errList}>
              {result.errors.map((e, i) => <p key={i} style={styles.errItem}>{e}</p>)}
            </div>
          )}
          <button style={styles.btnPrimary} onClick={reset} className="catalog-btn-primary">
            Nova importação
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles (adaptados ao visual do Dashboard - tema claro) ──────────────────
const C = {
  bg: "#f9fafb",
  surface: "#ffffff",
  border: "#e5e7eb",
  borderHover: "#0071b4",
  text: "#111827",
  muted: "#6b7280",
  accent: "#0071b4",
  accentLight: "#e0f2fe",
  accentDim: "#005f9e",
  error: "#ef4444",
  errorLight: "#fef2f2",
  success: "#22c55e",
  successLight: "#f0fdf4",
  mono: "#374151",
};

const styles = {
  // Drop zone
  dropzone: {
    border: `2px dashed ${C.border}`,
    borderRadius: 16,
    padding: "64px 32px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.25s ease",
    background: C.surface,
  },
  dropzoneActive: {
    borderColor: C.accent,
    background: C.accentLight,
  },
  dropIcon: { marginBottom: 16 },
  dropText: { margin: "0 0 8px", fontSize: 15, color: C.text, fontWeight: 500 },
  link: { color: C.accent, textDecoration: "underline", fontWeight: 600 },
  dropHint: { margin: 0, fontSize: 13, color: C.muted },

  // Error
  errorBox: {
    border: `1px solid ${C.error}`,
    background: C.errorLight,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    borderRadius: 12,
  },
  errorIcon: { color: C.error, fontSize: 20, flexShrink: 0, fontWeight: 700 },
  errorTitle: { margin: "0 0 4px", fontWeight: 600, color: C.error, fontSize: 14 },
  errorMsg: { margin: 0, fontSize: 13, color: C.muted },

  // Preview
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  previewInfo: { display: "flex", alignItems: "center", gap: 10 },
  fileTag: {
    background: C.accentLight,
    border: `1px solid #bfdbfe`,
    padding: "5px 12px",
    fontSize: 12,
    color: C.accent,
    borderRadius: 8,
    fontWeight: 600,
  },
  countBadge: {
    background: C.successLight,
    border: `1px solid #bbf7d0`,
    color: C.success,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
  },
  previewActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  searchInput: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    color: C.text,
    padding: "8px 14px",
    fontSize: 13,
    outline: "none",
    width: 200,
    borderRadius: 10,
    transition: "border-color 0.2s",
  },

  // Table
  tableWrapper: {
    overflowX: "auto",
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    background: C.surface,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    background: "#f3f4f6",
    borderBottom: `1px solid ${C.border}`,
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 11,
    letterSpacing: 0.5,
    color: C.muted,
    fontWeight: 600,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
  },
  td: {
    padding: "10px 14px",
    borderBottom: `1px solid #f3f4f6`,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 180,
    color: C.text,
  },
  trEven: { background: C.surface },
  trOdd: { background: "#f9fafb" },
  mono: { fontFamily: "'DM Mono', monospace", color: C.mono, fontSize: 12 },
  linhaTag: {
    background: C.accentLight,
    color: C.accent,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    borderRadius: 6,
  },
  badgeOn: {
    background: C.successLight,
    color: C.success,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    borderRadius: 6,
  },
  badgeOff: {
    background: C.errorLight,
    color: C.error,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
    borderRadius: 6,
  },
  truncNote: { textAlign: "center", fontSize: 13, color: C.muted, padding: "12px 0", margin: 0 },

  // Uploading
  uploadingBox: {
    textAlign: "center",
    padding: "80px 32px",
  },
  uploadingTitle: { fontSize: 16, marginBottom: 24, color: C.text, fontWeight: 600 },
  progressTrack: {
    background: "#f3f4f6",
    border: `1px solid ${C.border}`,
    height: 8,
    width: "100%",
    maxWidth: 480,
    margin: "0 auto 12px",
    overflow: "hidden",
    borderRadius: 99,
  },
  progressFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${C.accent}, ${C.accentDim})`,
    transition: "width 0.3s ease",
    borderRadius: 99,
  },
  progressPct: { margin: "0 0 8px", fontSize: 14, color: C.accent, fontWeight: 700 },
  uploadingHint: { margin: 0, fontSize: 13, color: C.muted },

  // Done
  doneBox: {
    textAlign: "center",
    padding: "60px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  doneIcon: {
    width: 56,
    height: 56,
    background: C.successLight,
    border: `2px solid ${C.success}`,
    color: C.success,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    borderRadius: "50%",
    fontWeight: 700,
  },
  doneTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: C.text },
  doneStats: { display: "flex", gap: 16 },
  statCard: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    padding: "16px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 120,
    borderRadius: 12,
  },
  statCardErr: { borderColor: C.error, background: C.errorLight },
  statNum: { fontSize: 28, fontWeight: 700, color: C.accent },
  statLabel: { fontSize: 12, color: C.muted },
  errList: {
    background: C.errorLight,
    border: `1px solid ${C.error}`,
    padding: "12px 16px",
    maxWidth: 600,
    width: "100%",
    textAlign: "left",
    borderRadius: 12,
  },
  errItem: { margin: "4px 0", fontSize: 13, color: C.error },

  // Buttons
  btnPrimary: {
    background: C.accent,
    color: "#ffffff",
    border: "none",
    padding: "10px 24px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: 10,
    transition: "all 0.2s",
  },
  btnSecondary: {
    background: "transparent",
    color: C.muted,
    border: `1px solid ${C.border}`,
    padding: "9px 18px",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 10,
    transition: "all 0.2s",
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
  .catalog-dropzone:hover { border-color: ${C.borderHover} !important; box-shadow: 0 0 0 3px ${C.accentLight}; }
  .catalog-btn-primary:hover { background: ${C.accentDim} !important; }
  .catalog-table-row:hover td { background: #f0f7ff !important; }
  .catalog-progress-fill { animation: catalogPulse 1.5s ease-in-out infinite; }
  @keyframes catalogPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.8; } }
`;
