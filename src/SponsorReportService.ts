import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import {createClient as createRedisClient}  from "redis";
import {Connection, Model } from "mongoose";

// @ts-ignore
import {CoreServices} from "rescueshelter.core";
import { CORSOptions } from ".";

let router = express.Router({ caseSensitive: true, mergeParams: true, strict: true});


class SponsorReaderDb {
private connection: Connection;
    private model: Model<CoreServices.animalSchema>;

    constructor() {
        this.connection = CoreServices.createConnection();
        this.model = this.connection.model(CoreServices.SPONSORS_MODEL_NAME, CoreServices.sponsorSchema);
    }

    async close() {
        await this.connection.close();
    }

    async getSponsor(id: String) : Promise<any>  {
        var data = await this.model.findById(id);
        return data;
    }

    async getSponsors(options: any) : Promise<any> {
        var filters = {...options,
            limit: options.limit || 100,
            keywords: (options.keywords+'').trim()
        }
        var condition = (filters.keywords)? {$text: {$search: filters.keywords}}: {};
        
        var data = await this.model.find(condition)
            .lean()
            .limit(filters.limit);

        return data;
    } 
} //end SponsorReaderDb class

export class SponsorReportService {
    constructor(){}
    
    publishWebAPI(app: express.Application) : void {   
        /**
         * @description Adds Redis cache data with expiration
         * @param {string} key: request original url
         * @param {object} value: actual data
         */
        async function cacheData(key: string, value: any) {  
            const client = createRedisClient({});

            // NOTE: https://github.com/redis/node-redis/blob/4d659f0b446d19b409f53eafbf7317f5fbb917a9/docs/client-configuration.md
            
            let cacheErrorWasFound = false;
            client.on('error', (error) => {
                if(cacheErrorWasFound) return;

                console.log(`Sponsor Cache Data non-blocking, error: ${error}:`);
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

        const SPONSORS_ROUTER_BASE_URL = '/api/report/sponsors';
        async function SponsorsRedisMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
            if(req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL) == false) {
                next();
                return;
            }
            const client = createRedisClient({});

            let cacheErrorWasFound = false; 
            client.on('error', (error) => {
                if(cacheErrorWasFound) return; // redis max of n connection attemps.

                console.debug(`Sponsor Middleware non-blocking, ${error}:`); // display once
                cacheErrorWasFound = true;
                next();
            });

            client.on('ready', () => {
                console.debug(`Sponsor Middleware ready now`);
                if(cacheErrorWasFound) {
                    console.debug(`Sponsor Cache Middleware ready now`);
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
        } // end SponsorsRedisMiddleware

        router.use(bodyParser.json({type: 'application/json'}));
        router.use(cors(CORSOptions));
        router.use(SponsorsRedisMiddleware);

        router.get("/:id", async (req,res) => {
            const jsonResponse = new CoreServices.JsonResponse();
            res.status(200);

            var jsonData;
            try {
                const db = new SponsorReaderDb();
                const data = await db.getSponsor(req.params.id);
                await db.close();

                jsonData = jsonResponse.createData(data);
                await cacheData(req.originalUrl, jsonData);
            } catch(error) {
                console.debug(`ERROR: Route get/:id ${req.originalUrl} ${error}`);
                jsonData = jsonData || jsonResponse.createError('Data not available');
            } finally {
                res.json(jsonData);
            }
        });

        router.get("/", async (req,res) => {
            const jsonResponse = new CoreServices.JsonResponse();
            res.status(200);

            const options = {
                page:Number.parseInt(req.query.page as any || 1),
                limit: Number.parseInt(req.query.limit as any || 5),
                phrase: req.query.phrase as any || null
            };

            var jsonData;
            try {
                const db = new SponsorReaderDb();
                const data = await db.getSponsors(options);
                await db.close();

                jsonData = jsonResponse.createPagination(data, 1, options.page);
                await cacheData(req.originalUrl, jsonData);
            } catch(error) {
                console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
                jsonData = jsonData || jsonResponse.createError('Data not available');
            } finally {
                res.json(jsonData);
            }
        });

        router.post("/", async (req,res) => {
            const jsonResponse = new CoreServices.JsonResponse();
            res.status(200);

            const options = req.body.options;
            var jsonData;
            try {
                const db = new SponsorReaderDb();
                const data = await db.getSponsors(options);
                await db.close();

                jsonData = jsonResponse.createPagination(data,1, options?.page || 1);
                await cacheData(req.originalUrl, jsonData);
            } catch(error) {
                console.debug(`ERROR: Route post ${req.originalUrl} ${error}`);
                jsonData = jsonData || jsonResponse.createError('Data not available');
            } finally {
                res.json(jsonData);
            }
        });

        // string.concat('/') is an express HACK. req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL)
        app.use(SPONSORS_ROUTER_BASE_URL.concat('/'), router);
    } // end publishWebAPI
} // end SponsorReportService