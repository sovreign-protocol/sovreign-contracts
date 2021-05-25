import {deployDAO} from "./deployment/define-1-deploy-DAO";
import {tokenSetup} from "./deployment/define-2-tokens-setup";
import {controllerSetup} from "./deployment/define-3-controller-setup";
import {activateSoVReign} from "./deployment/define-4-activate-SoVReign";
import {deployConfig} from "./config-rinkeby";

deployConfig()
    .then(c => deployDAO(c))
    .then(c => tokenSetup(c))
    .then(c => controllerSetup(c))
    .then(c => activateSoVReign(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });