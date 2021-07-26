import {deployConfig} from "./config-rinkeby";
import { transferOwnership } from "./rinkeby-actions/transfer-pool-ownership";
import { setAllowance } from "./rinkeby-actions/set-allowance";

deployConfig()
    .then(c => setAllowance(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });