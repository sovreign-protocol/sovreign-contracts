import { ethers } from 'hardhat';
import { BigNumber, Signer, version } from 'ethers';
import { expect } from 'chai';
import { moveAtEpoch, setTime, tenPow18, getCurrentUnix } from "./helpers/helpers";

import { 
    PoolRouter, SmartPoolMock, ERC20Mock, WrapSVR, EpochClockMock} from "../typechain";
    import { deployContract } from "./helpers/deploy";
import { prependOnceListener } from 'process';


describe('PoolRouter', function () {
    let wrapper: WrapSVR;
    let smartPool: SmartPoolMock;
    let router: PoolRouter;
    let underlyingToken: ERC20Mock;
    let creator: Signer, owner: Signer, user:Signer, treasury: Signer;
    let ownerAddr: string, userAddr: string, treasuryAddr: string;
    let epochClock:EpochClockMock

    const amount = BigNumber.from(100).mul(tenPow18) as BigNumber;
    const amountLP = BigNumber.from(50).mul(tenPow18) as BigNumber;
    const totalAmount = amount.mul(100);

    const epochStart = Math.floor(Date.now() / 1000) + 1000;

    const protocolFee = 100000 - 50;

    const liquidationFee = 100000; // 10%

    let snapshotId: any;


    let amountLPBefore:BigNumber;
    let amountBefore:BigNumber;
    let routerBalanceBefore:BigNumber;

    before(async () => {
        [creator, owner, user, treasury] = await ethers.getSigners();
        ownerAddr = await owner.getAddress();
        userAddr = await user.getAddress();
        treasuryAddr = await treasury.getAddress();


        await setTime(await getCurrentUnix());

        epochClock = (await deployContract('EpochClockMock', [epochStart])) as EpochClockMock;
        wrapper = (await deployContract("WrapSVR")) as WrapSVR;
        smartPool = (await deployContract("SmartPoolMock")) as SmartPoolMock;

        underlyingToken = (await deployContract("ERC20Mock")) as ERC20Mock; 

        router = (await deployContract("PoolRouter", [
            smartPool.address, 
            wrapper.address,
            treasuryAddr,
            protocolFee
        ])) as PoolRouter;

        await wrapper.initialize(
            epochClock.address,  
            ownerAddr, 
            smartPool.address,
            router.address,
        )

        
        await underlyingToken.mint(userAddr, totalAmount)
        await underlyingToken.connect(user).approve(router.address, totalAmount)


        
    });

    beforeEach(async function () {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async function () {
        await ethers.provider.send("evm_revert", [snapshotId]);
    });


    describe('General', async function () {
        it('should be deployed', async function () {
            expect(router.address).to.not.equal(0)
        })
    })

    describe('Deposit', async function () {

        before(async function () {
            await router.connect(user).deposit(underlyingToken.address, amount, amountLP, liquidationFee);
        });

        it('deposits LP tokens in wrapper on behalf of user', async function () {
            expect(await wrapper.balanceLocked(userAddr)).to.be.eq(amountLP.mul(protocolFee).div(100000))
        })

        it('mints the correct amount of SVR to the user', async function () {
            expect(await wrapper.balanceOf(userAddr)).to.be.eq(amountLP.mul(protocolFee).div(100000))
        })

        it('pulls the underlying form the user', async function () {
            expect(await underlyingToken.balanceOf(userAddr)).to.be.eq(totalAmount.sub(amount))
        })

        it('accrues protocol fee', async function () {
            expect(await underlyingToken.balanceOf(router.address)).to.be.eq(amount.mul(50).div(100000))
        })
    })

    describe('Withdraw', async function () {


        before(async function () {
            amountLPBefore = (await wrapper.balanceLocked(userAddr))
            amountBefore = (await underlyingToken.balanceOf(userAddr))
            routerBalanceBefore = (await underlyingToken.balanceOf(router.address))
            //withdraw half of what was deposited before
            await router.connect(user).withdraw(underlyingToken.address, amountLP.div(2), amount.div(2));
        });

        it('withdraws LP tokens from wrapper on behalf of user', async function () {
            expect(await wrapper.balanceLocked(userAddr)).to.be.eq(
                amountLPBefore.sub(amountLP.div(2))
            )
        })

        it('burns the correct amount of SVR from the user', async function () {
            expect(await wrapper.balanceOf(userAddr)).to.be.eq(
                amountLPBefore.sub(amountLP.div(2))
            )
        })

        it('sends the underlying to the user', async function () {
            expect(await underlyingToken.balanceOf(userAddr)).to.be.eq(
                amountBefore.add(amount.div(2).mul(protocolFee).div(100000))
            )
        })

        it('accrues protocol fee', async function () {
            expect(await underlyingToken.balanceOf(router.address)).to.be.eq(
                routerBalanceBefore.add(amount.div(2).mul(50).div(100000))
            )
        })
    })

    

    describe('Liquidate', async function () {

        before(async function () {
            amountLPBefore = (await wrapper.balanceLocked(userAddr))
            amountBefore = (await underlyingToken.balanceOf(userAddr))
            routerBalanceBefore = (await underlyingToken.balanceOf(router.address))

            await underlyingToken.mint(ownerAddr, totalAmount)

            //owner needs SVR tokens to liquidate, lets assume user sends the necessary SVR to owner
            await wrapper.connect(user).transfer(ownerAddr, amountLP.div(4))

            //approve underlying to pay fee
            await underlyingToken.connect(owner).approve(router.address, (amount.div(4)).div(10))

            //liquidate half of the remaining position
            await router.connect(owner).liquidate(
                userAddr, 
                underlyingToken.address, 
                amountLP.div(4), 
                amount.div(4)
            );
        });

        let feeAmount = (amount.div(4)).div(10) // 10% of withdrawn amount

        
        it('liquidates LP tokens from wrapper on the position of the user', async function () {
            expect(await wrapper.balanceLocked(userAddr)).to.be.eq(
                amountLPBefore.sub(amountLP.div(4))
            )
        })

        it('burns the correct amount of SVR from the liquidator', async function () {
            expect(await wrapper.balanceOf(ownerAddr)).to.be.eq(0)
        })

        it('sends the underlying to the liquidator and subtracts fee', async function () {
            expect(await underlyingToken.balanceOf(ownerAddr)).to.be.eq(
                totalAmount
                .add(amount.div(4).mul(protocolFee).div(100000)) // underlying received from liquidation
                .sub(feeAmount) // fee paid
            )
        })

        it('transfered fee to liquidated user', async function () {
            expect(await underlyingToken.balanceOf(userAddr)).to.be.eq(
                amountBefore
                .add(feeAmount) // fee received
            )
        })
    })

    describe('Collect Protocol Fees', async function () {

        it('can collect fees to treasury', async function () {
            let balanceBefore = await underlyingToken.balanceOf(router.address);

            await router.collectFeesToDAO(underlyingToken.address);

            expect(await underlyingToken.balanceOf(treasuryAddr)).to.be.eq(balanceBefore)
        });
    });

    describe('Liquidate With no Allowance', async function () {

        it('transfered fee to liquidated user', async function () {
            //owner needs SVR tokens to liquidate, lets assume user sends the necessary SVR to owner
            await router.connect(user).deposit(underlyingToken.address, amount, amountLP, liquidationFee);
            await wrapper.connect(user).transfer(ownerAddr, amountLP)


            //liquidate half of the remaining position
            await expect(router.connect(owner).liquidate(
                userAddr, 
                underlyingToken.address, 
                amountLP.div(4), 
                amount.div(4)
            )).to.be.revertedWith("Insuffiecient allowance for liquidation Fee")
        });
    });

});