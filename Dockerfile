FROM node:alpine

LABEL "version" "1.0.0"
LABEL "contributors" "@kscott5"
LABEL "github" "https://github.com/kscott5/RescueShelter.Reports"
LABEL "description" "Rescue Shelter Reports gives readonly access"

ENV "NODE_ENV" "production"

WORKDIR /home

COPY ./dist/*.js    ./
COPY ./dist/*.map   ./
COPY ./package.json ./

# Install package.json dependencies
RUN npm install

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
