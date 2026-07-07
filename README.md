# Hub

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Django](https://img.shields.io/badge/django-%23092E20.svg?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Next JS](https://img.shields.io/badge/Next-black?logo=next.js&logoColor=white)](https://nextjs.org/)

## Not ready for production yet 🚧

## Getting started 🔧

### Run Hub locally

> ⚠️ The methods described below for running Hub locally is **for testing purposes only**.

**Prerequisite**

Make sure you have a recent version of Docker and [Docker Compose](https://docs.docker.com/compose/install) installed on your laptop, then type:

```shellscript
$ docker -v

Docker version 20.10.2, build 2291f61

$ docker compose version

Docker Compose version v2.32.4
```

> ⚠️ You may need to run the following commands with `sudo`, but this can be avoided by adding your user to the local `docker` group.

**Project bootstrap**

The easiest way to start working on the project is to use [GNU Make](https://www.gnu.org/software/make/):

```shellscript
$ make bootstrap FLUSH_ARGS='--no-input'
```

This command builds the `app-dev` and `frontend-dev` containers, installs dependencies, performs database migrations and compiles translations. It's a good idea to use this command each time you are pulling code from the project repository to avoid dependency-related or migration-related issues.

Your Docker services should now be up and running 🎉

You can access the project by going to <http://localhost:9800>.

You will be prompted to log in. The default credentials are:

```
username: hub
password: hub
```

📝 Note that if you need to run them afterwards, you can use the eponymous Make rule:

```shellscript
$ make run
```

⚠️ For the frontend developer, it is often better to run the frontend in development mode locally.

To do so, install the frontend dependencies with the following command:

```shellscript
$ make frontend-development-install
```

And run the frontend locally in development mode with the following command:

```shellscript
$ make run-frontend-development
```

To start all the services, except the frontend container, you can use the following command:

```shellscript
$ make run-backend
```

To execute frontend tests & linting only
```shellscript
$ make frontend-test
$ make frontend-lint
```

**Adding content**

You can create a basic demo site by running this command:

```shellscript
$ make demo
```

Finally, you can check all available Make rules using this command:

```shellscript
$ make help
```

**Django admin**

You can access the Django admin site at:

<http://localhost:9801/admin>.

You first need to create a superuser account:

```shellscript
$ make superuser
```

### Development Services

When running the project, the following services are available:

| Service         | URL / Port                                              | Description              | Credentials                   |
|-----------------|---------------------------------------------------------|--------------------------|-------------------------------|
| **Frontend**    | [http://localhost:9800](http://localhost:9800)          | Main Hub frontend        | `hub@hub.world` / `hub`       |
| **Backend API** | [http://localhost:9801](http://localhost:9801)          | Django                   | `admin@admin.local` / `admin` |
| **Keycloak**    | [http://localhost:9802](http://localhost:9802)          | Identity provider admin  | `admin` / `admin`             |
| **Nginx**       | [http://localhost:9803](http://localhost:9803)          | Nginx                    | No auth required              |
| **Mailcatcher** | [http://localhost:9804](http://localhost:9804)          | Email testing interface  | No auth required              |
| **PostgreSQL**  | 9812                                                    | Database server          | `user` / `pass`               |
| **Redis**       | 9813                                                    | Cache and message broker | No auth required              |
| **MinIO**       | 9805 and [http://localhost:9806](http://localhost:9806) | Local S3 storage         | No auth required              |

The **dev-only Matrix stack** is started separately with `make run-matrix` and adds:

| Service       | URL / Port                                     | Description                      | Credentials            |
|---------------|------------------------------------------------|----------------------------------|------------------------|
| **Element**   | [http://localhost:9807](http://localhost:9807) | Element Web (Matrix test client) | realm user, e.g. `hub` |
| **Synapse**   | [http://localhost:9808](http://localhost:9808) | Matrix homeserver                | No direct auth         |
| **MAS**       | [http://localhost:9810](http://localhost:9810) | Matrix Authentication Service    | Delegates to Keycloak  |

### Local Matrix stack (dev only)

A self-contained, dev-only Matrix stack - Synapse, Matrix Authentication Service
(MAS) and Element Web - lets developers work against a real local homeserver
without depending on Tchap. MAS delegates authentication to the project Keycloak
realm (`hub`).

Dev-only warning: the stack ships obviously-fake committed secrets, generates
its private signing keys locally under the git-ignored `data/matrix/`, and
allows OIDC client registration over `http://localhost`; it must never be
deployed.

It is an isolated Compose overlay (`compose.matrix.yml`). The normal stack
(`make run`, `make run-backend`, `make stop`) never starts or stops Matrix
services.

```shellscript
# Bring it up beside the backend stack (nginx + Keycloak included):
$ make run-matrix

# Stop or remove only the Matrix stack:
$ make stop-matrix
$ make down-matrix
```

## License 📝

This work is released under the MIT License (see [LICENSE](https://github.com/suitenumerique/docs/blob/main/LICENSE)).

While Hub is a public-driven initiative, our license choice is an invitation for private sector actors to use, sell and contribute to the project.

## Contributing 🙌

You can help us with translations on [Crowdin](https://crowdin.com/project/lasuite-hub).

If you intend to make pull requests, see [CONTRIBUTING](https://github.com/suitenumerique/hub/blob/main/CONTRIBUTING.md) for guidelines.

## Directory structure:

```markdown
docs
├── bin - executable scripts or binaries that are used for various tasks, such as setup scripts, utility scripts, or custom commands.
├── crowdin - for crowdin translations, a tool or service that helps manage translations for the project.
├── docker - Dockerfiles and related configuration files used to build Docker images for the project. These images can be used for development, testing, or production environments.
├── docs - documentation for the project, including user guides, API documentation, and other helpful resources.
├── env.d/development - environment-specific configuration files for the development environment. These files might include environment variables, configuration settings, or other setup files needed for development.
├── gitlint - configuration files for `gitlint`, a tool that enforces commit message guidelines to ensure consistency and quality in commit messages.
├── playground - experimental or temporary code, where developers can test new features or ideas without affecting the main codebase.
└── src - main source code directory, containing the core application code, libraries, and modules of the project.
```

## Credits ❤️

### Stack

Hub is built on top of:

 - [Django Rest Framework](https://www.django-rest-framework.org/)
 - [Next.js](https://nextjs.org/)
 - and many other open source libraries and tools.

We thank the contributors of these projects for their awesome work!

### Gov ❤️ open source

<p align="center">
  <img src="/docs/assets/europe_opensource.png" width="50%"/>
</p>
