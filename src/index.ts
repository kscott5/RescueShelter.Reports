// @ts-ignore
import * as Core from "rescueshelter.core";
import {AnimalReportService} from "./AnimalReportService";
import {SponsorReportService} from "./SponsorReportService";

// @ts-ignore
declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("node:path");
let staticPath = path.join(__dirname, '../public');

export const CORSHostNames = []; // bad host requestors

export const CORSOptions = {
    // @ts-ignore
    origin: (origin, callback) => {
        callback(null, {
            // @ts-ignore
            origin: CORSHostNames.includes(origin)
        });
    },
    methods: ['GET','POST', 'PUT'],
    allowHeaders: ['Content-Type'],
    exposedHeaders: [], // none
    credentials: false,
    maxAge: 3000, // seconds
    preFlightContinue: true,
    optionSuccessStatus: 210
}

Core.server.start({
    server: {
        secure: true,
        name: 'Rescue Shelter Report Services', 
        port: 3303
    },
    middleWare: [
        new AnimalReportService().publishWebAPI,
        new SponsorReportService().publishWebAPI], 
    corsHostNames: CORSHostNames, // bad host requestors
    webRootPath: staticPath,
    closeCallback: ()=> {} });