const PRECO_RIFA = 2;
const TOTAL_NUMEROS = 250;
const META = TOTAL_NUMEROS * PRECO_RIFA;
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwt45Jr_Zwm_uqNTgz7amUlhkTXIBM6rLzQ-IMlkyLnOkgyKnfQsxVJrqQ_sdMITkK2/exec";

let registos = []; // números não livres, já normalizados
let filtro = "todos";

// Os nomes vêm de quem preenche o formulário público: nunca inserir como HTML
function esc(valor) {
  return String(valor ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function normalizarEstado(estado) {
  if (estado === "pago" || estado === "paid") return "pago";
  if (estado === "pendente" || estado === "reserved") return "pendente";
  return "livre";
}

async function autenticar(e) {
  e.preventDefault();
  const pass = document.getElementById("passInput").value;
  const erroEL = document.getElementById("loginErro");
  const btnSubmit = e.target.querySelector("button[type='submit']");

  // Desativa o botão durante o pedido para evitar cliques duplicados
  btnSubmit.disabled = true;
  btnSubmit.textContent = "A verificar...";
  erroEL.hidden = true;

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "login", password: pass })
    });

    const data = await response.json();

    if (data.success) {
      // Guarda a password na sessão do navegador para usar nas ações seguintes
      sessionStorage.setItem("adminPass", pass);

      // Esconde o login e mostra a área de administração
      document.getElementById("loginArea").hidden = true;
      document.getElementById("contentArea").hidden = false;
      
      // Carrega os dados da tabela
      carregarTabelaAdmin();
    } else {
      erroEL.hidden = false;
      document.getElementById("passInput").select();
    }
  } catch (err) {
    console.error("Erro na autenticação:", err);
    erroEL.textContent = "Erro de ligação ao servidor.";
    erroEL.hidden = false;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Entrar";
  }
}

async function carregarTabelaAdmin() {
  const container = document.getElementById("tabelaContainer");
  const btn = document.getElementById("btnAtualizar");
  btn.disabled = true;
  if (registos.length === 0) {
    container.innerHTML = '<p class="vazio">A carregar os dados…</p>';
  }

  try {
    const resposta = await fetch(GOOGLE_SCRIPT_URL);
    const dados = await resposta.json();

    registos = dados
      .map((item) => ({
        id: parseInt(item.id || item.numero),
        estado: normalizarEstado(item.estado),
        nome: item.nome || item.buyerName || "",
        telemovel: item.telemovel || item.buyerPhone || "",
        metodo: item.metodo || item.paymentMethod || "",
      }))
      .filter((item) => item.estado !== "livre" && !isNaN(item.id))
      .sort((a, b) => a.id - b.id);

    desenhar();
  } catch (erro) {
    console.error("Erro ao carregar gestão:", erro);
    container.innerHTML =
      '<p class="vazio">Não foi possível carregar os dados do Google Sheets. Verifique a ligação e use “Atualizar”.</p>';
  } finally {
    btn.disabled = false;
  }
}

