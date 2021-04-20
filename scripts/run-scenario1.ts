import {deployConfig} from "./config";
import {deployAll} from "./define-deploy-all";
import {scenario1} from "./define-scenario1";

deployConfig()
    .then(c => deployAll(c))
    .then(c => scenario1(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });