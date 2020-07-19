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
import bodyParser from "body-parser";

import * as services from "../rescueshelter.services/src/services";
import {SecurityDb} from "../rescueshelter.services/src/securityservice"

let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

class AnimalReaderDb {
    public model;
    private selectionFields;

    constructor() {
        this.model = services.getModelReader(services.ANIMAL_MODEL_NAME);
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
    let jsonResponse = new services.JsonResponse();            

    let securityDb = new SecurityDb();
    let db = new AnimalReaderDb();

    router.get('/categories', jsonBodyParser, async (req,res) => {
        res.status(200);

        try {
            var data = await db.getCategories();

            res.json(jsonResponse.createData(data));
        } catch(error) {
            res.json(jsonResponse.createError(error));
        }
    }); // end animals categories

    router.get("/", async (req,res) => {
        console.debug(`GET: ${req.url}`);
        var page = Number.parseInt(req.query["page"] as any || 1); 
        var limit = Number.parseInt(req.query["limit"] as any || 5);
        var phrase = req.query["phrase"] as string || '';

        res.status(200);
        
        try {
            var data = await db.getAnimals(page, limit, phrase);
            res.json(jsonResponse.createPagination(data,1,page));
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
        try {
            var data = await db.model.findById(req.params.id);
            res.json(jsonResponse.createData(data));
        } catch(error) {
                console.log(error);
                res.json(jsonResponse.createError(error));
        }
    }); // end animal with id

    app.use('/api/report/animals/', router);
} // end PublishWebAPI