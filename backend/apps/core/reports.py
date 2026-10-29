import csv
import io

from django.http import HttpResponse
from django.utils import timezone

HEADERS = ["Full name", "Email", "Company", "Status", "Check-in time"]


def _row(g, multi):
    local = timezone.localtime(g.checked_in_at).strftime("%Y-%m-%d %H:%M") if g.checked_in_at else ""
    row = [g.full_name, g.email, g.company, "Checked in" if g.checked_in_at else "Not checked in", local]
    if multi:
        row += ["Walk-in" if g.is_walk_in else "", g.event.name, g.event.date.isoformat()]
    return row


def _headers(multi):
    return HEADERS + (["Walk-in", "Event", "Date"] if multi else [])


def csv_response(guests, filename, multi=False):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(_headers(multi))
    for g in guests:
        w.writerow(_row(g, multi))
    resp = HttpResponse("\ufeff" + buf.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return resp


def pdf_response(guests, filename, title, multi=False):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), title=title)
    data = [_headers(multi)] + [_row(g, multi) for g in guests]
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B2545")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EAF4FB")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    styles = getSampleStyleSheet()
    doc.build([Paragraph(title, styles["Title"]), Spacer(1, 8), t])
    resp = HttpResponse(buf.getvalue(), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
    return resp
