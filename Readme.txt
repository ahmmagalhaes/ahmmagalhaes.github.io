# Calculadora de Infusão Contínua (UTI) — Documentação Técnica

Aplicação web progressiva (PWA) voltada para suporte à decisão clínica e redução de carga cognitiva de médicos intensivistas no cálculo, diluição e programação de bombas de infusão contínua (BIC).

---

## 1. Visão Geral da Arquitetura

O sistema adota uma arquitetura em camadas (**Layered / Separation of Concerns**) executada puramente no lado do cliente (*client-side*), sem necessidade de dependências externas (*zero-dependency vanilla architecture*). A separação garante que regras de negócio, dados clínicos, cálculos matemáticos e manipulação de interface operem de forma desacoplada.

```
┌─────────────────────────────────────────────────────────────┐
│                         index.html                          │
│        (Estrutura Semântica e Pontos de Injeção DOM)        │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │ Renderização
               ▼                               │ Reativa
┌──────────────────────────────┐ ┌─────────────┴──────────────┐
│          drogas.js           │ │           app.js           │
│   (Catálogo Farmacológico)   │ │  (Controlador de Interface │
└──────────────┬───────────────┘ │    e Estado da Aplicação)  │
               │                 └─────────────▲──────────────┘
               │ Dados                         │ Chamadas puras
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                           calc.js                           │
│             (Motor Matemático e Formatação Estrita)         │
└─────────────────────────────────────────────────────────────┘

```

---

## 2. Estrutura e Papel de Cada Arquivo

### `index.html`

* **Função:** Ponto de entrada estrutural.
* **Responsabilidades:**
* Define os containers de entrada (peso do paciente, seletores de classe e fármaco, campos de dose).
* Estrutura as duas abas operacionais: **Referência Rápida** (foco no cálculo imediato à beira do leito) e **Plano Terapêutico** (gestão multidrogas por paciente).
* Carrega os scripts de forma sequencial e não bloqueante via atributo `defer` (`drogas.js` $\rightarrow$ `calc.js` $\rightarrow$ `app.js`).
* Declara os metadados para compatibilidade mobile e manifesto PWA.



### `style.css`

* **Função:** Camada de apresentação visual e responsividade.
* **Responsabilidades:**
* Define o sistema de design através de variáveis CSS (`:root`), abrangendo tipografia do sistema, espaçamentos e estados cromáticos clínicos (verde para faixa terapêutica, âmbar para alerta/abaixo, vermelho para acima/erro).
* Implementa suporte automático ao modo escuro via media query `@media (prefers-color-scheme: dark)`, reduzindo a fadiga visual em ambientes hospitalares noturnos.
* Estrutura o layout flexível e grid responsivo para telas móveis e desktops de posto de enfermagem.



### `drogas.js`

* **Função:** Repositório de dados clínicos (Model/Entidades).
* **Responsabilidades:**
* Isola 100% dos parâmetros farmacológicos da lógica de programação.
* Estrutura cada medicação sob um esquema consistente:
* `u`: Unidade clínica da taxa de infusão (`mcg/kg/min`, `mg/kg/h`, `mcg/min`, `U/min`, etc.).


* `r`: Tupla com a faixa terapêutica usual `[min, max]`.


* `f`: Flag binária de fotossensibilidade (`1` ou `0`).


* `s`: Solvente padronizado (`SG5%`, `SF0,9%`, etc.).


* `ap`: Apresentação comercial `{ f: "amp"|"frasco", m: massa, u: unidade, v: volume_ml }`.


* `dil`: Coleção declarativa de preparos padronizados com `{ nome, qtd, solvente }`.
* `at`: Protocolo de dose de ataque opcional `{ v: dose, u: unidade, t: tempo_minutos }`.







### `calc.js`

* **Função:** Motor de domínio matemático e formatação estrita.
* **Responsabilidades:**
* Implementa o módulo imutável `CalcCore`, composto exclusivamente por **funções puras** (sem efeitos colaterais e sem referências ao DOM).
* Executa conversões dimensionais de massa (`mg` $\leftrightarrow$ `mcg`) e tempo (`min` $\leftrightarrow$ `h`).
* Processa diluições calculando concentrações reais com base no volume final somado (fármaco + solvente).
* Aplica a regra de formatação obrigatória para preparo de soluções.



### `app.js`

* **Função:** Controlador de aplicação (Presenter/Controller).
* **Responsabilidades:**
* Gerencia o estado reativo global `S` (fármaco selecionado, modo padrão/personalizado, dose, ataque) e o array `plan` (prescrições salvas).
* Ouve eventos do usuário (`input`, `change`, `click`) e orquestra o ciclo de atualização da interface.
* Integra a API da área de transferência (`navigator.clipboard`) para exportação formatada de prescrições.
* Registra o Service Worker em navegadores compatíveis.



### `manifest.json` & `sw.js`

* **Função:** Infraestrutura PWA (Progressive Web App).
* **Responsabilidades:**
* O `manifest.json` instrui o sistema operacional (Android/iOS) a tratar o site como aplicativo autônomo (*standalone*).
* O `sw.js` intercepta requisições de rede utilizando a estratégia **Stale-While-Revalidate**: entrega instantaneamente os arquivos cacheados do dispositivo (garantindo operação offline em áreas sem sinal da UTI) e atualiza o cache silenciosamente em segundo plano caso haja conexão.



