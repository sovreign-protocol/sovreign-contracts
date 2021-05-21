
import { expect } from 'chai';import { ethers } from 'hardhat';
import { BigNumber, ethers as ejs, Signer } from 'ethers';
import { Vesting, ERC20Mock } from '../typechain';
import { moveAtTimestamp, moveAtEpoch, getCurrentUnix } from './helpers/helpers';

describe('Vesting', function () {
    let owner:Signer, user:Signer, userAddr:string
    let bondToken: ERC20Mock, vesting:Vesting
    const distributedAmount = ethers.BigNumber.from(800000).mul(ethers.BigNumber.from(10).pow(18))
    let snapshotId:number

    const epochDuration = 604800
    const epoch1Start = getCurrentUnix() + 1000

    beforeEach(async function () {
        snapshotId = await ethers.provider.send('evm_snapshot', []);
        const [creator, ownerSigner, userSigner] = await ethers.getSigners()
        owner = ownerSigner
        user = userSigner
        userAddr = await user.getAddress()

        const Vesting = await ethers.getContractFactory('Vesting', creator)
        const ERC20Mock = await ethers.getContractFactory('ERC20Mock')

        bondToken = await ERC20Mock.deploy() as ERC20Mock;
        vesting = await Vesting.deploy(userAddr, bondToken.address, epoch1Start, distributedAmount) as Vesting
    })

    afterEach(async function () {
        await ethers.provider.send('evm_revert', [snapshotId])
    })

    describe('General Contract checks', function () {
        it('should be deployed', async function () {
            expect(vesting.address).to.not.equal(0)
            expect(bondToken.address).to.not.equal(0)
        })
        it('should have the owner set as userAddr', async function () {
            expect(await vesting.owner()).to.be.equal(userAddr)
        })
        it('should have current epoch 0', async function () {
            expect(await vesting.getCurrentEpoch()).to.be.equal(0)
            await moveAtEpoch(epoch1Start, epochDuration, -1)
            expect(await vesting.getCurrentEpoch()).to.be.equal(0)
        })
        it('should have last claimed epoch 0', async function () {
            expect(await vesting.lastClaimedEpoch()).to.be.equal(0)
        })
        it('should have bond balance 0', async function () {
            expect(await vesting.balance()).to.be.equal(0)
        })
        it('should have totalDistributedBalance 0', async function () {
            expect(await vesting.totalDistributedBalance()).to.be.equal(distributedAmount)
        })
        it('should have claim function callable by anyone', async function () {
            await expect(vesting.connect(owner).claim()).to.not.be.revertedWith('Ownable: caller is not the owner')
        })
        it('should have the epoch1', async function () {
            await moveAtEpoch(epoch1Start, epochDuration, 1)
            expect(await vesting.getCurrentEpoch()).to.be.equal(1)
        })
        it('should have the epoch 0', async function () {
            expect(await vesting.getCurrentEpoch()).to.be.equal(0)
        })
    })

    describe('Contract Tests', function () {
        it('should should deposit some tokens', async function () {
            await bondToken.mint(vesting.address, distributedAmount)
            expect(await vesting.balance()).to.be.equal(distributedAmount)
        })
        it('should mint for 1 week', async function () {
            await bondToken.mint(vesting.address, distributedAmount) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 2)
            await vesting.connect(user).claim()
            expect(await bondToken.balanceOf(userAddr)).to.be.equal(distributedAmount.div(100))
            expect(await vesting.balance()).to.be.equal(distributedAmount.sub(distributedAmount.div(100)))
            expect(await vesting.lastClaimedEpoch()).to.be.equal(1)
        })
        it('should mint with default function', async function () {
            await bondToken.mint(vesting.address, distributedAmount) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 3)
            await user.sendTransaction({
                to: vesting.address,
            })
            expect(await bondToken.balanceOf(userAddr)).to.be.equal((distributedAmount.div(100)).mul(2))
            expect(await vesting.balance()).to.be.equal(distributedAmount.sub(distributedAmount.div(100).mul(2)))
            expect(await vesting.lastClaimedEpoch()).to.be.equal(2)
        })
        it('should mint with any user calling claim', async function () {
            await bondToken.mint(vesting.address, distributedAmount) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 3)
            await vesting.connect(owner).claim()
            expect(await bondToken.balanceOf(await owner.getAddress())).to.be.equal(0)
            expect(await bondToken.balanceOf(userAddr)).to.be.equal((distributedAmount.div(100)).mul(2))
            expect(await vesting.balance()).to.be.equal(distributedAmount.sub(distributedAmount.div(100).mul(2)))
            expect(await vesting.lastClaimedEpoch()).to.be.equal(2)
        })
        it('should mint with any user sending 0 ETH', async function () {
            await bondToken.mint(vesting.address, distributedAmount) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 6)
            await owner.sendTransaction({
                to: vesting.address,
            })
            expect(await bondToken.balanceOf(await owner.getAddress())).to.be.equal(0)
            expect(await bondToken.balanceOf(userAddr)).to.be.equal((distributedAmount.div(100)).mul(5))
            expect(await vesting.balance()).to.be.equal(distributedAmount.sub(distributedAmount.div(100).mul(5)))
            expect(await vesting.lastClaimedEpoch()).to.be.equal(5)
        })
        it('should mint for 100 week', async function () {
            await bondToken.mint(vesting.address, distributedAmount.add(1)) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 104)
            expect(await vesting.getCurrentEpoch()).to.be.equal(104)
            await vesting.connect(user).claim()
            expect(await bondToken.balanceOf(userAddr)).to.be.equal(distributedAmount.add(1))
            expect(await vesting.balance()).to.be.equal(0)
            expect(await vesting.lastClaimedEpoch()).to.be.equal(100)
        })
        it('should emit', async function () {
            await bondToken.mint(vesting.address, distributedAmount) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 59)
            expect(vesting.connect(user).claim()).to.emit(bondToken, 'Transfer')
        })
        it('should not emit', async function () {
            await bondToken.mint(vesting.address, distributedAmount) // set tokens
            await moveAtEpoch(epoch1Start, epochDuration, 60)
            await vesting.connect(user).claim()
            expect(vesting.connect(user).claim()).to.not.emit(bondToken, 'Transfer')
        })
    })

})