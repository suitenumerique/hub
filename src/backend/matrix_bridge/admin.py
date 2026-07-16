"""Support visibility for Hub groups and successful AS transactions."""

from django.contrib import admin

from matrix_bridge import models

for model in (
    models.Group,
    models.GroupRoom,
    models.MatrixAccountBinding,
    models.GroupMember,
    models.AppServiceTransaction,
):
    admin.site.register(model)
