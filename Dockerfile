FROM parity/parity:stable

USER root

RUN apt update && apt install -y curl git
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
RUN bash -i -c "nvm install node"

RUN mkdir /iexec-poco
COPY . /iexec-poco

RUN bash /iexec-poco/parity/migrate.sh

ENTRYPOINT ["/home/parity/bin/parity"]
CMD ["--chain", "/iexec-poco/parity/spec.json", "--config", "/iexec-poco/parity/authority.toml", "-d", "/iexec-poco/parity/data", "--geth"]
