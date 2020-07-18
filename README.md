# Rescue Shelter Report Services  
The creation of a report service or [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) are additional effort for a simple project. However, it does provide new architectural challenges.  



## Hint: docker commands
```
docker run --name mongo_dev -p 27017:27017 mongo mongod
docker run --name nginx_dev -p 80:80 nginx
docker cp services.nginx.conf nginx_dev:/etc/nginx/conf.d/rescueshelter.services.nginx.conf
docker exec -it nginx_dev nginx -h
docker exec -it nginx_dev nginx -T
docker exec -it nginx_dev nginx -s reload
```
