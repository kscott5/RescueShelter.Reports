import {Application, NextFunction, Request, Response, Router} from "express";
import bodyParser from "body-parser";
import * as redis from "redis";

import {CoreServices, createLogService} from "rescueshelter.core";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalReaderDb {
    public model;
    private selectionFields;

    constructor() {
        this.model = CoreServices.getModel(CoreServices.ANIMAL_MODEL_NAME);
        this.selectionFields = '_id name description imageSrc sponsors';                
    }

    async getAnimal(id: String) : Promise<any> {
        var data = await this.model.findById(id);
        
        return data;
    } // end getAnimal

    async getAnimals(options?: {page: 1, limit: 100, keywords: '', endangered: false, category_id: -1}) : Promise<any> {

        const filters = options || {page: 1, limit: 100, keywords: '', endangered: false, category_id: -1};
        var animalAggregate = (!filters.keywords)? this.model.aggregate() :
        this.model.aggregate().append({$match: {$text: {$search: filters.keywords}}});
                
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
        .limit(filters.limit as number);
        
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
    /**
     * @description Adds Redis cache data with expiration
     * @param {string} key: request original url
     * @param {object} value: actual data
     */
    async function cacheData(key: string, value: any) {  
        const client = new redis.RedisClient({});

        let cacheErrorWasFound = false;
        client.on('error', (error) => {
            if(cacheErrorWasFound) return; // redis max of n connection attemps.

            console.debug(`Animal Cache Data non-blocking, error: ${error}:`);
            cacheErrorWasFound = true;
            return;
        });
        
        client.on('ready', async () => {
            if(await Promise.resolve(client.set(key, JSON.stringify(value))) &&
                await Promise.resolve(client.expire(key, 60/*seconds*/*10))) {
                console.debug(`Redis set \'${key}\' +OK`);
            }
        });    
    }

    const ANIMAL_ROUTER_BASE_URL = '/api/report/animals';
    async function AnimalsRedisMiddleware(req: Request, res: Response, next: NextFunction) {
        if(req.originalUrl.startsWith(ANIMAL_ROUTER_BASE_URL) == false) {
            next();
            return;
        }
        const client = new redis.RedisClient({});

        let cacheErrorWasFound = false; 
        client.on('error', (error) => {
            if(cacheErrorWasFound) return; // redis max of n connection attemps.

            console.debug(`Animal Cache Middleware non-blocking, error: ${error}:`); // display once
            cacheErrorWasFound = true;
            next();
        });

        client.on('ready', () => {
            console.debug(`Animal Cache Middleware ready now`);
        });

        // Reading data from Redis in memory cache
        client.get(req.originalUrl, (error,reply) => {
            if(cacheErrorWasFound) { 
                return; // next() where route process request without redis connection
            } else if(reply)  {
                console.debug(`Redis get \'${req.originalUrl}\' +OK`);
                res.status(200);
                res.json(JSON.parse(reply));
            } else {
                console.debug(`Redis get \'${req.originalUrl}\' ${error || 'NOT AVAILABLE'}`);
                next();
            } 
        });
    } // end AnimalsRedisMiddleware

    app.use(bodyParser.json({type: 'application/json'}));
    app.use(AnimalsRedisMiddleware);

    router.get('/categories', async (req,res) => {
        res.status(200);

        const jsonResponse = new CoreServices.JsonResponse();
        var jsonData;
        try {
            const db = new AnimalReaderDb();
            const data = await db.getCategories();

            jsonData = jsonResponse.createData(data);

            if(jsonData.data?.length > 0)
                await cacheData(req.originalUrl, jsonData);

        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    }); // end animals categories

    router.get("/", async (req,res) => {
        res.status(200);
        
        const jsonResponse = new CoreServices.JsonResponse();

        var page = Number.parseInt(req.query["page"] as any || 1); 
        var limit = Number.parseInt(req.query["limit"] as any || 5);
        var keywords = req.query["keywords"] as string || '';

        var jsonData;
        try {
            const db = new AnimalReaderDb();
            const data = await db.getAnimals(null);

            jsonData = jsonResponse.createPagination(data,1,page);
            await cacheData(req.originalUrl, jsonData);

        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    }); //end animals
    
    router.post("/", async (req,res) => {
        res.status(200);

        const jsonResponse = new CoreServices.JsonResponse();

        const options = req.body.options;
        
        var jsonData;
        try {
            const db = new AnimalReaderDb();
            const data = await db.getAnimals(options);

            jsonData = jsonResponse.createPagination(data,1, options?.page || 1);
            await cacheData(req.originalUrl, jsonData);

        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    }); //end animals

    router.get('/:id', async (req,res) => {
        res.status(200);

        const jsonResponse = new CoreServices.JsonResponse();
        if (!req.params.id) {
            res.json(jsonResponse.createError(`Missing animal id`));
            return;
        }

        var jsonData;
        try {
            const db = new AnimalReaderDb();
            const data = await db.model.findById(req.params.id);

            jsonData = jsonResponse.createData(data);
            await cacheData(req.originalUrl, jsonData);

        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    }); // end animal with id

    // string.concat('/') is an express HACK. req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL)
    app.use(ANIMAL_ROUTER_BASE_URL.concat('/'), router);
} // end PublishWebAPI