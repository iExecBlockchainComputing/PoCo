FROM parity/parity:v2.5.8-stable AS builder
USER root

ARG BLOCK_CREATION_TIME=2

# install deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates\
        curl \
        git \
        jq \
        python3-pip \
        python-pip \
        && \
    apt-get clean

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash && \
    export NVM_DIR="$HOME/.nvm" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    nvm install 10

# setup chain config
RUN mkdir -p /parity/data/keys/poco-chain
COPY ./docker/node.key  /parity/data/keys/poco-chain/node.key
COPY ./docker/node.pwd  /parity/node.pwd
COPY ./docker/node.toml /parity/node.toml
COPY ./docker/spec.json /parity/spec.json

# start chain and deploy poco
COPY . /poco
RUN bash /poco/docker/migrate.sh ${BLOCK_CREATION_TIME}
# 833 M

FROM parity/parity:v2.5.8-stable
USER root

COPY --from=builder /parity       /iexec-poco
COPY --from=builder /deploy.log   /iexec-poco/deploy.log

WORKDIR /iexec-poco
ENTRYPOINT /bin/parity --config=node.toml --geth
