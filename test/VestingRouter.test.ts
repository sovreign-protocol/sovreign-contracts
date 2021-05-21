
import { expect } from 'chai';import { ethers } from 'hardhat';
import { BigNumber, ethers as ejs, Signer } from 'ethers';
import { Vesting,VestingRouter, ERC20Mock } from '../typechain';
import { moveAtTimestamp, moveAtEpoch, getCurrentUnix } from './helpers/helpers';


describe('Vesting', function () {
    let owner:Signer, user:Signer, userAddr:string
    let bondToken:ERC20Mock, vestingA:Vesting, vestingB:Vesting, vestingC:Vesting, vestingRouter:VestingRouter
    const distributedAmount = ethers.BigNumber.from(800000).mul(ethers.BigNumber.from(10).pow(18))
    const amountVestingA = ethers.BigNumber.from(300000).mul(ethers.BigNumber.from(10).pow(18))
    const amountVestingB = ethers.BigNumber.from(400000).mul(ethers.BigNumber.from(10).pow(18))
    const amountVestingC = ethers.BigNumber.from(100000).mul(ethers.BigNumber.from(10).pow(18))
    let snapshotId:number

    const epoch1Start = Math.floor(Date.now() / 1000) + 1000

    beforeEach(async function () {
        snapshotId = await ethers.provider.send('evm_snapshot',[])
        const [creator, ownerSigner, userSigner] = await ethers.getSigners()
        owner = ownerSigner
        user = userSigner
        userAddr = await user.getAddress()

        const VestingRouter = await ethers.getContractFactory('VestingRouter', creator)
        const Vesting = await ethers.getContractFactory('Vesting', creator)
        const ERC20Mock = await ethers.getContractFactory('ERC20Mock')

        bondToken = await ERC20Mock.deploy() as ERC20Mock
        vestingA = await Vesting.deploy(userAddr, bondToken.address, epoch1Start, amountVestingA) as Vesting
        vestingB = await Vesting.deploy(userAddr, bondToken.address, epoch1Start, amountVestingB) as Vesting
        vestingC = await Vesting.deploy(userAddr, bondToken.address, epoch1Start, amountVestingC) as Vesting

        vestingRouter = await VestingRouter.deploy(
            [vestingA.address, vestingB.address, vestingC.address], 
            [amountVestingA, amountVestingB, amountVestingC], 
            bondToken.address) as VestingRouter

    })

    afterEach(async function () {
        await ethers.provider.send('evm_revert', [snapshotId])
    })

    describe('Contract checks', function () {
        it('should be deployed', async function () {
            expect(vestingA.address).to.not.equal(0)
            expect(vestingB.address).to.not.equal(0)
            expect(vestingC.address).to.not.equal(0)
            expect(bondToken.address).to.not.equal(0)
            expect(vestingRouter.address).to.not.equal(0)
        })
        it('should do nothing if no funds', async function () {
            await vestingRouter.allocateVestingFunds()
            expect (await vestingRouter.lastAllocatedAddress()).to.be.equal(0)
        })
        it('should move balance to vesting contracts', async function () {
            await bondToken.mint(vestingRouter.address, distributedAmount)
            await vestingRouter.allocateVestingFunds()
            expect(await bondToken.balanceOf(vestingA.address)).to.be.equal(amountVestingA)
            expect(await bondToken.balanceOf(vestingB.address)).to.be.equal(amountVestingB)
            expect(await bondToken.balanceOf(vestingC.address)).to.be.equal(amountVestingC)
        })
        it('should do partial distribute', async function () {
            await bondToken.mint(vestingRouter.address, distributedAmount.sub(amountVestingC))
            await vestingRouter.allocateVestingFunds()
            expect(await bondToken.balanceOf(vestingA.address)).to.be.equal(amountVestingA)
            expect(await bondToken.balanceOf(vestingB.address)).to.be.equal(amountVestingB)
            expect(await vestingRouter.lastAllocatedAddress()).to.be.equal(2)
            expect(await bondToken.balanceOf(vestingC.address)).to.be.equal(0)
            await bondToken.mint(vestingRouter.address, amountVestingC)
            await vestingRouter.allocateVestingFunds()
            expect(await bondToken.balanceOf(vestingC.address)).to.be.equal(amountVestingC)
            expect(await vestingRouter.lastAllocatedAddress()).to.be.equal(3)
        })

        it('should do partial distribute based on gas', async function () {
            await bondToken.mint(vestingRouter.address, distributedAmount)
            let tx = await vestingRouter.populateTransaction.allocateVestingFunds()
            let txRaw = {
                from: await owner.getAddress(),
                to: vestingRouter.address,
                value: 0,
                data: tx.data
            }
            let estimatedGas = await ethers.provider.estimateGas(txRaw)
            let manualGas = estimatedGas.sub(ethers.BigNumber.from(2000))

            await vestingRouter.allocateVestingFunds({gasLimit: manualGas})
            expect(await vestingRouter.lastAllocatedAddress()).to.be.equal(2)
            await vestingRouter.allocateVestingFunds({gasLimit: manualGas})
            expect(await vestingRouter.lastAllocatedAddress()).to.be.equal(3)
        })
    })
})