function desenhar() {
  const pendentes = registos.filter((r) => r.estado === "pendente").length;
  const pagos = registos.filter((r) => r.estado === "pago").length;

  const livres = TOTAL_NUMEROS - registos.length;
  const angariado = pagos * PRECO_RIFA;
  const percentagem = Math.round((angariado / META) * 100);

  document.getElementById("metricRaised").textContent =
    `${angariado.toLocaleString("pt-PT")} €`;
  document.getElementById("metricPercent").textContent =
    `${percentagem}% da meta de ${META} €`;
  document.getElementById("metricNumbers").textContent =
    `${pagos} / ${TOTAL_NUMEROS}`;
  document.getElementById("progressBar").style.width = `${percentagem}%`;
  document
    .querySelector(".prog-barra")
    .setAttribute("aria-valuenow", pagos);

  document.getElementById("statPaid").textContent = pagos;
  document.getElementById("statReserved").textContent = pendentes;
  document.getElementById("statAvailable").textContent = livres;

  document.querySelectorAll(".filtro").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.filtro === filtro);
  });

  const container = document.getElementById("tabelaContainer");
  const visiveis =
    filtro === "todos" ? registos : registos.filter((r) => r.estado === filtro);

  if (visiveis.length === 0) {
    const mensagens = {
      todos: "Ainda não há números reservados.",
      pendente: "Não há números a aguardar pagamento.",
      pago: "Ainda não há números pagos.",
    };
    container.innerHTML = `<p class="vazio">${mensagens[filtro]}</p>`;
    return;
  }

  const linhas = visiveis
    .map((r) => {
      const tel = esc(r.telemovel);
      const telLink = r.telemovel
        ? `<a href="tel:${esc(String(r.telemovel).replace(/[^\d+]/g, ""))}">${tel}</a>`
        : "–";
      const marcarPago =
        r.estado === "pendente"
          ? `<button type="button" class="btn btn-primario" data-id="${r.id}" data-acao="pago">Marcar como pago</button>`
          : "";

      return `
        <tr>
          <td class="c-numero numero">${r.id}</td>
          <td class="c-estado"><span class="estado is-${r.estado}">${r.estado === "pago" ? "Pago" : "Pendente"}</span></td>
          <td class="c-nome" data-label="Nome">${esc(r.nome) || "–"}</td>
          <td class="c-tel" data-label="Telemóvel">${telLink}</td>
          <td class="c-metodo" data-label="Método">${esc(r.metodo) || "–"}</td>
          <td class="c-acoes"><div class="acoes">
            ${marcarPago}
            <button type="button" class="btn btn-secundario" data-id="${r.id}" data-acao="livre">Libertar</button>
          </div></td>
        </tr>`;
    })
    .join("");

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th scope="col">Número</th>
          <th scope="col">Estado</th>
          <th scope="col">Nome</th>
          <th scope="col">Telemóvel</th>
          <th scope="col">Método</th>
          <th scope="col"><span class="sr-only">Ações</span></th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function mostrarAviso(texto) {
  document.getElementById("aviso").textContent = texto;
}

async function alterarEstado(id, novoEstado) {
  const pergunta =
    novoEstado === "pago"
      ? `Marcar o número ${id} como pago?`
      : `Libertar o número ${id}? Os dados do comprador ficam apagados.`;
  if (!confirm(pergunta)) return;

  // Recupera a palavra-passe guardada no login para autorizar a alteração
  const adminPass = sessionStorage.getItem("adminPass");

  try {
    const resposta = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        id: id,
        estado: novoEstado,
        apenasEstado: true,
        password: adminPass
      })
    });

    const data = await resposta.json();

    if (data.status === "success") {
      // Atualiza já no ecrã de forma imediata
      const registo = registos.find((r) => r.id === id);
      if (registo) {
        if (novoEstado === "livre") {
          registos = registos.filter((r) => r.id !== id);
        } else {
          registo.estado = novoEstado;
        }
        desenhar();
      }

      mostrarAviso(
        novoEstado === "pago"
          ? `Número ${id} marcado como pago.`
          : `Número ${id} livre.`
      );
      setTimeout(carregarTabelaAdmin, 1000);
    } else {
      mostrarAviso(data.message || `Erro ao alterar o número ${id}.`);
    }
  } catch (erro) {
    console.error("Erro ao atualizar:", erro);
    mostrarAviso(
      `Não foi possível alterar o número ${id}. Tente novamente.`,
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnAtualizar").addEventListener("click", () => {
    mostrarAviso("");
    carregarTabelaAdmin();
  });

  document.querySelector(".filtros").addEventListener("click", (e) => {
    const b = e.target.closest(".filtro");
    if (!b) return;
    filtro = b.dataset.filtro;
    desenhar();
  });

  document.getElementById("tabelaContainer").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-acao]");
    if (!b) return;
    alterarEstado(parseInt(b.dataset.id), b.dataset.acao);
  });
});