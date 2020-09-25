// NOTE: 
//       Report Services contains readonly data access, and should be removed
//       from Rescue Shelter Services project. Http Responses from these 
//       Http Requests are a convention of ExpressJS Router and Ngnix proxy_pass. 
//        
// React UI example Http Requests without Ngnix where server is localhost. 
// services.nginx.conf uses host O/S ip address. 
//
// ***************************************************************************
// CAUTION. Docker containers have localhost with specific virtual ip address
// ***************************************************************************
//
// http://[server]:3302/api/animal/new        [write]
// http;//[server]:3302/api/animals           [readonly]
// http://[server]:3303/api/report/categories [readonly]
// 
//
// with Ngnix
//
// http://[server]/api/animal/new        [write]
// http;//[server]/api/report/animals    [readonly]
// http://[server]/api/report/categories [readonly]
//
// ADDITION EFFORT FOR PROOF OF CONCEPT [poc]
//
import {Application, NextFunction, Request, Response, Router} from "express";
import bodyParser from "body-parser";
import {RedisClient} from "redis";

import {CoreServices} from "rescueshelter.core";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalReaderDb {
    public model;
    private selectionFields;

    constructor() {
        this.model = CoreServices.getModelReader(CoreServices.ANIMAL_MODEL_NAME);
        this.selectionFields = '_id name description imageSrc sponsors';                
    }

    async getAnimal(id: String) : Promise<any> {
        var data = await this.model.findById(id);
        
        return data;
    } // end getAnimal

    async getAnimals(page: Number = 1, limit: Number = 5, phrase?: String) : Promise<any> {
        var animalAggregate = (!phrase)? this.model.aggregate() :
            this.model.aggregate().append({$match: {$text: {$search: phrase}}});
                
        var data = await animalAggregate.append([
            {
                $lookup: {
                    from: "sponsors",
                    let: {animals_sponsors: '$sponsors'},
                    pipeline: [{
                        $project: {
                            _id: false, useremail: 1, username: 1, 
                            is_sponsor: {$in: ['$useremail', '$$animals_sponsors']}
                        }            
                    }],
                    as: "sponsors"
                }        
            },
            {
            $project: {
                name: 1, description: 1, endangered: 1, image: 1,
                sponsors: {
                    $filter: {
                        input: '$sponsors',
                        as: 'contributor',
                        cond: {$eq: ['$$contributor.is_sponsor', true]}
                    }
                }
            }}
        ])
        .limit(limit as number);
        
        return data;
    } // end getAnimals

    async getCategories() : Promise<any> {
        var data = await this.model.aggregate([
            { '$sort':  { 'category': 1} },
            { '$group': { '_id': '$category', 'count': { '$sum': 1}}},
            { '$project': { 'category': 1, 'count': 1}}
        ]);

        return data;
    } // end getCategories
} // end AnimalReaderDb

export function PublishWebAPI(app: Application) : void {
    // Parser for various different custom JSON types as JSON
    let jsonBodyParser = bodyParser.json({type: 'application/json'});
    let jsonResponse = new CoreServices.JsonResponse();            

    let db = new AnimalReaderDb();

    try {
        (new RedisClient({host: 'localhost', port: 6379}))?.quit();
    } catch(error) {
        console.log('**************These projects are professional entertainment***************')
        console.log('The following command configures an out of process Redis.io memory cache.');
        console.log('In process requires Redis.io install in the process of RescueShelter.Reports.');
        console.log('\n');
        console.log('docker run -it -p 127.0.0.1:6379:6379 --name redis_dev redis-server --loglevel debug');
        console.log('\n\n\n');
        console.log('Terminal/shell access use:> telnet 127.0.0.1 6379');
        console.log('set \'foo\' \'bar\''); // server response is +OK
        console.log('get \'foo\''); // server response is $4 bar
        console.log('quit'); //exit telnet sessions
    }

    async function inMemoryCache(req: Request, res: Response, next: NextFunction) {
        console.debug(`Redis [inMemoryCache] key \'${req.originalUrl}\'`);
        var client: RedisClient;
        try {
            client = new RedisClient({host: 'localhost', port: 6379});

            if(client.exists(req.params?.id+'') == true) {
                client.get(req.params.id, (error, reply) => {            
                    res.json(jsonResponse.createData(reply));
                });
            } else if(client.exists(req.originalUrl,) == true) {
                client.get(req.originalUrl, (error, reply) => {
                    res.json(reply);
                });
            } else {
                next();
            }
        } catch(error) {            
            next();
        } finally{
            client?.quit();
        }
    } // inMemoryCache
    
    app.use(inMemoryCache);

    router.get('/categories', jsonBodyParser, async (req,res) => {
        console.debug(`GET: ${req.url}`);        
        res.status(200);

        var client: RedisClient;
        try {            
            var data = await db.getCategories();
            var jsonData = jsonResponse.createData(data);

            try {// Caching Data
                client = new RedisClient({host: 'localhost', port: 6379});
                client.set(req.originalUrl, jsonData+'');
                client.expire(req.originalUrl, 60/*seconds*/*10);
            } catch(error) {
                console.log(error);
            } finally {
                client?.quit();
                res.json(jsonData);
            }
        } catch(error) {
            res.json(jsonResponse.createError(error));
        } 
    }); // end animals categories

    router.get("/", jsonBodyParser, async (req,res) => {
        console.debug(`GET: ${req.url}`);        
        var page = Number.parseInt(req.query["page"] as any || 1); 
        var limit = Number.parseInt(req.query["limit"] as any || 5);
        var phrase = req.query["phrase"] as string || '';

        res.status(200);
        
        var client: RedisClient;
        try {
            var data = await db.getAnimals(page, limit, phrase);
            var jsonData = jsonResponse.createPagination(data,1,page);

            try { // Caching Data
                client = new RedisClient({host: 'localhost', port: 6379});
                client.set(req.url, jsonData);
                client.expire(req.url, 60/*seconds*/*10);
            } catch(error) {
                console.log(error);
            } finally {
                client?.quit()
                res.json(jsonData);
            }
        } catch(error) {
            res.json(jsonResponse.createError(error));
        }
    }); //end animals

    router.get('/:id', jsonBodyParser, async (req,res) => {
        console.debug(`GET: ${req.url}`);
        if (!req.params.id) {
            res.status(404);
            res.send("HttpGET id not available");
            return;
        }

        res.status(200);

        var client: RedisClient;
        try {
            var data = await db.model.findById(req.params.id);
            var jsonData = jsonResponse.createData(data);

            try { // Caching Data
                client = new RedisClient({host: 'localhost', port: 6379});
                client.set(req.url, jsonData);
                client.expire(req.url, 60/*seconds*/*10);
            } catch(error) {
                console.log(error);
            } finally {
                client?.quit();
                res.json(jsonData);
            }
        } catch(error) {
                console.log(error);
                res.json(jsonResponse.createError(error));
        }
    }); // end animal with id

    app.use('/api/report/animals/', router);
} // end PublishWebAPI