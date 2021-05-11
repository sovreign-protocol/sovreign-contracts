import {DeployConfig} from "./config";
import {BigNumber, Contract, ethers as ejs} from "ethers";
import {GovRewards, InterestStrategy, PoolController, ReignDAO, ReignFacet, ReignToken} from "../typechain";
import * as helpers from "../test/helpers/governance-helpers";
import {diamondAsFacet} from "../test/helpers/diamond";
import {minute} from "../test/helpers/time";
import {moveAtTimestamp, stakingEpochStart} from "../test/helpers/helpers";
import * as deploy from "../test/helpers/deploy";

export class Scenario1Config {

    public amountStakedUser1?: BigNumber;
    public interestStrategy1?: InterestStrategy;
    public interestStrategy2?: InterestStrategy;

    constructor() {
    }
}

export async function scenario1(c: DeployConfig): Promise<DeployConfig> {

    c.scenario1 = new Scenario1Config();

    const reignDiamondAddr = c.reignDiamond?.address as string;
    const reignToken = c.reignToken as ReignToken;
    const reignDiamond = c.reignDiamond as Contract;
    const reignFacet = await diamondAsFacet(reignDiamond, 'ReignFacet') as ReignFacet;
    const reignDAO = c.reignDAO as ReignDAO;
    const poolController = c.poolController as PoolController;
    const govRewards = c.govRewards as GovRewards;

    ///////////////////////////
    // User1 stakes ReignToken to ReignDiamond:
    ///////////////////////////
    const amountStakedUser1 = BigNumber.from(100_000).mul(helpers.tenPow18);
    c.scenario1.amountStakedUser1 = amountStakedUser1;

    console.log(`User1 approves addr '${reignDiamond.address}' to transfer '${amountStakedUser1}'`)
    await reignToken
        .connect(c.user1Acct)
        .approve(reignDiamond.address, amountStakedUser1);

    console.log(`User1 deposits '${amountStakedUser1}' to ReignDiamond`)
    await reignFacet
        .connect(c.user1Acct)
        .deposit(amountStakedUser1);

    ///////////////////////////
    // User1 deploy InterestStrategy1 contract for Pool1:
    ///////////////////////////
    const interestStrategy1 = await deploy.deployContract(
        'InterestStrategy',
        [
            // params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10 ** 10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            BigNumber.from(0),
            reignDiamond.address,
            stakingEpochStart
        ]
    ) as InterestStrategy;
    c.scenario1.interestStrategy1 = interestStrategy1;
    console.log(`InterestStrategy1 deployed at: ${interestStrategy1.address.toLowerCase()}`);

    ///////////////////////////
    // User1 deploy InterestStrategy2:
    ///////////////////////////
    const interestStrategy2 = await deploy.deployContract(
        'InterestStrategy',
        [
            // params were taken from the InterestStrategy.test.ts
            BigNumber.from(3).mul(10 ** 10),
            BigNumber.from(8).mul(BigNumber.from(10).pow(BigNumber.from(59))),
            BigNumber.from(0),
            reignDiamond.address,
            stakingEpochStart
        ]
    ) as InterestStrategy;
    c.scenario1.interestStrategy2 = interestStrategy2;
    console.log(`InterestStrategy2 deployed at: ${interestStrategy2.address.toLowerCase()}`);


    const targets = [
        poolController.address,
        poolController.address
    ];
    const values = ['0', '0'];
    const signatures = ['createPool(address,address,address)', 'createPool(address,address,address)'];
    const callDatas = [
        // for the first pool (Pool1):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'address',
                'address'
            ],
            [
                // first param: token address
                // WBTC: https://etherscan.io/token/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
                "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
                // second param: interestStrategy
                interestStrategy1.address,
                // third param: oracle
                helpers.ZERO_ADDRESS,
            ]
        ),
        // for the second pool (Pool2):
        ejs.utils.defaultAbiCoder.encode(
            [
                'address',
                'address',
                'address'
            ],
            [
                // first param: token address
                // MKR: https://etherscan.io/token/0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2
                "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
                // second param: interestStrategy
                interestStrategy2.address,
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