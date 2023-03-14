###
## docker image build \
##      --file testchains/nethermind.dockerfile \
##      --tag nexus.intra.iex.ec/poco-chain:native-vX.Y.Z-alpha.0-5s \
##      --build-arg MNEMONIC="actual surround disorder swim upgrade devote digital misery truly verb slide final" \
##      --build-arg CHAIN_TYPE=native \
##      --build-arg CHAIN_BLOCK_TIME=5 \
##      --build-arg CHAIN_FORCE_SEALING=true \
##      .
###

FROM iexechub/nethermind:1.14.1-patch.0 AS builder

RUN apt-get update && apt-get -y install bash jq nodejs npm git
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
## Install npm packages
###
WORKDIR /iexec-poco
COPY package.json package-lock.json ./
# Remove ethereumjs-util for sidechains
RUN if [ "${CHAIN_TYPE}" = "native" ] ; \
    then \
        sed -i '/ethereumjs-util/d' package.json; \
    fi
RUN npm ci --production=false

###
## Copy chain config.
###
COPY testchains/nethermind/poco-chain.json /nethermind/chainspec/poco-chain.json
COPY testchains/nethermind/poco-chain.cfg /nethermind/configs/poco-chain.cfg
COPY testchains/nethermind/keystore /nethermind/keystore
RUN sed -i "s/@stepDuration@/${CHAIN_BLOCK_TIME}/" /nethermind/chainspec/poco-chain.json
RUN sed -i "s/@forceSealing@/${CHAIN_FORCE_SEALING}/" /nethermind/configs/poco-chain.cfg
# Remove eip1559 for sidechains
RUN if [ "${CHAIN_TYPE}" = "native" ] ; \
    then \
        sed -i "/eip1559/d" /nethermind/chainspec/poco-chain.json; \
    fi

###
## Copy PoCo contracts
###
COPY config config
COPY contracts contracts
COPY migrations migrations
COPY scripts scripts
COPY utils utils
COPY truffle-security.json truffle-security.json
COPY truffle.js truffle.js
COPY testchains/nethermind/migrate-all.sh migrate-all.sh
COPY testchains/nethermind/migrate.sh migrate.sh
RUN mv config/config_${CHAIN_TYPE}.json config/config.json

###
## Deploy contracts
###
ARG DEV_NODE
ARG MNEMONIC
RUN echo "MNEMONIC: ${MNEMONIC}"
# Choose migration file according to chain type.
# native -> migrate.sh
# token -> migrate-all.sh
RUN if [ "${CHAIN_TYPE}" = "native" ] ; \
    then \
        echo "Migration file: migrate.sh"; \
        bash migrate.sh; \
    else \
        echo "Migration file: migrate-all.sh"; \
        bash migrate-all.sh; \
    fi

FROM iexechub/nethermind:1.14.1-patch.0

COPY --from=builder /nethermind /nethermind

###
## Configure entrypoint
###
ENTRYPOINT [ "/nethermind/Nethermind.Runner" ]
CMD [ "--config=/nethermind/configs/poco-chain.cfg" ]
