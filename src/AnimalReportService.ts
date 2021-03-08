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
import bodyParser, { json } from "body-parser";
import * as redis from "redis";
import * as util from "util";

import {CoreServices} from "rescueshelter.core";

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

    const client = new redis.RedisClient({});

    /**
     * @description Adds Redis cache data with expiration
     * @param {string} key: request original url
     * @param {object} value: actual data
     */
    async function cacheData(key: string, value: any) {    
        if(await Promise.resolve(client.set(key, JSON.stringify(value))) &&
            await Promise.resolve(client.expire(key, 60/*seconds*/*10))) {
            console.debug(`Redis set \'${key}\' +OK`);
        }
    }

    const ANIMAL_ROUTER_BASE_URL = '/api/report/animals';
    async function AnimalsRedisMiddleware(req: Request, res: Response, next: NextFunction) {
        // NOTE: Separation of concerns.
        if(req.originalUrl.startsWith(ANIMAL_ROUTER_BASE_URL) !== true) {
            next();
            return;
        }
                
        try { // Reading data from Redis in memory cache            
            client.get(req.originalUrl, (error,reply) => {
                if(reply) {
                    console.debug(`Redis get \'${req.originalUrl}\' +OK`);
                    res.status(200);
                    res.json(JSON.parse(reply));
                } else {
                    console.debug(`Redis get \'${req.originalUrl}\' ${error || 'NOT AVAILABLE'}`);
                    next(); 
                } 
            });
        } catch(error) { // Redis cache access  
            console.debug(`Redis error \'${req.originalUrl}\' ${error}`);
            next();
        } // try-catch
    } // end AnimalsRedisMiddleware
    
    app.use(AnimalsRedisMiddleware);

    router.get('/categories', jsonBodyParser, async (req,res) => {
        res.status(200);

        var jsonData;
        try {            
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

    router.get("/", jsonBodyParser, async (req,res) => {
        res.status(200);
        
        var page = Number.parseInt(req.query["page"] as any || 1); 
        var limit = Number.parseInt(req.query["limit"] as any || 5);
        var phrase = req.query["phrase"] as string || '';

        var jsonData;
        try {
            const data = await db.getAnimals(page, limit, phrase);
            jsonData = jsonResponse.createPagination(data,1,page);

            await cacheData(req.originalUrl, jsonData);

        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    }); //end animals

    router.get('/:id', jsonBodyParser, async (req,res) => {
        res.status(200);

        if (!req.params.id) {
            res.json(jsonResponse.createError(`Missing animal id`));
            return;
        }

        var jsonData;
        try {
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