import {deployConfig} from "./config";
import {deployAll} from "./define-deploy-all";

deployConfig()
    .then(deployAll)
    .catch(error => {
        console.error(error);
        process.exit(1);
    });