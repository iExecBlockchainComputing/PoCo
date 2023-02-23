###
## docker image build \
##      --file testchains/nethermind.dockerfile \
##      --tag nexus.iex.ec/poco-chain:native-vX.Y.Z-some-fork.0 \
##      --build-arg CHAIN_TYPE=native \
##      --build-arg CHAIN_BLOCK_TIME=1 \
##      --build-arg CHAIN_FORCE_SEALING=true \
##      .
###
FROM iexechub/nethermind:1.14.1-patch.0-test

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
ARG CHAIN_TYPE
# New blocks creating interval in seconds.
# "1", "5", "20", ...
ARG CHAIN_BLOCK_TIME
# Always create new blocks (even without txs).
# "true" or "false"

###
## Log build configuration.
###
ENV MESSAGE="\n##########\n"
ENV MESSAGE="${MESSAGE}### CHAIN_TYPE: ${CHAIN_TYPE} \n"
ENV MESSAGE="${MESSAGE}### CHAIN_BLOCK_TIME: ${CHAIN_BLOCK_TIME} \n"
ENV MESSAGE="${MESSAGE}########## \n"
RUN echo -e ${MESSAGE}

###
## Copy files and setup the chain config.
###
ENV BASE_DIR="/iexec-poco/testchains/nethermind"

ENV NETHERMIND_SYNCCONFIG_FASTSYNC=true
ENV NETHERMIND_SYNCCONFIG_SNAPSYNC=true
ENV NETHERMIND_SYNCCONFIG_USEGETHLIMITSINFASTBLOCKS=true
ENV NETHERMIND_SYNCCONFIG_WITNESSPROTOCOLENABLED=true



# Init
ENV NETHERMIND_INITCONFIG_CHAINSPECPATH=/iexec-poco/testchains/nethermind/spec.json
ENV NETHERMIND_INITCONFIG_ISMINING=true
ENV NETHERMIND_INITCONFIG_STORERECEIPTS=true
ENV NETHERMIND_INITCONFIG_GENESISHASH=0x74fab4898a9ca96a5f2a1845d77850b4107057c7be2b8f1fc499775f7db20587

# Mining
ENV NETHERMIND_MININGCONFIG_MINGASPRICE=0

# JsonRpc
ENV NETHERMIND_JSONRPCCONFIG_ENABLED=true
ENV NETHERMIND_JSONRPCCONFIG_ENABLEDMODULES=Eth,Subscribe,TxPool,Web3,Proof,Net,Parity,Health
ENV NETHERMIND_JSONRPCCONFIG_HOST=0.0.0.0
ENV NETHERMIND_JSONRPCCONFIG_PORT=8545

# Aura
ENV NETHERMIND_AURACONFIG_FORCESEALING=true
ENV NETHERMIND_AURACONFIG_ALLOWAURAPRIVATECHAINS=true


# KeyStore
ENV NETHERMIND_KEYSTORECONFIG_PASSWORDS=["cLYaO6/petgU0NqdvQo6i6bBWDM7SzZw"]
ENV NETHERMIND_KEYSTORECONFIG_UNLOCKACCOUNTS=["0xc08c3def622af1476f2db0e3cc8ccaead07be3bb"]
ENV NETHERMIND_KEYSTORECONFIG_BLOCKAUTHORACCOUNT=0xc08c3def622af1476f2db0e3cc8ccaead07be3bb
ENV NETHERMIND_KEYSTORECONFIG_PASSWORDFILES=${BASE_DIR}/keystore/validator-wallet-password
ENV NETHERMIND_KEYSTORECONFIG_ENODEACCOUNT=0xc08c3def622af1476f2db0e3cc8ccaead07be3bb
ENV NETHERMIND_KEYSTORECONFIG_ENODEKEYFILE=${BASE_DIR}/keystore/validator-wallet-password

# Network
ENV NETHERMIND_NETWORKCONFIG_ACTIVEPEERSMAXCOUNT=100
ENV NETHERMIND_NETWORKCONFIG_DISCOVERYPORT=30303
ENV NETHERMIND_NETWORKCONFIG_STATICPEERS=null
ENV NETHERMIND_NETWORKCONFIG_DIAGTRACERENABLED=false

RUN mkdir /iexec-poco
COPY . /iexec-poco
COPY ./testchains/nethermind/keystore/key-c08c3def622af1476f2db0e3cc8ccaead07be3bb /nethermind/keystore/
RUN mv /iexec-poco/config/config_${CHAIN_TYPE}.json /iexec-poco/config/config.json
RUN sed -i "s/@stepDuration@/${CHAIN_BLOCK_TIME}/" ${BASE_DIR}/spec.json
# remove eip1559 for sidechains
RUN if [[ "${CHAIN_TYPE}" == "native" ]] ; \
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
        "echo $${VALIDATOR_ADDRESS} | awk '{print tolower($$0)}' | xargs -I {address} \
        ./Nethermind.Runner", \
        "--config ${BASE_DIR}/authority.cfg " \
    ]
