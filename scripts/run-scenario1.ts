import {deployConfig} from "./config";
import {contractsPreFlight} from "./deployment/define-0-contracts-preflight";
import {fundOwnerWallet} from "./deployment/define-0.5-fund-owner-wallet";
import {deployDAO} from "./deployment/define-1-deploy-DAO";
import {tokenSetup} from "./deployment/define-2-tokens-setup";
import {setupSmartPool} from "./deployment/define-3-pool-setup";
import {activateSoVReign} from "./deployment/define-4-activate-SoVReign";
import {transferOwnership} from "./deployment/define-6-transfer-ownership";
import {createRewards} from "./deployment/define-5-create-rewards";
import {scenario1} from "./scenarios/scenario-1-harvest";

deployConfig()
    .then(c => contractsPreFlight(c))
    .then(c => fundOwnerWallet(c))
    .then(c => deployDAO(c))
    .then(c => tokenSetup(c))
    .then(c => setupSmartPool(c))
    .then(c => activateSoVReign(c))
    .then(c => createRewards(c))
    .then(c => transferOwnership(c))
    .then(c => scenario1(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });