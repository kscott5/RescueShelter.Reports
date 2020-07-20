# https://hub.docker.com/_/nginx
# https://www.nginx.com/resources/wiki/start/topics/tutorials/commandline/
# https://www.docker.com/blog/tips-for-deploying-nginx-official-image-with-docker/
FROM nginx:latest

# Python Install Package Manager Script
COPY *.conf /etc/nginx/conf.d/

# Define an entry access point
COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT [ "docker-entrypoin.sh" ]
CMD [ "nginx" ]