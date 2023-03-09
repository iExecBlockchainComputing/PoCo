###
## docker image build \
##      --file testchains/nethermind.dockerfile \
##      --tag nexus.iex.ec/poco-chain:native-vX.Y.Z-alpha \
##      --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" \
##      --build-arg CHAIN_TYPE=native \
##      --build-arg CHAIN_BLOCK_TIME=5 \
##      --build-arg CHAIN_FORCE_SEALING=true \
##      .
###

FROM iexechub/nethermind:1.14.1-patch.0

USER root
RUN apt-get update && apt-get install bash jq nodejs npm -y
# Add git required to install ethereumjs-abi from github (https://github.com/MetaMask/web3-provider-engine/issues/345)
#
# ├─┬ @truffle/hdwallet-provider@2.0.7
#   └─┬ web3-provider-engine@16.0.3
#     └─┬ eth-json-rpc-middleware@6.0.0
#       └─┬ eth-sig-util@1.4.2
#         └── ethereumjs-abi@0.6.8  (git+https://github.com/ethereumjs/ethereumjs-abi.git#ee3994657fa7a427238e6ba92a84d0b529bbcde0)
RUN apt-get install git -y
RUN echo -e "Node: `node -v` - npm: `npm -v`"

###
## Get build configuration.
###
# Type of the blockchain to build.
# "native" or "token".
ARG CHAIN_TYPE=native
RUN echo "CHAIN_TYPE: ${CHAIN_TYPE}"
# New blocks creation interval in seconds.
# "1", "5", "20", ...
ARG CHAIN_BLOCK_TIME=5
RUN echo "CHAIN_BLOCK_TIME: ${CHAIN_BLOCK_TIME}"
# Always create new blocks (even without txs).
# "true" or "false"
ARG CHAIN_FORCE_SEALING=true
RUN echo "CHAIN_FORCE_SEALING: ${CHAIN_FORCE_SEALING}"

###
## Copy files and setup the chain config.
###
ENV BASE_DIR="/iexec-poco/testchains/nethermind"
RUN mkdir /iexec-poco
COPY . /iexec-poco
COPY ./testchains/nethermind/keystore/key-c08c3def622af1476f2db0e3cc8ccaead07be3bb /nethermind/keystore/
RUN mv /iexec-poco/config/config_${CHAIN_TYPE}.json /iexec-poco/config/config.json
RUN sed -i "s/@stepDuration@/${CHAIN_BLOCK_TIME}/" ${BASE_DIR}/spec.json
# remove eip1559 for sidechains
RUN if [ "${CHAIN_TYPE}" = "native" ] ; \
    then \
        sed -i "/eip1559/d" ${BASE_DIR}/spec.json; \
    fi

###
## Run migration
###
ARG DEV_NODE
ARG MNEMONIC
RUN echo "MNEMONIC: ${MNEMONIC}"
# Choose migration file according to chain type.
# native -> migrate.sh
# token -> migrate-all.sh
RUN if [ "${CHAIN_TYPE}" = "native" ] ; \
    then \
        echo "Migration file: ${BASE_DIR}/migrate.sh"; \
        bash ${BASE_DIR}/migrate.sh; \
    else \
        echo "Migration file: ${BASE_DIR}/migrate-all.sh"; \
        bash ${BASE_DIR}/migrate-all.sh; \
    fi

# ###
## Configure entrypoint
###
ENTRYPOINT [ "../../nethermind/Nethermind.Runner" ]
CMD [ "--config=/iexec-poco/testchains/nethermind/authority.cfg" ]