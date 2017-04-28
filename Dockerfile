FROM node:7.9-alpine

RUN apk --no-cache add \
    bash \
    coreutils \
    findutils \
    git \
    wget \
    tar

RUN adduser -D codewarrior

COPY package.json /tmp/runner/package.json
ENV NPM_CONFIG_LOGLEVEL=warn
RUN cd /tmp/runner && yarn install

COPY lib /tmp/runner/lib
COPY test /tmp/runner/test
# COPY creates with UID=0,GID=0 regardless of USER
# USER root
# RUN chown -R codewarrior:codewarrior /home/codewarrior/runner

USER codewarrior
ENV USER=codewarrior HOME=/home/codewarrior
WORKDIR /tmp/runner

RUN NODE_ENV=test node_modules/.bin/mocha -t 5s

CMD ["node"]
