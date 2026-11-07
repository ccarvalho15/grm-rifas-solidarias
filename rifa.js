const TOTAL_NUMBERS = 250;
const TICKET_PRICE = 2.0;
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwt45Jr_Zwm_uqNTgz7amUlhkTXIBM6rLzQ-IMlkyLnOkgyKnfQsxVJrqQ_sdMITkK2/exec";

let tickets = [];
let isAdminMode = false;
let selectedNumberForAction = null;

// Carrega dados reais do Google Sheets e mapeia para a estrutura da interface
async function carregarDados() {
  try {
    const resposta = await fetch(GOOGLE_SCRIPT_URL);
    const dadosRemotos = await resposta.json();

    tickets = Array.from({ length: TOTAL_NUMBERS }, (_, i) => {
      const numId = i + 1;
      const encontrado = dadosRemotos.find(
        (d) => parseInt(d.id || d.numero) === numId,
      );

      if (encontrado) {
        let status = "available";
        if (
          encontrado.estado === "pendente" ||
          encontrado.estado === "reserved"
        )
          status = "reserved";
        if (encontrado.estado === "pago" || encontrado.estado === "paid")
          status = "paid";

        return {
          id: numId,
          status: status,
          buyerName: encontrado.nome || encontrado.buyerName || "",
          buyerPhone: encontrado.telemovel || encontrado.buyerPhone || "",
          paymentMethod: encontrado.metodo || encontrado.paymentMethod || "",
        };
      }

      return {
        id: numId,
        status: "available",
        buyerName: "",
        buyerPhone: "",
        paymentMethod: "",
      };
    });

    renderGrid();
    updateMetrics();
  } catch (erro) {
    console.error("Erro ao carregar dados do Google Sheets:", erro);
    showToast("Erro ao carregar dados remotos", "info");
  }
}

let currentFilter = 'all';
// Função chamada ao clicar nos botões de filtro
function setFilter(filterType) {
  currentFilter = filterType;

  // Atualiza visualmente os botões (destaca o ativo)
  const allBtn = document.getElementById("filterAllBtn");
  const availBtn = document.getElementById("filterAvailableBtn");

  if (filterType === 'all') {
    allBtn.className = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-casa text-stone-950 transition";
    availBtn.className = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-stone-800 hover:bg-stone-100 transition";
  } else {
    allBtn.className = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-stone-800 hover:bg-stone-100 transition";
    availBtn.className = "px-3 py-1.5 text-xs font-semibold rounded-lg bg-casa text-stone-950 transition";
  }

  renderGrid();
}

// Renderiza a grelha com todos os 250 números
function renderGrid() {
  const gridContainer = document.getElementById("numbersGrid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";

  // Filtra os tickets com base na escolha do utilizador
  const filteredTickets = tickets.filter(t => {
    if (currentFilter === 'available') {
      return t.status === "available";
    }
    return true; // Mostra todos se o filtro for 'all'
  });

  filteredTickets.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";

    let statusClasses = "";
    if (t.status === "available") {
      // Available number
      statusClasses =
        "is-free text-stone-800 hover:bg-casa hover:text-stone-950 border-stone-200/90 hover:border-casa shadow-sm";
    } else if (t.status === "reserved") {
      // Reserved number
      statusClasses =
        "is-reserved text-stone-950 font-bold border-amber-500 shadow-sm hover:brightness-105";
    } else if (t.status === "paid") {
      // Paid number
      statusClasses =
        "is-paid text-white font-extrabold border-emerald-700 shadow-sm hover:brightness-105";
    }

    btn.className = `h-11 sm:h-12 rounded-xl border flex items-center justify-center font-bold text-sm transition-all duration-200 transform active:scale-95 ${statusClasses}`;
    btn.innerHTML = `<span class="font-sans text-xs sm:text-sm font-semibold">${t.id}</span>`;

    btn.onclick = () => handleNumberClick(t.id);
    gridContainer.appendChild(btn);
  });
}

// Clique em cada número
function handleNumberClick(id) {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return;

  selectedNumberForAction = id;

  if (isAdminMode) {
    openInfoModal(ticket);
  } else {
    if (ticket.status === "available") {
      openReserveModal(ticket);
    } else {
      openInfoModal(ticket);
    }
  }
}

