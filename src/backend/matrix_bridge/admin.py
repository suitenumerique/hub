"""Support visibility for Hub groups and successful AS transactions."""

from django.contrib import admin

from matrix_bridge import models

for model in (
    models.Group,
    models.GroupMatrixRoom,
    models.MatrixAccountBinding,
    models.GroupMembership,
    models.AppServiceTransaction,
):
    admin.site.register(model)
