#!/usr/bin/env bash

# `realpath` is not POSIX so using `pwd` for maximum compatibility.
# More info here : https://stackoverflow.com/a/4774063
BASE_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)

if ! docker image ls | grep readme-generator-for-helm; then
  git clone https://github.com/bitnami/readme-generator-for-helm.git /tmp/readme-generator-for-helm
  cd /tmp/readme-generator-for-helm || exit
  docker build -t readme-generator-for-helm:latest .
fi
cd "$BASE_DIR" || exit
docker run --rm -it -v .:/source -w /source readme-generator-for-helm:latest readme-generator -v values.yaml -r README.md
