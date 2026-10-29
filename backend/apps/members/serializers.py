from rest_framework import serializers
from .models import Member


class MemberSerializer(serializers.ModelSerializer):
    membership_number = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=40)

    class Meta:
        model = Member
        fields = ["id", "membership_number", "full_name", "email", "phone", "company", "is_active"]

    def validate_membership_number(self, value):
        return value or None   # blank -> NULL so the unique constraint ignores it


class CSVUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
