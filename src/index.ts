import reports = require("../rescueshelter.services/src/server");
import {PublishWebAPI as AnimalReportServices} from "./AnimalReportService";
import {PublishWebAPI as SponsorReportServices} from "./SponsorReportService";

reports.serverName = 'Rescue Shelter Report Services';
reports.serverPort = 3303;

reports.middleware = [
    AnimalReportServices,
    SponsorReportServices
];

reports.listener();