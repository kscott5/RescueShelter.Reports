import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import {createClient as createRedisClient} from "redis";
import {Connection, Model} from "mongoose";

// @ts-ignore
import {CoreServices} from "rescueshelter.core";
import { CORSOptions } from ".";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalReaderDb {
    private connection: Connection;
    private model: Model<CoreServices.animalSchema>;
    
    constructor() {
        this.connection = CoreServices.createConnection();
        this.model = this.connection.model(CoreServices.ANIMALS_MODEL_NAME, CoreServices.animalSchema);
    }

    async close() {
        await this.connection.close();
    }

    async getAnimal(id: String) : Promise<any> {
        // extend Mongoose.Connection class and override
        var data = await this.model.findById(id);
        
        return data;
    } // end getAnimal

    async getAnimals(options: any) : Promise<any> {

        const filters = {
            page: options?.page || 1, 
            limit: options?.limit || 100, 
            keywords:  options?.keywords || '', 
            endangered: options?.endangered || false, 
            categoryid: options?.categoryid || -1 /* all */
        };

        const pipeline = [];
        if(filters.keywords){
            pipeline.push({$match: {$text: {$search: filters.keywords}}});
        }
        
        pipeline.push({
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
        });

        pipeline.push({
            $project: {
                name: 1, description: 1, endangered: 1, image: 1,
                sponsors: {
                    $filter: {
                        input: '$sponsors',
                        as: 'contributor',
                        cond: {$eq: ['$$contributor.is_sponsor', true]}
                    }
                }
            }});

        var data = await this.model.aggregate(pipeline).limit(filters.limit as number);
        
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

export class AnimalReportService {
    constructor(){}

    publishWebAPI(app: express.Application) : void {
        /**
         * @description Adds Redis cache data with expiration
         * @param {string} key: request original url
         * @param {object} value: actual data
         */
        async function cacheData(key: string, value: any) {  
            const client = createRedisClient({});

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

                client.quit();
            });    
            client.connect();
        }

        const ANIMAL_ROUTER_BASE_URL = '/api/report/animals';
        async function AnimalsRedisMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
            if(req.originalUrl.startsWith(ANIMAL_ROUTER_BASE_URL) == false) {
                next();
                return;
            }

            const client = createRedisClient({});

            let cacheErrorWasFound = false; 
            client.on('error', (error) => {
                if(cacheErrorWasFound) return; // redis max of n connection attemps.

                console.debug(`Animal Cache Middleware non-blocking, error: ${error}:`); // display once
                cacheErrorWasFound = true;
                next();
            });

            client.on('ready', () => {
                if(cacheErrorWasFound) {
                    console.debug(`Animal Cache Middleware ready now`);
                    return; // next() route request done without cache client
                }

                // Reading data from Redis in memory cache
                client.get(req.originalUrl).then((value) => {
                    console.debug(`Redis get \'${req.originalUrl}\' +OK`);
                    res.status(200);
                    res.json(JSON.parse(value+''));
                }).catch((error) => {
                    console.debug(`Redis get \'${req.originalUrl}\' ${error || 'NOT AVAILABLE'}`);
                    next();
                });

                client.quit();
            }); // end client.on('ready'...)

            client.connect();
        } // end AnimalsRedisMiddleware

        router.use(bodyParser.json({type: 'application/json'}));
        router.use(cors(CORSOptions));
        router.use(AnimalsRedisMiddleware);

        router.get('/categories', async (req,res) => {
            res.status(200);

            const jsonResponse = new CoreServices.JsonResponse();
            var jsonData;
            try {
                const db = new AnimalReaderDb();
                const data = await db.getCategories();
                await db.close();

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

            const options = {
                page: Number.parseInt(req.query["page"] as any || 1),
                limit: Number.parseInt(req.query["limit"] as any || 100),
                keywords: req.query["keywords"] as string || ''
            };

            var jsonData;
            try {
                const db = new AnimalReaderDb();
                const data = await db.getAnimals(options);
                await db.close();

                jsonData = jsonResponse.createPagination(data,1,options.page);
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
                await db.close();

                jsonData = jsonResponse.createPagination(data,1, options?.page || 1);
                await cacheData(req.originalUrl, jsonData);

            } catch(error) {
                console.debug(`ERROR: Route post ${req.originalUrl} ${error}`);
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
                const data = await db.getAnimal(req.params.id);
                await db.close();

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
    } // end publishWebAPI
} // end AnimalReportService