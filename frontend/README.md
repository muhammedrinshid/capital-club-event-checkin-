# Capital Club Dubai - Frontend (React + Vite + Tailwind v4)

    npm install
    # edit .env.local (VITE_API_URL points at the Django API, e.g. http://localhost:8000/api)
    npm run dev

Django needs `CORS_ALLOWED_ORIGINS=http://localhost:5173`.

Routes: `/login` (password, then 6-digit code for admins; first-time admins scan a QR to enrol),
`/kiosk` (kiosk accounts), `/admin` (placeholder for admin and coordinator).
Tokens are kept in localStorage and refreshed automatically.

Admin console (`/admin`): events (create/edit with room-clash check, poster, host, coordinator, kiosk privacy), guests per event (add, CSV upload with preview, reports), members, rooms, kiosks, users, reports, activity log, settings and file cleanup. Coordinators see only their events and guests.

## Kiosk
- Guest mode: carousel on the left (30%), framed poster, logo, clock and promotions on the right; full-screen check-in flow.
- Logo: replace `public/logo.svg` (or set `VITE_LOGO_URL`). Promotions: edit `src/config/promotions.js`.
- Reception mode (hidden): swipe left across the top-right corner of the screen, then enter this kiosk account's password.
  It shows any day's events (other days are view-only), check in / undo, and walk-ins. It locks after 3 idle minutes or when the token expires.
- Install as a tablet app: open the site in Chrome, menu, Install app (full-screen, landscape).
