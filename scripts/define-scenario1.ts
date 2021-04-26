import {DeployConfig} from "./config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {Governance, PoolController, ReignFacet, ReignToken, Rewards} from "../typechain";
import * as helpers from "../test/helpers/governance-helpers";
import {diamondAsFacet} from "../test/helpers/diamond";
import {minute} from "../test/helpers/time";
import {moveAtTimestamp} from "../test/helpers/helpers";

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
    const amountStakedUser1 = BigNumber.from(100_000).mul(helpers.tenPow18);

    console.log(`User1 approves addr '${reignDiamond.address}' to transfer '${amountStakedUser1}'`)
    await reignToken
        .connect(c.user1Acct)
        .approve(reignDiamond.address, amountStakedUser1);

    console.log(`User1 deposits '${amountStakedUser1}' to ReignDiamond`)
    await reignFacet
        .connect(c.user1Acct)
        .deposit(amountStakedUser1);

    const targets = [
        poolController.address,
        poolController.address
    ];
    const values = ['0', '0'];
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

    console.log(`User1 proposes to create two pools.`)
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

    ///////////////////////////
    // Time warp
    ///////////////////////////
    const timeWarpInSeconds = 5 * minute
    console.log(`Time warping in '${timeWarpInSeconds}' seconds...`)
    await moveAtTimestamp(timeWarpInSeconds)

    ///////////////////////////
    // Get last proposal
    ///////////////////////////
    let proposalId = await reignDAO
        .connect(c.user1Acct)
        .lastProposalId();
    console.log(`Proposal created with ID: ${proposalId}`)

    // - test case:
    //   -- updateAllocationVote
    //   -- updateBasketBalance

    return c;

}