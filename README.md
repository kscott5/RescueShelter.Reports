# Rescue Shelter Report Services  
The creation of a report service or [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules) are additional effort for a simple project. However, it does provide new architectural challenges.  

Removed submodule and opt-in with code structure, npm package registry, and package.json dependencies.


The server should start on localhost port 3303.  
[http://localhost:3303/api/report/animals](http://localhost:3303/api/report/animals)   
[http://localhost:3303/api/report/sponsors](http://localhost:3303/api/report/sponsors)   
[http://localhost:3303/api/report/secure](http://localhost:3303/api/report/secure)   



However, with nginx_dev docker instance access on port 80.   
[http://localhost/api/report/animal](http://localhost/api/report/animals)   
[http://localhost/api/report/sponsors](http://localhost/api/report/sponsors)   


## Hint: docker commands
```
docker pull mongo
docker pull nginx
docker pull node
docker run --name mongo_dev -p 27017:27017 mongo mongod
docker run --name nginx_dev -p 80:80 nginx
docker cp services.nginx.conf nginx_dev:/etc/nginx/conf.d/rescueshelter.services.nginx.conf
docker exec -it nginx_dev nginx -h
docker exec -it nginx_dev nginx -T
docker exec -it nginx_dev nginx -s reload
```

## [Generates sample data](https://github.com/kscott5/DataLake/blob/master/src/rescueshelter/sample.data.py) of 100k random animals and 10 authenticated sponsors with useremail and passwords. Execute after mongo_dev docker instance is available.
```
python sample.data.py
```


### Absolutely should create a Dockerfile from nginx and copy configuration or source files