// Modal de Reserva
function openReserveModal(ticket) {
  document.getElementById("modalNumberBadge").innerText = `#${ticket.id}`;
  document.getElementById("modalNumberInput").value = ticket.id;

  const mbwayNumText = document.getElementById("mbwayNumText");
  if (mbwayNumText) mbwayNumText.innerText = `Nº ${ticket.id}`;

  document.getElementById("buyerName").value = "";
  document.getElementById("buyerPhone").value = "";

  const metodoSelect = document.getElementById("metodo");
  if (metodoSelect) {
    metodoSelect.value = "";
    togglePaymentInstructions("");
  }

  document.getElementById("reserveModal").classList.remove("hidden");
}

function closeReserveModal() {
  document.getElementById("reserveModal").classList.add("hidden");
}

// Alternar Instruções de Pagamento (MB WAY / Presencial)
function togglePaymentInstructions(method) {
  const mbwayBox = document.getElementById("mbwayInstructions");
  const presencialBox = document.getElementById("presencialInstructions");

  const isMbway = method === "MBWAY" || method === "mbway";
  const isPresencial = method === "PRESENCIAL" || method === "presencial";

  if (!isMbway && !isPresencial) {
    if (mbwayBox) mbwayBox.classList.add("hidden");
    if (presencialBox) presencialBox.classList.add("hidden");
    return;
  }

  if (isMbway) {
    if (mbwayBox) mbwayBox.classList.remove("hidden");
    if (presencialBox) presencialBox.classList.add("hidden");
  } else {
    if (mbwayBox) mbwayBox.classList.add("hidden");
    if (presencialBox) presencialBox.classList.remove("hidden");
  }
}

// Envio da Reserva para o Google Sheets
async function submitReservation(e) {
  e.preventDefault();

  const id = parseInt(document.getElementById("modalNumberInput").value);
  const name = document.getElementById("buyerName").value.trim();
  const phone = document.getElementById("buyerPhone").value.trim();

  // Obter o valor selecionado na lista pendente (<select id="metodo">)
  const metodoVal = document.getElementById("metodo").value;
  const methodLabel =
    metodoVal === "MBWAY" || metodoVal === "mbway" ? "MB WAY" : "Presencial";

  try {
    const resposta = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        id: id,
        estado: "pendente",
        nome: name,
        telemovel: phone,
        metodo: methodLabel,
        apenasEstado: false // Indica que é uma reserva nova completa
      })
    });

    const data = await resposta.json();

    if (data.status === "success" || data.success) {
      closeReserveModal();
      showToast(`Reserva do #${id} enviada com sucesso!`, "success");

      // Atualiza localmente de imediato para feedback rápido ao utilizador
      const ticketIndex = tickets.findIndex((t) => t.id === id);
      if (ticketIndex !== -1) {
        tickets[ticketIndex].status = "reserved";
        tickets[ticketIndex].buyerName = name;
        tickets[ticketIndex].buyerPhone = phone;
        tickets[ticketIndex].paymentMethod = methodLabel;
        renderGrid();
        updateMetrics();
      }

      // Sincroniza com o Google Sheets após 1.5s
      setTimeout(carregarDados, 1500);
    } else {
      showToast(data.message || "Erro ao registar a reserva.", "info");
    }
  } catch (erro) {
    console.error("Erro ao submeter reserva:", erro);
    showToast("Erro ao ligar ao servidor. Tente novamente.", "info");
  }
}

// Modal de Informação / Estado
function openInfoModal(ticket) {
  document.getElementById("infoModalNumber").innerText = `#${ticket.id}`;

  const statusBadge = document.getElementById("infoModalStatus");
  const buyerDetails = document.getElementById("infoModalBuyerDetails");
  const adminControls = document.getElementById("adminControlsArea");

  if (ticket.status === "available") {
    statusBadge.className =
      "px-2.5 py-1 rounded-full text-xs font-extrabold bg-stone-200 text-stone-700";
    statusBadge.innerText = "Disponível";
    if (buyerDetails) buyerDetails.classList.add("hidden");
  } else if (ticket.status === "reserved") {
    statusBadge.className =
      "px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-900";
    statusBadge.innerText = "Reservado (Pendente)";
    if (buyerDetails) buyerDetails.classList.remove("hidden");
  } else if (ticket.status === "paid") {
    statusBadge.className =
      "px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-200 text-emerald-900";
    statusBadge.innerText = "Pago / Confirmado";
    if (buyerDetails) buyerDetails.classList.remove("hidden");
  }

  document.getElementById("infoBuyerName").innerText =
    ticket.buyerName || "N/D";
  document.getElementById("infoBuyerPhone").innerText =
    ticket.buyerPhone || "N/D";
  document.getElementById("infoBuyerMethod").innerText =
    ticket.paymentMethod || "N/D";

  if (adminControls) {
    if (isAdminMode) {
      adminControls.classList.remove("hidden");
    } else {
      adminControls.classList.add("hidden");
    }
  }

  document.getElementById("infoModal").classList.remove("hidden");
}

