# /!\ /!\ /!\ /!\ /!\ /!\ /!\ DISCLAIMER /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\
#
# This Makefile is only meant to be used for DEVELOPMENT purpose as we are
# changing the user id that will run in the container.
#
# PLEASE DO NOT USE IT FOR YOUR CI/PRODUCTION/WHATEVER...
#
# /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\ /!\
#
# Note to developers:
#
# While editing this file, please respect the following statements:
#
# 1. Every variable should be defined in the ad hoc VARIABLES section with a
#    relevant subsection
# 2. Every new rule should be defined in the ad hoc RULES section with a
#    relevant subsection depending on the targeted service
# 3. Rules should be sorted alphabetically within their section
# 4. When a rule has multiple dependencies, you should:
#    - duplicate the rule name to add the help string (if required)
#    - write one dependency per line to increase readability and diffs
# 5. .PHONY rule statement should be written after the corresponding rule
# ==============================================================================
# VARIABLES

BOLD := \033[1m
RESET := \033[0m
GREEN := \033[1;32m


# -- Database

DB_HOST            = postgresql
DB_PORT            = 5432

# -- Docker
# Get the current user ID to use for docker run and docker exec commands
ifeq ($(OS),Windows_NT)
DOCKER_USER         := 0:0     # run containers as root on Windows
else
DOCKER_UID          := $(shell id -u)
DOCKER_GID          := $(shell id -g)
DOCKER_USER         := $(DOCKER_UID):$(DOCKER_GID)
endif
COMPOSE             = DOCKER_USER=$(DOCKER_USER) docker compose
COMPOSE_EXEC        = $(COMPOSE) exec
COMPOSE_EXEC_APP    = $(COMPOSE_EXEC) app-dev
COMPOSE_RUN         = $(COMPOSE) run --rm
COMPOSE_RUN_APP     = $(COMPOSE_RUN) app-dev
COMPOSE_RUN_CROWDIN = $(COMPOSE_RUN) crowdin crowdin

# -- Backend
MANAGE              = $(COMPOSE_RUN_APP) python manage.py
MANAGE_EXEC         = $(COMPOSE_EXEC_APP) python manage.py
PSQL_E2E            = ./bin/postgres_e2e
MAIL_YARN           = $(COMPOSE_RUN) -w //app/src/mail node yarn

# -- Frontend
PATH_FRONT          = ./src/frontend
PATH_FRONT_HUB  = $(PATH_FRONT)/apps/hub
FRONT_YARN          = $(COMPOSE_RUN) -w //app/src/frontend node yarn
FRONT_E2E_YARN      = $(COMPOSE_RUN) -w //app/src/frontend/apps/e2e node yarn
FRONT_HUB_YARN = $(COMPOSE_RUN) -w //app/src/frontend/apps/hub node yarn
FRONT_I18N_YARN     = $(COMPOSE_RUN) -w //app/src/frontend/packages/i18n node yarn
FRONT_DEV_YARN      = $(COMPOSE) run --rm --service-ports -w //app/src/frontend/apps/hub node yarn

# ==============================================================================
# RULES

default: help

data/media:
	@mkdir -p data/media

data/static:
	@mkdir -p data/static

data/postgresql.local:
	@mkdir -p data/postgresql.local

# -- Project

create-env-local-files: ## create env.local files in env.d/development
create-env-local-files: 
	@touch env.d/development/crowdin.local
	@touch env.d/development/common.local
	@touch env.d/development/postgresql.local
	@touch env.d/development/kc_postgresql.local
.PHONY: create-env-local-files

pre-bootstrap: \
	data/media \
	data/static \
	data/postgresql.local \
	create-env-local-files
.PHONY: pre-bootstrap

post-bootstrap: \
	migrate \
	demo \
	back-i18n-compile \
	mails-install \
	mails-build
.PHONY: post-bootstrap

pre-beautiful-bootstrap: ## Display a welcome message before bootstrap
ifeq ($(OS),Windows_NT)
	@echo ""
	@echo "================================================================================"
	@echo ""
	@echo "  Welcome to Hub - The place where La Suite happens!"
	@echo ""
	@echo "  This will set up your development environment with:"
	@echo "  - Docker containers for all services"
	@echo "  - Database migrations and static files"
	@echo "  - Frontend dependencies and build"
	@echo "  - Environment configuration files"
	@echo ""
	@echo "  Services will be available at:"
	@echo "  - Frontend: http://localhost:9800"
	@echo "  - API:      http://localhost:9801"
	@echo "  - Admin:    http://localhost:9801/admin"
	@echo ""
	@echo "================================================================================"
	@echo ""
	@echo "Starting bootstrap process..."
else
	@echo "$(BOLD)"
	@echo "╔══════════════════════════════════════════════════════════════════════════════╗"
	@echo "║                                                                              ║"
	@echo "║  🚀 Welcome to Hub - The place where La Suite happens! 🚀                    ║"
	@echo "║                                                                              ║"
	@echo "║  This will set up your development environment with :                        ║"
	@echo "║  • Docker containers for all services                                        ║"
	@echo "║  • Database migrations and static files                                      ║"
	@echo "║  • Frontend dependencies and build                                           ║"
	@echo "║  • Environment configuration files                                           ║"
	@echo "║                                                                              ║"
	@echo "║  Services will be available at:                                              ║"
	@echo "║  • Frontend: http://localhost:9800                                           ║"
	@echo "║  • API:      http://localhost:9801                                           ║"
	@echo "║  • Admin:    http://localhost:9801/admin                                     ║"
	@echo "║                                                                              ║"
	@echo "╚══════════════════════════════════════════════════════════════════════════════╝"
	@echo "$(RESET)"
	@echo "$(GREEN)Starting bootstrap process...$(RESET)"
endif
	@echo "" 
.PHONY: pre-beautiful-bootstrap

post-beautiful-bootstrap: ## Display a success message after bootstrap
	@echo ""
ifeq ($(OS),Windows_NT)
	@echo "Bootstrap completed successfully!"
	@echo ""
	@echo "Next steps:"
	@echo "  - Visit http://localhost:9800 to access the application"
	@echo "  - Run 'make help' to see all available commands"
else
	@echo "$(GREEN)🎉 Bootstrap completed successfully!$(RESET)"
	@echo ""
	@echo "$(BOLD)Next steps:$(RESET)"
	@echo "  • Visit http://localhost:9800 to access the application"
	@echo "  • Run 'make help' to see all available commands"
endif
	@echo ""
.PHONY: post-beautiful-bootstrap

bootstrap: ## Prepare the project for local development
bootstrap: \
	pre-beautiful-bootstrap \
	pre-bootstrap \
	build \
	post-bootstrap \
	run \
	post-beautiful-bootstrap
.PHONY: bootstrap

bootstrap-e2e: ## Bootstrap the backend container for e2e tests, without frontend
bootstrap-e2e: \
	pre-bootstrap \
	build-backend \
	back-i18n-compile \
	run-backend-e2e
.PHONY: bootstrap-e2e

# -- Docker/compose
build: cache ?=
build: ## build the project containers
	@$(MAKE) build-backend cache=$(cache)
	@$(MAKE) build-frontend cache=$(cache)
.PHONY: build

build-backend: cache ?=
build-backend: ## build the app-dev container
	@$(COMPOSE) build app-dev $(cache)
.PHONY: build-backend

build-frontend: cache ?=
build-frontend: ## build the frontend container
	@$(COMPOSE) build frontend-development $(cache)
.PHONY: build-frontend

down: ## stop and remove containers, networks, images, and volumes
	@$(COMPOSE) down
.PHONY: down

logs: ## display app-dev logs (follow mode)
	@$(COMPOSE) logs -f app-dev
.PHONY: logs

run-backend: ## Start only the backend application and all needed services
	@$(MAKE) stop
	@$(COMPOSE) up --force-recreate -d nginx
.PHONY: run-backend

run-backend-e2e: ## Start the backend with the e2e DB; always reset the postgresql.e2e volume first
	@$(MAKE) stop
	rm -rf data/postgresql.e2e
	@ENV_OVERRIDE=e2e $(MAKE) run-backend
	@ENV_OVERRIDE=e2e $(MAKE) migrate
.PHONY: run-backend-e2e

run: ## start the wsgi (production) and development server
run:
	@$(MAKE) run-backend
	@$(COMPOSE) up --force-recreate -d frontend-development
.PHONY: run

clear-db-e2e: ## quickly clears the e2e database, used by Playwright between tests
	$(PSQL_E2E) -c "$$(cat bin/clear_db_e2e.sql)"
.PHONY: clear-db-e2e

run-tests-e2e: ## run the e2e tests, example: make run-tests-e2e -- --project=chromium --headed
	@$(MAKE) run-backend-e2e
	@args="$(filter-out $@,$(MAKECMDGOALS))" && \
	cd src/frontend/apps/e2e && yarn test $${args:-${1}}
.PHONY: run-tests-e2e

backend-exec-command: ## execute a command in the running backend container, used by Playwright fixtures
	@args="$(filter-out $@,$(MAKECMDGOALS))" && \
	$(MANAGE_EXEC) $${args}
.PHONY: backend-exec-command

status: ## an alias for "docker compose ps"
	@$(COMPOSE) ps
.PHONY: status

stop: ## stop the development server using Docker
	@$(COMPOSE) stop
.PHONY: stop

# -- Backend

demo: ## flush db then create a demo for load testing purpose
	@$(MAKE) resetdb
	@$(MANAGE) create_demo
.PHONY: demo

index: ## index all documents to remote search
	@$(MANAGE) index
.PHONY: index

# Nota bene: Black should come after isort just in case they don't agree...
lint: ## lint back-end python sources
lint: \
  lint-ruff-format \
  lint-ruff-check \
  lint-pylint
.PHONY: lint

lint-ruff-format: ## format back-end python sources with ruff
	@echo 'lint:ruff-format started…'
	@$(COMPOSE_RUN_APP) ruff format .
.PHONY: lint-ruff-format

lint-ruff-check: ## lint back-end python sources with ruff
	@echo 'lint:ruff-check started…'
	@$(COMPOSE_RUN_APP) ruff check . --fix
.PHONY: lint-ruff-check

lint-pylint: ## lint back-end python sources with pylint only on changed files from main
	@echo 'lint:pylint started…'
	bin/pylint --diff-only=origin/main
.PHONY: lint-pylint

test: ## run project tests
	@$(MAKE) test-back-parallel
.PHONY: test

test-back: ## run back-end tests
	@args="$(filter-out $@,$(MAKECMDGOALS))" && \
	bin/pytest $${args:-${1}}
.PHONY: test-back

test-back-parallel: ## run all back-end tests in parallel
	@args="$(filter-out $@,$(MAKECMDGOALS))" && \
	bin/pytest -n auto $${args:-${1}}
.PHONY: test-back-parallel

makemigrations:  ## run django makemigrations for the hub project.
	@echo "$(BOLD)Running makemigrations$(RESET)"
	@$(COMPOSE) up -d postgresql
	@$(MANAGE) makemigrations
.PHONY: makemigrations

migrate:  ## run django migrations for the hub project.
	@echo "$(BOLD)Running migrations$(RESET)"
	@$(COMPOSE) up -d postgresql
	@$(MANAGE) migrate
.PHONY: migrate

superuser: ## Create an admin superuser with password "admin"
	@echo "$(BOLD)Creating a Django superuser$(RESET)"
	@$(MANAGE) createsuperuser --email admin@example.com --password admin
.PHONY: superuser

back-i18n-compile: ## compile the gettext files
	@$(MANAGE) compilemessages --ignore=".venv/**/*"
.PHONY: back-i18n-compile

back-i18n-generate: ## create the .pot files used for i18n
	@$(MANAGE) makemessages -a --keep-pot --all
.PHONY: back-i18n-generate

shell: ## connect to database shell
	@$(MANAGE) shell #_plus
.PHONY: dbshell

# -- Database

dbshell: ## connect to database shell
	docker compose exec app-dev python manage.py dbshell
.PHONY: dbshell

resetdb: FLUSH_ARGS ?=
resetdb: ## flush database and create a superuser "admin"
	@echo "$(BOLD)Flush database$(RESET)"
	@$(MANAGE) flush $(FLUSH_ARGS)
	@${MAKE} superuser
.PHONY: resetdb

crowdin-download: ## Download translated message from crowdin
	@$(COMPOSE_RUN_CROWDIN) download -c crowdin/config.yml
.PHONY: crowdin-download

crowdin-download-sources: ## Download sources from Crowdin
	@$(COMPOSE_RUN_CROWDIN) download sources -c crowdin/config.yml
.PHONY: crowdin-download-sources

crowdin-upload: ## Upload source translations to crowdin
	@$(COMPOSE_RUN_CROWDIN) upload sources -c crowdin/config.yml
.PHONY: crowdin-upload

i18n-compile: ## compile all translations
i18n-compile: \
	back-i18n-compile \
	frontend-i18n-compile
.PHONY: i18n-compile

i18n-generate: ## create the .pot files and extract frontend messages
i18n-generate: \
	back-i18n-generate \
	frontend-i18n-generate
.PHONY: i18n-generate

i18n-download-and-compile: ## download all translated messages and compile them to be used by all applications
i18n-download-and-compile: \
  crowdin-download \
  i18n-compile
.PHONY: i18n-download-and-compile

i18n-generate-and-upload: ## generate source translations for all applications and upload them to Crowdin
i18n-generate-and-upload: \
  i18n-generate \
  crowdin-upload
.PHONY: i18n-generate-and-upload


# -- Mail generator

mails-build: ## Convert mjml files to html and text
	@$(MAIL_YARN) build
.PHONY: mails-build

mails-build-html-to-plain-text: ## Convert html files to text
	@$(MAIL_YARN) build-html-to-plain-text
.PHONY: mails-build-html-to-plain-text

mails-build-mjml-to-html:	## Convert mjml files to html and text
	@$(MAIL_YARN) build-mjml-to-html
.PHONY: mails-build-mjml-to-html

mails-install: ## install the mail generator
	@$(MAIL_YARN) install
.PHONY: mails-install

# -- Misc
clean: ## restore repository state as it was freshly cloned
	git clean -idx
.PHONY: clean

help:
	@echo "$(BOLD)hub Makefile"
	@echo "Please use 'make $(BOLD)target$(RESET)' where $(BOLD)target$(RESET) is one of:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-30s$(RESET) %s\n", $$1, $$2}'
.PHONY: help

# Front
frontend-development-install: ## install the frontend locally
	@$(FRONT_HUB_YARN) install
.PHONY: frontend-development-install

frontend-lint: ## run the frontend linter
	@$(FRONT_YARN) lint
.PHONY: frontend-lint

frontend-lint-fix: ## run the frontend linter with auto-fix option
	@$(FRONT_YARN) lint-fix
.PHONY: frontend-lint-fix

frontend-format: ## run the frontend formatter (prettier --write)
	@$(FRONT_YARN) format
.PHONY: frontend-format

frontend-format-check: ## check the frontend formatting (prettier --check)
	@$(FRONT_YARN) format:check
.PHONY: frontend-format-check

run-frontend-development: ## Run the frontend in development mode
	@$(COMPOSE) stop frontend-development
	@$(FRONT_DEV_YARN) dev
.PHONY: run-frontend-development

frontend-test: ## Run the frontend tests
	@$(FRONT_HUB_YARN) test
.PHONY: frontend-test

frontend-i18n-extract: ## Extract the frontend translation inside a json to be used for crowdin
	@$(FRONT_YARN) i18n:extract
.PHONY: frontend-i18n-extract

frontend-i18n-generate: ## Generate the frontend json files used for crowdin
frontend-i18n-generate: \
	crowdin-download-sources \
	frontend-i18n-extract
.PHONY: frontend-i18n-generate

frontend-i18n-compile: ## Format the crowin json files used deploy to the apps
	@$(FRONT_YARN) i18n:deploy
.PHONY: frontend-i18n-compile

# -- K8S
build-k8s-cluster: ## build the kubernetes cluster using kind
	./bin/start-kind.sh
.PHONY: build-k8s-cluster

start-tilt: ## start the kubernetes cluster using kind
	tilt up -f ./bin/Tiltfile
.PHONY: build-k8s-cluster

bump-packages-version: VERSION_TYPE ?= minor
bump-packages-version: ## bump the version of the project - VERSION_TYPE can be "major", "minor", "patch"
	@$(MAIL_YARN) version --no-git-tag-version --$(VERSION_TYPE)
	@$(FRONT_YARN) version --no-git-tag-version --$(VERSION_TYPE)
	@$(FRONT_E2E_YARN) version --no-git-tag-version --$(VERSION_TYPE)
	@$(FRONT_HUB_YARN) version --no-git-tag-version --$(VERSION_TYPE)
	@$(FRONT_I18N_YARN) version --no-git-tag-version --$(VERSION_TYPE)
.PHONY: bump-packages-version
