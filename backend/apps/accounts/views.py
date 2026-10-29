from django.contrib.auth import authenticate
from django.core import signing
from django.shortcuts import get_object_or_404
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import ActivityLog, log_activity
from apps.core.throttles import LoginThrottle, OTPThrottle
from apps.core.utils import apply_filters, apply_search
from .models import User
from .permissions import IsAdminRole
from .serializers import CodeSerializer, LoginSerializer, MeSerializer, OTPSerializer, UserSerializer
from .tokens import issue_tokens

MFA_SALT = "capitalclub.mfa"


def _confirmed_device(user):
    return TOTPDevice.objects.filter(user=user, confirmed=True).first()


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login(request):
    """Step 1 for everyone. Admins with TOTP enrolled must finish with /login/otp/."""
    s = LoginSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = authenticate(request, email=s.validated_data["email"].lower(), password=s.validated_data["password"])
    if not user:
        log_activity(ActivityLog.Action.LOGIN_FAILED, email=s.validated_data["email"])
        return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

    if user.role == User.Role.ADMIN:
        if _confirmed_device(user):
            return Response({"mfa_required": True, "mfa_token": signing.dumps({"uid": user.pk}, salt=MFA_SALT)})
        # Admin without 2FA: token only works for the 2FA setup endpoints until enrolled.
        return Response({**issue_tokens(user, otp_verified=False), "mfa_setup_required": True,
                         "user": MeSerializer(user).data})
    log_activity(ActivityLog.Action.LOGIN, user=user)
    return Response({**issue_tokens(user), "user": MeSerializer(user).data})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([OTPThrottle])
def login_otp(request):
    s = OTPSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    try:
        uid = signing.loads(s.validated_data["mfa_token"], salt=MFA_SALT, max_age=300)["uid"]
    except signing.BadSignature:
        return Response({"detail": "Login expired. Start again."}, status=status.HTTP_401_UNAUTHORIZED)
    user = User.objects.filter(pk=uid, is_active=True, role=User.Role.ADMIN).first()
    device = _confirmed_device(user) if user else None
    if not device or not device.verify_token(s.validated_data["code"]):
        log_activity(ActivityLog.Action.LOGIN_FAILED, user=user, step="otp")
        return Response({"detail": "Invalid code."}, status=status.HTTP_401_UNAUTHORIZED)
    log_activity(ActivityLog.Action.LOGIN, user=user, otp=True)
    return Response({**issue_tokens(user, otp_verified=True), "user": MeSerializer(user).data})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh(request):
    s = TokenRefreshSerializer(data=request.data)
    try:
        s.is_valid(raise_exception=True)
    except TokenError as e:
        raise InvalidToken(e.args[0])
    return Response(s.validated_data)


@api_view(["POST"])
def logout(request):
    try:
        RefreshToken(request.data.get("refresh")).blacklist()
    except TokenError:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(["POST"])
def two_factor_setup(request):
    """Admin only (any admin token): creates an unconfirmed TOTP device; returns otpauth URL for the QR code."""
    if request.user.role != User.Role.ADMIN:
        return Response(status=status.HTTP_403_FORBIDDEN)
    if _confirmed_device(request.user):
        return Response({"detail": "2FA already enabled."}, status=status.HTTP_409_CONFLICT)
    TOTPDevice.objects.filter(user=request.user, confirmed=False).delete()
    device = TOTPDevice.objects.create(user=request.user, name="default", confirmed=False)
    return Response({"config_url": device.config_url})


@api_view(["POST"])
def two_factor_confirm(request):
    if request.user.role != User.Role.ADMIN:
        return Response(status=status.HTTP_403_FORBIDDEN)
    s = CodeSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    device = TOTPDevice.objects.filter(user=request.user, confirmed=False).first()
    if not device or not device.verify_token(s.validated_data["code"]):
        return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)
    device.confirmed = True
    device.save()
    return Response({**issue_tokens(request.user, otp_verified=True), "user": MeSerializer(request.user).data})


@api_view(["GET", "POST"])
@permission_classes([IsAdminRole])
def users_list(request):
    """Admin: list / create admins and coordinators. Filters: ?role= &is_active= &search="""
    if request.method == "GET":
        qs = apply_filters(User.objects.all(), request, {"role": "role", "is_active": "is_active"})
        qs = apply_search(qs, request, ["email", "full_name"])
        return Response(UserSerializer(qs, many=True).data)
    s = UserSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAdminRole])
def user_detail(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == "GET":
        return Response(UserSerializer(user).data)
    if request.method == "DELETE":
        user.is_active = False          # soft-delete keeps audit history intact
        user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
    s = UserSerializer(user, data=request.data, partial=(request.method == "PATCH"))
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)
