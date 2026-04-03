# Urban Eco Route

Urban Eco Route is a static interactive travel guide for exploring Sha Tin and Tai Po through a lower-impact, public-transport-friendly itinerary. The site combines a landing page, an interactive Leaflet map, detailed stop pages, photo galleries, audio guides, and optional 360 panorama views to help visitors plan a slower and more sustainable two-day route.

## Project Overview

This project is built as a client-side web app with no build step or backend. Everything is served from static files:

- `index.html` defines the landing page, map layout, mobile drawers, stop detail page, lightbox, and panorama viewer.
- `style.css` handles the visual design, responsive layout, overlays, drawers, and map UI styling.
- `app.js` contains the itinerary data, map logic, category filtering, to-do list behavior, audio guide handling, and panorama/lightbox interactions.
- `assets/` stores icons, photos, and multilingual audio files used throughout the experience.

## Highlights

- Two curated route views:
  - Day 1 focuses on Tai Po, including public transport transfers, heritage stops, and optional add-ons.
  - Day 2 focuses on Sha Tin, including museum, temple, promenade, shopping, and walking-based exploration.
- Interactive Leaflet map with category-based markers and filters.
- Suggested itinerary panels for both desktop and mobile.
- Personal route to-do list stored in `localStorage`.
- Stop detail pages with:
  - route guidance
  - sustainability notes and estimated footprint text
  - photo galleries with a lightbox viewer
  - audio guides in Chinese, Cantonese, and English for selected stops
  - immersive 360 panorama views for selected landmarks
- Responsive experience with dedicated mobile utility sheets and desktop drawers.

## Example Stops Included

The route data in `app.js` includes stops such as:

- Royal Park Hotel
- Sha Tin Station
- Tai Po Market Station
- Lam Tsuen Wishing Tree
- Tai Po Man Mo Temple
- Hong Kong Railway Museum
- Ten Thousand Buddhas Monastery
- Hong Kong Heritage Museum
- Sha Tin Che Kung Temple

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- [Leaflet](https://leafletjs.com/) for interactive maps
- CARTO Voyager raster tiles with OpenStreetMap attribution
- Google Fonts for typography

## Running Locally

Because this is a static project, you can run it with any simple static server.

### Option 1: Open directly

Open `index.html` in your browser.

### Option 2: Serve locally

If you prefer a local server, you can use one of these:

```powershell
python -m http.server 8000
```

or

```powershell
npx serve .
```

Then open `http://localhost:8000` or the URL shown by your server.

## Deployment

The repository includes a GitHub Actions workflow at `.github/workflows/static.yml` that deploys the full site to GitHub Pages whenever changes are pushed to the `main` branch.

## Project Structure

```text
urban_eco_route/
|-- .github/
|   `-- workflows/
|       `-- static.yml
|-- assets/
|   |-- icons/
|   |-- photos/
|   |   `-- 360/
|   `-- sounds/
|       |-- cn/
|       |-- ct/
|       `-- en/
|-- app.js
|-- index.html
|-- style.css
`-- README.md
```

## Notes for Future Development

- Route content is currently hardcoded in `app.js`.
- External assets such as Leaflet, map tiles, and Google Fonts require an internet connection.
- If the itinerary grows, the stop data could be moved into a dedicated JSON or module-based data layer for easier maintenance.

