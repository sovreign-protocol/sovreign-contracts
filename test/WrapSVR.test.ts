import { ethers } from "hardhat";
import { BigNumber, BigNumberish, Signer } from "ethers";
import { moveAtEpoch, setTime, tenPow18, getCurrentUnix, zeroAddress } from "./helpers/helpers";
import { deployContract } from "./helpers/deploy";
import { expect } from "chai";
import { ERC20Mock, WrapSVR, EpochClockMock } from "../typechain";

describe("WrapSVR", function () {
    let wrapper: WrapSVR;
    let balancerLP: ERC20Mock;
    let underlyingToken: ERC20Mock;
    let creator: Signer, owner: Signer, user:Signer, newUser: Signer;
    let ownerAddr: string, userAddr: string, newUserAddr: string;
    let epochClock:EpochClockMock

    const amount = BigNumber.from(100).mul(tenPow18) as BigNumber;
    const MULTIPLIER_DECIMALS = 18;
    const BASE_MULTIPLIER = BigNumber.from(10).pow(MULTIPLIER_DECIMALS);

    const epochStart = Math.floor(Date.now() / 1000) + 1000;
    const epochDuration = 604800;

    const liquidationFee = 100000; // 10%

    let snapshotId: any;

    before(async () => {
        [creator, owner, user, newUser] = await ethers.getSigners();
        ownerAddr = await owner.getAddress();
        userAddr = await user.getAddress();
        newUserAddr = await newUser.getAddress();


        await setTime(await getCurrentUnix());

        epochClock = (await deployContract('EpochClockMock', [epochStart])) as EpochClockMock;
        wrapper = (await deployContract("WrapSVR")) as WrapSVR;
        balancerLP = (await deployContract("ERC20Mock")) as ERC20Mock;

        await wrapper.initialize(
            epochClock.address,  
            ownerAddr, 
            balancerLP.address,
            userAddr,
        )

        underlyingToken = (await deployContract("ERC20Mock")) as ERC20Mock;

        
        await balancerLP.mint(userAddr, amount.mul(100))
        
    });

    beforeEach(async function () {
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async function () {
        await ethers.provider.send("evm_revert", [snapshotId]);
    });


    


    describe("General", function () {
        it("Can deploy successfully", async function () {
            expect(wrapper.address).to.not.equal(0);
        });

        it("Can not initialize twice", async function () {
            await expect(
                wrapper.initialize(
                    epochClock.address,  
                    ownerAddr, 
                    balancerLP.address,
                    userAddr,
                )
            ).to.be.revertedWith("Can only be initialized once");
        });
    })

    describe('ERC-20', async function () {

        it('transfers amounts correctly', async function () {
            await deposit(user, amount)
            let transfers = BigNumber.from(10)
            await wrapper.connect(user).transfer(newUserAddr,transfers);
            expect(await wrapper.balanceOf(newUserAddr)).to.be.eq(transfers)
        })

        it('reverts if transfers more then balance', async function () {
            await deposit(user, amount)
            let transfers = (await wrapper.balanceOf(userAddr)).add(1000)
            await expect(
                wrapper.connect(user).transfer(newUserAddr,transfers)
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('set allowance amounts correctly', async function () {
            await deposit(user, amount)
            let allow = BigNumber.from(10)
            await wrapper.connect(user).approve(newUserAddr,allow);
            expect(await wrapper.allowance(userAddr,newUserAddr)).to.be.eq(allow)
        })

        it('makes TransferFrom correctly', async function () {
            await deposit(user, amount)
            let allow = BigNumber.from(10)
            await wrapper.connect(user).approve(newUserAddr,allow);
            await wrapper.connect(newUser).transferFrom(userAddr,newUserAddr, allow);
            expect(await wrapper.balanceOf(newUserAddr)).to.be.eq(allow);
        })

        it('reverts if transferFrom is above allowance', async function () {
            await deposit(user, amount)
            let allow = BigNumber.from(10)
            await wrapper.connect(user).approve(newUserAddr,allow);
            await expect(
                wrapper.connect(user).transferFrom(userAddr,newUserAddr,allow.add(1))
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('TransferFrom reduces allowance', async function () {
            await deposit(user, amount)
            let allow = BigNumber.from(10)
            await wrapper.connect(user).approve(newUserAddr,allow);
            await wrapper.connect(newUser).transferFrom(userAddr,newUserAddr, allow.sub(5));
            expect(await wrapper.allowance(userAddr,newUserAddr)).to.be.eq(allow.sub(5))
        })
    })

    describe("Deposit", function () {
        it("If deposit is 0 just set liquidation fee", async function () {
            await expect(
                wrapper.connect(user).deposit(userAddr, 0, 100000)
            ).to.not.be.reverted;

            expect( await wrapper.liquidationFee(userAddr)).to.be.eq(liquidationFee)
            expect( await wrapper.balanceLocked(userAddr)).to.be.eq(0)
            expect( await wrapper.epoch1Start()).to.be.eq(epochStart)
        });
        
        it("reverts if user sets liquidation fee above max", async function () {
            await expect(
                wrapper.connect(user).deposit(userAddr, 0, 200000)
            ).to.be.revertedWith("Liquidation fee above max value")
        })

        it("Can not deposit if is not Router", async function () {
            await expect(
                wrapper.connect(owner).deposit(ownerAddr, 0, 100000)
            ).to.be.revertedWith("Only Router can do this");

        });

        it("Reverts if amount > allowance", async function () {
            await balancerLP.mint(userAddr, amount);
            // no allowance

            await expect(
                wrapper.connect(user).deposit(userAddr, amount,100000)
            ).to.be.revertedWith("Wrapper: Token allowance too small");
        });

        it("Saves users deposit in state", async function () {
            await balancerLP.mint(userAddr, amount);
            await balancerLP.connect(user).approve(wrapper.address, amount);

            await wrapper.connect(user).deposit(userAddr, amount,100000);

            const balance = await wrapper.balanceLocked(userAddr);

            expect(balance.toString()).to.be.equal(amount.toString());
        });

        it("Calls transferFrom when conditions are met", async function () {
            await balancerLP.mint(userAddr, amount);
            await balancerLP.connect(user).approve(wrapper.address, amount);

            await wrapper.connect(user).deposit(userAddr, amount,100000);

            expect(await balancerLP.transferFromCalled()).to.be.true;
        });

        it("Updates the pool size of the next epoch", async function () {
            await balancerLP.mint(userAddr, amount);
            await balancerLP.connect(user).approve(wrapper.address, amount);

            await wrapper.connect(user).deposit(userAddr, amount,100000);

            expect((await wrapper.getEpochPoolSize(1)).toString()).to.be.equal(amount.toString());
        });

        it("Updates the user balance of the next epoch", async function () {
            await balancerLP.mint(userAddr, amount.mul(10));
            await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));

            await wrapper.connect(user).deposit(userAddr, amount,100000);

            expect(
                (await wrapper.getEpochUserBalance(userAddr,1)).toString()
            ).to.be.equal(amount.toString());

            // move forward to epoch 1
            // do one more deposit then check that the user balance is still correct
            await moveAtEpoch(epochStart, epochDuration, 1);

            await wrapper.connect(user).deposit(userAddr, amount,100000);

            expect(
                (await wrapper.getEpochUserBalance(userAddr, 2)).toString()
            ).to.be.equal(amount.mul(2).toString());
        });

        describe("Continuous deposits", function () {
            beforeEach(async function () {
                await balancerLP.mint(userAddr, amount.mul(10));
                await balancerLP.mint(ownerAddr, amount.mul(10));
                await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
                await balancerLP.connect(owner).approve(wrapper.address, amount.mul(10));
            });

            it("Deposit at random points inside an epoch sets the correct effective balance", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                const NUM_CHECKS = 5;
                for (let i = 0; i < NUM_CHECKS; i++) {
                    const snapshotId = await ethers.provider.send("evm_snapshot", []);

                    const ts = Math.floor(Math.random() * epochDuration);

                    await setTime(epochStart + ts);
                    await deposit(user, amount);

                    const multiplier = multiplierAtTs(1, await getBlockTimestamp());
                    const expectedBalance = computeEffectiveBalance(amount, multiplier);

                    expect(await getEpochUserBalance(userAddr, 1)).to.equal(expectedBalance);
                    expect(await getEpochUserBalance(userAddr, 2)).to.equal(amount);
                    expect(await getEpochPoolSize(1)).to.equal(expectedBalance);
                    expect(await getEpochPoolSize(2)).to.equal(amount);

                    await ethers.provider.send("evm_revert", [snapshotId]);
                }
            });

            it("deposit in middle of epoch 1", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                await setTime(getEpochStart(1) + Math.floor(epochDuration / 2));

                await deposit(user, amount);

                const expectedMultiplier = multiplierAtTs(1, await getBlockTimestamp());
                const expectedBalance = computeEffectiveBalance(amount, expectedMultiplier);

                expect(await getEpochUserBalance(userAddr, 1)).to.equal(expectedBalance);
                expect(await getEpochUserBalance(userAddr, 2)).to.equal(amount);

                expect(await getEpochPoolSize(1)).to.equal(expectedBalance);
                expect(await getEpochPoolSize(2)).to.equal(amount);
            });

            it("deposit epoch 1, deposit epoch 4", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                await setTime(getEpochStart(1) + Math.floor(epochDuration / 2));
                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 4);
                await wrapper.initEpochForTokens(3);

                await setTime(getEpochStart(4) + Math.floor(epochDuration / 2));

                expect(await getEpochUserBalance(userAddr, 4)).to.equal(amount);

                await deposit(user, amount);

                const expectedMultiplier = multiplierAtTs(4, await getBlockTimestamp());
                const totalMultiplier = calculateMultiplier(amount, BASE_MULTIPLIER, amount, expectedMultiplier);
                const expectedBalance = computeEffectiveBalance(amount.mul(2), totalMultiplier);

                expect(await getEpochUserBalance(userAddr, 4)).to.equal(expectedBalance);
                expect(await getEpochUserBalance(userAddr, 5)).to.equal(amount.mul(2));

                expect(await getEpochPoolSize(4)).to.equal(expectedBalance);
                expect(await getEpochPoolSize(5)).to.equal(amount.mul(2));
            });

            it("deposit epoch 1, deposit epoch 2", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);
                await setTime(getEpochStart(1) + Math.floor(epochDuration / 2));
                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 2);
                await setTime(getEpochStart(2) + Math.floor(epochDuration / 2));

                expect(await getEpochUserBalance(userAddr, 2)).to.equal(amount);

                await deposit(user, amount);

                const expectedMultiplier = multiplierAtTs(2, await getBlockTimestamp());
                const totalMultiplier = calculateMultiplier(amount, BASE_MULTIPLIER, amount, expectedMultiplier);
                const expectedBalance = computeEffectiveBalance(amount.mul(2), totalMultiplier);

                expect(await getEpochUserBalance(userAddr, 2)).to.equal(expectedBalance);
                expect(await getEpochUserBalance(userAddr, 3)).to.equal(amount.mul(2));

                expect(await getEpochPoolSize(2)).to.equal(expectedBalance);
                expect(await getEpochPoolSize(3)).to.equal(amount.mul(2));
            });

            it("deposit epoch 1, deposit epoch 5, deposit epoch 5", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);
                await setTime(getEpochStart(1) + Math.floor(epochDuration / 2));
                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 5);
                await wrapper.initEpochForTokens(3);
                await wrapper.initEpochForTokens(4);

                await setTime(getEpochStart(5) + Math.floor(epochDuration / 2));
                await deposit(user, amount);

                const expectedMultiplier = multiplierAtTs(5, await getBlockTimestamp());
                const totalMultiplier = calculateMultiplier(amount, BASE_MULTIPLIER, amount, expectedMultiplier);

                await setTime(getEpochStart(5) + Math.floor(epochDuration * 3 / 4));
                await deposit(user, amount);

                const expectedMultiplier2 = multiplierAtTs(5, await getBlockTimestamp());
                const totalMultiplier2 = calculateMultiplier(
                    amount.mul(2),
                    totalMultiplier,
                    amount,
                    expectedMultiplier2
                );
                const expectedBalance = computeEffectiveBalance(amount.mul(3), totalMultiplier2);

                expect(await getEpochUserBalance(userAddr, 5)).to.equal(expectedBalance);
                expect(await getEpochUserBalance(userAddr, 6)).to.equal(amount.mul(3));

                expect(await getEpochPoolSize(5)).to.equal(expectedBalance);
                expect(await getEpochPoolSize(6)).to.equal(amount.mul(3));
            });
        });
    });

    describe("Withdraw", function () {
        it("Reverts if user has no balance", async function () {
            await expect(
                wrapper.connect(user).withdraw(userAddr,userAddr, amount)
            ).to.be.revertedWith("Wrapper: balance too small");
        });

        it("Can not withdraw if is not Router", async function () {
            await expect(
                wrapper.connect(owner).withdraw(ownerAddr,ownerAddr, amount)
            ).to.be.revertedWith("Only Router can do this");
        });

        it("Can not withdraw if has not necessary SVRs", async function () {
            await balancerLP.mint(userAddr, amount);
            await balancerLP.connect(user).approve(wrapper.address, amount);
            await wrapper.connect(user).deposit(userAddr, amount,100000);

            await wrapper.connect(user).transfer(zeroAddress, amount);

            await expect(
                wrapper.connect(user).withdraw(userAddr,userAddr, amount)
            ).to.be.revertedWith("Insuffiecient SVR Balance");
        });

        it("Sets the balance of the user to 0", async function () {
            // set-up the balance sheet
            await balancerLP.mint(userAddr, amount);
            await balancerLP.connect(user).approve(wrapper.address, amount);

            await deposit(user, amount);
            await withdraw(user, amount);

            const balance = await wrapper.balanceLocked(userAddr);

            expect(balance.toString()).to.be.equal("0");
        });

        it("Calls the `transfer` function on token when all conditions are met", async function () {
            // set-up the balance sheet
            await balancerLP.mint(userAddr, amount);
            await balancerLP.connect(user).approve(wrapper.address, amount);
            await wrapper.connect(user).deposit(userAddr, amount,100000);

            await withdraw(user, amount);

            expect(await balancerLP.transferCalled()).to.be.true;
            expect(await balancerLP.transferRecipient()).to.be.equal(userAddr);
            expect((await balancerLP.transferAmount()).toString()).to.be.equal(amount.toString());
        });

        describe("Partial withdraw", function () {
            beforeEach(async function () {
                await balancerLP.mint(userAddr, amount.mul(10));
                await balancerLP.mint(ownerAddr, amount.mul(10));
                await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
                await balancerLP.connect(owner).approve(wrapper.address, amount.mul(10));
            });

            it("deposit epoch 1, withdraw epoch 5", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 5);
                await wrapper.initEpochForTokens(3);
                await wrapper.initEpochForTokens(4);

                const ts = getEpochStart(1) + 24 * 60 * 60;
                await setTime(ts);

                await withdraw(user, amount.div(2));

                expect(await getEpochUserBalance(userAddr, 5)).to.equal(amount.div(2));
                expect(await getEpochPoolSize(5)).to.equal(amount.div(2));
            });

            it("deposit epoch 1, withdraw epoch 2", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 2);

                const ts = getEpochStart(1) + 24 * 60 * 60;
                await setTime(ts);

                await withdraw(user, amount.div(2));

                expect(await getEpochUserBalance(userAddr, 2)).to.equal(amount.div(2));
                expect(await getEpochPoolSize(2)).to.equal(amount.div(2));
            });

            it("deposit epoch 1, deposit epoch 5, withdraw epoch 5 half amount", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 5);
                await wrapper.initEpochForTokens(3);
                await wrapper.initEpochForTokens(4);

                const ts = getEpochStart(1) + 24 * 60 * 60;
                await setTime(ts);

                await deposit(user, amount);

                const ts1 = getEpochStart(1) + Math.floor(epochDuration / 2);
                await setTime(ts1);

                const balance = await getEpochUserBalance(userAddr, 5);

                await withdraw(user, amount.div(2));

                const avgDepositMultiplier = BigNumber.from(balance).sub(amount)
                    .mul(BASE_MULTIPLIER)
                    .div(amount);

                const postWithdrawMultiplier = calculateMultiplier(
                    amount,
                    BASE_MULTIPLIER,
                    amount.div(2),
                    avgDepositMultiplier
                );

                const expectedBalance = computeEffectiveBalance(amount.add(amount.div(2)), postWithdrawMultiplier);

                expect(await getEpochUserBalance(userAddr, 5)).to.equal(expectedBalance);
                expect(await getEpochUserBalance(userAddr, 6)).to.equal(amount.add(amount.div(2)));
                expect(await getEpochPoolSize(5)).to.equal(expectedBalance);
                expect(await getEpochPoolSize(6)).to.equal(amount.add(amount.div(2)));
            });

            it("deposit epoch 1, deposit epoch 5, withdraw epoch 5 more than deposited", async function () {
                await moveAtEpoch(epochStart, epochDuration, 1);
                await wrapper.initEpochForTokens(0);

                await deposit(user, amount);

                await moveAtEpoch(epochStart, epochDuration, 5);
                await wrapper.initEpochForTokens(3);
                await wrapper.initEpochForTokens(4);

                const ts = getEpochStart(1) + 24 * 60 * 60;
                await setTime(ts);

                await deposit(user, amount);

                const ts1 = getEpochStart(1) + Math.floor(epochDuration / 2);
                await setTime(ts1);

                await withdraw(user, amount.add(amount.div(2)));

                expect(await getEpochUserBalance(userAddr, 5)).to.equal(amount.div(2));
                expect(await getEpochUserBalance(userAddr, 6)).to.equal(amount.div(2));
                expect(await getEpochPoolSize(5)).to.equal(amount.div(2));
                expect(await getEpochPoolSize(6)).to.equal(amount.div(2));
            });
        });
    });

    describe("Liquidation", function () {
        beforeEach(async function () {
            await balancerLP.mint(userAddr, amount.mul(10));
            await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
        });

        it("Can not liquidate if is not Router", async function () {
            await expect(
                wrapper.connect(owner).liquidate(ownerAddr, ownerAddr, amount)
            ).to.be.revertedWith("Only Router can do this");
        });

        it("allows user to set liquidation fee", async function () {
            await deposit(user, amount);
            expect(await wrapper.liquidationFee(userAddr)).to.be.eq(liquidationFee);

            await wrapper.connect(user).setLiquidationFee(liquidationFee/2);
            expect(await wrapper.liquidationFee(userAddr)).to.be.eq(liquidationFee/2);
        })

        it("reverts if user sets liquidation fee above max", async function () {
            await deposit(user, amount);
            await expect(
                wrapper.connect(user).setLiquidationFee(liquidationFee*2)
            ).to.be.revertedWith("Liquidation fee above max value")
        })

        it("allows DAO to set Max Liquidation fee", async function () {
            await expect(
                wrapper.connect(owner).setMaxLiquidationFee(liquidationFee*2)
            ).to.not.be.reverted

            expect(await wrapper.maxLiquidationFee()).to.be.eq(liquidationFee*2);
        })

        it("reverts if user sets  Max Liquidation fee", async function () {
            await expect(
                wrapper.connect(user).setMaxLiquidationFee(liquidationFee*2)
            ).to.be.revertedWith("Only DAO can call this")
        })

        it("allows user to liquidate a position", async function () {

            await deposit(user, amount);


            let balanceBeforeLiquidation = await balancerLP.balanceOf(userAddr);

            let userSVRBalance = await wrapper.balanceOf(userAddr);
            wrapper.connect(user).transfer(ownerAddr, userSVRBalance)


            await expect(
                wrapper.connect(user).liquidate(
                    ownerAddr, 
                    userAddr, 
                    amount
                )
            ).to.not.be.reverted;
            
            // stake was removed
            expect(await wrapper.balanceLocked(userAddr)).to.be.eq(0);
            
            // lp tokens where received by who called the liquidate method
            expect(
                await balancerLP.balanceOf(userAddr)
            ).to.be.eq(balanceBeforeLiquidation.add(amount));
        })
    })

    describe("Epoch logic", function () {
        beforeEach(async function () {
            await balancerLP.mint(userAddr, amount.mul(10));
            await balancerLP.mint(ownerAddr, amount.mul(10));
            await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
            await balancerLP.connect(owner).approve(wrapper.address, amount.mul(10));
        });

        it("deposit in epoch 0, deposit in epoch 1, deposit in epoch 2, withdraw in epoch 3", async function () {
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal("0");

            // epoch 0
            await setTime(getCurrentUnix() + 15);
            await deposit(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 1);
            await deposit(user, amount);

            expect(await getEpochPoolSize(2)).to.be.equal(amount.mul(2).toString());
            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal(amount.mul(2).toString());

            await moveAtEpoch(epochStart, epochDuration, 2);
            await deposit(user, amount);

            expect(await getEpochPoolSize(3)).to.be.equal(amount.mul(3).toString());
            expect(await getEpochUserBalance(userAddr, 3)).to.be.equal(amount.mul(3).toString());

            await moveAtEpoch(epochStart, epochDuration, 3);
            await withdraw(user, amount.mul(3));

            expect(await getEpochPoolSize(4)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal("0");
        });

        it("deposit in epoch 0, withdraw in epoch 3", async function () {
            // epoch 0
            await setTime(getCurrentUnix() + 15);
            await deposit(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 3);
            await wrapper.initEpochForTokens(2);

            await withdraw(user, amount);

            expect(await getEpochPoolSize(4)).to.be.equal("0");
        });

        it("deposit in epoch 0, withdraw in epoch 0", async function () {
            // epoch 0
            await setTime(getCurrentUnix() + 15);
            await deposit(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.toString());

            await withdraw(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal("0");
        });

        it("deposit in epoch 3, withdraw in epoch 3", async function () {
            await moveAtEpoch(epochStart, epochDuration, 3);
            await wrapper.initEpochForTokens(0);
            await wrapper.initEpochForTokens(1);
            await wrapper.initEpochForTokens(2);

            await deposit(user, amount);

            expect(await getEpochPoolSize(4)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal(amount.toString());

            await withdraw(user, amount);

            expect(await getEpochPoolSize(4)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal("0");
        });

        it("deposit in epoch 2, withdraw in epoch 3", async function () {
            await moveAtEpoch(epochStart, epochDuration, 2);
            await wrapper.initEpochForTokens(0);
            await wrapper.initEpochForTokens(1);

            await deposit(user, amount);

            expect(await getEpochPoolSize(3)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 3)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 3);
            await withdraw(user, amount);

            expect(await getEpochPoolSize(4)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal("0");
        });

        it("multiple users deposit", async function () {
            await setTime(getCurrentUnix() + 15);
            await deposit(user, amount);
            await deposit(user, amount);
            await deposit(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.mul(3).toString());
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.mul(3).toString());
        });

        it("multiple users deposit epoch 0 then 1 withdraw epoch 1", async function () {
            await setTime(getCurrentUnix() + 15);
            await deposit(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 1);
            await withdraw(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal("0");
        });

        it("multiple users deposit epoch 0 then 1 withdraw epoch 2", async function () {
            await setTime(getCurrentUnix() + 15);
            await deposit(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 2);
            await withdraw(user, amount);

            expect(await getEpochPoolSize(1)).to.be.equal(amount.toString());
            expect(await getEpochPoolSize(2)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 1)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 3)).to.be.equal("0");
        });

        it("multiple deposits in same epoch", async function () {
            await moveAtEpoch(epochStart, epochDuration, 1);
            await wrapper.initEpochForTokens(0);

            await deposit(user, amount);
            await deposit(user, amount);

            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal(amount.mul(2).toString());
            expect(await getEpochPoolSize(2)).to.be.equal(amount.mul(2).toString());
        });

        it("deposit epoch 2, deposit epoch 3, withdraw epoch 3", async function () {
            await moveAtEpoch(epochStart, epochDuration, 2);

            await wrapper.initEpochForTokens(0);
            await wrapper.initEpochForTokens(1);
            await wrapper.initEpochForTokens(2);

            await deposit(user, amount);
            expect(await getEpochUserBalance(userAddr, 3)).to.be.equal(amount.toString());
            expect(await getEpochPoolSize(3)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 3);
            await deposit(user, amount);
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal(amount.mul(2).toString());
            expect(await getEpochPoolSize(4)).to.be.equal(amount.mul(2).toString());

            await withdraw(user, amount.mul(2));
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal("0");
            expect(await getEpochPoolSize(4)).to.be.equal("0");
        });

        it("deposit epoch 1, deposit epoch 3, withdraw epoch 3", async function () {
            await moveAtEpoch(epochStart, epochDuration, 1);
            await wrapper.initEpochForTokens(0);

            await deposit(user, amount);
            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal(amount.toString());
            expect(await getEpochPoolSize(2)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 3);
            await deposit(user, amount);
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal(amount.mul(2).toString());
            expect(await getEpochPoolSize(4)).to.be.equal(amount.mul(2).toString());

            await withdraw(user, amount.mul(2));
            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 4)).to.be.equal("0");
            expect(await getEpochPoolSize(4)).to.be.equal("0");
        });

        it("deposit epoch 1, deposit epoch 4, deposit epoch 5, withdraw epoch 5", async function () {
            await moveAtEpoch(epochStart, epochDuration, 1);
            await wrapper.initEpochForTokens(0);

            await deposit(user, amount);
            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal(amount.toString());
            expect(await getEpochPoolSize(2)).to.be.equal(amount.toString());

            await moveAtEpoch(epochStart, epochDuration, 4);
            await wrapper.initEpochForTokens(3);

            await deposit(user, amount);

            await moveAtEpoch(epochStart, epochDuration, 5);
            await deposit(user, amount);
            expect(await getEpochUserBalance(userAddr, 2)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 3)).to.be.equal(amount.toString());
            expect(await getEpochUserBalance(userAddr, 6)).to.be.equal(amount.mul(3).toString());
            expect(await getEpochPoolSize(2)).to.be.equal(amount.toString());
            expect(await getEpochPoolSize(3)).to.be.equal(amount.toString());
            expect(await getEpochPoolSize(6)).to.be.equal(amount.mul(3).toString());

            await withdraw(user, amount.mul(3));
            expect(await getEpochPoolSize(7)).to.be.equal("0");
            expect(await getEpochUserBalance(userAddr, 7)).to.be.equal("0");
        });

        it("reverts if future epoch is init", async function () {
            await moveAtEpoch(epochStart, epochDuration, 2);
            await expect(wrapper.initEpochForTokens(4)).to.be.revertedWith("can't init a future epoch")

        })

        it("reverts if epoch is already init", async function () {
            await moveAtEpoch(epochStart, epochDuration, 2);
            await wrapper.initEpochForTokens(0)
            await wrapper.initEpochForTokens(1)
            await wrapper.initEpochForTokens(2)
            await expect(wrapper.initEpochForTokens(2)).to.be.revertedWith("Wrapper: epoch already initialized")

        })
    });

    describe("getEpochPoolSize", function () {
        beforeEach(async function () {
            await balancerLP.mint(userAddr, amount.mul(10));
            await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
        });

        it("Reverts if there's a gap", async function () {
            await moveAtEpoch(epochStart, epochDuration, 2);

            await expect(deposit(user, amount)).to.be.revertedWith("Wrapper: previous epoch not initialized");
        });

        it("Returns pool size when epoch is initialized", async function () {
            await moveAtEpoch(epochStart, epochDuration, 1);
            await wrapper.initEpochForTokens(0);
            await deposit(user, amount);

            expect(await getEpochPoolSize(2)).to.be.equal(amount.toString());
        });

        it("Returns 0 when there was no action ever", async function () {
            expect(await getEpochPoolSize(0)).to.be.equal("0");
            expect(await getEpochPoolSize(2)).to.be.equal("0");
            expect(await getEpochPoolSize(5)).to.be.equal("0");
            expect(await getEpochPoolSize(79)).to.be.equal("0");
            expect(await getEpochPoolSize(1542)).to.be.equal("0");
        });

        it("Returns correct balance where there was an action at some point", async function () {
            await moveAtEpoch(epochStart, epochDuration, 1);
            await wrapper.initEpochForTokens(0);
            await deposit(user, amount);

            expect(await getEpochPoolSize(79)).to.be.equal(amount.toString());
        });
    });

    describe("currentEpochMultiplier", function () {
        it("Returns correct value", async function () {
            // epoch size is 1 week = 604800 seconds

            await moveAtEpoch(epochStart, epochDuration, 1);

            // after 100 seconds, multiplier should be 0.9998
            await moveAtTimestamp(epochStart + 100);

            let expectedMultiplier = multiplierAtTs(1, await getBlockTimestamp());
            expect(await wrapper.currentEpochMultiplier()).to.be.equal(expectedMultiplier);

            // after 1h, multiplier should be  0.9940
            await moveAtTimestamp(epochStart + 3600);
            expectedMultiplier = multiplierAtTs(1, await getBlockTimestamp());
            expect(await wrapper.currentEpochMultiplier()).to.be.equal(expectedMultiplier);

            // after 1 day, multiplier should be 0.8571
            await moveAtTimestamp(epochStart + 86400);
            expectedMultiplier = multiplierAtTs(1, await getBlockTimestamp());
            expect(await wrapper.currentEpochMultiplier()).to.be.equal(expectedMultiplier);

            // after 3.5 days (half time; 86400 + 216000), multiplier should be 0.5
            await moveAtTimestamp(epochStart + 302400);
            expectedMultiplier = multiplierAtTs(1, await getBlockTimestamp());
            expect(await wrapper.currentEpochMultiplier()).to.be.equal(expectedMultiplier);
        });
    });

    describe("computeNewMultiplier", function () {
        it("Returns correct value", async function () {
            // 0.75 with 18 decimals
            const expectedMultiplier = scaleMultiplier(0.75, 2);

            expect(
                await wrapper.computeNewMultiplier(1000, BASE_MULTIPLIER, 1000, BASE_MULTIPLIER.div(2))
            ).to.equal(BigNumber.from(expectedMultiplier));
        });
    });

    describe("emergencyWithdraw", function () {
        beforeEach(async function () {
            await balancerLP.mint(userAddr, amount.mul(10));
            await balancerLP.mint(ownerAddr, amount.mul(10));
            await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
            await balancerLP.connect(owner).approve(wrapper.address, amount.mul(10));
        });

        it("Does not work if less than 10 epochs passed", async function () {
            await expect(
                wrapper.connect(user).emergencyWithdraw()
            ).to.be.revertedWith("At least 10 epochs must pass without success");
        });

        it("Reverts if user has no balance", async function () {
            await moveAtEpoch(epochStart, epochDuration, 11);

            await expect(
                wrapper.connect(user).emergencyWithdraw()
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Reverts if user has balance but less than 10 epochs passed", async function () {
            await deposit(user, amount);

            await expect(
                wrapper.connect(user).emergencyWithdraw()
            ).to.be.revertedWith("At least 10 epochs must pass without success");
        });

        it("Works if more than 10 epochs passed with no withdraw", async function () {
            await deposit(user, amount);
            await moveAtEpoch(epochStart, epochDuration, 11);

            await expect(
                wrapper.connect(user).emergencyWithdraw()
            ).to.not.be.reverted;

            expect(await balancerLP.transferCalled()).to.be.true;
            expect(await balancerLP.transferRecipient()).to.be.equal(userAddr);
            expect((await balancerLP.transferAmount()).toString()).to.be.equal(amount.toString());
            expect(await wrapper.balanceLocked(userAddr)).to.be.equal(0);
        });
    });

    describe("Events", function () {
        beforeEach(async function () {
            await balancerLP.mint(userAddr, amount.mul(10));
            await balancerLP.connect(user).approve(wrapper.address, amount.mul(10));
        });

        it("Deposit emits Deposit event", async function () {
            await expect(wrapper.connect(user).deposit(balancerLP.address, 10, 100000))
                .to.emit(wrapper, "Deposit");
        });

        it("Withdraw emits Withdraw event", async function () {
            await deposit(user, amount);

            await expect(wrapper.connect(user).withdraw(userAddr,userAddr, 10))
                .to.emit(wrapper, "Withdraw");
        });

        it("InitEpochForTokens emits InitEpochForTokens event", async function () {
            await moveAtEpoch(epochStart, epochDuration, 1);
            await expect(wrapper.initEpochForTokens(0))
                .to.emit(wrapper, "InitEpochForTokens");
        });

        it("EmergencyWithdraw emits EmergencyWithdraw event", async function () {
            await deposit(user, amount);

            await moveAtEpoch(epochStart, epochDuration, 20);

            await expect(wrapper.connect(user).emergencyWithdraw())
                .to.emit(wrapper, "EmergencyWithdraw");
        });
    });

    async function getBlockTimestamp() {
        const block = await ethers.provider.send("eth_getBlockByNumber", ["latest", false]);

        return parseInt(block.timestamp);
    }

    function computeEffectiveBalance(balance: BigNumber, multiplier: BigNumber) {
        return balance.mul(multiplier).div(BASE_MULTIPLIER);
    }

    function multiplierAtTs(epoch: number, ts: number) {
        const epochEnd = epochStart + epoch * epochDuration;
        const timeLeft = epochEnd - ts;

        return BigNumber.from(timeLeft).mul(BASE_MULTIPLIER).div(epochDuration);
    }

    function scaleMultiplier(floatValue: number, currentDecimals: number) {
        const value = floatValue * Math.pow(10, currentDecimals);

        return BigNumber.from(value).mul(BigNumber.from(10).pow(MULTIPLIER_DECIMALS - currentDecimals));
    }

    function calculateMultiplier(previousBalance: BigNumber, previousMultiplier: BigNumber, newDeposit: BigNumber, newMultiplier: BigNumber) {
        const pb = BigNumber.from(previousBalance);
        const pm = BigNumber.from(previousMultiplier);
        const nd = BigNumber.from(newDeposit);
        const nm = BigNumber.from(newMultiplier);

        const pa = pb.mul(pm).div(BASE_MULTIPLIER);
        const na = nd.mul(nm).div(BASE_MULTIPLIER);

        return pa.add(na).mul(BASE_MULTIPLIER).div(pb.add(nd));
    }

    

    async function deposit(u: Signer, x: BigNumber) {
        await balancerLP.connect(u).approve(wrapper.address, x);
        return await wrapper.connect(u).deposit(userAddr, x, 100000);
    }

    async function withdraw(u: Signer, x: BigNumber) {
        return await wrapper.connect(u).withdraw(userAddr,userAddr, x);
    }

    async function getEpochPoolSize(epochId: number) {
        return (await wrapper.getEpochPoolSize( epochId)).toString();
    }

    function getEpochStart(epoch: number) {
        return epochStart + (epoch - 1) * epochDuration;
    }

    async function getEpochUserBalance(addr: string, epochId: number) {
        return (await wrapper.getEpochUserBalance(addr,epochId)).toString();
    }

    async function moveAtTimestamp(timestamp: number) {
        await setTime(timestamp);
        await ethers.provider.send("evm_mine", []);
    }
});
