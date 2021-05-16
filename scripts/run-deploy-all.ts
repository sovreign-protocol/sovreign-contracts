import {deployConfig} from "./config";
import {mainnetPreFlight} from "./define-0-mainnet-preflight";
import {deployDAO} from "./define-1-deploy-DAO";
import {tokenSetup} from "./define-2-tokens-setup";
import {controllerSetup} from "./define-3-controller-setup";
import {activateSoVReign} from "./define-4-activate-SoVReign";
import {createPools} from "./define-5-create-pools";
import {createRewards} from "./define-6-create-rewards";

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