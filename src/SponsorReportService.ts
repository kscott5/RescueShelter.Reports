import {Application, NextFunction, Request, Response, Router} from "express";
import bodyParser from "body-parser";
import * as redis from "redis";

import {CoreServices} from "rescueshelter.core";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class SponsorReaderDb {
    private __selectionFields;
    public model;

    constructor() {
        this.__selectionFields =  "_id useremail username firstname lastname photo audit";
        this.model = CoreServices.getModel(CoreServices.SPONSOR_MODEL_NAME);
    }

    async getSponsor(id: String) : Promise<any>  {
        var data = await this.model.findById(id);
        return data;
    }

    async getSponsors(page: Number = 1, limit: Number = 5, phrase?: String) : Promise<any> {
        var condition = (phrase)? {$text: {$search: phrase}}: {};
        
        var data = await this.model.find(condition)
            .lean()
            .limit(limit)
            .select(this.__selectionFields);

        return data;
    } 
} //end SponsorReaderDb class

export function PublishWebAPI(app: Application) : void {   
    /**
     * @description Adds Redis cache data with expiration
     * @param {string} key: request original url
     * @param {object} value: actual data
     */
    async function cacheData(key: string, value: any) {  
        const client = new redis.RedisClient({
            
        });

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
        });    
    }

    const SPONSORS_ROUTER_BASE_URL = '/api/report/sponsors';
    async function SponsorsRedisMiddleware(req: Request, res: Response, next: NextFunction) {
        if(req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL) == false) {
            next();
            return;
        }
        const client = new redis.RedisClient({});

        let cacheErrorWasFound = false; 
        client.on('error', (error) => {
            if(cacheErrorWasFound) return; // redis max of n connection attemps.

            console.debug(`Sponsor Middleware non-blocking, ${error}:`); // display once
            cacheErrorWasFound = true;
            next();
        });

        client.on('ready', () => {
            console.debug(`Sponsor Middleware ready now`);
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
    } // end SponsorsRedisMiddleware

    app.use(bodyParser.json({type: 'application/json'}));
    app.use(SponsorsRedisMiddleware);

    router.get("/:id", async (req,res) => {
        const jsonResponse = new CoreServices.JsonResponse();
        res.status(200);

        var jsonData;
        try {
            const db = new SponsorReaderDb();
            const data = await db.getSponsor(req.params.id);

            jsonData = jsonResponse.createData(data);
            await cacheData(req.originalUrl, jsonData);
        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    });

    router.get("/", async (req,res) => {
        const jsonResponse = new CoreServices.JsonResponse();
        res.status(200);

        var page = Number.parseInt(req.query.page as any || 1); 
        var limit = Number.parseInt(req.query.limit as any || 5);
        var phrase = req.query.phrase as any || null;

        var jsonData;
        try {
            const db = new SponsorReaderDb();
            const data = await db.getSponsors(page,limit,phrase);
            
            jsonData = jsonResponse.createPagination(data, 1, page);
            await cacheData(req.originalUrl, jsonData);
        } catch(error) {
            console.debug(`ERROR: Route get ${req.originalUrl} ${error}`);
            jsonData = jsonData || jsonResponse.createError('Data not available');
        } finally {
            res.json(jsonData);
        }
    });

    // string.concat('/') is an express HACK. req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL)
    app.use(SPONSORS_ROUTER_BASE_URL.concat('/'), router);
} // end publishWebAPI
