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
import * as redis from "redis";

import {CoreServices} from "rescueshelter.core";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class SponsorReaderDb {
    private __selectionFields;
    public model;

    constructor() {
        this.__selectionFields =  "_id useremail username firstname lastname photo audit";
        this.model = CoreServices.getModelReader(CoreServices.SPONSOR_MODEL_NAME);
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
    let jsonBodyParser = bodyParser.json({type: 'application/json'});
    let jsonResponse = new CoreServices.JsonResponse();

    let db = new SponsorReaderDb();
    const client = new redis.RedisClient({host: 'localhost', port: 6379});
    
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
    
    const SPONSORS_ROUTER_BASE_URL = '/api/report/sponsors';
    function SponsorsRedisMiddleware(req: Request, res: Response, next: NextFunction) {
        if(req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL) !== true) {
            console.debug(`SponsorsRedisMiddleware get \'${req.originalUrl}\' not supported`);
            next();
            return;
        }
    
        try { // Reading data from Redis in memory cache            
            client.get(req.originalUrl, (error, reply) => {                    
                if(reply !== null) {
                    console.debug(`SponsorsRedisMiddleware get \'${req.originalUrl}\' +OK`);                      
                    res.status(200);
                    res.json(JSON.parse(reply));
                } else {
                    console.debug(`SponsorsRedisMiddleware get \'${req.originalUrl}\' ${(error || 'not available')}`);                      
                    next();
                }
            });
        } catch(error) { // Redis cache access  
            console.debug(error);
            next();
        } // try-catch        
    } // end SponsorsRedisMiddleware
    
    app.use(SponsorsRedisMiddleware);

    router.get("/:id", async (req,res) => {
        console.debug(`GET [:id]: ${req.originalUrl}`);
        res.status(200);

        try {
            var data = await db.getSponsor(req.params.id);
            var jsonData = jsonResponse.createData(data);

            try { // Data Caching
                client.set(req.originalUrl, JSON.stringify(jsonData), (error,reply) => {
                    console.debug(`Redis set \'${req.originalUrl}\' ${(error || '+'.concat(reply))}`);
                });
                client.expire(req.originalUrl, 60/*seconds*/*10);
            } catch(error) {
                console.log(error);
            } finally {
                res.json(jsonData);
            }
        } catch(error) {
            res.json(jsonResponse.createError(error));
        }
    });

    router.get("/", async (req,res) => {
        console.debug(`GET: ${req.originalUrl}`);
        var page = Number.parseInt(req.query.page as any || 1); 
        var limit = Number.parseInt(req.query.limit as any || 5);
        var phrase = req.query.phrase as any || null;

        res.status(200);

        try {
            var data = await db.getSponsors(page,limit,phrase);
            var jsonData = jsonResponse.createPagination(data, 1, page);

            try { // Data caching
                client.set(req.originalUrl, JSON.stringify(jsonData), (error, reply) => {
                    console.debug(`Redis set \'${req.originalUrl}\' ${(error || '+'.concat(reply))}`);
                });
                client.expire(req.originalUrl, 60/*seconds*/*10);
            } catch(error) {
                console.log(error);
            } finally {
                res.json(jsonData);
            }
        } catch(error) {
            res.json(jsonResponse.createError(error));
        }
    });

    // string.concat('/') is an express HACK. req.originalUrl.startsWith(SPONSORS_ROUTER_BASE_URL)
    app.use(SPONSORS_ROUTER_BASE_URL.concat('/'), router);
} // end publishWebAPI
