import {deployConfig} from "./config";
import {contractsPreFlight} from "./deployment/define-0-contracts-preflight";
import {deployDAO} from "./deployment/define-1-deploy-DAO";
import {tokenSetup} from "./deployment/define-2-tokens-setup";
import {uniswapSetup} from "./deployment/define-2.5-uniswap-setup";
import {setupSmartPool} from "./deployment/define-3-pool-setup";
import {activateSoVReign} from "./deployment/define-4-activate-SoVReign";
import {transferOwnership} from "./deployment/define-5-transfer-ownership";
import {createPools} from "./deployment/define-6-add-token";
import {createRewards} from "./deployment/define-7-create-rewards";

deployConfig()
    .then(c => contractsPreFlight(c))
    .then(c => deployDAO(c))
    .then(c => tokenSetup(c))
    .then(c => uniswapSetup(c))
    .then(c => setupSmartPool(c))
    .then(c => activateSoVReign(c))
    .then(c => transferOwnership(c))
    .then(c => createPools(c))
    //.then(c => createRewards(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });