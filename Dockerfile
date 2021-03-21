FROM alpine:3.12.4
COPY harmony-master /harmony

RUN apk update && \
    apk add python3 && \
    apk add gcc && \
    apk add musl-dev

RUN echo "assert True" > example.hny
RUN (cd /harmony && ./harmony ../example.hny && rm harmony.html)
RUN rm example.hny
