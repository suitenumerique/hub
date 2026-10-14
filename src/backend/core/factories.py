"""
Core application factories
"""

from django.conf import settings
from django.contrib.auth.hashers import make_password

import factory.fuzzy
from faker import Faker

from core import models

fake = Faker()


class UserFactory(factory.django.DjangoModelFactory):
    """A factory to random users for testing purposes."""

    class Meta:
        model = models.User
        # Skip postgeneration save, no save is made in the postgeneration methods.
        skip_postgeneration_save = True

    sub = factory.Sequence(lambda n: f"user{n!s}")
    email = factory.Faker("email")
    full_name = factory.Faker("name")
    short_name = factory.Faker("first_name")
    language = factory.fuzzy.FuzzyChoice([lang[0] for lang in settings.LANGUAGES])
    password = make_password("password")


class MeetRoomFactory(factory.django.DjangoModelFactory):
    """A factory to create the Visio room of a conversation."""

    class Meta:
        model = models.MeetRoom

    chat_service_id = factory.Sequence(lambda n: f"!room{n!s}:matrix.test")
    meet_room_id = factory.Faker("uuid4")
    url = factory.Sequence(lambda n: f"https://visio.test/room-{n!s}")
    created_by = factory.SubFactory(UserFactory)


class CallFactory(factory.django.DjangoModelFactory):
    """A factory to create calls."""

    class Meta:
        model = models.Call

    room = factory.SubFactory(MeetRoomFactory)
    started_by = factory.SubFactory(UserFactory)
