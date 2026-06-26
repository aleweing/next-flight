# ✈️ Next Flight

PWA para encontrar vuelos baratos entre España y Argentina. Parte de la serie **Next** de apps personales para iPhone.

## Funcionalidades

- **Búsqueda con fecha** — resultados exactos vía Google Flights (SerpApi)
- **Búsqueda sin fecha** — encuentra la mejor semana disponible en los próximos meses
- **Tipo de precio** — elige si el presupuesto es para ida y vuelta o solo ida
- **Precio máximo** — filtra resultados por presupuesto en EUR
- **Aeropuertos de salida:** MAD, BCN, VLC, AGP
- **Aeropuertos de llegada:** EZE, AEP, COR, ROS
- **Vuelos directos** — opción para excluir escalas
- **Filtro por aerolínea:** Iberia, Air Europa, LATAM, Aerolíneas Argentinas y más
- **Clase de cabina:** Económica, Premium Economy, Business, Primera
- **Alertas de precio** — guarda búsquedas y comprueba si hay vuelos dentro del presupuesto
- **Botón "Comprar / Ver vuelo"** con enlace directo a Google Flights con el vuelo preseleccionado
- **Instalable en iPhone** como app nativa desde Safari

## Arquitectura

```
iPhone (PWA · Safari)
        ↓
GitHub Pages (index.html · vanilla JS)
        ↓
Cloudflare Worker (proxy · oculta la API key)
        ↓
SerpApi → Google Flights (datos reales)
```

Sin frameworks. Sin servidor. Sin CLI. Todo desplegado desde el navegador.

## Archivos

| Archivo | Descripción |
|---|---|
| `index.html` | PWA completa — UI y lógica en vanilla JS |
| `sw.js` | Service Worker — instalación y cache offline |
| `manifest.json` | Configuración PWA para iPhone |
| `worker.js` | Cloudflare Worker — proxy hacia SerpApi |
| `icon-192.png` | Icono PWA 192×192 px |
| `icon-512.png` | Icono PWA 512×512 px |

> `worker.js` se despliega en Cloudflare, **no** en GitHub Pages.

## Despliegue rápido

### 1. SerpApi
Regístrate en [serpapi.com](https://serpapi.com/users/sign_up) y copia tu API key.  
Plan gratuito: **250 búsquedas/mes**.

### 2. Cloudflare Worker
1. [Crear Worker](https://dash.cloudflare.com) → pegar contenido de `worker.js` → Deploy
2. **Settings → Variables and Secrets** → añadir `SERPAPI_KEY` como tipo **Secret**
3. Volver a hacer Deploy
4. Copiar la URL del Worker (sin barra final)

### 3. GitHub Pages
1. Subir `index.html`, `sw.js`, `manifest.json` e iconos al repositorio
2. **Settings → Pages** → Source: `main` / `root`
3. En `index.html`, reemplazar `WORKER_URL` por la URL real del Worker

### 4. Instalar en iPhone
Safari → abrir la URL de GitHub Pages → compartir (□↑) → **Añadir a pantalla de inicio**

Guía completa en [`DEPLOY.md`](DEPLOY.md).

## API

Los filtros de precio máximo y aerolínea se aplican en el Worker sobre los resultados de SerpApi, que no los soporta de forma nativa.

| Parámetro | Descripción |
|---|---|
| `origin` | Código IATA origen (MAD, BCN…) |
| `destination` | Código IATA destino (EZE, AEP…) |
| `dateFrom` | Fecha de salida (yyyy-mm-dd) |
| `dateTo` | Fecha de vuelta, opcional (yyyy-mm-dd) |
| `adults` | Número de adultos |
| `cabin` | ECONOMY · PREMIUM_ECONOMY · BUSINESS · FIRST |
| `maxPrice` | Precio máximo en EUR |
| `nonStop` | `true` para vuelos directos únicamente |
| `airline` | Código IATA de aerolínea (IB, UX, LA…) |

## Roadmap

- [ ] Notificaciones push automáticas (Cloudflare Cron Trigger)
- [ ] Calendario de precios por mes
- [ ] Comparativa de precios históricos
