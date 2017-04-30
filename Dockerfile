FROM node:7.9-alpine

RUN apk --no-cache add \
    bash \
    coreutils \
    findutils \
    git \
    redis

RUN adduser -D codewarrior

COPY package.json /tmp/runner/package.json
ENV NPM_CONFIG_LOGLEVEL=warn
RUN cd /tmp/runner && yarn install

COPY lib /tmp/runner/lib
COPY test /tmp/runner/test

USER codewarrior
ENV USER=codewarrior HOME=/home/codewarrior
WORKDIR /tmp/runner

RUN NODE_ENV=test node_modules/.bin/mocha -t 8s

CMD ["node"]
