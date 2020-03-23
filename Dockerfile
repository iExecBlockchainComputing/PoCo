FROM parity/parity:stable

USER root

RUN apt update && apt install -y curl git ca-certificates
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
RUN bash -i -c "nvm install 10"
RUN apt install -y python2.7 python-pip #prevents /parity/migrate.sh > node-gyp rebuild > Can't find Python executable "python"

RUN mkdir /iexec-poco
COPY . /iexec-poco

RUN bash /iexec-poco/parity/migrate.sh

ENTRYPOINT ["/bin/parity"]
CMD ["--chain", "/iexec-poco/parity/spec.json", "--config", "/iexec-poco/parity/authority.toml", "-d", "/iexec-poco/parity/data", "--geth"]
