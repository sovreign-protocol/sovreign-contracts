import * as deploy from '../test/helpers/deploy';
import {diamondAsFacet} from '../test/helpers/diamond';
import {ReignFacet, Rewards} from '../typechain';
import {BigNumber} from 'ethers';
import * as helpers from '../test/helpers/helpers';
import {addMinutes} from '../test/helpers/helpers';

const _owner = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const _bond = '0x0391D2021f89DC339F60Fff84546EA23E337750f';

// needed for rewards setup
const _cv = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
// start timestamp
const startTs = Math.floor(Date.now() / 1000);
// end timestamp (30 minutes from now)
const endTs = Math.floor(addMinutes(new Date(), 30).getTime() / 1000);

// rewards amount
const rewardsAmount = BigNumber.from(610000).mul(helpers.tenPow18);

async function main() {

    ///////////////////////////
    // deploy 'facet' contracts:
    ///////////////////////////
    const cutFacet = await deploy.deployContract('DiamondCutFacet');
    console.log(`DiamondCutFacet deployed to: ${cutFacet.address}`);

    const loupeFacet = await deploy.deployContract('DiamondLoupeFacet');
    console.log(`DiamondLoupeFacet deployed to: ${loupeFacet.address}`);

    const ownershipFacet = await deploy.deployContract('OwnershipFacet');
    console.log(`OwnershipFacet deployed to: ${ownershipFacet.address}`);

    const crf = await deploy.deployContract('ChangeRewardsFacet');
    console.log(`ChangeRewardsFacet deployed to: ${crf.address}`);

    const reignFacet = await deploy.deployContract('ReignFacet');
    console.log(`ReignFacet deployed at: ${reignFacet.address}`);

    ///////////////////////////
    // deploy 'diamond' "Reign" contract:
    ///////////////////////////
    const diamond = await deploy.deployDiamond(
        'Reign',
        [cutFacet, loupeFacet, ownershipFacet, crf, reignFacet],
        _owner,
    );
    console.log(`Reign deployed at: ${diamond.address}`);

    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [_owner]);
    console.log(`ReignToken deployed at: ${reignToken.address}`);

    ///////////////////////////
    // Deploy "SVR Token" contract:
    ///////////////////////////
    const sovToken = await deploy.deployContract('SovToken', [_owner]);
    console.log(`SovToken deployed at: ${sovToken.address}`);

    // mint and setController


    ///////////////////////////
    // Deploy "Rewards" contract:
    ///////////////////////////

    const rewards = (await deploy.deployContract('Rewards', [_owner, _bond, diamond.address])) as Rewards;
    console.log(`Rewards deployed at: ${rewards.address}`);

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////

    console.log('Calling initReign');
    const reign = (await diamondAsFacet(diamond, 'ReignFacet')) as ReignFacet;
    await reign.initReign(_bond, rewards.address);

    ///////////////////////////
    // Init "Rewards":
    ///////////////////////////

    console.log('Calling setupPullToken');
    await rewards.setupPullToken(_cv, startTs, endTs, rewardsAmount);

    ///////////////////////////
    // Deploy "BasketBalancer" contract:
    ///////////////////////////
    // TODO: arguments?
    const basketBalancer1 = await deploy.deployContract(
        'BasketBalancer',
        [
            [],
            [],
            diamond.address,
            diamond.address
        ]
    );
    console.log(`BasketBalancer deployed at: ${basketBalancer1.address}`);

    ///////////////////////////
    // Deploy "InterestStrategy" contract:
    ///////////////////////////
    // TODO: arguments?
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [

        ]
    );
    console.log(`InterestStrategy deployed at: ${interestStrategy1.address}`);



    // - mint Reign tokens
    // - stake the Reign tokens in the Reing contract
    // - create proposals and govern

    // - updateAllocationVote
    // - updateBasketBalance

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
