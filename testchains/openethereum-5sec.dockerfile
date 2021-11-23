FROM openethereum/openethereum:v3.3.0-rc.4

USER root

RUN apk update && apk add bash jq nodejs npm
RUN npm -v
RUN node -v

# Should be "native" (default) or "token".
ARG CHAIN_TYPE=native

# Should be "migrate.sh" (default) or "migrate-all.sh".
ARG MIGRATION_FILENAME=migrate.sh

RUN mkdir /iexec-poco
COPY . /iexec-poco
RUN mv /iexec-poco/config/config_${CHAIN_TYPE}.json /iexec-poco/config/config.json

ARG DEV_NODE
ARG MNEMONIC

RUN bash /iexec-poco/testchains/openethereum/1sec/${MIGRATION_FILENAME}

ENTRYPOINT ["/home/openethereum/openethereum"]
CMD [ \
        "--chain", "/iexec-poco/testchains/openethereum/1sec/spec.json", \
        "--config", "/iexec-poco/testchains/openethereum/1sec/authority.toml", \
        "-d", "/iexec-poco/testchains/openethereum/1sec/data" \
    ]
