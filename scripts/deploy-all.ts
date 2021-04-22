import * as deploy from '../test/helpers/deploy';
import {diamondAsFacet} from '../test/helpers/diamond';
import {ReignFacet, ReignToken, Rewards} from '../typechain';
import {BigNumber} from 'ethers';
import * as helpers from '../test/helpers/helpers';
import {addMinutes} from '../test/helpers/helpers';
import {getAccount} from "../test/helpers/accounts";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

// start timestamp
const startTs = Math.floor(Date.now() / 1000);
// end timestamp (30 minutes from now)
const endTs = Math.floor(addMinutes(new Date(), 30).getTime() / 1000);

// rewards amount
const rewardsAmount = BigNumber.from(610000).mul(helpers.tenPow18);

async function main() {

    const _ownerAddr = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    const _user1Addr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const _user2Addr = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const _ownerAcct: SignerWithAddress = await getAccount(_ownerAddr)
    const _user1Acct: SignerWithAddress = await getAccount(_user1Addr)
    const _user2Acct: SignerWithAddress = await getAccount(_user2Addr)

    const _reignTokenAmountToOwnerAddr = BigNumber.from(2800000).mul(helpers.tenPow18);
    const _reignTokenAmountToUser1Addr = BigNumber.from(4500000).mul(helpers.tenPow18);

    const _svrTokenAmountToOwnerAddr = BigNumber.from(2800000).mul(helpers.tenPow18);
    const _svrTokenAmountToUser1Addr = BigNumber.from(4500000).mul(helpers.tenPow18);

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
    const diamondReign = await deploy.deployDiamond(
        'Reign',
        [cutFacet, loupeFacet, ownershipFacet, crf, reignFacet],
        _ownerAddr,
    );
    console.log(`Reign deployed at: ${diamondReign.address}`);

    ///////////////////////////
    // Deploy "ReignToken" contract:
    ///////////////////////////
    const reignToken = await deploy.deployContract('ReignToken', [_ownerAddr]) as ReignToken;
    console.log(`ReignToken deployed at: ${reignToken.address}`);

    // mint:
    await reignToken.mint(_ownerAddr, _reignTokenAmountToOwnerAddr)
    console.log(`ReignToken minted: '${_reignTokenAmountToOwnerAddr}' to addr '${_ownerAddr}'`);
    await reignToken.mint(_user1Addr, _reignTokenAmountToUser1Addr)
    console.log(`ReignToken minted: '${_reignTokenAmountToUser1Addr}' to addr '${_user1Addr}'`);
    
    // set controller to Reign diamond:
    await reignToken.setController(diamondReign.address)
    console.log(`ReignToken controller changed: '${diamondReign.address}'`);

    ///////////////////////////
    // Deploy "SVR Token" contract:
    ///////////////////////////
    const svrToken = await deploy.deployContract('SvrToken', [_ownerAddr]);
    console.log(`SvrToken deployed at: ${svrToken.address}`);

    // mint:
    await svrToken.mint(_ownerAddr, _svrTokenAmountToOwnerAddr)
    console.log(`SvrToken minted: '${_svrTokenAmountToOwnerAddr}' to addr '${_ownerAddr}'`);
    await svrToken.mint(_user1Addr, _svrTokenAmountToUser1Addr)
    console.log(`SvrToken minted: '${_svrTokenAmountToUser1Addr}' to addr '${_user1Addr}'`);
    
    // set controller to Reign diamond:
    await svrToken.setController(diamondReign.address)
    console.log(`SvrToken controller changed: '${diamondReign.address}'`);

    ///////////////////////////
    // Deploy "Rewards" contract:
    ///////////////////////////

    const rewards = (await deploy.deployContract('Rewards', [_ownerAddr, reignToken.address, diamondReign.address])) as Rewards;
    console.log(`Rewards deployed at: ${rewards.address}`);

    ///////////////////////////
    // Init "Reign":
    ///////////////////////////

    console.log('Calling initReign');
    const reign = (await diamondAsFacet(diamondReign, 'ReignFacet')) as ReignFacet;
    await reign.initReign(reignToken.address, rewards.address);

    ///////////////////////////
    // Init "Rewards":
    ///////////////////////////

    console.log('Calling setupPullToken');
    await rewards.setupPullToken(_ownerAddr, startTs, endTs, rewardsAmount);

    ///////////////////////////
    // User1 addr Stake ReignToken to Reign:
    ///////////////////////////


    ///////////////////////////
    // Deploy "BasketBalancer" contract:
    ///////////////////////////
    const basketBalancer1 = await deploy.deployContract(
        'BasketBalancer',
        [
            // empty since new pools can be added later (initial state)
            [],
            // empty since new allocations can be added later (initial state)
            [],
            diamondReign.address
        ]
    );
    console.log(`BasketBalancer deployed at: ${basketBalancer1.address}`);

    ///////////////////////////
    // Deploy "InterestStrategy" contract:
    ///////////////////////////
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [
            // both params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10**10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            diamondReign.address,
            helpers.stakingEpochStart
        ]
    );
    console.log(`InterestStrategy deployed at: ${interestStrategy1.address}`);

    // - stake the Reign tokens in the Reign contract
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
