FROM openethereum/openethereum:v3.3.0-rc.4

USER root

RUN apk update && apk add bash jq nodejs npm
RUN npm -v
RUN node -v

###
## Read user configuration options
###

# "native" or "token".
ARG CHAIN_TYPE=

# "migrate.sh" or "migrate-all.sh".
ARG MIGRATION_FILENAME=migrate.sh

# "1sec", "1sec_no_seal", "5sec", "20sec"
ARG CHAIN_CONFIG_FOLDER_NAME=1sec

###
## Copy config file
###

RUN mkdir /iexec-poco
COPY . /iexec-poco
RUN mv /iexec-poco/config/config_${CHAIN_TYPE}.json /iexec-poco/config/config.json

###
## Setup config folder path env variable
###

ENV CHAIN_CONFIG_FOLDER_PATH="/iexec-poco/testchains/openethereum/${CHAIN_CONFIG_FOLDER_NAME}"

###
## Run migration
###

ARG DEV_NODE
ARG MNEMONIC

# e.g. /iexec-poco/testchains/openethereum/1sec/migrate.sh
RUN bash ${CHAIN_CONFIG_FOLDER_PATH}/${MIGRATION_FILENAME}

###
## Configure entrypoint
###

ENTRYPOINT ["/home/openethereum/openethereum"]
CMD [ \
        "--chain", "${CHAIN_CONFIG_FOLDER_PATH}/spec.json", \
        "--config", "${CHAIN_CONFIG_FOLDER_PATH}/authority.toml", \
        "-d", "${CHAIN_CONFIG_FOLDER_PATH}/data" \
    ]
