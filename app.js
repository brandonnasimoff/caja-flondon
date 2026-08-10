const {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} = React;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_S = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const CATS = ["Servicios", "Alquiler", "Salidas", "Compras del hogar", "Personal"];
const PERS = ["Brandon", "Florencia"];
const METS = ["Efectivo", "Débito", "Tarjeta de Crédito"];
const ICONS = {
  "Servicios": "⚡",
  "Alquiler": "🏠",
  "Salidas": "🍽️",
  "Compras del hogar": "🛒",
  "Personal": "👤",
  "Expensas": "🏢",
  "Comida": "🛒",
  "Compras": "🛍️",
  "Muebles": "🪑",
  "Accesorios": "💡",
  "Arreglos": "🔧",
  "Transporte": "🚗",
  "Salud": "💊",
  "Entretenimiento": "🎬",
  "Otros": "📦"
};
const fmt = n => {
  const a = Math.abs(Math.round(n));
  return (n < 0 ? "-" : "") + "$" + a.toLocaleString("es-AR");
};
const fmtK = n => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n < 0 ? "-" : "") + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return (n < 0 ? "-" : "") + "$" + Math.round(a / 1e3) + "K";
  return fmt(n);
};
const norm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const mI = m => {
  if (m == null || m === "") return -1;
  if (typeof m === "number") return m >= 0 && m < 12 ? m : -1;
  if (m instanceof Date) return m.getMonth();
  const s = norm(m);
  if (!s) return -1;
  let i = MESES.findIndex(x => norm(x) === s);
  if (i >= 0) return i;
  i = MESES_S.findIndex(x => norm(x) === s);
  if (i >= 0) return i;
  i = MESES.findIndex(x => norm(x).startsWith(s.slice(0, 3)));
  if (i >= 0) return i;
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n - 1;
  return -1;
};
const todayShort = () => {
  const d = new Date();
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
};
const parseFecha = s => {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s) ? null : s;
  const str = String(s).trim();
  let m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?$/);
  if (m) {
    const day = +m[1],
      mon = +m[2] - 1;
    let yr = m[3] ? +m[3] : new Date().getFullYear();
    if (yr < 100) yr += 2000;
    return new Date(yr, mon, day);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
};
const ymd = d => d.toISOString().slice(0, 10);
// Tarjeta de Crédito: TODO pago con crédito impacta el mes SIGUIENTE al de la compra (cierre de tarjeta)
const cuoStart = e => {
  const em = mI(e.mes);
  if (em < 0) return em;
  return em + (e.metodo === "Tarjeta de Crédito" ? 1 : 0);
};
const fmtFecha = f => {
  const d = parseFecha(f);
  return d ? String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") : f || "";
};
const isoToday = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const anyToISO = f => {
  const d = parseFecha(f) || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const isoToDDMM = iso => {
  const p = String(iso || "").split("-");
  return p.length === 3 ? p[2] + "/" + p[1] : todayShort();
};

// SPLIT encoding inside descripcion: " [#sp=B]" personal de Brandon, " [#sp=F]" personal de Flor, " [#sp=70/30]" custom %
const SPLIT_RE = /\s*\[#sp=([^\]]+)\]\s*$/;
const parseSplit = desc => {
  if (!desc) return {
    kind: "50/50",
    brPct: 0.5,
    flPct: 0.5,
    clean: ""
  };
  const m = String(desc).match(SPLIT_RE);
  if (!m) return {
    kind: "50/50",
    brPct: 0.5,
    flPct: 0.5,
    clean: String(desc)
  };
  const code = m[1];
  const clean = String(desc).replace(SPLIT_RE, "").trim();
  if (code === "B") return {
    kind: "personal",
    personal: "Brandon",
    brPct: 1,
    flPct: 0,
    clean
  };
  if (code === "F") return {
    kind: "personal",
    personal: "Florencia",
    brPct: 0,
    flPct: 1,
    clean
  };
  const p = code.split("/");
  if (p.length === 2) {
    const b = +p[0] / 100,
      f = +p[1] / 100;
    if (!isNaN(b) && !isNaN(f)) return {
      kind: "custom",
      brPct: b,
      flPct: f,
      clean
    };
  }
  return {
    kind: "50/50",
    brPct: 0.5,
    flPct: 0.5,
    clean: String(desc)
  };
};
const encodeSplit = (clean, sp) => {
  if (!sp || sp.kind === "50/50") return clean || "";
  if (sp.kind === "personal") return sp.personal ? `${clean || ""} [#sp=${sp.personal[0]}]`.trim() : clean || "";
  if (sp.kind === "custom") {
    const b = Math.round(sp.brPct * 100);
    return `${clean || ""} [#sp=${b}/${100 - b}]`.trim();
  }
  return clean || "";
};
const LS = {
  api: "caja-flondon-api",
  lastVals: "caja-flondon-last",
  installDism: "caja-flondon-install-dismissed",
  fixed: "caja-flondon-fixed"
};
function App() {
  const DEFAULT_API = "https://script.google.com/macros/s/AKfycbzFfJmK9c4ERpoD3AcjaOzoNrKL6QS3Lao-etUP_bKFs_N2TGpp6reejPxC13oJOAGOAw/exec";
  const [apiUrl, setApiUrl] = useState(localStorage.getItem(LS.api) || DEFAULT_API);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [budget, setBudget] = useState(1500000);
  const [view, setView] = useState("dashboard");
  const [month, setMonth] = useState(MESES[new Date().getMonth()]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [urlInput, setUrlInput] = useState(apiUrl);
  const [editingExp, setEditingExp] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [fixed, setFixed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS.fixed) || "[]");
    } catch (e) {
      return [];
    }
  });
  const saveFixed = arr => {
    setFixed(arr);
    localStorage.setItem(LS.fixed, JSON.stringify(arr));
  };
  const flash = (m, kind) => {
    setToast({
      m,
      kind: kind || "ok"
    });
    setTimeout(() => setToast(null), 2400);
  };
  const fetchData = useCallback(async url => {
    const target = url || apiUrl;
    if (!target) return;
    setLoading(true);
    try {
      const r = await fetch(target);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setExpenses((d.expenses || []).map((e, i) => ({
        ...e,
        id: "gs" + e.row + "_" + i
      })));
      setSettlements((d.settlements || []).map((s, i) => ({
        ...s,
        id: "st" + s.row + "_" + i
      })));
      setBudget(d.budget || 1500000);
    } catch (err) {
      console.error(err);
      flash("Error al conectar: " + err.message, "err");
    }
    setLoading(false);
  }, [apiUrl]);
  useEffect(() => {
    if (configured && apiUrl) fetchData();
  }, [configured]);
  useEffect(() => {
    const h = e => {
      e.preventDefault();
      if (!localStorage.getItem(LS.installDism)) setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const apiPost = async body => {
    setSyncing(true);
    try {
      await fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "text/plain"
        }
      });
      await fetchData();
    } catch (err) {
      flash("Error: " + err.message, "err");
    }
    setSyncing(false);
  };
  const addExpense = async exp => {
    await apiPost({
      action: "addExpense",
      expense: exp
    });
    flash("✓ Gasto guardado");
  };
  const delExpense = async row => {
    await apiPost({
      action: "deleteExpense",
      row
    });
    flash("Gasto eliminado");
  };
  const updExpense = async (row, exp) => {
    await apiPost({
      action: "deleteExpense",
      row
    });
    await apiPost({
      action: "addExpense",
      expense: exp
    });
    flash("✓ Gasto actualizado");
  };
  const addSettle = async s => {
    await apiPost({
      action: "addSettlement",
      settlement: s
    });
    flash("✓ Pago saldado");
  };
  const updBudget = async v => {
    setBudget(v);
    await apiPost({
      action: "updateBudget",
      budget: v
    });
    flash("Presupuesto actualizado");
  };
  const bulkLoadFixed = async targetMonth => {
    if (fixed.length === 0) return;
    if (!confirm(`Cargar ${fixed.length} gastos fijos a ${targetMonth}? Total: ${fmt(fixed.reduce((a, f) => a + f.monto, 0))}`)) return;
    setSyncing(true);
    try {
      for (const t of fixed) {
        await fetch(apiUrl, {
          method: "POST",
          body: JSON.stringify({
            action: "addExpense",
            expense: {
              fecha: todayShort(),
              mes: targetMonth,
              categoria: t.categoria,
              descripcion: t.descripcion,
              persona: t.persona,
              metodo: t.metodo,
              monto: t.monto,
              cuotas: 1
            }
          }),
          headers: {
            "Content-Type": "text/plain"
          }
        });
      }
      await fetchData();
      flash(`✓ ${fixed.length} gastos fijos cargados a ${targetMonth}`);
    } catch (err) {
      flash("Error: " + err.message, "err");
    }
    setSyncing(false);
  };
  const loadOneFixed = async (t, targetMonth) => {
    await addExpense({
      fecha: todayShort(),
      mes: targetMonth,
      categoria: t.categoria,
      descripcion: t.descripcion,
      persona: t.persona,
      metodo: t.metodo,
      monto: t.monto,
      cuotas: 1
    });
  };
  const startEdit = e => {
    setEditingExp(e);
    setPrefill(e);
    setView("add");
  };
  const startDup = e => {
    setEditingExp(null);
    setPrefill({
      ...e,
      fecha: todayShort(),
      mes: month
    });
    setView("add");
  };
  const goAdd = () => {
    setEditingExp(null);
    setPrefill(null);
    setView("add");
  };

  // ============= COMPUTED: monthly aggregate (with splits + settlements) =============
  const md = useMemo(() => {
    const m = mI(month);
    let tot = 0,
      brPaid = 0,
      flPaid = 0,
      brOwes = 0,
      flOwes = 0;
    const bCat = {};
    const bMet = {};
    CATS.forEach(c => bCat[c] = {
      t: 0,
      B: 0,
      F: 0
    });
    METS.forEach(mt => bMet[mt] = 0);
    expenses.forEach(e => {
      const cu = Number(e.cuotas) || 1;
      const mc = Number(e.monto || 0) / cu;
      const st = cuoStart(e);
      if (st < 0) return;
      if (m >= st && m < st + cu) {
        const sp = parseSplit(e.descripcion);
        tot += mc;
        if (e.persona === "Brandon") brPaid += mc;else flPaid += mc;
        brOwes += mc * sp.brPct;
        flOwes += mc * sp.flPct;
        if (e.categoria) {
          if (!bCat[e.categoria]) bCat[e.categoria] = {
            t: 0,
            B: 0,
            F: 0
          };
          bCat[e.categoria].t += mc;
          bCat[e.categoria][e.persona[0]] += mc;
        }
        if (bMet[e.metodo] !== undefined) bMet[e.metodo] += mc;
      }
    });
    let brSettleTo = 0,
      flSettleTo = 0;
    settlements.filter(s => mI(s.mes) === m).forEach(s => {
      const amt = Number(s.monto) || 0;
      if (s.from === "Brandon") brSettleTo += amt;else flSettleTo += amt;
    });
    const imbalance = brPaid - brOwes + brSettleTo - flSettleTo;
    return {
      tot,
      brPaid,
      flPaid,
      brOwes,
      flOwes,
      bCat,
      bMet,
      imbalance
    };
  }, [expenses, settlements, month, budget]);

  // ============= Multi-month chart data (last 6 months ending at selected) =============
  const trend = useMemo(() => {
    const sel = mI(month);
    const arr = [];
    for (let off = 5; off >= 0; off--) {
      const i = sel - off;
      if (i < 0) {
        arr.push({
          m: "",
          v: 0,
          sel: false
        });
        continue;
      }
      let t = 0;
      expenses.forEach(e => {
        const st = cuoStart(e);
        if (st < 0) return;
        const cu = Number(e.cuotas) || 1;
        if (i >= st && i < st + cu) t += e.monto / cu;
      });
      arr.push({
        m: MESES_S[i],
        v: t,
        sel: i === sel
      });
    }
    return arr;
  }, [expenses, month]);

  // ============= Cuotas pendientes (proxima 6 meses, posterior al actual) =============
  const cuotas = useMemo(() => {
    const sel = mI(month);
    const arr = [];
    for (let off = 1; off <= 6; off++) {
      const i = sel + off;
      if (i > 11) break;
      const items = [];
      let total = 0;
      expenses.forEach(e => {
        const st = cuoStart(e);
        if (st < 0) return;
        const cu = Number(e.cuotas) || 1;
        if (i >= st && i < st + cu && cu > 1) {
          const mc = e.monto / cu;
          items.push({
            ...e,
            mc,
            n: i - st + 1,
            cu
          });
          total += mc;
        }
      });
      if (total > 0) arr.push({
        mes: MESES[i],
        total,
        items
      });
    }
    return arr;
  }, [expenses, month]);

  // ============= Projection / daily avg =============
  const proj = useMemo(() => {
    const now = new Date();
    const isCurMonth = mI(month) === now.getMonth();
    if (!isCurMonth) return null;
    const day = now.getDate();
    const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyAvg = md.tot / day;
    const projected = dailyAvg * daysIn;
    return {
      day,
      daysIn,
      dailyAvg,
      projected
    };
  }, [md.tot, month]);

  // ============= Filtered expenses for current dashboard view =============
  const mExp = useMemo(() => {
    const m = mI(month);
    return expenses.filter(e => {
      const st = cuoStart(e);
      if (st < 0) return false;
      const cu = Number(e.cuotas) || 1;
      return m >= st && m < st + cu;
    });
  }, [expenses, month]);

  // CONFIG SCREEN
  if (!configured) {
    return /*#__PURE__*/React.createElement("div", {
      style: S.root
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 500,
        margin: "0 auto",
        padding: "60px 20px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 54,
        marginBottom: 16
      }
    }, "🏠"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 28,
        fontWeight: 800,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#8FB07A"
      }
    }, "Caja"), " Flondon"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "#666",
        marginBottom: 30
      }
    }, "Conectá con tu planilla de Google Sheets"), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "left",
        marginBottom: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: S.sLabel
    }, "URL de Google Apps Script"), /*#__PURE__*/React.createElement("input", {
      value: urlInput,
      onChange: e => setUrlInput(e.target.value),
      placeholder: "https://script.google.com/macros/s/.../exec",
      style: {
        ...S.input,
        marginTop: 8,
        fontSize: 13
      }
    })), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (!urlInput.includes("script.google.com")) {
          flash("URL inválida", "err");
          return;
        }
        localStorage.setItem(LS.api, urlInput);
        setApiUrl(urlInput);
        setConfigured(true);
      },
      style: {
        ...S.greenBtn,
        width: "100%",
        padding: 16,
        fontSize: 16
      }
    }, "Conectar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setConfigured(true),
      style: {
        marginTop: 12,
        background: "transparent",
        border: "1px solid #2a3050",
        borderRadius: 10,
        padding: "12px 20px",
        color: "#666",
        fontSize: 13,
        cursor: "pointer",
        width: "100%"
      }
    }, "Usar sin conexión (datos locales)")));
  }
  if (loading && expenses.length === 0) return /*#__PURE__*/React.createElement("div", {
    style: S.loadWrap
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 48,
      animation: "pulse 1.4s infinite"
    }
  }, "🏠"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      opacity: 0.5,
      marginTop: 10
    }
  }, "Sincronizando…")));
  return /*#__PURE__*/React.createElement("div", {
    style: S.root
  }, toast && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.toast,
      background: toast.kind === "err" ? "#e74c3c" : "#8FB07A",
      color: toast.kind === "err" ? "#fff" : "#0E0E0E"
    }
  }, toast.m), syncing && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: "#8FB07A",
      zIndex: 1000,
      animation: "pulse 1s infinite"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.header
  }, /*#__PURE__*/React.createElement("div", {
    style: S.headerInner
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.logo
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#8FB07A"
    }
  }, "Caja"), " Flondon"), /*#__PURE__*/React.createElement("div", {
    style: S.sub
  }, "Brandon & Florencia · ", apiUrl ? "🟢" : "🔴")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => fetchData(),
    style: S.iconBtn,
    "aria-label": "Sincronizar"
  }, "🔄"), /*#__PURE__*/React.createElement("select", {
    value: month,
    onChange: e => setMonth(e.target.value),
    style: S.monthPick
  }, MESES.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m)))))), installPrompt && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "10px 16px 0",
      background: "linear-gradient(135deg,#152218,#1a2e22)",
      border: "1px solid #264030",
      borderRadius: 12,
      padding: "10px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#8FB07A"
    }
  }, "Instalá la app"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#888"
    }
  }, "Acceso directo desde tu pantalla")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    },
    style: {
      ...S.greenBtn,
      padding: "6px 12px",
      fontSize: 12
    }
  }, "Instalar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      localStorage.setItem(LS.installDism, "1");
      setInstallPrompt(null);
    },
    style: {
      ...S.iconBtn,
      fontSize: 13
    }
  }, "✕"))), /*#__PURE__*/React.createElement("div", {
    style: S.content
  }, view === "dashboard" && /*#__PURE__*/React.createElement(Dash, {
    d: md,
    budget: budget,
    month: month,
    updBudget: updBudget,
    trend: trend,
    proj: proj,
    cuotas: cuotas
  }), view === "add" && /*#__PURE__*/React.createElement(Add, {
    onAdd: addExpense,
    onUpd: updExpense,
    editing: editingExp,
    prefill: prefill,
    month: month,
    onDone: () => {
      setEditingExp(null);
      setPrefill(null);
      setView("history");
    }
  }), view === "history" && /*#__PURE__*/React.createElement(Hist, {
    allExps: expenses,
    month: month,
    onDel: delExpense,
    onEdit: startEdit,
    onDup: startDup
  }), view === "balance" && /*#__PURE__*/React.createElement(Bal, {
    d: md,
    month: month,
    onSettle: addSettle,
    setts: settlements.filter(s => mI(s.mes) === mI(month))
  }), view === "fixed" && /*#__PURE__*/React.createElement(Fixed, {
    fixed: fixed,
    saveFixed: saveFixed,
    bulkLoad: bulkLoadFixed,
    loadOne: loadOneFixed,
    month: month
  }), view === "settings" && /*#__PURE__*/React.createElement(Settings, {
    apiUrl: apiUrl,
    expenses: expenses,
    settlements: settlements,
    onSave: u => {
      localStorage.setItem(LS.api, u);
      setApiUrl(u);
      fetchData(u);
      setView("dashboard");
      flash("Conectado");
    },
    onDisconnect: () => {
      if (confirm("¿Desconectar de Google Sheets? Los datos siguen en la planilla.")) {
        localStorage.removeItem(LS.api);
        setApiUrl("");
        setConfigured(false);
      }
    }
  })), view !== "add" && /*#__PURE__*/React.createElement("button", {
    onClick: goAdd,
    style: S.fab,
    "aria-label": "Cargar gasto"
  }, "＋"), /*#__PURE__*/React.createElement("div", {
    style: S.navWrap
  }, /*#__PURE__*/React.createElement("div", {
    style: S.nav
  }, [{
    k: "dashboard",
    i: "📊",
    l: "Inicio"
  }, {
    k: "history",
    i: "📋",
    l: "Historial"
  }, {
    k: "fixed",
    i: "📌",
    l: "Fijos"
  }, {
    k: "balance",
    i: "⚖️",
    l: "Balance"
  }, {
    k: "settings",
    i: "⚙️",
    l: "Config"
  }].map(({
    k,
    i,
    l
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setView(k),
    style: {
      ...S.navBtn,
      color: view === k ? "#8FB07A" : "#555"
    }
  }, view === k && /*#__PURE__*/React.createElement("div", {
    style: S.navDot
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, i), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      marginTop: 2
    }
  }, l))))));
}

