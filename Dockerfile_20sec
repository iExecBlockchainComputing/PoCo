FROM parity/parity:v2.3.2

USER root

RUN apt update && apt install -y curl git ca-certificates
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
RUN bash -i -c "nvm install node"
RUN apt install -y python2.7 python-pip #prevents /parity/migrate.sh > node-gyp rebuild > Can't find Python executable "python"

RUN mkdir /iexec-poco
COPY . /iexec-poco

RUN bash /iexec-poco/parity_20sec/migrate_20sec.sh

ENTRYPOINT ["/bin/parity"]
CMD ["--chain", "/iexec-poco/parity_20sec/spec_20sec.json", "--config", "/iexec-poco/parity_20sec/authority.toml", "--force-sealing", "-d", "/iexec-poco/parity_20sec/data", "--geth"]