function closeInfoModal() {
  document.getElementById("infoModal").classList.add("hidden");
}

// Ação do Administrador (Alterar estado no Sheets)
async function changeNumberStatus(newStatus) {
  if (!selectedNumberForAction) return;

  const ticket = tickets.find((t) => t.id === selectedNumberForAction);
  const estadoSheets =
    newStatus === "available"
      ? "livre"
      : newStatus === "reserved"
        ? "pendente"
        : "pago";

  const formData = new URLSearchParams();
  formData.append("id", selectedNumberForAction);
  formData.append("estado", estadoSheets);
  formData.append(
    "nome",
    newStatus === "available" ? "" : ticket.buyerName || "",
  );
  formData.append(
    "telemovel",
    newStatus === "available" ? "" : ticket.buyerPhone || "",
  );
  formData.append(
    "metodo",
    newStatus === "available" ? "" : ticket.paymentMethod || "",
  );

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData,
    });

    closeInfoModal();
    showToast(
      `Estado do #${selectedNumberForAction} alterado com sucesso!`,
      "info",
    );
    setTimeout(carregarDados, 1200);
  } catch (erro) {
    console.error("Erro ao alterar estado:", erro);
    showToast("Erro ao alterar estado no servidor.", "info");
  }
}

// Métricas do Topo
function updateMetrics() {
  const paidCount = tickets.filter((t) => t.status === "paid").length;
  const reservedCount = tickets.filter((t) => t.status === "reserved").length;
  const availableCount = tickets.filter((t) => t.status === "available").length;

  const totalRaised = paidCount * TICKET_PRICE;
  const percentage = Math.round((paidCount / TOTAL_NUMBERS) * 100);

  const elRaised = document.getElementById("metricRaised");
  const elPercent = document.getElementById("metricPercent");
  const elNumbers = document.getElementById("metricNumbers");
  const elProgressBar = document.getElementById("progressBar");

  if (elRaised) elRaised.innerText = `${totalRaised} €`;
  if (elPercent) elPercent.innerText = `${percentage}% da meta (500 €)`;
  if (elNumbers) elNumbers.innerText = `${paidCount} / ${TOTAL_NUMBERS}`;
  if (elProgressBar) elProgressBar.style.width = `${percentage}%`;

  const statPaid = document.getElementById("statPaid");
  const statReserved = document.getElementById("statReserved");
  const statAvailable = document.getElementById("statAvailable");

  if (statPaid) statPaid.innerText = paidCount;
  if (statReserved) statReserved.innerText = reservedCount;
  if (statAvailable) statAvailable.innerText = availableCount;
}

// Modo de Gestão / Organização
function toggleAdminMode() {
  isAdminMode = !isAdminMode;
  const btnText = document.getElementById("adminBtnText");

  if (isAdminMode) {
    if (btnText) btnText.innerText = "Sair da Gestão";
    showToast("Modo de Organização Ativado", "info");
  } else {
    if (btnText) btnText.innerText = "Modo Organização";
    showToast("Modo de Utilizador Ativado", "info");
  }
}

// Sistema de Notificações Toast
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMessage");
  const toastIcon = document.getElementById("toastIcon");

  if (!toast || !toastMsg) return;

  toastMsg.innerText = message;

  if (type === "success") {
    if (toastIcon)
      toastIcon.className = "fa-solid fa-circle-check text-emerald-400 text-lg";
  } else if (type === "info") {
    if (toastIcon)
      toastIcon.className = "fa-solid fa-circle-info text-amber-400 text-lg";
  }

  toast.classList.remove("translate-y-20", "opacity-0");

  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
  }, 3500);
}

// Inicialização ao carregar a página
window.onload = function () {
  carregarDados();
};
