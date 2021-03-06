import {CoreServer} from "rescueshelter.core";
import {PublishWebAPI as AnimalReportServices} from "./AnimalReportService";
import {PublishWebAPI as SponsorReportServices} from "./SponsorReportService";

CoreServer.start('Rescue Shelter Report Services', 3303, 
    [AnimalReportServices,SponsorReportServices], [], './public');