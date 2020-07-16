# https://hub.docker.com/_/node
FROM node:latest

COPY get-pip.py get-pip.py

RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | apt-key add -
RUN echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.2 main" | tee /etc/apt/sources.list.d/mongodb-org-4.2.list

RUN apt-get update
RUN apt-get install -y python3.5 mongodb-org-tools

RUN rm /usr/bin/python & ln /usr/bin/python3.5 /usr/bin/python

RUN python get-pip.py & python -m pip install pymongo

COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT [ "docker-entrypoin.sh" ]
CMD [ "node" ]