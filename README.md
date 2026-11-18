# Berliner U-Bahn 3D (прототип)

Отдельное приложение: подземка Берлина в 3D (Vite + React + three.js / react-three-fiber).

* Данные: `public/data/network3d.json` (из `ubahn-data/depth`, z относительно поверхности DGM1) и `public/data/stations.geojson` (из 2D-приложения: даты, названия, Geisterbahnhöfe).
* Проекция: метры от центра (13.4014 E, 52.5109 N), x = восток, y = вверх, z = −север (`src/lib/geo.js`).
* Земля: `berlin.pmtiles` рисуется невидимой картой MapLibre в текстуру 4096 px (`src/components/Ground.jsx`).
  Файл подложки и шрифты НЕ копируются: dev-сервер отдаёт их из `../berlinmetro/public` (`vite.config.js`).
* Слайдер лет и логика дат — копия `berlinmetro/src/lib/time.js`.
* Вертикальное преувеличение и прозрачность земли — в панели справа.

Запуск: `npm install`, затем `npm run dev` → http://localhost:5174/

Обновить данные: скопировать свежие `depth/network3d.json` и `app/berlinmetro/public/data/stations.geojson` в `public/data/`.
