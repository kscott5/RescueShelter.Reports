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
import {Application, Router} from "express";
import * as bodyParser from "body-parser";
import * as services from "../rescueshelter.services/src/services";

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class SponsorReaderDb {
    private __selectionFields;
    public model;

    constructor() {
        this.__selectionFields =  "_id useremail username firstname lastname photo audit";
        this.model = services.getModelReader(services.SPONSOR_MODEL_NAME);
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
    let jsonResponse = new services.JsonResponse();

    let db = new SponsorReaderDb();

    router.get("/:id", async (req,res) => {
        console.debug(`GET [:id]: ${req.url}`);
        res.status(200);

        try {
            var data = await db.getSponsor(req.params.id);
            res.json(jsonResponse.createData(data));
        } catch(error) {
            res.json(jsonResponse.createError(error));
        }
    });

    router.get("/", async (req,res) => {
        console.debug(`GET: ${req.url}`);
        var page = Number.parseInt(req.query.page as any || 1); 
        var limit = Number.parseInt(req.query.limit as any || 5);
        var phrase = req.query.phrase as any || null;

        res.status(200);
        try {
            var data = await db.getSponsors(page,limit,phrase);
            res.json(jsonResponse.createPagination(data, 1, page));
        } catch(error) {
            res.json(jsonResponse.createError(error));
        }
    });

    app.use("/api/report/sponsors", router);
} // end publishWebAPI
