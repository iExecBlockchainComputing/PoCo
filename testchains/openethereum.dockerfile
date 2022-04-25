###
## docker image build \
##      --file testchains/openethereum.dockerfile \
##      --tag nexus.iex.ec/poco-chain:native-vX.Y.Z-some-fork.0 \
##      --build-arg CHAIN_TYPE=native \
##      --build-arg CHAIN_BLOCK_TIME=1 \
##      --build-arg CHAIN_FORCE_SEALING=true \
##      .
###

FROM openethereum/openethereum:v3.3.0

USER root
RUN apk update && apk add bash jq nodejs npm
# Add git required to install ethereumjs-abi from github (https://github.com/MetaMask/web3-provider-engine/issues/345)
#
# ├─┬ @truffle/hdwallet-provider@2.0.7
#   └─┬ web3-provider-engine@16.0.3
#     └─┬ eth-json-rpc-middleware@6.0.0
#       └─┬ eth-sig-util@1.4.2
#         └── ethereumjs-abi@0.6.8  (git+https://github.com/ethereumjs/ethereumjs-abi.git#ee3994657fa7a427238e6ba92a84d0b529bbcde0)
RUN apk add git
RUN echo -e "Node: `node -v` - npm: `npm -v`"

###
## Get build configuration.
###
# Type of the blockchain to build.
# "native" or "token".
ARG CHAIN_TYPE
# New blocks creating interval in seconds.
# "1", "5", "20", ...
ARG CHAIN_BLOCK_TIME
# Always create new blocks (even without txs).
# "true" or "false"
ARG CHAIN_FORCE_SEALING=true

###
## Log build configuration.
###
ENV MESSAGE="\n##########\n"
ENV MESSAGE="${MESSAGE}### CHAIN_TYPE: ${CHAIN_TYPE} \n"
ENV MESSAGE="${MESSAGE}### CHAIN_BLOCK_TIME: ${CHAIN_BLOCK_TIME} \n"
ENV MESSAGE="${MESSAGE}### CHAIN_FORCE_SEALING: ${CHAIN_FORCE_SEALING} \n"
ENV MESSAGE="${MESSAGE}########## \n"
RUN echo -e ${MESSAGE}

###
## Copy files and setup the chain config.
###
ENV BASE_DIR="/iexec-poco/testchains/openethereum"
RUN mkdir /iexec-poco
COPY . /iexec-poco
RUN mv /iexec-poco/config/config_${CHAIN_TYPE}.json /iexec-poco/config/config.json
RUN sed -i "s/@stepDuration@/${CHAIN_BLOCK_TIME}/" ${BASE_DIR}/spec.json
RUN sed -i "s/@force_sealing@/${CHAIN_FORCE_SEALING}/" ${BASE_DIR}/authority.toml

###
## Run migration
###
ARG DEV_NODE
ARG MNEMONIC
RUN echo "MNEMONIC: ${MNEMONIC}"
# Choose migration file according to chain type.
# native -> migrate.sh
# token -> migrate-all.sh
RUN if [[ "${CHAIN_TYPE}" == "native" ]] ; \
    then \
        echo "Migration file: ${BASE_DIR}/migrate.sh"; \
        bash ${BASE_DIR}/migrate.sh; \
    else \
        echo "Migration file: ${BASE_DIR}/migrate-all.sh"; \
        bash ${BASE_DIR}/migrate-all.sh; \
    fi

###
## Configure entrypoint
###
ENTRYPOINT ["sh"]
CMD [ \
        "-c", \
        "/home/openethereum/openethereum \
            --chain ${BASE_DIR}/spec.json \
            --config ${BASE_DIR}/authority.toml \
            --base-path ${BASE_DIR}/chain-data" \
    ]
