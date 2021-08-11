import {deployConfig} from "./config-rinkeby";
import { Script } from "./rinkeby-actions/set-allowance";

deployConfig()
    .then(c => Script(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });