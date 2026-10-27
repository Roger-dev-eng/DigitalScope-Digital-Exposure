const form = document.getElementById("exposure-form");
const analyzeButton = document.getElementById("analyze-button");
const formStatus = document.getElementById("form-status");
const results = document.querySelectorAll(".results");
const emailInput = form.elements.email;
const exportButton = document.getElementById("export-result");
let currentExportReport = null;

const platformCatalog = document.getElementById("platform-catalog");

const viewTabs = Array.from(document.querySelectorAll('[role="tab"]'));
const activateView = (tab, moveFocus = false) => {
    viewTabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
        item.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(item.getAttribute("aria-controls"));
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
    });
    if (moveFocus) tab.focus();
};

viewTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateView(tab));
    tab.addEventListener("keydown", (event) => {
        let nextIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % viewTabs.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + viewTabs.length - 1) % viewTabs.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = viewTabs.length - 1;
        if (nextIndex !== undefined) {
            event.preventDefault();
            activateView(viewTabs[nextIndex], true);
        }
    });
});

const maskEmail = (email) => {
    const [localPart, domain] = String(email || "").split("@");
    if (!localPart || !domain) return "Oculto";
    return `${localPart[0]}•••@${domain}`;
};

const safeExportBreach = (breach) => ({
    name: String(breach.name || "Incidente sem nome"),
    date: breach.date ? String(breach.date) : null,
    source: String(breach.source || "XposedOrNot"),
    details_available: breach.details_available === true,
    data_classes: Array.isArray(breach.data_classes) ? breach.data_classes.map(String) : [],
    description: breach.description ? String(breach.description) : null,
    domain: breach.domain ? String(breach.domain) : null,
    industry: breach.industry ? String(breach.industry) : null,
    reference_url: breach.reference_url ? String(breach.reference_url) : null,
    password_risk: breach.password_risk ? String(breach.password_risk) : null,
    verified: typeof breach.verified === "boolean" ? breach.verified : null,
    exposed_records: Number.isInteger(breach.exposed_records) ? breach.exposed_records : null,
});

