from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from apps.core.utils import apply_filters, apply_search, read_csv_rows
from .models import Member
from .serializers import CSVUploadSerializer, MemberSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAdminRole])
def members_list(request):
    """GET ?search= &is_active=   |   POST create a member (e.g. on the spot while creating an event)."""
    if request.method == "GET":
        qs = apply_filters(Member.objects.all(), request, {"is_active": "is_active"})
        qs = apply_search(qs, request, ["full_name", "email", "company", "membership_number"])
        return Response(MemberSerializer(qs, many=True).data)
    s = MemberSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminRole])
def member_detail(request, pk):
    member = get_object_or_404(Member, pk=pk)
    if request.method == "GET":
        return Response(MemberSerializer(member).data)
    if request.method == "DELETE":
        member.is_active = False       # keep history: events still point to this host
        member.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
    s = MemberSerializer(member, data=request.data, partial=(request.method == "PATCH"))
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


@api_view(["POST"])
@permission_classes([IsAdminRole])
@parser_classes([MultiPartParser, FormParser])
def members_import(request):
    """CSV columns: membership_number, full_name, email, phone, company. Upserts by number, then email."""
    s = CSVUploadSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    created = updated = 0
    errors = []
    with transaction.atomic():
        for i, row in enumerate(read_csv_rows(s.validated_data["file"]), start=2):
            name = row.get("full_name", "")
            if not name:
                errors.append({"row": i, "error": "full_name is required"})
                continue
            if row.get("email"):
                try:
                    validate_email(row["email"])
                except DjangoValidationError:
                    errors.append({"row": i, "error": "invalid email"})
                    continue
            number = row.get("membership_number") or None
            existing = Member.objects.filter(membership_number=number).first() if number else None
            if not existing and row.get("email"):
                existing = Member.objects.filter(email__iexact=row["email"]).first()
            data = {k: row.get(k, "") for k in ("full_name", "email", "phone", "company")}
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
                if number:
                    existing.membership_number = number
                existing.is_active = True
                existing.save()
                updated += 1
            else:
                Member.objects.create(membership_number=number, **data)
                created += 1
    return Response({"created": created, "updated": updated, "errors": errors})
