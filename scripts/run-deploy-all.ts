import {deployConfig} from "./config";
import {mainnetPreFlight} from "./deployment/define-0-mainnet-preflight";
import {deployDAO} from "./deployment/define-1-deploy-DAO";
import {tokenSetup} from "./deployment/define-2-tokens-setup";
import {controllerSetup} from "./deployment/define-3-controller-setup";
import {activateSoVReign} from "./deployment/define-4-activate-SoVReign";
import {createPools} from "./deployment/define-5-create-pools";
import {createRewards} from "./deployment/define-6-create-rewards";

deployConfig()
    .then(c => mainnetPreFlight(c))
    .then(c => deployDAO(c))
    .then(c => tokenSetup(c))
    .then(c => controllerSetup(c))
    .then(c => activateSoVReign(c))
    .then(c => createPools(c))
    .then(c => createRewards(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });