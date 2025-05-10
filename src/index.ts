import {CoreServer} from "rescueshelter.core";
import {AnimalReportService} from "./AnimalReportService";
import {SponsorReportService} from "./SponsorReportService";

declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("path");
let staticPath = path.join(__dirname, '../public');

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