import csv
import io
import re
import unicodedata


def normalize_name(value: str) -> str:
    """Case/space-insensitive key used to prevent duplicate guests in one event."""
    value = unicodedata.normalize("NFKC", value or "")
    return re.sub(r"\s+", " ", value).strip().casefold()


HEADER_ALIASES = {
    "name": "full_name", "fullname": "full_name", "full name": "full_name", "guest": "full_name",
    "e-mail": "email", "mail": "email", "organisation": "company", "organization": "company",
    "mobile": "phone", "tel": "phone", "job title": "title", "position": "title",
    "membership number": "membership_number", "member id": "membership_number",
    "membership_no": "membership_number",
}


def read_csv_rows(uploaded_file):
    """Return a list of dicts with normalised headers. Accepts UTF-8 (with/without BOM)."""
    raw = uploaded_file.read()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        clean = {}
        for k, v in row.items():
            if k is None:
                continue
            key = k.strip().lower()
            key = HEADER_ALIASES.get(key, key.replace(" ", "_"))
            clean[key] = (v or "").strip()
        if any(clean.values()):
            rows.append(clean)
    return rows


def apply_search(qs, request, fields):
    """?search=abc -> case-insensitive match on any of the given fields."""
    from django.db.models import Q
    term = request.query_params.get("search", "").strip()
    if not term:
        return qs
    q = Q()
    for f in fields:
        q |= Q(**{f"{f}__icontains": term})
    return qs.filter(q)


def apply_filters(qs, request, allowed):
    """allowed: {"param": "orm_lookup"}; booleans 'true'/'false' are converted."""
    for param, lookup in allowed.items():
        val = request.query_params.get(param)
        if val in (None, ""):
            continue
        if val.lower() in ("true", "false"):
            val = val.lower() == "true"
        qs = qs.filter(**{lookup: val})
    return qs


def limit_offset(qs, request, default=100, maximum=500):
    try:
        limit = min(int(request.query_params.get("limit", default)), maximum)
        offset = max(int(request.query_params.get("offset", 0)), 0)
    except ValueError:
        limit, offset = default, 0
    return qs[offset:offset + limit]
