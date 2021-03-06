FROM node:alpine

LABEL "version" "1.0.0"
LABEL "contributors" "@kscott5"
LABEL "github" "https://github.com/kscott5/RescueShelter.Reports"
LABEL "description" "Rescue Shelter Reports gives readonly access"

ENV "NODE_ENV" "production"

WORKDIR /home

# https://github.com/nodejs/node-gyp
RUN apk add make
# OK: 65 MiB in 32 packages

RUN apk add g++
# OK: 229 MiB in 43 packages
# apk del g++ only removes 1/4 of total (229 MiB)

RUN apk add python
# OK: 65 MiB in 31 packages

RUN apk add redis
# OK: 25 MiB in 23 packages

# requires make g++ python
RUN npm install --global node-gyp

RUN apk add git
# OK: 23 MiB in 22 packages

RUN git clone https://github.com/kscott5/rescueShelter.reports.git
# Receiving objects: 100% (360/360), 1.51 MiB | 16.00 KiB/s, done.

WORKDIR /home/rescueshelter.reports

# requires node-gyp
RUN npm install
RUN npm run compile

# The docker documentation states if any container uses 
#       docker run --network rescueshelter --ip some_ip_range_id ...
# command line options after 
#       docker network create --driver=bridge --subnet=172.10.0.0/16 --ip-range=172.10.1.0/24 --gateway=172.10.0.1 rescueshelter
# all communication between containers are isolated and protected on same subnet. Therefore, any port is accessible within this 
# network and
# EXPOSE 3303/tcp # is not neccessary.

# Define an entry access point
COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT [ "docker-entrypoin.sh" ]

CMD [ "node", "index.js" ]