exportButton.addEventListener("click", () => {
    if (!currentExportReport) return;
    const file = new Blob([JSON.stringify(currentExportReport, null, 2)], { type: "application/json;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `digitalscope-relatorio-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});

const safeExternalLink = (label, href, className = "catalog-link") => {
    try {
        const url = new URL(href);
        if (url.protocol !== "https:") return null;
        const link = document.createElement("a");
        link.className = className;
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        return link;
    } catch {
        return null;
    }
};

const actionProgressKey = "digitalscope.action-plan.completed.v1";
const actionProgress = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem(actionProgressKey) || "{}");
        return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch {
        return {};
    }
})();

const knownServiceSecurityPages = [
    { id: "google", name: "Google", pattern: /\bgoogle\b|youtube/i, url: "https://myaccount.google.com/security-checkup" },
    { id: "meta", name: "Meta (Facebook/Instagram)", pattern: /facebook|instagram/i, url: "https://www.facebook.com/hacked/" },
    { id: "tiktok", name: "TikTok", pattern: /tiktok/i, url: "https://support.tiktok.com/en/safety-hc/account-and-user-safety/account-safety" },
    { id: "amazon", name: "Amazon", pattern: /amazon/i, url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=201909010" },
    { id: "x", name: "X", pattern: /twitter|x\.com|\bx\b/i, url: "https://help.x.com/en/safety-and-security/account-security-tips" },
    { id: "microsoft", name: "Microsoft", pattern: /microsoft|outlook|onedrive|xbox/i, url: "https://account.microsoft.com/security" },
    { id: "playstation", name: "PlayStation", pattern: /playstation|\bpsn\b/i, url: "https://www.playstation.com/en-us/support/account/2sv-login/" },
    { id: "cloudflare", name: "Cloudflare", pattern: /cloudflare/i, url: "https://developers.cloudflare.com/fundamentals/account/account-security/2fa/" },
];

const actionDefinitions = (payload) => {
    const breaches = Array.isArray(payload.breaches) ? payload.breaches : [];
    const classes = breaches.flatMap((breach) => Array.isArray(breach.data_classes) ? breach.data_classes : [])
        .map((value) => String(value).toLowerCase());
    const classText = classes.join(" ");
    const hasCredentials = /password|senha|credential|credencial|hash|token|login|security question|pergunta de seguran/.test(classText);
    const hasFinancial = /payment|pagamento|card|cart[aã]o|credit|cr[eé]dito|bank|banco|financial|financeiro|billing|cobran[cç]a/.test(classText);
    const hasIdentity = /birth|nascimento|address|endere[cç]o|phone|telefone|passport|passaporte|national|nacional|government|governo|cpf|tax|fiscal|identity|identidade/.test(classText);
    const servicesText = breaches.map((breach) => `${breach.name || ""} ${breach.domain || ""}`).join(" ");
    const servicePages = knownServiceSecurityPages.filter((service) => service.pattern.test(servicesText));
    const tasks = [];

    tasks.push({
        id: "protect-email-account",
        priority: hasCredentials ? "Prioridade alta" : "Prioridade recomendada",
        title: "Proteja a conta de e-mail usada na consulta",
        description: "Ative autenticação em dois fatores, confira os métodos de recuperação e encerre sessões que não reconhecer. O e-mail costuma ser usado para redefinir outras senhas.",
    });
    tasks.push({
        id: "update-reused-passwords",
        priority: hasCredentials ? "Prioridade alta" : "Boa prática de segurança",
        title: hasCredentials
            ? "Troque senhas expostas e qualquer senha reutilizada"
            : "Use senhas únicas nas contas importantes",
        description: hasCredentials
            ? "Entre diretamente nos sites oficiais dos serviços afetados e troque as senhas. Atualize também qualquer outra conta onde a mesma senha tenha sido usada."
            : "Um gerenciador de senhas ajuda a criar e guardar uma senha diferente para cada serviço.",
    });
    tasks.push({
        id: "enable-multifactor-authentication",
        priority: "Proteção recomendada",
        title: "Ative autenticação em dois fatores",
        description: "Priorize e-mail, redes sociais, armazenamento em nuvem, lojas e contas com dados financeiros. Prefira aplicativo autenticador ou passkey quando disponíveis.",
        services: servicePages,
    });
    if (breaches.length) {
        tasks.push({
            id: "review-account-sessions",
            priority: "Verificação recomendada",
            title: "Revise atividades recentes e dispositivos conectados",
            description: "Procure logins desconhecidos, remova dispositivos que não reconhece e revogue o acesso de aplicativos de terceiros que não usa mais.",
            services: servicePages,
        });
        tasks.push({
            id: "watch-for-phishing",
            priority: "Atenção contínua",
            title: "Desconfie de mensagens inesperadas sobre suas contas",
            description: "Dados de contato publicados em incidentes podem facilitar golpes personalizados. Não abra links de redefinição recebidos por mensagem; acesse o serviço digitando o endereço oficial.",
        });
    }
    if (hasFinancial) {
        tasks.push({
            id: "review-financial-activity",
            priority: "Prioridade alta",
            title: "Confira movimentações e cobranças",
            description: "Revise extratos e compras recentes. Se encontrar algo que não reconhece, contate o banco ou emissor do cartão usando os canais oficiais.",
        });
    }
    if (hasIdentity) {
        tasks.push({
            id: "protect-identity-information",
            priority: "Atenção recomendada",
            title: "Redobre o cuidado com tentativas de identificação e fraude",
            description: "Não confirme dados pessoais em ligações ou mensagens recebidas sem solicitação. Procure os canais oficiais se receber avisos de abertura de conta ou solicitação que não reconhece.",
        });
    }
    return { tasks, breachCount: breaches.length, hasCredentials };
};

const saveActionProgress = () => {
    try {
        const completed = Object.fromEntries(Object.entries(actionProgress).filter(([, value]) => value === true));
        if (Object.keys(completed).length) localStorage.setItem(actionProgressKey, JSON.stringify(completed));
        else localStorage.removeItem(actionProgressKey);
    } catch {
        // Checklist remains usable for this page even if browser storage is unavailable.
    }
};

const renderActionPlan = (payload) => {
    const list = document.getElementById("action-plan-list");
    const summary = document.getElementById("action-plan-summary");
    const progress = document.getElementById("action-plan-progress");
    const { tasks, breachCount, hasCredentials } = actionDefinitions(payload);
    list.replaceChildren();
    summary.textContent = breachCount
        ? `Plano baseado nas categorias publicadas para ${breachCount} incidente(s). Elas não confirmam quais dados seus foram acessados.`
        : "Nenhum incidente associado foi retornado. Estas são medidas gerais para proteger suas contas.";

    const updateProgress = () => {
        const completeCount = tasks.filter((task) => actionProgress[task.id] === true).length;
        progress.textContent = `${completeCount} de ${tasks.length} ações marcadas como concluídas`;
    };

    tasks.forEach((task) => {
        const item = document.createElement("li");
        item.className = "action-plan-item";
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.className = "action-plan-checkbox";
        checkbox.type = "checkbox";
        checkbox.checked = actionProgress[task.id] === true;
        const content = document.createElement("span");
        content.className = "action-plan-content";
        const priority = document.createElement("span");
        priority.className = "action-plan-priority";
        priority.textContent = task.priority;
        const title = document.createElement("span");
        title.className = "action-plan-label";
        title.textContent = task.title;
        const description = document.createElement("span");
        description.className = "action-plan-description";
        description.textContent = task.description;
        content.append(priority, title, description);
        label.append(checkbox, content);
        item.appendChild(label);

        if (task.services?.length) {
            const links = document.createElement("div");
            links.className = "action-plan-links";
            task.services.forEach((service) => {
                const link = safeExternalLink(`Central de segurança: ${service.name}`, service.url, "action-plan-link");
                if (link) links.appendChild(link);
            });
            if (links.childElementCount) item.appendChild(links);
        }
        item.classList.toggle("is-complete", checkbox.checked);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) actionProgress[task.id] = true;
            else delete actionProgress[task.id];
            item.classList.toggle("is-complete", checkbox.checked);
            saveActionProgress();
            updateProgress();
        });
        list.appendChild(item);
    });
    updateProgress();

    const clearButton = document.getElementById("clear-action-progress");
    clearButton.onclick = () => {
        Object.keys(actionProgress).forEach((id) => delete actionProgress[id]);
        saveActionProgress();
        renderActionPlan(payload);
    };
};

