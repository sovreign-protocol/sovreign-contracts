import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { expect } from 'chai';
import * as helpers from './helpers/helpers';

import { 
    Erc20Mock, BasketBalancerMock, PoolController, Pool, SovToken, ReignToken, OracleMock, InterestStrategy
 } from '../typechain';
import * as deploy from './helpers/deploy';
import { stringify } from 'querystring';


describe('PoolController', function () {

    let  sov: SovToken, reign: ReignToken, underlying1: Erc20Mock, underlying2: Erc20Mock
    let  balancer: BasketBalancerMock, pool_controller:PoolController;
    let  oracle:OracleMock, intrestStaretgy: InterestStrategy;
    let  pool:Pool;

    let user: Signer, userAddress: string;
    let reignDAO: Signer, reignDAOAddress: string;
    let newAddress:string;

    let pool_address:string;

    before(async function () {

        await setupSigners();

        sov = (await deploy.deployContract('SovToken', [userAddress])) as SovToken;
        reign = (await deploy.deployContract('ReignToken', [userAddress])) as ReignToken;
        underlying1 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock; 
        underlying2 = (await deploy.deployContract('ERC20Mock')) as Erc20Mock;
        
        oracle = (await deploy.deployContract('OracleMock')) as OracleMock;
        intrestStaretgy = (await deploy.deployContract('InterestStrategy')) as InterestStrategy;
 

        balancer = (
            await deploy.deployContract('BasketBalancerMock',[[underlying1.address], [1000000]])
        ) as BasketBalancerMock; 
        await setupContracts();
   
    });

    beforeEach(async function() {

        pool_controller = (
            await deploy.deployContract('PoolController', [balancer.address, sov.address, reign.address, reignDAOAddress])
        ) as PoolController; 

        await pool_controller.connect(reignDAO).createPool(
            underlying1.address, intrestStaretgy.address, oracle.address
        )

        pool_address = await pool_controller.allPools(0);

        //connect to deployed pool
        pool = (await deploy.deployContract('Pool')) as Pool;
        pool = pool.attach(pool_address);

    })


    describe('General', function () {
        it('should be deployed', async function () {
            expect(pool_controller.address).to.not.eql(0).and.to.not.be.empty;
        });
    
    });

    describe('Getters and Setters', async function () {

        it('sets correct addresses at construction', async function () {
           expect(await pool_controller.basketBalancer()).to.be.eq(balancer.address)
           expect(await pool_controller.sovToken()).to.be.eq(sov.address)
           expect(await pool_controller.reignToken()).to.be.eq(reign.address)
           expect(await pool_controller.reignDAO()).to.be.eq(reignDAOAddress)
        });

        describe('updates BasketBalancer address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setBaseketBalancer(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setBaseketBalancer(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(pool_controller.connect(reignDAO).setBaseketBalancer(newAddress)).to.not.be.reverted;
                expect(await pool_controller.basketBalancer()).to.be.eq(newAddress)
            });
        });

        describe('updates SovToken address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setSovToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setSovToken(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(pool_controller.connect(reignDAO).setSovToken(newAddress)).to.not.be.reverted;
                expect(await pool_controller.sovToken()).to.be.eq(newAddress)
            });
        });

        describe('updates ReignToken address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setReignToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setReignToken(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(pool_controller.connect(reignDAO).setReignToken(newAddress)).to.not.be.reverted;
                expect(await pool_controller.reignToken()).to.be.eq(newAddress)
            });
        });

        describe('updates reignDAO address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setReignDAO(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setReignDAO(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(pool_controller.connect(reignDAO).setReignDAO(newAddress)).to.not.be.reverted;
                expect(await pool_controller.reignDAO()).to.be.eq(newAddress)
            });

            it('setters revert if called with old DAO', async function () {
                await expect(pool_controller.connect(reignDAO).setReignDAO(newAddress)).to.not.be.reverted;

                await expect(
                    pool_controller.connect(reignDAO).setReignToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
                await expect(
                    pool_controller.connect(reignDAO).setSovToken(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
                await expect(
                    pool_controller.connect(reignDAO).setBaseketBalancer(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
                await expect(
                    pool_controller.connect(reignDAO).setReignDAO(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });
        });

        describe('updates IntrestStaretgy address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setInterestStrategy(newAddress, pool_address)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setInterestStrategy(helpers.zeroAddress, pool_address)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setInterestStrategy(newAddress, pool_address)
                ).to.not.be.reverted;
                expect(await pool_controller.getInterestStrategy(pool_address)).to.be.eq(newAddress)
            });
        });

        describe('updates Oracle address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setOracle(newAddress, pool_address)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setOracle(helpers.zeroAddress, pool_address)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setOracle(newAddress, pool_address)
                ).to.not.be.reverted;
                expect(await pool_controller.getOracle(pool_address)).to.be.eq(newAddress)
            });
        });

        describe('updates feeTo address correctly', async function () {
            it('reverts if not called by DAO', async function () {
                await expect(
                    pool_controller.connect(user).setFeeTo(newAddress)
                ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
            });

            it('reverts if called with Zero Address', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setFeeTo(helpers.zeroAddress)
                ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
            });

            it('sets correct address otherwise', async function () {
                await expect(
                    pool_controller.connect(reignDAO).setFeeTo(newAddress)
                ).to.not.be.reverted;
                expect(await pool_controller.feeTo()).to.be.eq(newAddress)
            });
        });

    })
    
    
    describe('Creating Pools', async function () {
        
        it('creates a pool for an underlying', async function () {
            expect(await pool.token()).to.eq(underlying1.address)
        })

        it('sets the interest strategy', async function () {
            let interest = await pool_controller.getInterestStrategy(pool_address);
            expect(interest).to.be.eq(intrestStaretgy.address);
        });

        it('sets the oracle', async function () {
            expect(await pool_controller.getOracle(pool_address)).to.be.eq(oracle.address);
        });

        it('adds the pools to the pool list', async function () {
            let pool_len = await pool_controller.allPoolsLength();
            expect(pool_len).to.eq(1);
            await expect(pool_controller.connect(reignDAO).createPool(
                underlying2.address, intrestStaretgy.address, oracle.address
            )).to.not.be.reverted;
            let pool_len_after = await pool_controller.allPoolsLength();
            expect(pool_len_after).to.eq(2);
        });

        it('adds the pools to the balancer list', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(
                underlying2.address, intrestStaretgy.address, oracle.address
            )).to.not.be.reverted;
            let all_pools = await balancer.getPools();
            expect(all_pools[0]).to.eq(await pool.token());
        });

        it('adds the pools to the mapping', async function () {
            let last_pool = await pool_controller.allPools(0);
            let new_pool = await pool_controller.getPool(underlying1.address);
            expect(new_pool).to.eq(last_pool);

            await expect(pool_controller.connect(reignDAO).createPool(
                underlying2.address, intrestStaretgy.address, oracle.address
            )).to.not.be.reverted;
            last_pool = await pool_controller.allPools(1);
            new_pool = await pool_controller.getPool(underlying2.address);
            expect(new_pool).to.eq(last_pool);
        });

        it('correctly relays target allocation', async function () {
            expect(await pool_controller.getTargetAllocation(underlying1.address)).to.eq(1000000);
        });

        it('correctly relays price', async function () {
            //Mock Oracle returns 1
            expect(await pool_controller.getTokenPrice(pool_address)).to.eq(BigNumber.from(10).pow(18));
        });

        it('correctly relays Reign Rate', async function () {
            //Mock Oracle returns 1
            expect(await pool_controller.getReignRate(pool_address)).to.eq(BigNumber.from(10).pow(18));
        });

        it('correctly relays interest rate', async function () {
            let interest_rate = await pool_controller.getInterestRate(pool_address,100,101)
            expect(interest_rate[0]).to.eq(338497452615);
            expect(interest_rate[1]).to.eq(0);

            interest_rate = (await pool_controller.getInterestRate(pool_address,101,100))
            expect(interest_rate[0]).to.eq(57305936073);
            expect(interest_rate[1]).to.eq(0);
        });

        it('correctly returns on isPool', async function () {
            expect(await pool_controller.isPool(pool_address)).to.be.true;
            expect(await pool_controller.isPool(userAddress)).to.be.false;
        });

        it('correctly returns TVL', async function () {
            expect(await pool_controller.getPoolsTVL()).to.eq(0)
            await depositIntoBothPools();
            let tvl = await pool_controller.getPoolsTVL();
            expect(tvl).to.eq(
                BigNumber.from(1400000).mul(helpers.tenPow18).mul(1)  //token1 balance * price1
                .add(BigNumber.from(1000000).mul(helpers.tenPow18).mul(1)) //token2 balance * price2
            )
        });

        it('reverts if unauthorized addresses creates pool', async function () {
            await expect( 
                pool_controller.connect(user).createPool(
                    helpers.zeroAddress, intrestStaretgy.address, oracle.address
                )
            ).to.be.revertedWith('SoV-Reign: FORBIDDEN');
        });

        it('reverts if underlying is zero', async function () {
            await expect( 
                pool_controller.connect(reignDAO).createPool(
                    helpers.zeroAddress, intrestStaretgy.address, oracle.address
                )
            ).to.be.revertedWith('SoV-Reign: ZERO_ADDRESS');
        });

        it('reverts if pool already exists', async function () {
            await expect(pool_controller.connect(reignDAO).createPool(
                underlying2.address, intrestStaretgy.address, oracle.address
            )).to.not.be.reverted;
            await expect( 
                pool_controller.connect(reignDAO).createPool(
                    underlying2.address, intrestStaretgy.address, oracle.address
                )
            ).to.be.revertedWith('SoV-Reign: POOL_EXISTS');
        });
    }); 



    async function depositIntoBothPools () {
        let pool2_address = await deployPool2();
        let pool2 = (await deploy.deployContract('Pool')) as Pool;
        pool2 = pool2.attach(pool2_address);

        await underlying1.connect(user).transfer(pool_address,BigNumber.from(1400000).mul(helpers.tenPow18));
        await pool.connect(user).sync();

        await underlying2.connect(user).transfer(pool2_address, BigNumber.from(1000000).mul(helpers.tenPow18));
        await pool2.connect(user).sync();
    }


    async function deployPool2 () {
        await pool_controller.connect(reignDAO).createPool(
            underlying2.address, intrestStaretgy.address, oracle.address
        )
        let len = await pool_controller.allPoolsLength();
        return (await pool_controller.allPools(len.sub(1)));
    }
    


    async function setupContracts () {
        const cvValue = BigNumber.from(2800000).mul(helpers.tenPow18);

        await underlying1.mint(userAddress, cvValue);
        await underlying2.mint(userAddress, cvValue);
    }

    async function setupSigners () {
        const accounts = await ethers.getSigners();
        user = accounts[0];
        reignDAO = accounts[1];

        userAddress = await user.getAddress();
        reignDAOAddress = await reignDAO.getAddress();
        newAddress = await accounts[2].getAddress();
    }

});