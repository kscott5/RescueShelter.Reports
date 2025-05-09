import {CoreServer} from "rescueshelter.core";
import {PublishWebAPI as AnimalReportServices} from "./AnimalReportService";
import {PublishWebAPI as SponsorReportServices} from "./SponsorReportService";

declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("path");
let staticPath = path.join(__dirname, '../public');

CoreServer.start({
    server: {
        secure: true,
        name: 'Rescue Shelter Report Services', 
        port: 3303
    },
    middleWare: [AnimalReportServices,SponsorReportServices], 
    corsHostName: [/* cors */], 
    webRootPath: staticPath,
    closeCallback: ()=> {} });