const appendSources = (container, sources) => {
    const list = document.createElement("ul");
    list.className = "catalog-sources";
    (sources || []).forEach((source) => {
        const link = safeExternalLink(source.label, source.url);
        if (!link) return;
        const item = document.createElement("li");
        item.appendChild(link);
        list.appendChild(item);
    });
    if (list.childElementCount) container.appendChild(list);
};

const renderPlatformCatalog = (catalog) => {
    platformCatalog.replaceChildren();
    const reviewed = document.getElementById("catalog-updated");
    const reviewedDate = new Date(`${catalog.updated_at}T12:00:00`);
    reviewed.textContent = `Revisado em ${reviewedDate.toLocaleDateString("pt-BR")}`;

    catalog.platforms.forEach((platform) => {
        const card = document.createElement("details");
        card.className = "platform-card";

        const summary = document.createElement("summary");
        summary.className = "platform-card-summary";
        const identity = document.createElement("span");
        identity.className = "platform-identity";
        const name = document.createElement("strong");
        name.textContent = platform.name;
        const company = document.createElement("span");
        company.textContent = platform.company;
        identity.append(name, company);
        const disclosure = document.createElement("span");
        disclosure.className = "platform-disclosure-hint";
        disclosure.textContent = "Ver perfil";
        summary.append(identity, disclosure);
        card.appendChild(summary);

        const securityHeading = document.createElement("h3");
        securityHeading.textContent = "Controles de segurança documentados";
        const securitySummary = document.createElement("p");
        securitySummary.className = "platform-summary";
        securitySummary.textContent = platform.security_summary;

        const controls = document.createElement("ul");
        controls.className = "platform-controls";
        platform.controls.forEach((control) => {
            const item = document.createElement("li");
            item.append(document.createTextNode(control.label));
            const source = safeExternalLink("Fonte", control.url);
            if (source) item.append(" ", source);
            controls.appendChild(item);
        });
        card.append(securityHeading, securitySummary, controls);

        const dataHeading = document.createElement("h3");
        dataHeading.textContent = "Como a plataforma diz que usa os dados";
        const dataSummary = document.createElement("p");
        dataSummary.className = "platform-summary";
        dataSummary.textContent = platform.data_use;
        card.append(dataHeading, dataSummary);
        const policyLink = safeExternalLink("Abrir política de privacidade", platform.data_policy_url);
        if (policyLink) card.appendChild(policyLink);

        const incidentsHeading = document.createElement("h3");
        incidentsHeading.textContent = "Incidentes públicos conhecidos";
        card.appendChild(incidentsHeading);
        if (platform.incidents.length) {
            const incidents = document.createElement("div");
            incidents.className = "platform-incidents";
            platform.incidents.forEach((incident, index) => {
                const incidentCard = document.createElement("section");
                incidentCard.className = `platform-incident incident-${incident.status}`;
                const titleRow = document.createElement("div");
                titleRow.className = "incident-title-row";
                const title = document.createElement("strong");
                title.textContent = incident.title;
                const status = document.createElement("span");
                status.className = `incident-status status-${incident.status}`;
                status.textContent = incident.status_label;
                titleRow.append(title, status);
                const dates = document.createElement("p");
                dates.className = "incident-dates";
                dates.textContent = `Evento: ${incident.occurred_at} · Divulgado: ${incident.disclosed_at}`;
                const description = document.createElement("p");
                description.className = "platform-summary";
                description.textContent = incident.summary;
                incidentCard.append(titleRow, dates, description);
                appendSources(incidentCard, incident.sources);
                incidents.appendChild(incidentCard);
                if (index === 0) {
                    const latestLabel = document.createElement("span");
                    latestLabel.className = "latest-incident-label";
                    latestLabel.textContent = "Mais recente neste catálogo";
                    titleRow.appendChild(latestLabel);
                }
            });
            card.appendChild(incidents);
        } else {
            const noIncident = document.createElement("p");
            noIncident.className = "platform-summary incident-note";
            noIncident.textContent = platform.incident_note;
            card.appendChild(noIncident);
        }

        if (platform.regulatory_findings?.length) {
            const regulatoryHeading = document.createElement("h3");
            regulatoryHeading.textContent = "Decisões de autoridades sobre privacidade";
            card.appendChild(regulatoryHeading);
            const findings = document.createElement("div");
            findings.className = "platform-incidents";
            platform.regulatory_findings.forEach((finding) => {
                const findingCard = document.createElement("section");
                findingCard.className = "platform-incident regulatory-finding";
                const title = document.createElement("strong");
                title.textContent = finding.title;
                const date = document.createElement("p");
                date.className = "incident-dates";
                date.textContent = finding.date;
                const description = document.createElement("p");
                description.className = "platform-summary";
                description.textContent = finding.summary;
                findingCard.append(title, date, description);
                appendSources(findingCard, [{ label: "Fonte oficial", url: finding.url }]);
                findings.appendChild(findingCard);
            });
            card.appendChild(regulatoryHeading, findings);
        }

        appendSources(card, platform.sources);
        platformCatalog.appendChild(card);
    });
};

