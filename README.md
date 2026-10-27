# DigitalScope - Digital Exposure

Dashboard de exposição digital pessoal focado em evidências, privacidade e explicações claras sobre vazamentos associados a um e-mail.
## Live Demo
https://digitalscope.noxlux.workers.dev/

O endereço `workers.dev` é exibido pelo Wrangler após o primeiro deploy. Consulte [Deploy na Cloudflare](#deploy-na-cloudflare).
## Índice

- [Visão geral](#visao-geral)
- [Princípios de privacidade](#principios-de-privacidade)
- [Funcionalidades atuais](#funcionalidades-atuais)
- [Tecnologias](#tecnologias)
- [Configuração](#configuracao)
- [Como executar](#como-executar)
- [Como usar](#como-usar)
- [API](#api)
- [Deploy na Cloudflare](#deploy-na-cloudflare)
- [Perfis públicos de plataformas](#perfis-publicos-de-plataformas)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Testes](#testes)
- [Limitações conhecidas](#limitacoes-conhecidas)

<a id="visao-geral"></a>
## Visão geral

O DigitalScope oferece duas áreas: **Verificar e-mail**, que consulta sinais de exposição em bases públicas e apresenta incidentes, datas, tipos de dados e fontes; e **Panorama das plataformas**, que reúne informações públicas sobre o uso de dados, controles de segurança documentados e incidentes conhecidos de serviços populares. O panorama pode ser consultado sem informar e-mail. O projeto não afirma que uma conta foi invadida nem exibe dados privados recuperados de vazamentos.

<a id="principios-de-privacidade"></a>
## Princípios de privacidade

O DigitalScope segue os seguintes princípios de privacidade:

- Não solicitar ou armazenar senhas.
- Não exibir o conteúdo de dados vazados.
- Não armazenar e-mails consultados em banco de dados.
- Salvar apenas o estado genérico das ações concluídas no navegador, sem e-mail ou resultado da consulta.
- Usar cache temporário com identificador derivado do e-mail.
- Informar a fonte dos resultados.
- Diferenciar evidência retornada pelo provider de interpretação do sistema.
- Evitar um “score de segurança” numérico sem fundamentação.

<a id="funcionalidades-atuais"></a>
## Funcionalidades atuais

- Validação de e-mail.
- Consulta pelo XposedOrNot.
- Modo local para desenvolvimento sem chamadas externas.
- Resumo de incidentes e severidade explicável.
- Plano de ação personalizado por categorias de exposição, com links oficiais e progresso salvo localmente sem e-mail ou resultados.
- Exportação do resultado em JSON gerado localmente, com e-mail parcialmente mascarado.
- Alertas para credenciais, dados pessoais e exposição recorrente.
- Cartões de incidentes com origem, data, dados vazados e fonte.
- Metadados individuais por incidente quando o XposedOrNot os fornece, incluindo descrição, domínio, setor e referência.
- Catálogo público, sem e-mail, de políticas, controles documentados e incidentes conhecidos de YouTube, Instagram, TikTok, Facebook, Google, Amazon, X, Cloudflare, Microsoft e PlayStation Network.
- Tooltip para os tipos de dados, reduzindo poluição visual.
- Paginação de cinco incidentes por página.
- Cache temporário em memória.
- Rate limiting de 30 consultas por minuto por cliente.
- Headers básicos de segurança.
- Tratamento de falhas do provider com respostas `429` e `502`.

<a id="tecnologias"></a>
## Tecnologias

- Python 3.13+ para o Worker Cloudflare (Python local/Docker usa `requirements-docker.txt`)
- FastAPI
- Pydantic
- HTTPX
- python-dotenv
- pytest

<a id="configuracao"></a>
## Configuração

### Provider XposedOrNot

Configuração padrão para consultar a API gratuita:

```env
BREACH_PROVIDER=xposedornot
```

### Provider local

Para executar sem chamadas externas:

```env
BREACH_PROVIDER=local
```

Nesse modo, a consulta retorna uma lista vazia. Providers simulados também podem ser injetados nos testes através de `create_app(breach_provider=...)`.


<a id="como-executar"></a>
## Como executar

Instale as dependências:

```powershell
python -m pip install -r requirements-docker.txt
```

Inicie o servidor:

```powershell
python -m uvicorn --app-dir src app.main:app --reload
```

Abra no navegador:

```text
http://127.0.0.1:8000/
```

<a id="como-usar"></a>
## Como usar

1. Digite um e-mail válido.
2. Clique em **Analisar**.
3. Aguarde a consulta ao provider.
4. Confira o resumo, os alertas e as recomendações.
5. Navegue pelos incidentes usando a paginação.
6. Passe o mouse sobre **Dados vazados** para ver as categorias.

<a id="api"></a>
## API

Endpoint de consulta:

```http
GET /api/exposure?email=user@example.com
```

Exemplo de resposta:

```json
{
  "email": "user@example.com",
  "breaches": [
    {
      "name": "ExampleBreach",
      "date": "2024",
      "data_classes": ["Email addresses", "Passwords"],
      "source": "XposedOrNot"
    }
  ],
  "alerts": [],
  "recommendations": ["Continuar monitorando este e-mail para novos vazamentos"],
  "summary": {
    "breach_count": 1,
    "severity": "low",
    "exposed_data_types": ["Email addresses", "Passwords"]
  }
}
```
Respostas de erro relevantes:

- `422`: e-mail inválido.
- `429`: limite local ou limite do provider atingido.
- `502`: provider externo indisponível ou recusou a consulta.


## Deploy na Cloudflare

O app roda como **Python Worker com FastAPI** e publica HTML, CSS e JavaScript como **Static Assets**. O workflow `.github/workflows/deploy-cloudflare.yml` publica o Worker automaticamente a cada `push` para `main`.

O Workers Free inclui até **100.000 chamadas de Worker por dia** e limita o CPU a **10 ms por chamada**; as chamadas externas ao XposedOrNot usam o Fetch API do Worker.

### 1. Prepare sua conta Cloudflare

1. Crie uma conta gratuita em [dash.cloudflare.com](https://dash.cloudflare.com/), se ainda não tiver uma.
2. Abra **Workers & Pages** e configure o subdomínio `workers.dev`, caso seja solicitado. Não ative Workers Paid nem Cloudflare Containers.

### 2. Rode localmente e faça o primeiro deploy

Instale Python 3.13 ou superior, [Node.js](https://nodejs.org/) e [`uv`](https://docs.astral.sh/uv/). O `pywrangler` precisa do executável `node` acessível pelo `PATH` para preparar o ambiente Pyodide do Worker. Depois de instalar Node.js, feche e reabra o terminal e confirme que `node --version` retorna uma versão. Na pasta do repositório, rode:

```powershell
uv run pywrangler dev
```

Isso inicia o projeto localmente. Para publicar a primeira versão, autentique sua conta Cloudflare quando solicitado e rode:

```powershell
uv run pywrangler deploy
```

O deploy publica o Worker e os arquivos de `public/`. O Wrangler mostra o endereço `https://digitalscope.<seu-subdominio>.workers.dev`.

<a id="estrutura-do-projeto"></a>
## Estrutura do projeto

```text
public/
  index.html
  data/
    platforms.json
  static/
    dashboard.js
    styles.css
src/
  app/
    __init__.py
    main.py
    breach_service.py
  worker.py
pyproject.toml
wrangler.jsonc
tests/
  test_exposure_api.py
.env
.gitignore
requirements-docker.txt
README.md
```

<a id="testes"></a>
## Testes

Execute a suíte com:

```powershell
python -m pytest -q
```

Os testes cobrem:

- validação do e-mail;
- normalização de dados;
- provider XposedOrNot simulado;
- provider local;
- cache;
- erros `429` e `502`;
- análise de severidade;
- alertas e recomendações;
- rate limiting;
- headers de segurança;
- entrega dos arquivos estáticos.

<a id="perfis-publicos-de-plataformas"></a>
## Perfis públicos de plataformas

A área **Segurança e privacidade das plataformas** não pede e-mail e não consulta o XposedOrNot. Os perfis são servidos como arquivo estático em `public/data/platforms.json`, com links para políticas, páginas de segurança, avisos de incidentes e autoridades. A data de revisão aparece na interface.

O catálogo separa incidentes confirmados, alegações contestadas, falhas internas sem exposição externa identificada e decisões regulatórias sobre privacidade. Controles publicados não confirmam que estejam ativos em uma conta específica. “Não encontrado no catálogo” não garante que nunca houve um incidente; por isso, a aplicação não calcula uma nota geral de segurança.

<a id="limitacoes"></a>
## Limitações

- A disponibilidade de descrição, data, categorias e outros metadados depende do registro individual retornado pelo XposedOrNot.
- Os perfis públicos cobrem um conjunto inicial de plataformas e refletem as fontes consultadas na data de revisão indicada; não são uma auditoria independente nem um histórico completo.
- O sistema não confirma quais campos específicos de um usuário foram efetivamente acessados.
- O modo local não representa dados reais.
- O cache atual existe apenas na memória do processo.
- Ainda não há autenticação, histórico persistente ou monitoramento automático.
