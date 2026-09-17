"""
Core application factories
"""

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.utils import timezone

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


class MeetingFactory(factory.django.DjangoModelFactory):
    """A Meet room created by the Hub for a user."""

    class Meta:
        model = models.Meeting

    slug = factory.Sequence(lambda n: f"abc-defg-{n:03d}")
    livekit_room = factory.Faker("uuid4")
    organizer = factory.SubFactory(UserFactory)


class MeetingTranscriptSegmentFactory(factory.django.DjangoModelFactory):
    """A sentence of a meeting's live transcript."""

    class Meta:
        model = models.MeetingTranscriptSegment

    meeting = factory.SubFactory(MeetingFactory)
    segment_id = factory.Sequence(lambda n: f"SG_{n}")
    speaker_identity = factory.Faker("uuid4")
    speaker_name = factory.Faker("name")
    text = factory.Faker("sentence")
    spoken_at = factory.LazyFunction(timezone.now)


class MeetingAttachmentFactory(factory.django.DjangoModelFactory):
    """A text file attached to a meeting."""

    class Meta:
        model = models.MeetingAttachment

    meeting = factory.SubFactory(MeetingFactory)
    name = factory.Sequence(lambda n: f"document-{n}.md")
    content = factory.Faker("paragraph")


class MeetingParticipantFactory(factory.django.DjangoModelFactory):
    """Someone seen in a meeting's call."""

    class Meta:
        model = models.MeetingParticipant

    meeting = factory.SubFactory(MeetingFactory)
    identity = factory.Faker("uuid4")
    name = factory.Faker("name")
    first_seen_at = factory.LazyFunction(timezone.now)
    last_seen_at = factory.LazyFunction(timezone.now)


class MeetingChatMessageFactory(factory.django.DjangoModelFactory):
    """A message of a meeting's call chat."""

    class Meta:
        model = models.MeetingChatMessage

    meeting = factory.SubFactory(MeetingFactory)
    message_id = factory.Sequence(lambda n: f"MSG_{n}")
    sender_identity = factory.Faker("uuid4")
    sender_name = factory.Faker("name")
    text = factory.Faker("sentence")
    sent_at = factory.LazyFunction(timezone.now)
