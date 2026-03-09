# Arquitectura Técnica — Project Dashboard

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 |
| Componentes UI | Radix UI (dialogs, tooltips) |
| Gráficos | Recharts |
| Fechas | date-fns |
| Excel | xlsx (SheetJS) |
| IA | @anthropic-ai/sdk (Claude Haiku) |
| Runtime | Node.js |

---

## Estructura de directorios

```
project-dashboard/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (sidebar + main)
│   ├── globals.css             # Estilos globales + @media print
│   ├── page.tsx                # Vista Overview (tabla de servicios)
│   ├── portfolio/page.tsx      # Vista COR Portfolio
│   ├── gantt/page.tsx          # Vista Gantt global
│   ├── team/page.tsx           # Vista Team (bench & disponibilidad)
│   ├── project/[id]/
│   │   ├── page.tsx            # Shell de reporte de proyecto
│   │   └── project-detail.tsx  # Componente de detalle (CC/SC o Fixed Price)
│   └── api/
│       ├── data/route.ts       # GET/POST → data/store.json
│       └── generate-report/route.ts  # POST → Claude Haiku (IA)
├── components/
│   ├── sidebar.tsx             # Navegación lateral + quarter badge
│   ├── print-button.tsx        # Botón "Exportar PDF" (oculto en impresión)
│   ├── print-header.tsx        # Header visible solo en impresión
│   └── multi-filter.tsx        # Dropdown multi-select con checkboxes
├── lib/
│   ├── data-context.tsx        # Estado global (React Context)
│   ├── data.ts                 # Datos por defecto (proyectos demo)
│   ├── csv-parser.ts           # Parser del CSV de servicios
│   ├── translations.ts         # i18n (ES/EN)
│   └── utils.ts                # Helpers: cn(), formatCurrency(), getFiscalQuarter()
├── types/
│   └── index.ts                # Tipos: Project, TeamMember, ProjectReport, Milestone...
├── data/
│   └── store.json              # ⚠️ Generado en runtime, en .gitignore
└── public/                     # Assets estáticos
```

---

## Flujo de datos

### Persistencia (red local compartida)

```
Browser A ──POST /api/data──▶ data/store.json ◀──GET /api/data── Browser B
```

- Al montar, `DataProvider` hace `GET /api/data` y carga el store
- Cualquier cambio de estado dispara un `POST /api/data` con debounce de 800 ms
- **Migración automática**: si el servidor está vacío y el browser tiene datos en localStorage (sesiones antiguas), los sube automáticamente

### Carga inicial

```
mount → GET /api/data
  ├── servidor tiene datos → applyStore(serverStore)
  └── servidor vacío
        ├── localStorage tiene datos → applyStore(local) + POST /api/data
        └── localStorage vacío → usa datos por defecto (demo)
```

### Estado global (`lib/data-context.tsx`)

| Estado | Tipo | Descripción |
|---|---|---|
| `projects` | `Project[]` | Lista de servicios/proyectos |
| `teamMembers` | `TeamMember[]` | Equipo |
| `financialData` | `FinancialData[]` | KPIs financieros por proyecto |
| `reportData` | `Record<string, ProjectReport>` | Reportes editables por proyecto |
| `oportunidades` | `Oportunidad[]` | Pipeline de oportunidades |

---

## Vistas principales

### Overview (`app/page.tsx`)
- Tabla de todos los servicios con KPIs financieros
- Filtros multi-select: Estado, Cliente, Tipo, BM, Líder, BU
- Click en proyecto → abre reporte detallado
- Carga de datos via CSV

### Portfolio COR (`app/portfolio/page.tsx`)
- Vista COR (Cost of Revenue) por proyecto
- Semáforos de salud (verde/amarillo/rojo/gris/done)
- Edición inline de métricas financieras
- Filtros multi-select: Estado, Cliente, Team Leader, BM, Tipo

### Gantt (`app/gantt/page.tsx`)
- Línea de tiempo global de todos los proyectos activos
- Visualización de fases y hitos

### Team (`app/team/page.tsx`)
- Bench y disponibilidad del equipo
- KPIs de ocupación

### Reporte de Proyecto (`app/project/[id]/`)
- **Layout CC/SC**: métricas de Customer Satisfaction / Service Continuity
- **Layout Fixed Price**: incluye Gantt de fases del proyecto
- Toggle entre layouts persistido en store
- Auto-detección de Fixed Price por tipo de servicio
- Edición inline de todos los campos
- Generación con IA (Claude Haiku) via `/api/generate-report`

---

## Sistema de quarter fiscal

```
Q1 = Abril – Junio
Q2 = Julio – Septiembre
Q3 = Octubre – Diciembre
Q4 = Enero – Marzo

FY etiquetado por el año del inicio (abril):
  Ejemplo: Marzo 2026 → Q4 FY2025
  Ejemplo: Abril 2026 → Q1 FY2026
```

Implementado en `lib/utils.ts` → `getFiscalQuarter(date)`.
Mostrado en el sidebar (solo client-side para evitar hydration mismatch).

---

## Exportación a PDF

- Sin librerías externas: usa `window.print()` del navegador
- CSS `@media print` en `globals.css`:
  - `-webkit-print-color-adjust: exact` — preserva colores de fondo
  - `@page { margin: 1.5cm }`
- Tailwind `print:hidden` oculta: sidebar, filtros, botones de acción
- Tailwind `print:ml-0` en `<main>` elimina el margen del sidebar
- `<PrintHeader>` (oculto normalmente, visible en impresión) muestra: título, quarter, fecha

---

## Parser CSV (`lib/csv-parser.ts`)

El CSV de servicios se mapea a los tipos internos. Campos soportados:

| CSV | Tipo interno |
|---|---|
| Nombre / Proyecto | `project.name` |
| Cliente | `project.client` |
| Estado | `project.status` |
| Tipo de servicio | `project.serviceType` |
| BM | `project.manager` |
| Team Leader | `project.leader` |
| BU | `project.bu` |
| Fechas (inicio/fin) | `project.startDate / endDate` |
| Revenue / Cost | `financialData` |

---

## API Routes

### `GET/POST /api/data`
- Lee/escribe `data/store.json` en el filesystem del servidor
- Usado por `DataProvider` para persistencia compartida en red local

### `POST /api/generate-report`
- Recibe contexto del proyecto
- Llama a Claude Haiku (`claude-haiku-4-5-20251001`)
- Devuelve campos del reporte completados por IA
- Requiere `ANTHROPIC_API_KEY` en `.env.local`

---

## Internacionalización

- `lib/translations.ts` — objetos ES/EN
- Toggle de idioma en el sidebar
- Todas las cadenas de UI usan `const t = translations[lang]`

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic (para generación con IA) |

Archivo: `.env.local` (nunca commitear, está en `.gitignore`)

---

## Despliegue en red local

```bash
# Instalar dependencias
npm install

# Build de producción
npm run build

# Iniciar servidor (accesible en la red)
npm run start -- -H 0.0.0.0

# Acceder desde otro equipo en la misma red WiFi
http://<IP-del-servidor>:3000
```

Para saber la IP del servidor: `ipconfig getifaddr en0` (Mac).

---

## Comandos de desarrollo

```bash
npm run dev      # Servidor de desarrollo con Turbopack (localhost:3000)
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # Linter
```
