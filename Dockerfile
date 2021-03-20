FROM alpine:3.12.4
COPY harmony-master /harmony

RUN apk update && \
    apk add python3 && \
    apk add gcc && \
    apk add musl-dev
