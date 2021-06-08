import {deployDAO} from "./deployment/define-1-deploy-DAO";
import {tokenSetup} from "./deployment/define-2-tokens-setup";
import {uniswapSetup} from "./deployment/define-2.5-uniswap-setup";
import {setupSmartPool} from "./deployment/define-3-pool-setup";
import {activateSoVReign} from "./deployment/define-4-activate-SoVReign";
import {deployConfig} from "./config-rinkeby";
import {contractsPreFlight} from "./deployment/define-0-contracts-preflight";

deployConfig()
    .then(c => contractsPreFlight(c))
    .then(c => deployDAO(c))
    .then(c => tokenSetup(c))
    .then(c => uniswapSetup(c))
    .then(c => setupSmartPool(c))
    .then(c => activateSoVReign(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });