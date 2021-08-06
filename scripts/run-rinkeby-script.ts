import {deployConfig} from "./config-rinkeby";
import { transferOwnership } from "./rinkeby-actions/transfer-pool-ownership";
import { deployGovRew } from "./rinkeby-actions/deploy-gov";

deployConfig()
    .then(c => deployGovRew(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });