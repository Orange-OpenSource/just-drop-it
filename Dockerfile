FROM node:14.17.5 AS build

ARG NPM_REGISTRY="https://registry.npmjs.org/"

COPY    ./  /build/
WORKDIR /build/

RUN     npm config set proxy $http_proxy                                        && \
        npm config set https-proxy $https_proxy                                 && \
        rm -rf node_modules/                                                    && \
        echo " - Installing dependencies"                                       && \
        npm install --registry=$NPM_REGISTRY  >/dev/null

FROM node:14.17.5 AS runtime

LABEL name="just drop it"                                      \
    description="Just Drop It"                                 \
    url="https://github.com/Orange-OpenSource/just-drop-it"    \
    maintainer="no-one@neverland.com"

COPY  --from=build /build/  /application/

WORKDIR /application/

EXPOSE 8080

CMD [ "npm", "start" ]

