import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    PoolControllerMock, SvrToken, ReignToken
} from '../typechain';
import * as deploy from './helpers/deploy';
import { prependOnceListener } from 'process';


describe('Token', function () {

    let svr: SvrToken, reign: ReignToken
    let user: Signer, userAddress: string;
    let happyPirate: Signer, happyPirateAddress: string;

    let controller: PoolControllerMock;


    before(async function () {
        await setupSigners();

        controller = (await deploy.deployContract('PoolControllerMock', 
                [helpers.zeroAddress, helpers.zeroAddress]
            )) as PoolControllerMock;
   
    });

    beforeEach(async function() {
        svr = (await deploy.deployContract('SvrToken', [controller.address])) as SvrToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;

    })


    describe('SVR', function () {
        it('transfers amounts correctly', async function () {
            await prepareAccountSVR(user, 100000)
            let transfers = BigNumber.from(10)
            await svr.connect(user).transfer(happyPirateAddress,transfers);
            expect(await svr.balanceOf(happyPirateAddress)).to.be.eq(transfers)
        })

        it('reverts if transfers more then balance', async function () {
            await prepareAccountSVR(user, 100000)
            let transfers = (await svr.balanceOf(userAddress)).add(1000)
            await expect(
                svr.connect(user).transfer(happyPirateAddress,transfers)
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('set allowance amounts correctly', async function () {
            await prepareAccountSVR(user, 100000)
            let allow = BigNumber.from(10)
            await svr.connect(user).approve(happyPirateAddress,allow);
            expect(await svr.allowance(userAddress,happyPirateAddress)).to.be.eq(allow)
        })

        it('makes TransferFrom correctly', async function () {
            await prepareAccountSVR(user, 100000)
            let allow = BigNumber.from(10)
            await svr.connect(user).approve(happyPirateAddress,allow);
            await svr.connect(happyPirate).transferFrom(userAddress,helpers.zeroAddress, allow);
            expect(await svr.balanceOf(helpers.zeroAddress)).to.be.eq(allow);
        })

        it('reverts if transferFrom is above allowance', async function () {
            await prepareAccountSVR(user, 100000)
            let allow = BigNumber.from(10)
            await svr.connect(user).approve(happyPirateAddress,allow);
            await expect(
                svr.connect(user).transferFrom(userAddress,helpers.zeroAddress,allow.add(1))
            ).to.be.revertedWith("SafeMath: subtraction overflow")
        })

        it('TransferFrom reduces allowance', async function () {
            await prepareAccountSVR(user, 100000)
            let allow = BigNumber.from(10)
            await svr.connect(user).approve(happyPirateAddress,allow);
            await svr.connect(happyPirate).transferFrom(userAddress,helpers.zeroAddress, allow.sub(5));
            expect(await svr.allowance(userAddress,happyPirateAddress)).to.be.eq(allow.sub(5))
        })

        it('mints amounts correctly if called by pool', async function () {
            controller.setIsPool(true);
            let transfers = BigNumber.from(10)
            await svr.connect(user).mint(happyPirateAddress,transfers);
            expect(await svr.balanceOf(happyPirateAddress)).to.be.eq(transfers)
        })

        it('reverts if not called by pool', async function () {
            controller.setIsPool(false);
            let transfers = BigNumber.from(10)
            await expect(
                svr.connect(user).mint(happyPirateAddress,transfers)
            ).to.be.revertedWith("Only a Pool can do this")
        })

        it('burns amounts correctly if called by pool', async function () {
            controller.setIsPool(true);
            await prepareAccountSVR(user, 100000)
            let transfers = BigNumber.from(10)
            await svr.connect(user).burnFrom(userAddress, transfers);
            expect(await svr.balanceOf(userAddress)).to.be.eq(BigNumber.from(100000).sub(transfers))
        })

        it('reverts if burn is not called by pool', async function () {
            await prepareAccountSVR(user, 100000)

            controller.setIsPool(false);
            let transfers = BigNumber.from(10)
            await expect(
                svr.connect(user).burnFrom(userAddress,transfers)
            ).to.be.revertedWith("Only a Pool can do this")
        })

        it('allows Owner to set new poolController', async function () {
            expect(await svr.poolController()).to.be.eq(controller.address)
            svr.connect(user).setController(happyPirateAddress)
            expect(await svr.poolController()).to.be.eq(happyPirateAddress)
        })

        it('allows Owner to set new owner', async function () {
            expect(await svr.owner()).to.be.eq(userAddress)
            svr.connect(user).setOwner(happyPirateAddress)
            expect(await svr.owner()).to.be.eq(happyPirateAddress)
        })

        it('reverts if other is setting poolController', async function () {
            expect(await svr.poolController()).to.be.eq(controller.address)
            await expect(
                svr.connect(happyPirate).setController(happyPirateAddress)
            ).to.be.revertedWith("Only Owner can do this")
        })

        it('reverts if other is setting owner', async function () {
            expect(await svr.owner()).to.be.eq(userAddress)
            await expect(
                svr.connect(happyPirate).setOwner(happyPirateAddress)
            ).to.be.revertedWith("Only Owner can do this")
        })

        it('emits Mint on call to mint()', async function () {
            controller.setIsPool(true)
            await expect(await svr.mint(userAddress, 10))
                .to.emit(svr, 'Mint')
        });

        it('emits Burn on call to burnFrom()', async function () {
            controller.setIsPool(true)
            await prepareAccountSVR(user, 10000)
            await expect(await svr.burnFrom(userAddress, 10))
                .to.emit(svr, 'Burn')
        });
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

    async function prepareAccountSVR (account: Signer, balance: number) {
        await svr.mint(await account.getAddress(), balance);
    }

    async function prepareAccountREIGN (account: Signer, balance: number) {
        await reign.mint(await account.getAddress(), balance);
    }
        
    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        happyPirate = accounts[1];

        userAddress = await user.getAddress();
        happyPirateAddress = await happyPirate.getAddress();
    }

});