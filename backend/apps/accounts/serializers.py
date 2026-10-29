from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class OTPSerializer(serializers.Serializer):
    mfa_token = serializers.CharField()
    code = serializers.CharField(max_length=10)


class CodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=10)


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "password", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_email(self, value):
        return value.lower()

    def create(self, validated):
        pw = validated.pop("password", None)
        if not pw:
            raise serializers.ValidationError({"password": "Required."})
        return User.objects.create_user(password=pw, **validated)

    def update(self, instance, validated):
        pw = validated.pop("password", None)
        for k, v in validated.items():
            setattr(instance, k, v)
        if pw:
            instance.set_password(pw)
        instance.save()
        return instance


class MeSerializer(serializers.ModelSerializer):
    otp_enrolled = serializers.SerializerMethodField()
    kiosk = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "otp_enrolled", "kiosk"]

    def get_otp_enrolled(self, user):
        from django_otp.plugins.otp_totp.models import TOTPDevice
        return TOTPDevice.objects.filter(user=user, confirmed=True).exists()

    def get_kiosk(self, user):
        p = getattr(user, "kiosk_profile", None)
        return {"label": p.label, "room": p.room_id} if p else None
