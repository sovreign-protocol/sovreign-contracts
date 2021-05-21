import {DeployConfig} from "./config";
import * as deploy from "../test/helpers/deploy";
import {
    ReignDAO,
} from "../typechain";
import { getCurrentUnix } from "../test/helpers/helpers";


export async function deployDAO(c: DeployConfig): Promise<DeployConfig> {
    console.log(`\n --- DEPLOY REIGN DAO ---`);
    

    ///////////////////////////
    // Deploy 'Facet' contracts:
    ///////////////////////////
    const cutFacet = await deploy.deployContract('DiamondCutFacet');
    console.log(`DiamondCutFacet deployed to: ${cutFacet.address.toLowerCase()}`);

    const loupeFacet = await deploy.deployContract('DiamondLoupeFacet');
    console.log(`DiamondLoupeFacet deployed to: ${loupeFacet.address.toLowerCase()}`);

    const ownershipFacet = await deploy.deployContract('OwnershipFacet');
    console.log(`OwnershipFacet deployed to: ${ownershipFacet.address.toLowerCase()}`);

    const epochClockFacet = await deploy.deployContract('EpochClockFacet');
    console.log(`EpochClockFacet deployed to: ${epochClockFacet.address}`);

    const reignFacet = await deploy.deployContract('ReignFacet');
    console.log(`ReignFacet deployed at: ${reignFacet.address.toLowerCase()}`);

    ///////////////////////////
    // Deploy "ReignDiamond" contract:
    ///////////////////////////
    const reignDiamond = await deploy.deployDiamond(
        'ReignDiamond',
        [cutFacet, loupeFacet, ownershipFacet, reignFacet, epochClockFacet],
        c.sovReignOwnerAddr,
    );
    c.reignDiamond = reignDiamond;
    console.log(`ReignDiamond deployed at: ${reignDiamond.address.toLowerCase()}`);

    

    ///////////////////////////
    // Deploy "ReignDAO" contract:
    ///////////////////////////
    const reignDAO = await deploy.deployContract('ReignDAO') as ReignDAO;
    c.reignDAO = reignDAO;
    console.log(`ReignDAO deployed at: ${reignDAO.address.toLowerCase()}`);


    return c;
}