// @ts-ignore
import {CoreServer} from "rescueshelter.core";
import {AnimalReportService} from "./AnimalReportService";
import {SponsorReportService} from "./SponsorReportService";

// @ts-ignore
declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("node:path");
let staticPath = path.join(__dirname, '../public');

export const CORSHostNames = [
    "https://localhost:3000"
];

export const CORSOptions = {
    // @ts-ignore
    origin: (origin, callback) => {
        callback(null, {
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

CoreServer.start({
    server: {
        secure: true,
        name: 'Rescue Shelter Report Services', 
        port: 3303
    },
    middleWare: [
        new AnimalReportService().publishWebAPI,
        new SponsorReportService().publishWebAPI], 
    corsHostNames: ['https://localhost:3000'], 
    webRootPath: staticPath,
    closeCallback: ()=> {} });