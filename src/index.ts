import reports = require("../rescueshelter.services/src/server");
import {PublishWebAPI as AnimalReportServices} from "./AnimalReportService";

reports.serverName = 'Rescue Shelter Report Services';
reports.serverPort = 3303;

reports.middleware = [
    AnimalReportServices
];

reports.listener();