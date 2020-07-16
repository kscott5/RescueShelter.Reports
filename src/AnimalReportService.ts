import {Application, Router} from "express";
import bodyParser from "body-parser";

import * as services from "../rescueshelter.services/src/services";
import {SecurityDb} from "../rescueshelter.services/src/securityservice"

let model = services.getModel(services.ANIMAL_MODEL_NAME);
let router = Router({ caseSensitive: true, mergeParams: true, strict: true});

export function PublishWebAPI(app: Application) : void {
        // Parser for various different custom JSON types as JSON
        let jsonBodyParser = bodyParser.json({type: 'application/json'});
        let jsonResponse = new services.JsonResponse();            

        let securityDb = new SecurityDb();
 
        router.get('/categories', jsonBodyParser, async (req,res) => {
            res.status(200);

            try {
                var data = await model.aggregate([
                    { '$sort':  { 'category': 1} },
                    { '$group': { '_id': '$category', 'count': { '$sum': 1}}},
                    { '$project': { 'category': 1, 'count': 1}}
                ]);
            } catch(error) {
                res.json(jsonResponse.createError(error));
            }

            res.json(jsonResponse.createData(data));
        });

        app.use('/api/report', router);
} // end PublishWebAPI