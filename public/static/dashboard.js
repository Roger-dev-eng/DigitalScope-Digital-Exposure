const form = document.getElementById("exposure-form");
const analyzeButton = document.getElementById("analyze-button");
const formStatus = document.getElementById("form-status");
const results = document.querySelectorAll(".results");
const emailInput = form.elements.email;

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
        card.append(securityHeading, securitySummary);

        const dataHeading = document.createElement("h3");
        dataHeading.textContent = "Como a plataforma diz que usa os dados";
        const dataSummary = document.createElement("p");
        dataSummary.className = "platform-summary";
        dataSummary.textContent = platform.data_use;
        card.append(dataHeading, dataSummary);
        const policyLink = safeExternalLink("Abrir política de privacidade", platform.data_policy_url);
        if (policyLink) card.appendChild(policyLink);

        const controls = document.createElement("ul");
        controls.className = "platform-controls";
        platform.controls.forEach((control) => {
            const item = document.createElement("li");
            item.append(document.createTextNode(control.label));
            const source = safeExternalLink("Fonte", control.url);
            if (source) item.append(" ", source);
            controls.appendChild(item);
        });
        card.appendChild(controls);

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
