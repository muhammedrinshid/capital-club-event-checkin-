# Capital Club Dubai - Event & Check-in API (Django + DRF + JWT)

## Setup
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env   # export the variables (PostgreSQL required: btree_gist exclusion constraint)
    python manage.py migrate
    python manage.py createsuperuser      # role is set to admin automatically
    python manage.py runserver
The DB user must be allowed to `CREATE EXTENSION btree_gist` (or run it once as superuser).

## Roles / auth
- `admin`: password + TOTP (django-otp). First login returns `mfa_setup_required`; call `/api/auth/2fa/setup/` then `/2fa/confirm/`.
  Admin endpoints reject tokens that did not pass TOTP. Django `/admin/` also requires 2FA (django-two-factor-auth).
- `coordinator`: email + password; only their assigned events.
- `kiosk`: one login per tablet (admin creates at `/api/kiosk/devices/`). Token is guest mode (locked).
  Re-entering the same password at `POST /api/kiosk/unlock/` returns a short-lived `reception_access` token.

## Endpoints (prefix /api)
| Area | Endpoint |
|---|---|
| Auth | POST auth/login/, auth/login/otp/, auth/refresh/, auth/logout/; GET auth/me/; POST auth/2fa/setup/, auth/2fa/confirm/ |
| Users (admin) | auth/users/ , auth/users/{id}/ |
| Members (admin) | members/ , POST members/import/ (CSV) |
| Rooms | rooms/ (admin write; coordinators read) |
| Events | events/ ; POST events/{id}/cancel/ ; GET events/check-conflict/ ; GET events/{id}/report/?type=csv\|pdf ; GET events/report/?type=...&date_from=... |
| Guests | events/{id}/guests/ ; POST events/{id}/guests/bulk-upload/ (file, dry_run) |
| Kiosk | GET kiosk/events/ ; GET kiosk/events/{id}/guests/?q= ; POST .../guests/{gid}/check-in/ ; POST .../undo/ ; POST kiosk/events/{id}/walk-ins/ (reception) ; POST kiosk/unlock/ |
| Kiosk devices (admin) | kiosk/devices/ |
| Settings / files / audit (admin) | settings/ ; media/ (GET list, DELETE ?path=, POST = clear unused) ; audit/ |

## Code style
All views are plain function-based views (`@api_view`). Each URL maps to one function that branches on
`request.method`. Lists are plain JSON arrays filtered with query params (`?search=`, `?room=`, `?date_from=` ...);
only `/api/audit/` supports `?limit=&offset=`. Throttles for login/OTP/unlock live in `apps/core/throttles.py`.
