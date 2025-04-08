import {CoreServer} from "rescueshelter.core";
import {PublishWebAPI as AnimalReportServices} from "./AnimalReportService";
import {PublishWebAPI as SponsorReportServices} from "./SponsorReportService";

declare let __dirname; // variable initialize by NodeJS Path Module

let path = require("path");
let staticPath = path.join(__dirname, '/../public');

CoreServer.start('Rescue Shelter Report Services', 3303, 
    [AnimalReportServices,SponsorReportServices], [/* cors */ "http://localhost:3000"], staticPath);