---

## 3. Principais Funções e Mecanismos de Cálculo

### 3.1. Formatação Padronizada de Preparo (`formatPreparo`)

Em conformidade com as boas práticas de segurança medicamentosa, a descrição do preparo elimina termos ambíguos como "QSP" ou somas implícitas, retornando estritamente:

$$\text{Massa de soluto (Número de ampolas)} + \text{Solvente em mL}$$

```javascript
formatPreparo(massa, unidMassa, qtd, tipoRecipiente, volSolvente)

```

* **Comportamento:** Analisa o tipo de recipiente (`ampola` vs. `frasco`), aplica pluralização automática, formata valores decimais/inteiros via `nfClean` e expressa claramente adições nulas (ex.: `500 mg (1 frasco) + 0 mL` para Propofol puro).

### 3.2. Normalização e Concentração Real (`CalcCore.normalizeRecipe`)

Diferente de sistemas legados que assumem que o volume da ampola desaparece no diluente, o motor calcula o **volume final verdadeiro**:

$$\text{Volume Final} = (\text{Volume da Ampola} \times \text{Quantidade}) + \text{Volume do Solvente}$$

$$\text{Concentração} = \frac{\text{Massa Total Convertida}}{\text{Volume Final}}$$

A função converte automaticamente a massa da apresentação para a unidade base da infusão (ex.: se a dose é em `mcg/kg/min` e a ampola está em `mg`, a massa é multiplicada por 1000).

### 3.3. Cálculo da Taxa de Infusão na BIC (`CalcCore.infusionRate`)

Calcula a vazão em mL/h a ser programada no equipamento:

$$\text{Vazão (mL/h)} = \frac{\text{Dose} \times [\text{Peso se /kg}] \times [60\text{ se /min}]}{\text{Concentração}}$$

* **Validações:** Retorna `NaN` caso o fármaco dependa de `/kg` e o peso informado não esteja no intervalo validado (1 a 300 kg), ou se dose/concentração forem inválidos.



### 3.4. Cálculo Reverso: Dose a partir da Vazão (`CalcCore.doseFromRate`)

Permite ao médico digitar uma vazão em mL/h que já está correndo na bomba para descobrir a dose exata entregue:

$$\text{Dose} = \frac{\text{Vazão} \times \text{Concentração}}{[\text{Peso se /kg}] \times [60\text{ se /min}]}$$

### 3.5. Avaliação de Faixa Terapêutica (`CalcCore.doseStatus`)

Compara a dose fornecida com a tupla `r: [min, max]` cadastrada em `drogas.js`:

* $\text{Dose} < \text{mínima}$: Retorna `['lo', 'abaixo da faixa usual']`.


* $\text{mínima} \le \text{Dose} \le \text{máxima}$: Retorna `['ok', 'dentro da faixa usual']`.


* $\text{Dose} > \text{máxima}$: Retorna `['hi', 'acima da faixa usual']`.



---

## 4. Ciclo de Funcionamento da Aplicação

1. **Inicialização do Sistema (`window.onload` / Execução de Script):**
* O `app.js` lê as chaves de categorias em `DROGAS` e popula o seletor `#cat`.
* Dispara `fillSelects()`, carregando os fármacos da primeira categoria em ordem alfabética.
* `resetDrug()` inicializa o estado `S` com a dose mínima usual cadastrada e aciona `build()`.
* O navegador registra o Service Worker em segundo plano.


2. **Renderização Dinâmica do Formulário (`build`):**
* Avalia o modo de preparo ativo:
* **Padrão:** Injeta um `<select id="dil">` contendo as opções predefinidas do hospital.
* **Personalizada:** Injeta campos de quantidade de ampolas e volume final desejado, calculando sugestões rápidas de bolsas (100 mL, 250 mL, 500 mL, 1000 mL) superiores ao volume das ampolas.


* Injeta os botões de atalho: **Dose mín** e **Dose máx**.


3. **Ciclo Reativo de Atualização (`update`):**
* A função `context()` processa o preparo atual via `CalcCore.normalizeRecipe` ou calcula a diluição customizada.
* A taxa de infusão e a dose de ataque são recalculadas.
* Se os dados forem válidos, exibe o valor em destaque no elemento `#vaz` (ex.: `7,5 mL/h`), atualiza as tags visuais de status e monta o painel lateral com solvente, preparo estrito, volume final e alertas de fotossensibilidade.


* Em caso de dado omisso ou inválido (ex.: ausência de peso em droga dependente de peso), suspende o cálculo e exibe mensagens de orientação.


4. **Gerenciamento do Plano Terapêutico Multidrogas:**
* Ao clicar em "Adicionar ao plano terapêutico", o estado da medicação atual é empacotado e salvo no array `plan`.
* A visualização agrupa as infusões por categoria médica.


* Caso o peso do paciente seja alterado no topo da página, todas as drogas dependentes de peso registradas no plano têm suas vazões instantaneamente recalculadas em lote, prevenindo erros de ajuste em pacientes com balanço hídrico oscilante.


5. **Exportação Rápida:**
* O botão "Copiar prescrição para o prontuário" compila a droga, o preparo padronizado, o solvente, o volume final, a concentração, a vazão calculada e a dose meta em texto plano, enviando-o à área de transferência para colagem direta no Prontuário Eletrônico do Paciente (PEP).