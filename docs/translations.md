# Translations

Hub is translated on [Crowdin](https://crowdin.com/project/lasuite-hub)
(project `lasuite-hub`, ID `895176`), with the same setup as
[Docs](https://github.com/suitenumerique/docs). English is the source
language: the code only contains English, every other language comes from
Crowdin.

## How it works

1. A push on `main` runs `.github/workflows/crowdin_upload.yml`. It builds the
   mail templates, extracts the backend messages (`django.pot`) and the
   frontend messages (`translations-crowdin.json`), then uploads both sources
   to Crowdin.
2. Translators work on Crowdin.
3. A push on a `release/**` branch (or a manual run) starts
   `.github/workflows/crowdin_download.yml`. It downloads the translations,
   rebuilds the frontend `translations.json` and opens a pull request named
   `🌐(i18n) update translated strings`.

| File | Content | Committed |
| --- | --- | --- |
| `src/backend/locale/<locale>/LC_MESSAGES/django.po` | Backend translations, from Crowdin | yes |
| `src/backend/locale/django.pot` | Backend source messages, generated | no |
| `*.mo` | Compiled backend translations, built with the Docker image | no |
| `src/frontend/packages/i18n/locales/hub/translations-crowdin.json` | Frontend source messages, extracted | no |
| `src/frontend/packages/i18n/locales/hub/<locale>/translations.json` | Frontend translations downloaded from Crowdin | no |
| `src/frontend/apps/hub/src/i18n/translations.json` | Frontend translations loaded by the app, from Crowdin | yes |

## Rules

### Writing strings

- **Frontend**: wrap every user-facing string with `t()` (or `i18n.t()`
  outside React). The key is the full English sentence, never an identifier
  such as `api.error.unexpected`. Only string literals are extracted: never
  pass a variable or a template literal to `t()`.
- **Interpolation**: `t("Remove {{name}}", { name })`.
- **Plurals**: pass `count` to a single key written in the plural form, and
  let i18next pick the form: `t("{{count}} replies", { count })`. Never choose
  between a singular and a plural key in the code. Translators fill the
  `_one`, `_many` and `_other` forms on Crowdin, the English singular included.
- **Context**: when a short string is ambiguous, add a `description`, shown to
  translators: `t("Open", { description: "Button opening a conversation" })`.
- **Backend**: `from django.utils.translation import gettext_lazy as _`, with
  placeholders filled by `.format()` after `_()`.
- **Mails**: use `{% trans %}` and `{% blocktrans %}` in the MJML templates of
  `src/mail`. Run `make mails-build` before generating the backend messages.

### Never edit by hand

- `translations.json` and the `.po` files come from Crowdin. Fix a translation
  on Crowdin, fix an English text in the code.
- Do not keep translations in the code (local dictionaries, overrides): they
  are lost on the next download.
- Do not commit `.pot`, `.mo`, `src/frontend/packages/i18n/locales/` or the
  built mail templates. They are ignored by git.

### Commits and changelog

- Translation updates use `🌐(i18n) update translated strings` and never go in
  the CHANGELOG.
- Other translation changes use the 🌐 gitmoji.

## Commands

| Command | Effect |
| --- | --- |
| `make i18n-generate` | Generate the backend and frontend source messages |
| `make i18n-generate-and-upload` | Generate the sources and upload them to Crowdin |
| `make i18n-download-and-compile` | Download the translations and compile them for the apps |
| `make i18n-compile` | Compile the `.mo` files and rebuild `translations.json` |
| `make crowdin-upload-translations` | Re-import the committed translations into Crowdin (recovery) |

The Crowdin commands read `env.d/development/crowdin.local`, which is ignored
by git:

```
CROWDIN_PROJECT_ID=895176
CROWDIN_PERSONAL_TOKEN=<your token>
```

Create the token in your Crowdin settings, under "Personal Access Tokens",
with the "Projects" scope. Check the access with
`docker compose run --rm crowdin crowdin status -c crowdin/config.yml`. The
CI uses the repository secrets `CROWDIN_PROJECT_ID` and
`CROWDIN_PERSONAL_TOKEN`.

## Languages

- The backend `LANGUAGES` setting lists the languages offered in the user
  menu, ordered by priority: the first one is the fallback. Override it with
  `DJANGO_LANGUAGES=en-us,English;fr-fr,Français`.
- The interface uses the closest translated language. The choice is saved on
  the user profile, applied again at login, and stored in the `hub_language`
  cookie shared with Django.
- To add a language, ask the maintainers to add it on Crowdin, then add it to
  `LANGUAGES`.

## Recovering translations on Crowdin

If Crowdin loses translations (or starts from an empty project), re-import
the committed ones. It needs the manager role on the Crowdin project.

1. Upload the sources of the current commit: `make i18n-generate-and-upload`.
2. Check what would be sent:
   `make crowdin-upload-translations CROWDIN_ARGS=--dryrun`.
3. Import: `make crowdin-upload-translations`.
4. Check nothing was lost: remove the previous downloads
   (`rm -rf src/frontend/packages/i18n/locales/hub/*/`), run
   `make i18n-download-and-compile`, then
   `git diff src/frontend/apps/hub/src/i18n/translations.json`.

Only the languages that are targets of the Crowdin project are imported.
