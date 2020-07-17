# https://hub.docker.com/_/node
FROM node:14.5.0-alpine

# Python Install Package Manager Script
COPY get-pip.py get-pip.py

# MongoDB APT Manager source keys
RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | apt-key add -
RUN echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.2 main" | tee /etc/apt/sources.list.d/mongodb-org-4.2.list

# Update kernel current packages, install mongodb tools only, and python 3.7
#
# NOTE: Installation of python 2.5, 3 and 3.5 exist wtih kernel but 
# does not support Blake2b encryption alogrithm.
RUN apt-get update 
RUN apt-get install -y mongodb-org-tools python3.7

# Update the python symbolic links
RUN rm /usr/bin/python & ln /usr/bin/python3.7 /usr/bin/python

# Install python package manager and application dependencies
RUN python get-pip.py & python -m pip install blake2b pymongo

# Define an entry access point
COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT [ "docker-entrypoin.sh" ]
CMD [ "node" ]