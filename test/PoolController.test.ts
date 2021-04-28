import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    Erc20Mock, BasketBalancerMock, PoolController, Pool, SvrToken, ReignToken, OracleMock
 } from '../typechain';
import * as deploy from './helpers/deploy';
import { stringify } from 'querystring';


;

describe('PoolController', function () {

    let  svr: SvrToken, reign: ReignToken, underlying1: Erc20Mock, underlying2: Erc20Mock
    let  balancer: BasketBalancerMock, poolController:PoolController;
    let  oracle:OracleMock
    let  pool:Pool;

    let user: Signer, userAddress: string;
    let treasoury: Signer, treasouryAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;
    let interestStrategyAddress: string;
    let newAddress:string;


    before(async function () {

        await setupSigners();

        svr = (await deploy.deployContract('SvrToken', [userAddress])) as SvrToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;
        underlying1 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
        underlying2 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;
        
        oracle = (await deploy.deployContract('OracleMock')) as OracleMock;
 

        balancer = (
            await deploy.deployContract('BasketBalancerMock',[[underlying1.address], [500000]])
        ) as BasketBalancerMock; 
        await setupContracts();
   
    });

    beforeEach(async function() {

        poolController = (
            await deploy.deployContract('PoolController', [
                balancer.address, svr.address, reign.address, reignDAOAddress, treasouryAddress
            ])
        ) as PoolController; 

        await poolController.connect(reignDAO).createPool(
            underlying1.address, interestStrategyAddress, oracle.address
        )

        let poolAddress = await poolController.allPools(0);

        //connect to deployed pool
        pool = (await deploy.deployContract('Pool')) as Pool;
        pool = pool.attach(poolAddress);





    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(poolController.address).to.not.eql(0).and.to.not.be.empty;
        });
    
    });

    describe('Getters and Setters', async function () {

        it('sets correct addresses at construction', async function () {
           expect((await poolController.basketBalancer())).to.be.eq(balancer.address)
           expect(await poolController.svrToken()).to.be.eq(svr.address)
           expect(await poolController.reignToken()).to.be.eq(reign.address)
           expect(await poolController.reignDAO()).to.be.eq(reignDAOAddress)
           expect(await poolController.treasoury()).to.be.eq(treasouryAddress)
        });

        describe('updates BasketBalancer address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setBaseketBalancer(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setBaseketBalancer(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(poolController.connect(reignDAO).setBaseketBalancer(newAddress)).to.not.be.reverted;
                expect(await poolController.basketBalancer()).to.be.eq(newAddress)
            });
        });

        describe('updates SvrToken address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setSvrToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setSvrToken(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(poolController.connect(reignDAO).setSvrToken(newAddress)).to.not.be.reverted;
                expect(await poolController.svrToken()).to.be.eq(newAddress)
            });
        });

        describe('updates ReignToken address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setReignToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setReignToken(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(poolController.connect(reignDAO).setReignToken(newAddress)).to.not.be.reverted;
                expect(await poolController.reignToken()).to.be.eq(newAddress)
            });
        });

        describe('updates reignDAO address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setReignDAO(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setReignDAO(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(poolController.connect(reignDAO).setReignDAO(newAddress)).to.not.be.reverted;
                expect(await poolController.reignDAO()).to.be.eq(newAddress)
            });

            it('setters revert if called with old DAO', async function () {
                await expect(poolController.connect(reignDAO).setReignDAO(newAddress)).to.not.be.reverted;

                await expect(
                    poolController.connect(reignDAO).setReignToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
                await expect(
                    poolController.connect(reignDAO).setSvrToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
                await expect(
                    poolController.connect(reignDAO).setBaseketBalancer(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
                await expect(
                    poolController.connect(reignDAO).setReignDAO(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });
        });

        describe('updates Treasoury address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setTreasoury(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setTreasoury(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(poolController.connect(reignDAO).setTreasoury(newAddress)).to.not.be.reverted;
                expect(await poolController.treasoury()).to.be.eq(newAddress)
            });
        });

        describe('updates IntrestStaretgy address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setInterestStrategy(newAddress, pool.address)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setInterestStrategy(helpers.zeroAddress, pool.address)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(
                    poolController.connect(reignDAO).setInterestStrategy(newAddress, pool.address)
                ).to.not.be.reverted;
                expect(await poolController.getInterestStrategy(pool.address)).to.be.eq(newAddress)
            });
        });

        describe('updates Oracle address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    poolController.connect(user).setOracle(newAddress, pool.address)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    poolController.connect(reignDAO).setOracle(helpers.zeroAddress, pool.address)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(
                    poolController.connect(reignDAO).setOracle(newAddress, pool.address)
                ).to.not.be.reverted;
                expect(await poolController.getOracle(pool.address)).to.be.eq(newAddress)
            });
        });
    })
    
    
    describe('Creating Pools', async function () {
        
        it('creates a pool for an underlying', async function () {
            expect(await pool.token()).to.eq(underlying1.address)
        })

        it('sets the interest strategy', async function () {
            let interest = await poolController.getInterestStrategy(pool.address);
            expect(interest).to.be.eq(interestStrategyAddress);
        });

        it('sets the oracle', async function () {
            expect(await poolController.getOracle(pool.address)).to.be.eq(oracle.address);
        });

        it('adds the pools to the pool list', async function () {
            let pool_len = await poolController.allPoolsLength();
            expect(pool_len).to.eq(1);
            await expect(poolController.connect(reignDAO).createPool(
                underlying2.address, interestStrategyAddress, oracle.address
            )).to.not.be.reverted;
            let pool_len_after = await poolController.allPoolsLength();
            expect(pool_len_after).to.eq(2);
        });

        it('adds the pools to the balancer list', async function () {
            await expect(poolController.connect(reignDAO).createPool(
                underlying2.address, interestStrategyAddress, oracle.address
            )).to.not.be.reverted;
            let all_pools = await balancer.getPools();
            expect(all_pools[0]).to.eq(await pool.token());
        });

        it('adds the pools to the mapping', async function () {
            let last_pool = await poolController.allPools(0);
            let new_pool = await poolController.getPool(underlying1.address);
            expect(new_pool).to.eq(last_pool);

            await expect(poolController.connect(reignDAO).createPool(
                underlying2.address, interestStrategyAddress, oracle.address
            )).to.not.be.reverted;
            last_pool = await poolController.allPools(1);
            new_pool = await poolController.getPool(underlying2.address);
            expect(new_pool).to.eq(last_pool);
        });

        it('correctly relays price', async function () {
            //Mock Oracle returns always 2
            expect(await poolController.getTokenPrice(pool.address)).to.eq(BigNumber.from(2).mul(helpers.tenPow18));
        });

        it('correctly relays Reign Rate', async function () {
            //Mock Oracle returns always 2
            expect(await poolController.getReignPrice()).to.eq(BigNumber.from(2).mul(helpers.tenPow18));
        });

        it('correctly returns on isPool', async function () {
            expect(await poolController.isPool(pool.address)).to.be.true;
            expect(await poolController.isPool(userAddress)).to.be.false;
        });


        it('correctly returns TVL', async function () {
            expect(await poolController.getPoolsTVL()).to.eq(0)
            await depositIntoBothPools();
            let tvl = await poolController.getPoolsTVL();
            expect(tvl).to.eq((
                    BigNumber.from(1400000).mul(helpers.tenPow18).mul(1)  //token1 balance * price1
                    .add(BigNumber.from(1000000).mul(helpers.tenPow18).mul(1)) //token2 balance * price2
                ).mul(2)
            )
        });

        it('correctly returns target Size', async function () {
            expect(await poolController.getTargetSize(pool.address)).to.eq(0)
            await depositIntoBothPools();
            let targetSize = await poolController.getTargetSize(pool.address);
            expect(targetSize).to.eq(
                (await poolController.getPoolsTVL()).div(2).div(2)  // (TVL / 2) / price
            )
        });

        it('reverts if unauthorized addresses creates pool', async function () {
            await expect( 
                poolController.connect(user).createPool(
                    helpers.zeroAddress, interestStrategyAddress, oracle.address
                )
            ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
        });

        it('reverts if underlying is zero', async function () {
            await expect( 
                poolController.connect(reignDAO).createPool(
                    helpers.zeroAddress, interestStrategyAddress, oracle.address
                )
            ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
        });

        it('reverts if pool already exists', async function () {
            await expect(poolController.connect(reignDAO).createPool(
                underlying2.address, interestStrategyAddress, oracle.address
            )).to.not.be.reverted;
            await expect( 
                poolController.connect(reignDAO).createPool(
                    underlying2.address, interestStrategyAddress, oracle.address
                )
            ).to.be.revertedWith('SoV-Reign: POOL_EXISTS');
        });
    }); 



    async function depositIntoBothPools () {
        let pool2_address = await deployPool2();
        let pool2 = (await deploy.deployContract('Pool')) as Pool;
        pool2 = pool2.attach(pool2_address);

        await underlying1.connect(user).transfer(pool.address,BigNumber.from(1400000).mul(helpers.tenPow18));
        await pool.connect(user).sync();

        await underlying2.connect(user).transfer(pool2_address, BigNumber.from(1000000).mul(helpers.tenPow18));
        await pool2.connect(user).sync();
    }


    async function deployPool2 () {
        await poolController.connect(reignDAO).createPool(
            underlying2.address, interestStrategyAddress, oracle.address
        )
        let len = await poolController.allPoolsLength();
        return (await poolController.allPools(len.sub(1)));
    }
    


    async function setupContracts () {
        const cvValue = BigNumber.from(2800000).mul(helpers.tenPow18);

        await underlying1.mint(userAddress, cvValue);
        await underlying2.mint(userAddress, cvValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        treasoury = accounts[1];
        reignDAO = accounts[2];

        userAddress = await user.getAddress();
        treasouryAddress = await treasoury.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
        newAddress = await accounts[3].getAddress();
        interestStrategyAddress = await accounts[4].getAddress();
    }

});