// ===== DASHBOARD =====
function Dash({
  d,
  budget,
  month,
  updBudget,
  trend,
  proj,
  cuotas
}) {
  const [editBudget, setEditBudget] = useState(false);
  const [bIn, setBIn] = useState("");
  const pct = budget > 0 ? Math.min(d.tot / budget * 100, 100) : 0;
  const avail = budget - d.tot;
  const bc = pct > 90 ? "#e74c3c" : pct > 70 ? "#f39c12" : "#8FB07A";
  const maxTrend = Math.max(...trend.map(t => t.v), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    },
    className: "fade"
  }, /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: S.sLabel
  }, "Presupuesto ", month), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditBudget(!editBudget);
      setBIn(String(budget));
    },
    style: S.smallBtn
  }, editBudget ? "✕" : "✏️")), editBudget ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "numeric",
    value: bIn,
    onChange: e => setBIn(e.target.value),
    style: {
      ...S.input,
      flex: 1,
      fontSize: 18,
      fontWeight: 800
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      updBudget(+bIn || 0);
      setEditBudget(false);
    },
    style: S.greenBtn
  }, "OK")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      letterSpacing: "-1px"
    }
  }, fmt(budget)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0f14",
      borderRadius: 6,
      height: 8,
      marginTop: 14,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${pct}%`,
      background: bc,
      borderRadius: 6,
      transition: "width 0.4s"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 8,
      fontSize: 12,
      color: "#666"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Gastado: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: bc
    }
  }, fmt(d.tot)), " (", pct.toFixed(0), "%)"), /*#__PURE__*/React.createElement("span", null, "Libre: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: avail >= 0 ? "#8FB07A" : "#e74c3c"
    }
  }, fmt(avail)))))), proj && /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Proyección de fin de mes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: proj.projected > budget ? "#e74c3c" : "#8FB07A"
    }
  }, fmt(proj.projected)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666",
      marginTop: 2
    }
  }, "Día ", proj.day, "/", proj.daysIn, " · promedio ", fmt(proj.dailyAvg), "/día")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: proj.projected > budget ? "#e74c3c" : "#666",
      textAlign: "right"
    }
  }, proj.projected > budget ? `+${fmt(proj.projected - budget)}` : `-${fmt(budget - proj.projected)}`, /*#__PURE__*/React.createElement("br", null), "vs presupuesto"))), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Tendencia · últimos 6 meses"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 6,
      height: 60,
      marginTop: 10
    }
  }, trend.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      width: "100%",
      display: "flex",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: `${t.v / maxTrend * 100}%`,
      background: t.sel ? "#8FB07A" : "#2a3050",
      borderRadius: "3px 3px 0 0",
      minHeight: t.v > 0 ? 2 : 0
    },
    title: fmt(t.v)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: t.sel ? "#8FB07A" : "#555",
      fontWeight: t.sel ? 700 : 400
    }
  }, t.m || "·"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 10
    }
  }, [["Brandon", d.brPaid, "#4A6378"], ["Florencia", d.flPaid, "#8FB07A"]].map(([n, a, c]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.avatar,
      background: c
    }
  }, n[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666"
    }
  }, n, " pagó"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800
    }
  }, fmtK(a))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666",
      marginBottom: 4,
      fontWeight: 600,
      letterSpacing: "0.5px"
    }
  }, "ESTADO DE DEUDA"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: Math.abs(d.imbalance) < 1 ? "#8FB07A" : "#e8e8e4"
    }
  }, d.tot === 0 ? "Sin gastos este mes" : Math.abs(d.imbalance) < 1 ? "✓ Están parejos" : d.imbalance > 0 ? `Flor debe ${fmt(Math.abs(d.imbalance))} a Brandon` : `Brandon debe ${fmt(Math.abs(d.imbalance))} a Florencia`)), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.sLabel,
      marginBottom: 10,
      marginTop: 8
    }
  }, "Gastos por categoría"), Object.keys(d.bCat).filter(c => d.bCat[c].t > 0).sort((a, b) => d.bCat[b].t - d.bCat[a].t).map(c => {
    const x = d.bCat[c];
    const p = d.tot > 0 ? x.t / d.tot * 100 : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: c,
      style: {
        ...S.card,
        padding: "10px 14px",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16
      }
    }, ICONS[c]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600
      }
    }, c), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: "#555",
        background: "#1a1e2a",
        padding: "2px 6px",
        borderRadius: 4
      }
    }, p.toFixed(0), "%")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0
      }
    }, fmtK(x.t))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        marginTop: 5,
        fontSize: 11,
        color: "#666"
      }
    }, /*#__PURE__*/React.createElement("span", null, "B: ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: "#4A6378"
      }
    }, fmtK(x.B))), /*#__PURE__*/React.createElement("span", null, "F: ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: "#8FB07A"
      }
    }, fmtK(x.F)))), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#0d0f14",
        borderRadius: 3,
        height: 3,
        marginTop: 6,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: `${p}%`,
        background: "#8FB07A",
        borderRadius: 3
      }
    })));
  }), Object.keys(d.bCat).every(c => d.bCat[c].t === 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: "#444"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32
    }
  }, "📭"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 13
    }
  }, "Sin gastos en ", month)), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.sLabel,
      marginBottom: 10,
      marginTop: 8
    }
  }, "Métodos de pago"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 14
    }
  }, METS.map(m => /*#__PURE__*/React.createElement("div", {
    key: m,
    style: {
      ...S.card,
      textAlign: "center",
      padding: "12px 6px",
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#666",
      fontWeight: 600,
      marginBottom: 4
    }
  }, m === "Tarjeta de Crédito" ? "TC" : m), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, fmtK(d.bMet[m] || 0))))), cuotas.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.sLabel,
      marginBottom: 10,
      marginTop: 8
    }
  }, "Cuotas pendientes"), cuotas.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.mes,
    style: {
      ...S.card,
      padding: "12px 14px",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700
    }
  }, c.mes), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "#f39c12"
    }
  }, fmtK(c.total))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666",
      marginTop: 4
    }
  }, c.items.slice(0, 3).map(it => `${ICONS[it.categoria] || "·"} ${parseSplit(it.descripcion).clean || it.categoria} (${it.n}/${it.cu})`).join(" · "), c.items.length > 3 ? ` · +${c.items.length - 3}` : "")))));
}

// ===== ADD / EDIT =====
function Add({
  onAdd,
  onUpd,
  editing,
  prefill,
  month,
  onDone
}) {
  const last = (() => {
    try {
      return JSON.parse(localStorage.getItem(LS.lastVals) || "{}");
    } catch (e) {
      return {};
    }
  })();
  const initial = () => {
    if (prefill) {
      const sp = parseSplit(prefill.descripcion);
      return {
        fecha: anyToISO(prefill.fecha),
        mes: prefill.mes || month,
        categoria: prefill.categoria || "",
        descripcion: sp.clean,
        persona: prefill.persona || "",
        metodo: prefill.metodo || "",
        monto: String(prefill.monto || ""),
        cuotas: String(prefill.cuotas || 1),
        split: sp.kind,
        personal: sp.personal || "",
        brPct: Math.round(sp.brPct * 100)
      };
    }
    return {
      fecha: isoToday(),
      mes: month,
      categoria: CATS.includes(last.categoria) ? last.categoria : "",
      descripcion: "",
      persona: last.persona || "",
      metodo: last.metodo || "",
      monto: "",
      cuotas: "1",
      split: "50/50",
      personal: "",
      brPct: 50
    };
  };
  const [f, sF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const montoRef = useRef(null);
  useEffect(() => {
    if (!prefill && montoRef.current) setTimeout(() => montoRef.current.focus(), 120);
  }, []);
  const u = (k, v) => sF(p => ({
    ...p,
    [k]: v
  }));
  const ok = f.categoria && f.persona && f.metodo && f.monto && +f.monto > 0 && (f.split !== "personal" || f.personal);
  const fmtPreview = f.monto ? fmt(+f.monto) : "$0";
  const splitDesc = () => {
    if (f.split === "personal") return `Solo de ${f.personal}`;
    if (f.split === "custom") return `B ${f.brPct}% · F ${100 - f.brPct}%`;
    return "50/50";
  };
  const go = async () => {
    if (!ok) return;
    setBusy(true);
    const sp = f.split === "personal" ? {
      kind: "personal",
      personal: f.personal
    } : f.split === "custom" ? {
      kind: "custom",
      brPct: f.brPct / 100,
      flPct: (100 - f.brPct) / 100
    } : {
      kind: "50/50"
    };
    const desc = encodeSplit(f.descripcion.trim(), sp);
    const exp = {
      fecha: isoToDDMM(f.fecha),
      mes: f.mes,
      categoria: f.categoria,
      descripcion: desc,
      persona: f.persona,
      metodo: f.metodo,
      monto: +f.monto,
      cuotas: +f.cuotas || 1
    };
    if (editing) await onUpd(editing.row, exp);else await onAdd(exp);
    localStorage.setItem(LS.lastVals, JSON.stringify({
      categoria: f.categoria,
      persona: f.persona,
      metodo: f.metodo
    }));
    setBusy(false);
    onDone();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    },
    className: "fade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800
    }
  }, editing ? "Editar gasto" : prefill ? "Duplicar gasto" : "Cargar gasto"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#666",
      marginTop: 2
    }
  }, editing ? "Modificá lo que necesites" : "Se guarda en la planilla")), /*#__PURE__*/React.createElement("button", {
    onClick: onDone,
    style: S.iconBtn
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Monto total"), /*#__PURE__*/React.createElement("input", {
    ref: montoRef,
    type: "number",
    inputMode: "decimal",
    value: f.monto,
    onChange: e => u("monto", e.target.value),
    placeholder: "0",
    style: {
      ...S.input,
      fontSize: 34,
      fontWeight: 800,
      textAlign: "center",
      margin: "6px 0 4px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontSize: 12,
      color: "#8FB07A",
      marginBottom: 14,
      fontWeight: 600
    }
  }, fmtPreview), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "¿Quién pagó?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      margin: "6px 0 16px"
    }
  }, PERS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => u("persona", p),
    style: {
      padding: 16,
      borderRadius: 12,
      border: `2px solid ${f.persona === p ? p === "Brandon" ? "#4A6378" : "#8FB07A" : "#222840"}`,
      background: f.persona === p ? p === "Brandon" ? "#151f2c" : "#152218" : "#161a26",
      color: "#e8e8e4",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, p === "Brandon" ? "🧑" : "👩", " ", p))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "División"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowSplit(!showSplit),
    style: S.smallBtn
  }, showSplit ? "OK" : "Cambiar")), !showSplit ? /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      padding: "10px 14px",
      marginTop: 8,
      marginBottom: 14,
      borderColor: f.split !== "50/50" ? "#8FB07A" : "#222840"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: f.split === "50/50" ? "#888" : "#8FB07A"
    }
  }, splitDesc())) : /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginTop: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 6,
      marginBottom: 8
    }
  }, [["50/50", "50/50"], ["personal", "Personal"], ["custom", "Custom %"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => u("split", k),
    style: {
      padding: "8px 4px",
      borderRadius: 8,
      border: `1px solid ${f.split === k ? "#8FB07A" : "#222840"}`,
      background: f.split === k ? "#152218" : "#0d0f14",
      color: f.split === k ? "#8FB07A" : "#888",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, l))), f.split === "personal" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 6
    }
  }, PERS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => u("personal", p),
    style: {
      padding: 10,
      borderRadius: 8,
      border: `1px solid ${f.personal === p ? "#8FB07A" : "#222840"}`,
      background: f.personal === p ? "#152218" : "#0d0f14",
      color: f.personal === p ? "#8FB07A" : "#888",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Solo de ", p))), f.split === "custom" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12,
      color: "#888",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, "Brandon: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#4A6378"
    }
  }, f.brPct, "%")), /*#__PURE__*/React.createElement("span", null, "Florencia: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#8FB07A"
    }
  }, 100 - f.brPct, "%"))), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: f.brPct,
    onChange: e => u("brPct", +e.target.value),
    style: {
      width: "100%",
      accentColor: "#8FB07A"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Categoría"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 6,
      margin: "6px 0 16px"
    }
  }, CATS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => u("categoria", c),
    style: {
      padding: "12px 4px",
      borderRadius: 10,
      border: `1px solid ${f.categoria === c ? "#8FB07A" : "#222840"}`,
      background: f.categoria === c ? "#152218" : "#161a26",
      color: f.categoria === c ? "#8FB07A" : "#888",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      minHeight: 54
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18
    }
  }, ICONS[c]), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2
    }
  }, c)))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Descripción"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: f.descripcion,
    onChange: e => u("descripcion", e.target.value),
    placeholder: "Ej: Cena con amigos",
    style: {
      ...S.input,
      margin: "6px 0 14px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Método"), /*#__PURE__*/React.createElement("select", {
    value: f.metodo,
    onChange: e => u("metodo", e.target.value),
    style: {
      ...S.input,
      marginTop: 6,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Elegir…"), METS.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Cuotas"), /*#__PURE__*/React.createElement("select", {
    value: f.cuotas,
    onChange: e => u("cuotas", e.target.value),
    style: {
      ...S.input,
      marginTop: 6,
      cursor: "pointer"
    }
  }, [1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n, " ", n === 1 ? "pago" : "cuotas"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Mes"), /*#__PURE__*/React.createElement("select", {
    value: f.mes,
    onChange: e => u("mes", e.target.value),
    style: {
      ...S.input,
      marginTop: 6,
      cursor: "pointer"
    }
  }, MESES.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Fecha del gasto"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.fecha,
    max: isoToday(),
    onChange: e => {
      const v = e.target.value;
      sF(p => ({
        ...p,
        fecha: v,
        mes: v ? MESES[new Date(v + "T12:00:00").getMonth()] : p.mes
      }));
    },
    style: {
      ...S.input,
      marginTop: 6,
      colorScheme: "dark"
    }
  }))), f.metodo === "Tarjeta de Crédito" && +f.cuotas === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#28200f",
      border: "1px solid #4a3a1a",
      borderRadius: 10,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: "#f39c12"
    }
  }, "💳 Pagado con crédito: impacta en ", /*#__PURE__*/React.createElement("b", null, MESES[(mI(f.mes) + 1) % 12]), " (cierre de tarjeta)"), +f.cuotas > 1 && +f.monto > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#152218",
      border: "1px solid #264030",
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#8FB07A",
      fontWeight: 600,
      marginBottom: 4
    }
  }, "CUOTAS"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#ccc"
    }
  }, +f.cuotas, " cuotas de ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#8FB07A"
    }
  }, fmt(+f.monto / +f.cuotas))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666",
      marginTop: 4
    }
  }, Array.from({
    length: Math.min(+f.cuotas, 8)
  }, (_, i) => MESES_S[(mI(f.mes) + i + (f.metodo === "Tarjeta de Crédito" ? 1 : 0)) % 12]).join(" → "), +f.cuotas > 8 ? " →…" : ""), f.metodo === "Tarjeta de Crédito" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#f39c12",
      marginTop: 6
    }
  }, "💳 La 1ª cuota impacta en ", MESES[(mI(f.mes) + 1) % 12], " (cierre de tarjeta)")), /*#__PURE__*/React.createElement("button", {
    onClick: go,
    disabled: busy || !ok,
    style: {
      ...S.greenBtn,
      width: "100%",
      padding: 18,
      fontSize: 16,
      opacity: ok ? 1 : 0.4,
      marginBottom: 20
    }
  }, busy ? "Guardando…" : editing ? "Actualizar gasto" : "Agregar gasto"));
}

// ===== HISTORY (con filtros + búsqueda + rango fechas) =====
function Hist({
  allExps,
  month,
  onDel,
  onEdit,
  onDup
}) {
  const [del, setDel] = useState(null);
  const [filtP, setFiltP] = useState("all");
  const [filtCat, setFiltCat] = useState("all");
  const [filtMet, setFiltMet] = useState("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("month");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return ymd(d);
  });
  const [to, setTo] = useState(ymd(new Date()));
  const [showFilt, setShowFilt] = useState(false);
  const yearNow = new Date().getFullYear();
  const list = useMemo(() => {
    let arr = allExps;
    if (mode === "month") {
      const m = mI(month);
      arr = arr.filter(e => {
        const st = cuoStart(e);
        if (st < 0) return true;
        const cu = Number(e.cuotas) || 1;
        if (m >= st && m < st + cu) return true;
        const em = mI(e.mes);
        return em === m && st > m; // gasto con TC recien cargado: todavia no impacta, se muestra como pendiente
      });
    } else if (mode === "range") {
      const fD = new Date(from);
      const tD = new Date(to);
      tD.setHours(23, 59, 59);
      arr = arr.filter(e => {
        const d = parseFecha(e.fecha);
        if (!d) {
          const em = mI(e.mes);
          if (em < 0) return true;
          const fb = new Date(yearNow, em, 15);
          return fb >= fD && fb <= tD;
        }
        return d >= fD && d <= tD;
      });
    }
    if (filtP !== "all") arr = arr.filter(e => e.persona === filtP);
    if (filtCat !== "all") arr = arr.filter(e => e.categoria === filtCat);
    if (filtMet !== "all") arr = arr.filter(e => e.metodo === filtMet);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(e => (parseSplit(e.descripcion).clean || "").toLowerCase().includes(q) || (e.categoria || "").toLowerCase().includes(q));
    }
    return arr;
  }, [allExps, month, mode, from, to, filtP, filtCat, filtMet, search, yearNow]);
  const isPending = e => mode === "month" && mI(e.mes) === mI(month) && cuoStart(e) > mI(month);
  const total = list.reduce((a, e) => isPending(e) ? a : a + e.monto / (e.cuotas || 1), 0);
  const activeFilters = (filtP !== "all" ? 1 : 0) + (filtCat !== "all" ? 1 : 0) + (filtMet !== "all" ? 1 : 0) + (search.trim() ? 1 : 0);
  const clearFilters = () => {
    setFiltP("all");
    setFiltCat("all");
    setFiltMet("all");
    setSearch("");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    },
    className: "fade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800
    }
  }, "Historial"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#666",
      marginTop: 2
    }
  }, list.length, " de ", allExps.length, " gastos · ", fmt(total))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowFilt(!showFilt),
    style: {
      ...S.smallBtn,
      position: "relative",
      padding: "8px 14px"
    }
  }, "🔍 Filtros", activeFilters > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -4,
      right: -4,
      background: "#8FB07A",
      color: "#0E0E0E",
      fontSize: 9,
      fontWeight: 800,
      borderRadius: 10,
      minWidth: 16,
      height: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 4px"
    }
  }, activeFilters))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginTop: 12,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode("month"),
    style: {
      flex: 1,
      padding: "8px 4px",
      borderRadius: 8,
      border: `1px solid ${mode === "month" ? "#8FB07A" : "#222840"}`,
      background: mode === "month" ? "#152218" : "transparent",
      color: mode === "month" ? "#8FB07A" : "#666",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Mes (", month, ")"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode("range"),
    style: {
      flex: 1,
      padding: "8px 4px",
      borderRadius: 8,
      border: `1px solid ${mode === "range" ? "#8FB07A" : "#222840"}`,
      background: mode === "range" ? "#152218" : "transparent",
      color: mode === "range" ? "#8FB07A" : "#666",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Rango"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode("all"),
    style: {
      flex: 1,
      padding: "8px 4px",
      borderRadius: 8,
      border: `1px solid ${mode === "all" ? "#8FB07A" : "#222840"}`,
      background: mode === "all" ? "#152218" : "transparent",
      color: mode === "all" ? "#8FB07A" : "#666",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Todos")), mode === "range" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.sLabel,
      fontSize: 10
    }
  }, "Desde"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: from,
    onChange: e => setFrom(e.target.value),
    style: {
      ...S.input,
      marginTop: 4,
      padding: 10,
      fontSize: 13
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.sLabel,
      fontSize: 10
    }
  }, "Hasta"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: to,
    onChange: e => setTo(e.target.value),
    style: {
      ...S.input,
      marginTop: 4,
      padding: 10,
      fontSize: 13
    }
  }))), showFilt && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginTop: 8
    },
    className: "slide"
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Buscar"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: search,
    onChange: e => setSearch(e.target.value),
    placeholder: "Descripción, categoría…",
    style: {
      ...S.input,
      marginTop: 6,
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Persona"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 6,
      margin: "6px 0 12px"
    }
  }, ["all", "Brandon", "Florencia"].map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => setFiltP(p),
    style: {
      padding: 8,
      borderRadius: 6,
      border: `1px solid ${filtP === p ? "#8FB07A" : "#222840"}`,
      background: filtP === p ? "#152218" : "transparent",
      color: filtP === p ? "#8FB07A" : "#888",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, p === "all" ? "Todos" : p))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Categoría"), /*#__PURE__*/React.createElement("select", {
    value: filtCat,
    onChange: e => setFiltCat(e.target.value),
    style: {
      ...S.input,
      marginTop: 6,
      marginBottom: 12,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Todas"), [...new Set([...CATS, ...allExps.map(e => e.categoria).filter(Boolean)])].map(c => /*#__PURE__*/React.createElement("option", {
    key: c
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Método"), /*#__PURE__*/React.createElement("select", {
    value: filtMet,
    onChange: e => setFiltMet(e.target.value),
    style: {
      ...S.input,
      marginTop: 6,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Todos"), METS.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m))), activeFilters > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: clearFilters,
    style: {
      marginTop: 12,
      width: "100%",
      padding: 10,
      borderRadius: 8,
      border: "1px solid #e74c3c",
      background: "transparent",
      color: "#e74c3c",
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Limpiar filtros")), list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "50px 0",
      color: "#444"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40
    }
  }, "📭"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, "Sin gastos")) : list.map(e => {
    const cu = e.cuotas || 1;
    const mc = e.monto / cu;
    const st = cuoStart(e);
    const cNum = mode === "month" ? mI(month) - st + 1 : 1;
    const pending = isPending(e);
    const sp = parseSplit(e.descripcion);
    return /*#__PURE__*/React.createElement("div", {
      key: e.id || e.row,
      style: {
        ...S.card,
        padding: "12px 14px",
        marginBottom: 6,
        ...(pending ? {
          borderStyle: "dashed",
          borderColor: "#4a3a1a",
          background: "#171410"
        } : {})
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        marginTop: 2
      }
    }, ICONS[e.categoria] || "📦"), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        textDecoration: pending ? "underline" : "none",
        textDecorationColor: "#f39c12",
        textDecorationStyle: "dashed",
        textUnderlineOffset: 3
      }
    }, sp.clean || e.categoria), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#666",
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: e.persona === "Brandon" ? "#4A6378" : "#8FB07A",
        fontWeight: 600
      }
    }, e.persona), " · ", e.metodo, !pending && cu > 1 ? ` · ${cNum > 0 && cNum <= cu ? cNum : 1}/${cu}` : "", " · ", fmtFecha(e.fecha), sp.kind !== "50/50" && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        padding: "1px 6px",
        background: "#1a1e2a",
        borderRadius: 4,
        color: "#8FB07A",
        fontSize: 10,
        fontWeight: 700
      }
    }, sp.kind === "personal" ? `Solo ${sp.personal[0]}` : `${Math.round(sp.brPct * 100)}/${100 - Math.round(sp.brPct * 100)}`)), pending && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#f39c12",
        fontWeight: 700,
        marginTop: 3
      }
    }, "💳 Impacta en ", MESES[st % 12], cu > 1 ? ` (${cu} cuotas)` : "", " · no descuenta este mes"))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right",
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        opacity: pending ? 0.55 : 1
      }
    }, fmtK(mc)), cu > 1 && !pending && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "#666"
      }
    }, "Tot ", fmtK(e.monto)))), del === e.row ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 10,
        justifyContent: "flex-end"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setDel(null),
      style: {
        padding: "6px 14px",
        borderRadius: 6,
        border: "1px solid #333",
        background: "transparent",
        color: "#888",
        fontSize: 11,
        cursor: "pointer"
      }
    }, "No"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        onDel(e.row);
        setDel(null);
      },
      style: {
        padding: "6px 14px",
        borderRadius: 6,
        background: "#e74c3c",
        color: "#fff",
        border: "none",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "Sí, eliminar")) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => onEdit(e),
      style: S.linkBtn
    }, "✏️ Editar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => onDup(e),
      style: S.linkBtn
    }, "📋 Duplicar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setDel(e.row),
      style: {
        ...S.linkBtn,
        color: "#e74c3c"
      }
    }, "🗑 Borrar")));
  }));
}

// ===== BALANCE =====
function Bal({
  d,
  month,
  onSettle,
  setts
}) {
  const [show, setShow] = useState(false);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const imb = d.imbalance;
  const who = imb > 0.5 ? "Florencia" : imb < -0.5 ? "Brandon" : null;
  const debt = Math.abs(imb);
  const gets = who === "Florencia" ? "Brandon" : "Florencia";
  const go = async () => {
    if (!amt) return;
    await onSettle({
      fecha: todayShort(),
      from: who,
      to: gets,
      monto: +amt,
      nota: note,
      mes: month
    });
    setShow(false);
    setAmt("");
    setNote("");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    },
    className: "fade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800
    }
  }, "Balance"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#666",
      marginBottom: 18
    }
  }, month), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      marginBottom: 20
    }
  }, [["Brandon", d.brPaid, d.brOwes, "#4A6378"], ["Florencia", d.flPaid, d.flOwes, "#8FB07A"]].map(([n, paid, owes, c]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.avatar,
      width: 54,
      height: 54,
      fontSize: 24,
      background: c,
      margin: "0 auto 8px"
    }
  }, n[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#666"
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      marginTop: 4
    }
  }, fmtK(paid)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#555",
      marginTop: 2
    }
  }, "justo: ", fmtK(owes)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      textAlign: "center",
      padding: 20
    }
  }, !who || debt < 1 ? /*#__PURE__*/React.createElement(React.Fragment, null, d.tot === 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36
    }
  }, "📭"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#666",
      marginTop: 6
    }
  }, "Sin gastos")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36
    }
  }, "✓"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: "#8FB07A",
      marginTop: 6
    }
  }, "Están parejos"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#888",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#e8e8e4"
    }
  }, who), " le debe a ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#e8e8e4"
    }
  }, gets)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      fontWeight: 800,
      color: "#e74c3c",
      marginBottom: 14
    }
  }, fmt(debt)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShow(true);
      setAmt(String(Math.round(debt)));
    },
    style: {
      ...S.greenBtn,
      padding: "14px 32px",
      fontSize: 14
    }
  }, "Saldar deuda"))), show && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      borderColor: "#8FB07A",
      padding: 20
    },
    className: "slide"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      marginBottom: 12
    }
  }, "Pago de ", who, " → ", gets), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Monto"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: amt,
    onChange: e => setAmt(e.target.value),
    style: {
      ...S.input,
      fontSize: 22,
      fontWeight: 700,
      margin: "6px 0 10px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Nota"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: note,
    onChange: e => setNote(e.target.value),
    placeholder: "Transferencia, efectivo…",
    style: {
      ...S.input,
      margin: "6px 0 14px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShow(false),
    style: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      border: "1px solid #333",
      background: "transparent",
      color: "#888",
      cursor: "pointer"
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    onClick: go,
    style: {
      ...S.greenBtn,
      flex: 1,
      padding: 14
    }
  }, "Confirmar"))), setts.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.sLabel,
      marginBottom: 10
    }
  }, "Pagos saldados"), setts.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      ...S.card,
      padding: "10px 14px",
      marginBottom: 6,
      background: "#152218",
      borderColor: "#264030"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "#8FB07A"
    }
  }, s.from, " → ", s.to), s.nota && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666"
    }
  }, s.nota), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#555",
      marginTop: 2
    }
  }, fmtFecha(s.fecha))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "#8FB07A"
    }
  }, fmtK(s.monto)))))));
}

// ===== FIXED (gastos recurrentes) =====
function Fixed({
  fixed,
  saveFixed,
  bulkLoad,
  loadOne,
  month
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [f, setF] = useState({
    nombre: "",
    categoria: "",
    persona: "",
    metodo: "",
    monto: "",
    split: "50/50",
    personal: "",
    brPct: 50
  });
  const reset = () => {
    setF({
      nombre: "",
      categoria: "",
      persona: "",
      metodo: "",
      monto: "",
      split: "50/50",
      personal: "",
      brPct: 50
    });
    setEditingId(null);
    setShowForm(false);
  };
  const ok = f.nombre && f.categoria && f.persona && f.metodo && +f.monto > 0 && (f.split !== "personal" || f.personal);
  const save = () => {
    if (!ok) return;
    const sp = f.split === "personal" ? {
      kind: "personal",
      personal: f.personal
    } : f.split === "custom" ? {
      kind: "custom",
      brPct: f.brPct / 100,
      flPct: (100 - f.brPct) / 100
    } : {
      kind: "50/50"
    };
    const tpl = {
      id: editingId || "t" + Date.now(),
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      persona: f.persona,
      metodo: f.metodo,
      monto: +f.monto,
      descripcion: encodeSplit(f.nombre.trim(), sp)
    };
    if (editingId) saveFixed(fixed.map(x => x.id === editingId ? tpl : x));else saveFixed([...fixed, tpl]);
    reset();
  };
  const startEdit = t => {
    const sp = parseSplit(t.descripcion);
    setF({
      nombre: sp.clean || t.nombre,
      categoria: t.categoria,
      persona: t.persona,
      metodo: t.metodo,
      monto: String(t.monto),
      split: sp.kind,
      personal: sp.personal || "",
      brPct: Math.round(sp.brPct * 100)
    });
    setEditingId(t.id);
    setShowForm(true);
  };
  const del = id => {
    if (confirm("¿Eliminar plantilla?")) saveFixed(fixed.filter(x => x.id !== id));
  };
  const total = fixed.reduce((a, x) => a + x.monto, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    },
    className: "fade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800
    }
  }, "Gastos fijos"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#666",
      marginBottom: 14
    }
  }, "Plantillas que se repiten cada mes (alquiler, internet, streaming…)"), fixed.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      background: "linear-gradient(135deg,#152218,#1a2e22)",
      borderColor: "#264030"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Total mensual de fijos"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      color: "#8FB07A",
      marginTop: 4
    }
  }, fmt(total)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#888",
      marginTop: 4
    }
  }, fixed.length, " plantilla", fixed.length !== 1 ? "s" : ""), /*#__PURE__*/React.createElement("button", {
    onClick: () => bulkLoad(month),
    style: {
      ...S.greenBtn,
      width: "100%",
      padding: 14,
      marginTop: 12,
      fontSize: 14
    }
  }, "⚡ Cargar todos a ", month)), fixed.map(t => {
    const sp = parseSplit(t.descripcion);
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      style: {
        ...S.card,
        padding: "12px 14px",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        marginTop: 2
      }
    }, ICONS[t.categoria] || "📦"), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700
      }
    }, t.nombre), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#666",
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: t.persona === "Brandon" ? "#4A6378" : "#8FB07A",
        fontWeight: 600
      }
    }, t.persona), " · ", t.metodo, sp.kind !== "50/50" && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        padding: "1px 6px",
        background: "#1a1e2a",
        borderRadius: 4,
        color: "#8FB07A",
        fontSize: 10,
        fontWeight: 700
      }
    }, sp.kind === "personal" ? `Solo ${sp.personal[0]}` : `${Math.round(sp.brPct * 100)}/${100 - Math.round(sp.brPct * 100)}`)))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right",
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700
      }
    }, fmtK(t.monto)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (confirm(`Cargar "${t.nombre}" a ${month}?`)) loadOne(t, month);
      },
      style: {
        ...S.linkBtn,
        color: "#8FB07A"
      }
    }, "⚡ Cargar a ", month), /*#__PURE__*/React.createElement("button", {
      onClick: () => startEdit(t),
      style: S.linkBtn
    }, "✏️ Editar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => del(t.id),
      style: {
        ...S.linkBtn,
        color: "#e74c3c"
      }
    }, "🗑 Borrar")));
  }), !showForm && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: {
      width: "100%",
      padding: 16,
      marginTop: 10,
      borderRadius: 12,
      border: "1px dashed #2a3050",
      background: "transparent",
      color: "#8FB07A",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "+ Crear plantilla nueva"), showForm && /*#__PURE__*/React.createElement("div", {
    style: S.card,
    className: "slide"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, editingId ? "Editar plantilla" : "Nueva plantilla"), /*#__PURE__*/React.createElement("button", {
    onClick: reset,
    style: S.iconBtn
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Nombre"), /*#__PURE__*/React.createElement("input", {
    value: f.nombre,
    onChange: e => setF(p => ({
      ...p,
      nombre: e.target.value
    })),
    placeholder: "Alquiler, Internet, Netflix…",
    style: {
      ...S.input,
      marginTop: 6,
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Monto mensual"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "decimal",
    value: f.monto,
    onChange: e => setF(p => ({
      ...p,
      monto: e.target.value
    })),
    placeholder: "0",
    style: {
      ...S.input,
      marginTop: 6,
      marginBottom: 12,
      fontSize: 20,
      fontWeight: 800,
      textAlign: "center"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Categoría"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 6,
      margin: "6px 0 12px"
    }
  }, CATS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => setF(p => ({
      ...p,
      categoria: c
    })),
    style: {
      padding: "10px 4px",
      borderRadius: 8,
      border: `1px solid ${f.categoria === c ? "#8FB07A" : "#222840"}`,
      background: f.categoria === c ? "#152218" : "#0d0f14",
      color: f.categoria === c ? "#8FB07A" : "#888",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      minHeight: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16
    }
  }, ICONS[c]), /*#__PURE__*/React.createElement("div", null, c)))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Quién paga"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 6,
      margin: "6px 0 12px"
    }
  }, PERS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => setF(prev => ({
      ...prev,
      persona: p
    })),
    style: {
      padding: 14,
      borderRadius: 10,
      border: `2px solid ${f.persona === p ? p === "Brandon" ? "#4A6378" : "#8FB07A" : "#222840"}`,
      background: f.persona === p ? p === "Brandon" ? "#151f2c" : "#152218" : "#0d0f14",
      color: "#e8e8e4",
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, p))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Método"), /*#__PURE__*/React.createElement("select", {
    value: f.metodo,
    onChange: e => setF(p => ({
      ...p,
      metodo: e.target.value
    })),
    style: {
      ...S.input,
      marginTop: 6,
      marginBottom: 12,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Elegir…"), METS.map(m => /*#__PURE__*/React.createElement("option", {
    key: m
  }, m))), /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "División"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 6,
      margin: "6px 0 10px"
    }
  }, [["50/50", "50/50"], ["personal", "Personal"], ["custom", "Custom"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setF(p => ({
      ...p,
      split: k
    })),
    style: {
      padding: 10,
      borderRadius: 8,
      border: `1px solid ${f.split === k ? "#8FB07A" : "#222840"}`,
      background: f.split === k ? "#152218" : "#0d0f14",
      color: f.split === k ? "#8FB07A" : "#888",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, l))), f.split === "personal" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 6,
      marginBottom: 10
    }
  }, PERS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => setF(prev => ({
      ...prev,
      personal: p
    })),
    style: {
      padding: 10,
      borderRadius: 8,
      border: `1px solid ${f.personal === p ? "#8FB07A" : "#222840"}`,
      background: f.personal === p ? "#152218" : "#0d0f14",
      color: f.personal === p ? "#8FB07A" : "#888",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Solo ", p))), f.split === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12,
      color: "#888",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, "B: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#4A6378"
    }
  }, f.brPct, "%")), /*#__PURE__*/React.createElement("span", null, "F: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "#8FB07A"
    }
  }, 100 - f.brPct, "%"))), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "5",
    value: f.brPct,
    onChange: e => setF(p => ({
      ...p,
      brPct: +e.target.value
    })),
    style: {
      width: "100%",
      accentColor: "#8FB07A"
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: !ok,
    style: {
      ...S.greenBtn,
      width: "100%",
      padding: 16,
      fontSize: 15,
      opacity: ok ? 1 : 0.4,
      marginTop: 8
    }
  }, editingId ? "Actualizar plantilla" : "Guardar plantilla")), fixed.length === 0 && !showForm && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: "#444"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 42
    }
  }, "📌"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 14
    }
  }, "Sin plantillas todavía"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#555",
      marginTop: 4,
      maxWidth: 280,
      margin: "4px auto 0",
      lineHeight: 1.5
    }
  }, "Creá plantillas para los gastos que se repiten todos los meses (alquiler, expensas, internet) y cargalos con un toque.")));
}

// ===== SETTINGS =====
function Settings({
  apiUrl,
  expenses,
  settlements,
  onSave,
  onDisconnect
}) {
  const [url, setUrl] = useState(apiUrl);
  const expCSV = () => {
    const rows = [["Fecha", "Mes", "Categoría", "Descripción", "Persona", "Método", "Monto", "Cuotas", "Split"]];
    expenses.forEach(e => {
      const sp = parseSplit(e.descripcion);
      rows.push([e.fecha, e.mes, e.categoria, sp.clean, e.persona, e.metodo, e.monto, e.cuotas || 1, sp.kind === "50/50" ? "50/50" : sp.kind === "personal" ? `Solo ${sp.personal}` : `${Math.round(sp.brPct * 100)}/${100 - Math.round(sp.brPct * 100)}`]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `caja-flondon-gastos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 14
    },
    className: "fade"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      marginBottom: 16
    }
  }, "Configuración"), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "URL de Google Apps Script"), /*#__PURE__*/React.createElement("input", {
    value: url,
    onChange: e => setUrl(e.target.value),
    style: {
      ...S.input,
      marginTop: 8,
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onSave(url),
    style: {
      ...S.greenBtn,
      marginTop: 12,
      width: "100%",
      padding: 12
    }
  }, "Guardar y sincronizar")), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Estado"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      marginTop: 8,
      color: apiUrl ? "#8FB07A" : "#e74c3c"
    }
  }, apiUrl ? "🟢 Conectado" : "🔴 Sin conexión"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#666",
      marginTop: 4
    }
  }, expenses.length, " gastos · ", settlements.length, " pagos"), apiUrl && /*#__PURE__*/React.createElement("button", {
    onClick: onDisconnect,
    style: {
      marginTop: 12,
      padding: "10px 16px",
      borderRadius: 8,
      border: "1px solid #e74c3c",
      background: "transparent",
      color: "#e74c3c",
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Desconectar")), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Datos"), /*#__PURE__*/React.createElement("button", {
    onClick: expCSV,
    style: {
      ...S.greenBtn,
      marginTop: 10,
      width: "100%",
      padding: 12,
      background: "#1e2236",
      color: "#8FB07A"
    }
  }, "📥 Exportar CSV")), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.sLabel
  }, "Sobre la app"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#888",
      marginTop: 8,
      lineHeight: 1.6
    }
  }, "Caja Flondon v2.0 — Gestión de gastos del hogar conectada a Google Sheets. Soporta splits personalizados, cuotas, balance entre ambos y exportación.")));
}