fetch("/data/platforms.json?v=20261027")
    .then((response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o catálogo.");
        return response.json();
    })
    .then(renderPlatformCatalog)
    .catch(() => {
        platformCatalog.replaceChildren();
        const message = document.createElement("p");
        message.className = "catalog-loading";
        message.textContent = "Não foi possível carregar os perfis agora. Tente atualizar a página.";
        platformCatalog.appendChild(message);
    });

emailInput.addEventListener("invalid", () => {
    formStatus.className = "form-status error";
    formStatus.textContent = emailInput.validity.valueMissing
        ? "Digite seu e-mail para continuar."
        : "Digite um endereço de e-mail válido (ex.: nome@exemplo.com).";
});

emailInput.addEventListener("input", () => {
    if (emailInput.validity.valid) {
        formStatus.className = "form-status";
        formStatus.textContent = "";
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!emailInput.validity.valid) {
        emailInput.reportValidity();
        return;
    }

    const email = new FormData(form).get("email");
    currentExportReport = null;
    exportButton.disabled = true;
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analisando...";
    formStatus.className = "form-status";
    formStatus.textContent = "Consultando evidências...";

    try {
        const response = await fetch(`/api/exposure?email=${encodeURIComponent(email)}`);

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            if (response.status === 422) {
                throw new Error("O e-mail informado é inválido. Digite um endereço válido, como nome@exemplo.com.");
            }
            if (response.status === 429) {
                const providerLimited = typeof errorPayload.detail === "string"
                    && errorPayload.detail.toLowerCase().includes("provider");
                throw new Error(providerLimited
                    ? "O XposedOrNot limitou as consultas. Aguarde um pouco e tente novamente."
                    : "O limite de consultas do aplicativo foi atingido. Aguarde um pouco e tente novamente.");
            }
            if (response.status === 502) {
                throw new Error("O servidor do XposedOrNot está indisponível no momento. Tente novamente mais tarde.");
            }

            const detail = errorPayload.detail;
            const message = typeof detail === "string"
                ? detail
                : "Não foi possível concluir a consulta. Tente novamente.";
            throw new Error(message);
        }

        const payload = await response.json();
        renderActionPlan(payload);
        currentExportReport = {
            title: "Relatório de exposição digital — DigitalScope",
            generated_at: new Date().toISOString(),
            email: maskEmail(payload.email || email),
            summary: {
                breach_count: Number(payload.summary.breach_count) || 0,
                severity: String(payload.summary.severity || "unknown"),
                exposed_data_types: Array.isArray(payload.summary.exposed_data_types)
                    ? payload.summary.exposed_data_types.map(String)
                    : [],
            },
            alerts: Array.isArray(payload.alerts) ? payload.alerts.map((alert) => ({
                type: String(alert.type || "info"),
                message: String(alert.message || ""),
                details: Array.isArray(alert.details) ? alert.details.map(String) : [],
            })) : [],
            recommendations: Array.isArray(payload.recommendations) ? payload.recommendations.map(String) : [],
            breaches: Array.isArray(payload.breaches) ? payload.breaches.map(safeExportBreach) : [],
            note: "Este arquivo foi gerado localmente no navegador. O e-mail foi mascarado. Os resultados refletem apenas as fontes consultadas nesta busca.",
        };
        exportButton.disabled = false;
        document.getElementById("breach-count").textContent = payload.summary.breach_count;
        const severityLabels = { low: "Baixa", medium: "Média", high: "Alta" };
        document.getElementById("severity").textContent = severityLabels[payload.summary.severity] || payload.summary.severity;
        document.getElementById("exposed-count").textContent = payload.summary.exposed_data_types.length;
        document.getElementById("alert-count").textContent = payload.alerts.length;
        document.getElementById("account-count").textContent = payload.breaches.length;


        const renderList = (elementId, items, emptyMessage) => {
            const list = document.getElementById(elementId);
            list.replaceChildren();
            (items.length ? items : [emptyMessage]).forEach((item) => {
                const listItem = document.createElement("li");
                listItem.textContent = item;
                list.appendChild(listItem);
            });
        };

        const alertItems = [];
        payload.alerts.forEach((alert) => {
            alertItems.push(alert.message);
            alert.details.forEach((detail) => alertItems.push(detail));
        });
        renderList("alerts-list", alertItems, "Nenhum alerta identificado.");
        renderList("recommendations-list", payload.recommendations, "Nenhuma recomendação disponível.");

        const breachesList = document.getElementById("breaches-list");
        const pagination = document.getElementById("breach-pagination");
        const previousPage = document.getElementById("previous-page");
        const nextPage = document.getElementById("next-page");
        const paginationStatus = document.getElementById("pagination-status");
        const pageSize = 5;
        let currentPage = 1;

        const renderBreaches = () => {
            breachesList.replaceChildren();
            const totalPages = Math.max(1, Math.ceil(payload.breaches.length / pageSize));
            const start = (currentPage - 1) * pageSize;
            const visibleBreaches = payload.breaches.slice(start, start + pageSize);

            visibleBreaches.forEach((breach) => {
                const item = document.createElement("article");
                item.className = "breach-item";

                const name = document.createElement("strong");
                name.className = "breach-name";
                name.textContent = breach.name;

                const metadata = document.createElement("div");
                metadata.className = "breach-meta";

                const date = document.createElement("span");
                date.className = "breach-date";
                date.textContent = `Data: ${breach.date || "Data não informada"}`;

                const source = document.createElement("span");
                source.className = "breach-source";
                source.textContent = `Fonte: ${breach.source || "XposedOrNot"}`;

                metadata.append(date);
                if (breach.details_available) {
                    const dataTooltip = document.createElement("span");
                    dataTooltip.className = "data-tooltip";
                    const dataTrigger = document.createElement("button");
                    dataTrigger.className = "data-tooltip-trigger";
                    dataTrigger.type = "button";
                    dataTrigger.textContent = "Dados vazados";
                    const dataContent = document.createElement("span");
                    dataContent.className = "data-tooltip-content";
                    dataContent.textContent = breach.data_classes.length
                        ? breach.data_classes.join(", ")
                        : "Tipos de dados não informados";
                    dataTooltip.append(dataTrigger, dataContent);
                    metadata.append(document.createTextNode("|"), dataTooltip);
                }
                [
                    breach.domain && `Domínio: ${breach.domain}`,
                    breach.industry && `Setor: ${breach.industry}`,
                    Number.isInteger(breach.exposed_records)
                        && `Registros no incidente: ${breach.exposed_records.toLocaleString("pt-BR")}`,
                    breach.password_risk && `Risco das senhas: ${breach.password_risk}`,
                    breach.verified === true && "Incidente verificado pelo provider",
                    breach.verified === false && "Incidente não verificado pelo provider",
                ].filter(Boolean).forEach((value) => {
                    metadata.append(document.createTextNode("|"));
                    const detail = document.createElement("span");
                    detail.textContent = value;
                    metadata.append(detail);
                });
                metadata.append(document.createTextNode("|"), source);
                item.append(name, metadata);
                if (breach.description) {
                    const description = document.createElement("p");
                    description.className = "breach-description";
                    description.textContent = breach.description;
                    item.appendChild(description);
                }
                if (breach.reference_url) {
                    try {
                        const referenceUrl = new URL(breach.reference_url);
                        if (["http:", "https:"].includes(referenceUrl.protocol)) {
                            const reference = document.createElement("a");
                            reference.className = "breach-reference";
                            reference.href = referenceUrl.href;
                            reference.target = "_blank";
                            reference.rel = "noopener noreferrer";
                            reference.textContent = "Consultar fonte do incidente";
                            item.appendChild(reference);
                        }
                    } catch {
                        // Ignore malformed provider references.
                    }
                }
                if (!breach.details_available) {
                    const detailsError = document.createElement("p");
                    detailsError.className = "breach-meta";
                    detailsError.textContent = "Não foi possível carregar os detalhes deste incidente.";
                    item.appendChild(detailsError);
                }
                breachesList.appendChild(item);
            });

            paginationStatus.textContent = `Página ${currentPage} de ${totalPages}`;
            previousPage.disabled = currentPage === 1;
            nextPage.disabled = currentPage === totalPages;
            pagination.hidden = payload.breaches.length <= pageSize;
        };

        previousPage.onclick = () => {
            if (currentPage > 1) {
                currentPage -= 1;
                renderBreaches();
            }
        };
        nextPage.onclick = () => {
            if (currentPage < Math.ceil(payload.breaches.length / pageSize)) {
                currentPage += 1;
                renderBreaches();
            }
        };

        if (payload.breaches.length === 0) {
            const emptyState = document.createElement("p");
            emptyState.className = "breach-meta";
            emptyState.textContent = "Nenhuma brecha conhecida foi associada a este e-mail.";
            breachesList.appendChild(emptyState);
            pagination.hidden = true;
        } else {
            renderBreaches();
        }
        results.forEach((element) => element.classList.add("is-visible"));
        formStatus.className = "form-status";
        const detailsUnavailable = payload.breaches.some((breach) => !breach.details_available);
        formStatus.textContent = payload.breaches.length === 0
            ? "Nenhuma exposição conhecida foi encontrada nas fontes consultadas para este e-mail. Isso não garante que não existam exposições em outras fontes."
            : detailsUnavailable
                ? "A busca encontrou incidentes, mas não foi possível carregar os detalhes."
                : "Consulta concluída. Foram encontradas exposições associadas a este e-mail.";
    } catch (error) {
        formStatus.className = "form-status error";
        formStatus.textContent = error.message;
    } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Analisar";
    }
});
