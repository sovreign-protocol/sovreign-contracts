import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    ReignToken, SovToken
} from '../typechain';
import * as deploy from './helpers/deploy';
import { prependOnceListener } from 'process';


describe('Token', function () {

    let reign: ReignToken
    let sov: SovToken
    let owner: Signer, ownerAddress: string;
    let sovMinter: Signer, sovMinterAddress: string;
    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;


    before(async function () {
        await setupSigners();
    });

    beforeEach(async function() {
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;
        sov = (await deploy.deployContract('SovToken', [ownerAddress, sovMinterAddress])) as SovToken;

    })



    describe('REIGN', function () {
        it('transfers amounts correctly', async function () {
            await prepareAccountREIGN(user, 100000)
            let transfers = BigNumber.from(10)
            await reign.connect(user).transfer(happyPirateAddress,transfers);
            expect(await reign.balanceOf(happyPirateAddress)).to.be.eq(transfers)
        })

        it('reverts if transfers more then balance', async function () {
            await prepareAccountREIGN(user, 100000)
            let transfers = (await reign.balanceOf(userAddress)).add(1000)
            await expect(
                reign.connect(user).transfer(happyPirateAddress,transfers)
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('set allowance amounts correctly', async function () {
            await prepareAccountREIGN(user, 100000)
            let allow = BigNumber.from(10)
            await reign.connect(user).approve(happyPirateAddress,allow);
            expect(await reign.allowance(userAddress,happyPirateAddress)).to.be.eq(allow)
        })

        it('makes TransferFrom correctly', async function () {
            await prepareAccountREIGN(user, 100000)
            let allow = BigNumber.from(10)
            await reign.connect(user).approve(happyPirateAddress,allow);
            await reign.connect(happyPirate).transferFrom(userAddress,helpers.zeroAddress, allow);
            expect(await reign.balanceOf(helpers.zeroAddress)).to.be.eq(allow);
        })

        it('reverts if transferFrom is above allowance', async function () {
            await prepareAccountREIGN(user, 100000)
            let allow = BigNumber.from(10)
            await reign.connect(user).approve(happyPirateAddress,allow);
            await expect(
                reign.connect(user).transferFrom(userAddress,helpers.zeroAddress,allow.add(1))
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('TransferFrom reduces allowance', async function () {
            await prepareAccountREIGN(user, 100000)
            let allow = BigNumber.from(10)
            await reign.connect(user).approve(happyPirateAddress,allow);
            await reign.connect(happyPirate).transferFrom(userAddress,helpers.zeroAddress, allow.sub(5));
            expect(await reign.allowance(userAddress,happyPirateAddress)).to.be.eq(allow.sub(5))
        })

        it('mints amounts correctly if called by owner', async function () {
            let transfers = BigNumber.from(10)
            await reign.connect(user).mint(happyPirateAddress,transfers);
            expect(await reign.balanceOf(happyPirateAddress)).to.be.eq(transfers)
        })

        it('reverts if not called by owner', async function () {
            let transfers = BigNumber.from(10)
            await expect(
                reign.connect(happyPirate).mint(happyPirateAddress,transfers)
            ).to.be.revertedWith("Only Owner can do this")
        })

        it('allows Owner to set new owner', async function () {
            expect(await reign.owner()).to.be.eq(userAddress)
            reign.connect(user).setOwner(happyPirateAddress)
            expect(await reign.owner()).to.be.eq(happyPirateAddress)
        })

        it('reverts if other is setting owner', async function () {
            expect(await reign.owner()).to.be.eq(userAddress)
            await expect(
                reign.connect(happyPirate).setOwner(happyPirateAddress)
            ).to.be.revertedWith("Only Owner can do this")
        })

        it('allows to set 0 address as  owner', async function () {
            expect(await reign.owner()).to.be.eq(userAddress)
            await expect(
                reign.connect(user).setOwner(helpers.zeroAddress)
            ).to.not.be.reverted
            expect(await reign.owner()).to.be.eq(helpers.zeroAddress)
        })

        it('emits Mint on call to mint()', async function () {
            await expect(await reign.connect(user).mint(userAddress, 10))
                .to.emit(reign, 'Mint')
        });
    })


    describe('SOV', function () {
        it('transfers amounts correctly', async function () {
            await prepareAccountSOV(user, 100000)
            let transfers = BigNumber.from(10)
            await sov.connect(user).transfer(happyPirateAddress,transfers);
            expect(await sov.balanceOf(happyPirateAddress)).to.be.eq(transfers)
        })

        it('reverts if transfers more then balance', async function () {
            await prepareAccountSOV(user, 100000)
            let transfers = (await sov.balanceOf(userAddress)).add(1000)
            await expect(
                sov.connect(user).transfer(happyPirateAddress,transfers)
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('set allowance amounts correctly', async function () {
            await prepareAccountSOV(user, 100000)
            let allow = BigNumber.from(10)
            await sov.connect(user).approve(happyPirateAddress,allow);
            expect(await sov.allowance(userAddress,happyPirateAddress)).to.be.eq(allow)
        })

        it('makes TransferFrom correctly', async function () {
            await prepareAccountSOV(user, 100000)
            let allow = BigNumber.from(10)
            await sov.connect(user).approve(happyPirateAddress,allow);
            await sov.connect(happyPirate).transferFrom(userAddress,helpers.zeroAddress, allow);
            expect(await sov.balanceOf(helpers.zeroAddress)).to.be.eq(allow);
        })

        it('reverts if transferFrom is above allowance', async function () {
            await prepareAccountSOV(user, 100000)
            let allow = BigNumber.from(10)
            await sov.connect(user).approve(happyPirateAddress,allow);
            await expect(
                sov.connect(user).transferFrom(userAddress,helpers.zeroAddress,allow.add(1))
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('TransferFrom reduces allowance', async function () {
            await prepareAccountSOV(user, 100000)
            let allow = BigNumber.from(10)
            await sov.connect(user).approve(happyPirateAddress,allow);
            await sov.connect(happyPirate).transferFrom(userAddress,helpers.zeroAddress, allow.sub(5));
            expect(await sov.allowance(userAddress,happyPirateAddress)).to.be.eq(allow.sub(5))
        })

        it('mints amounts correctly if called by minter', async function () {
            let transfers = BigNumber.from(10)
            await sov.connect(sovMinter).mint(happyPirateAddress,transfers);
            expect(await sov.balanceOf(happyPirateAddress)).to.be.eq(transfers)
        })

        it('burns amounts correctly if called by minter', async function () {
            let transfers = BigNumber.from(10)
            await sov.connect(sovMinter).mint(happyPirateAddress,transfers);
            expect(await sov.balanceOf(happyPirateAddress)).to.be.eq(transfers)


            await sov.connect(sovMinter).burn(happyPirateAddress,transfers);
            expect(await sov.balanceOf(happyPirateAddress)).to.be.eq(0)
        })

        it('reverts if mint not called by minter', async function () {
            let transfers = BigNumber.from(10)
            await expect(
                sov.connect(happyPirate).mint(happyPirateAddress,transfers)
            ).to.be.revertedWith("Only Minter can do this")
        })

        it('reverts if bunt not called by minter', async function () {
            let transfers = BigNumber.from(10)
            await expect(
                sov.connect(happyPirate).burn(happyPirateAddress,transfers)
            ).to.be.revertedWith("Only Minter can do this")
        })

        it('allows reignDAO to set new reignDAO', async function () {
            expect(await sov.reignDAO()).to.be.eq(ownerAddress)
            sov.connect(owner).setReignDAO(happyPirateAddress)
            expect(await sov.reignDAO()).to.be.eq(happyPirateAddress)
        })

        it('allows reignDAO to set new Minter', async function () {
            expect(await sov.reignDAO()).to.be.eq(ownerAddress)
            sov.connect(owner).setMinter(happyPirateAddress, true)
            expect(await sov.isMinter(happyPirateAddress)).to.be.eq(true)

            sov.connect(owner).setMinter(happyPirateAddress, false)
            expect(await sov.isMinter(happyPirateAddress)).to.be.eq(false)
        })

        it('reverts if other is setting reignDAO', async function () {
            expect(await sov.reignDAO()).to.be.eq(ownerAddress)
            await expect(
                sov.connect(happyPirate).setReignDAO(happyPirateAddress)
            ).to.be.revertedWith("Only reignDAO can do this")
        })

        it('reverts if other is setting minter', async function () {
            expect(await sov.reignDAO()).to.be.eq(ownerAddress)
            await expect(
                sov.connect(happyPirate).setMinter(happyPirateAddress, true)
            ).to.be.revertedWith("Only reignDAO can do this")
        })

        it('allows to set 0 address as owner', async function () {
            expect(await sov.reignDAO()).to.be.eq(ownerAddress)
            await expect(
                sov.connect(owner).setReignDAO(helpers.zeroAddress)
            ).to.not.be.reverted
            expect(await sov.reignDAO()).to.be.eq(helpers.zeroAddress)
        })

        it('emits Mint on call to mint()', async function () {
            await expect(await sov.connect(sovMinter).mint(sovMinterAddress, 10))
                .to.emit(sov, 'Mint')
        });


        it('emits Burn on call to burn()', async function () {
            await sov.connect(sovMinter).mint(sovMinterAddress, 10)
            await expect(await sov.connect(sovMinter).burn(sovMinterAddress, 10))
                .to.emit(sov, 'Burn')
        });
    })


    async function prepareAccountREIGN (account: Signer, balance: number) {
        await reign.mint(await account.getAddress(), balance);
    }

    async function prepareAccountSOV(account: Signer, balance: number) {
        await sov.connect(sovMinter).mint(await account.getAddress(), balance);
    }
        
    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        owner = accounts[1];
        sovMinter = accounts[1];
        happyPirate = accounts[2];

        userAddress = await user.getAddress();
        happyPirateAddress = await happyPirate.getAddress();
        ownerAddress = await owner.getAddress();
        sovMinterAddress = await sovMinter.getAddress();
    }

});