// ===== STYLES =====
const S = {
  root: {
    minHeight: "100vh",
    background: "#0d0f14",
    color: "#e8e8e4"
  },
  loadWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#0d0f14",
    color: "#e8e8e4"
  },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "12px 28px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    zIndex: 999,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    maxWidth: "calc(100% - 40px)"
  },
  header: {
    background: "linear-gradient(135deg,#12151f,#171c2a)",
    borderBottom: "1px solid #222840",
    padding: "14px 16px 10px",
    position: "sticky",
    top: 0,
    zIndex: 50,
    backdropFilter: "blur(10px)"
  },
  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    maxWidth: 600,
    margin: "0 auto",
    gap: 10
  },
  logo: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.5px"
  },
  sub: {
    fontSize: 11,
    color: "#555",
    marginTop: 2
  },
  monthPick: {
    background: "#1a1e2a",
    color: "#8FB07A",
    border: "1px solid #2a3050",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    minHeight: 40
  },
  content: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "0 16px 120px"
  },
  navWrap: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(180deg,transparent 0%,#0d0f14 30%)",
    paddingTop: 20,
    paddingBottom: "env(safe-area-inset-bottom)",
    pointerEvents: "none"
  },
  nav: {
    maxWidth: 600,
    margin: "0 auto",
    display: "flex",
    background: "#14171f",
    borderRadius: "16px 16px 0 0",
    borderTop: "1px solid #222840",
    pointerEvents: "auto"
  },
  navBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 0 14px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    position: "relative",
    minHeight: 60
  },
  navDot: {
    position: "absolute",
    top: 0,
    left: "30%",
    right: "30%",
    height: 2,
    background: "#8FB07A",
    borderRadius: 1
  },
  fab: {
    position: "fixed",
    right: 18,
    bottom: "calc(80px + env(safe-area-inset-bottom))",
    width: 58,
    height: 58,
    borderRadius: "50%",
    background: "#8FB07A",
    color: "#0E0E0E",
    border: "none",
    fontSize: 30,
    fontWeight: 300,
    cursor: "pointer",
    zIndex: 90,
    boxShadow: "0 6px 20px rgba(143,176,122,0.4),0 0 0 1px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1
  },
  card: {
    background: "#161a26",
    borderRadius: 14,
    padding: "16px 18px",
    marginBottom: 10,
    border: "1px solid #222840"
  },
  sLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.8px"
  },
  input: {
    width: "100%",
    background: "#0d0f14",
    border: "1px solid #2a3050",
    borderRadius: 10,
    color: "#e8e8e4",
    padding: "14px 14px",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    minHeight: 44
  },
  greenBtn: {
    background: "#8FB07A",
    color: "#0E0E0E",
    border: "none",
    borderRadius: 10,
    padding: "12px 18px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    minHeight: 44
  },
  smallBtn: {
    background: "#1e2236",
    border: "none",
    color: "#8FB07A",
    fontSize: 12,
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 36,
    fontWeight: 600
  },
  iconBtn: {
    background: "#1e2236",
    border: "none",
    color: "#8FB07A",
    fontSize: 16,
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    minWidth: 40,
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#8FB07A",
    fontSize: 12,
    cursor: "pointer",
    padding: "4px 0",
    fontWeight: 600
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0
  }
};
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));