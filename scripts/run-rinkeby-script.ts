import {deployConfig} from "./config-rinkeby";
import { Script } from "./rinkeby-actions/deploy-LPRew";

deployConfig()
    .then(c => Script(c))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });