from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases import (
    SentryAppInstallationExternalIssueBaseEndpoint as ExternalIssueBaseEndpoint,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import URLField
from sentry.mediators.external_issues import Creator
from sentry.models import Group, Project


class PlatformExternalIssueSerializer(serializers.Serializer):
    webUrl = URLField()
    project = serializers.CharField()
    identifier = serializers.CharField()


@control_silo_endpoint
class SentryAppInstallationExternalIssuesEndpoint(ExternalIssueBaseEndpoint):
    def post(self, request: Request, installation) -> Response:
        data = request.data

        try:
            group = Group.objects.get(
                id=data.get("issueId"),
                project_id__in=Project.objects.filter(organization_id=installation.organization_id),
            )
        except Group.DoesNotExist:
            return Response(status=404)

        serializer = PlatformExternalIssueSerializer(data=request.data)
        if serializer.is_valid():
            external_issue = Creator.run(
                install=installation,
                group=group,
                web_url=data["webUrl"],
                project=data["project"],
                identifier=data["identifier"],
            )
            return Response(serialize(external_issue))

        return Response(serializer.errors, status=400)
