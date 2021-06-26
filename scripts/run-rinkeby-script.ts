import {deployConfig} from "./config-rinkeby";
import { transferOwnership } from "./rinkeby-actions/transfer-pool-ownership";

deployConfig()
    .then(c => transferOwnership(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });