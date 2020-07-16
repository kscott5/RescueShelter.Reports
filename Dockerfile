# https://hub.docker.com/_/node
FROM Node:14.5

RUN apt-get install mongodb-org-tools
RUN apt-get install python3.7 pymongo 

EXPOSE 8888