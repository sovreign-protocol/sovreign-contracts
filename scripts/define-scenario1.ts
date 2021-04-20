import {DeployConfig} from "./config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {Governance, PoolController, Reign, ReignFacet, ReignToken, Rewards} from "../typechain";
import * as helpers from "../test/helpers/governance-helpers";
import {diamondAsFacet} from "../test/helpers/diamond";

export async function scenario1(c: DeployConfig): Promise<DeployConfig> {

    const reignDiamondAddr = c.reignDiamond?.address as string;
    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const reignFacet = await diamondAsFacet(reignDiamond, 'ReignFacet') as ReignFacet;
    const reignDAO = c.reignDAO as Governance;
    const poolController = c.poolController as PoolController;
    const rewards = c.rewards as Rewards;

    ///////////////////////////
    // User1 stakes ReignToken to ReignDiamond:
    ///////////////////////////
    const amountStakedUser1 = BigNumber.from(1000).mul(helpers.tenPow18);
    console.log(`User1 approves addr '${reignDiamond.address}' to transfer '${amountStakedUser1}'`)

    console.log('user1 addr: ' + c.user1Acct.getAddress())

    await reignToken
        .connect(c.user1Acct)
        .approve(reignDiamond.address, amountStakedUser1);
    await reignToken
        .connect(c.user1Acct)
        .approve(rewards.address, amountStakedUser1);
    console.log(`User1 deposits '${amountStakedUser1}' to ReignDiamond`)
    await reignFacet
        .connect(c.user1Acct)
        .deposit(amountStakedUser1);

    const targets = [poolController.address];
    const values = ['0'];
    const signatures = ['createPool(address,address,address)', 'createPool(address,address,address)'];
    const callDatas = [
        // for the first pool:
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'address',
                'address'
            ],
            [
                // first param: token
                helpers.ZERO_ADDRESS,
                // second param: interestStrategy
                helpers.ZERO_ADDRESS,
                // third param: oracle
                helpers.ZERO_ADDRESS,
            ]
        ),
        // for the second pool:
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'address',
                'address'
            ],
            [
                // first param: token
                helpers.ZERO_ADDRESS,
                // second param: interestStrategy
                helpers.ZERO_ADDRESS,
                // third param: oracle
                helpers.ZERO_ADDRESS,
            ]
        ),
    ];

    console.log(`User1 propose to create two pools.`)
    await reignDAO
        .connect(c.user1Acct)
        .propose(
            targets,
            values,
            signatures,
            callDatas,
            'Create two pools.',
            'Proposal1'
        );

    // - create proposal to:
    //   -- Pool1: createPool(oracle, interest strategy)
    //   -- Pool2: createPool(oracle, interest strategy)
    //   -- advance blocks (timewarp)

    // - test case:
    //   -- updateAllocationVote
    //   -- updateBasketBalance

    return c;

}