FROM node:slim

# https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.title="Rescue Shelter Report Services"
LABEL org.opencontainers.image.url="https://githhub.com/kscott5/rescueshelter.reports"
LABEL org.opencontainers.image.source="https://githhub.com/kscott5/rescueshelter.reports"
LABEL org.opencontainers.image.version="v2.0.1"

ARG PATH=/api
EXPOSE 443

ENV NODE_ENV="production"

ENV RS_API_LOG_DIR='${PATH}/logs'
ENV RS_CONNECTION_URI="mongodb+srv://cluster0.dol02bo.mongodb.net/?authSource=%24external&authMechanism=MONGODB-X509&retryWrites=true&tlsCertificateKeyFile=${PATH}/cert/production.pem&w=majority&appName=Cluster0&dbname=rescueshelter"

RUN mkdir ${PATH}
RUN mkdir ${PATH}/cert
RUN mkdir ${PATH}/logs

COPY cert.readwrite.pem ${PATH}cert/production.pem
COPY ./dist/** ${PATH}

WORKDIR ${PATH}

ENTRYPOINT [ "node", "index.js" ]