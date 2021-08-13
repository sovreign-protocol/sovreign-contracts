import {DeployConfig} from "../config";
import {Contract,BigNumber} from "ethers";
import { ERC20 } from "../../typechain";
import {increaseBlockTime, tenPow18} from "../../test/helpers/helpers";
import SynthSwap from "./ContractABIs/SynthSwap.json"
import SynthRates from "./ContractABIs/SynthRates.json"

export async function fundOwnerWallet(c: DeployConfig): Promise<DeployConfig> {
    console.log(`\n ---FUNDING OWNER ---`);

    const sbtc = c.sbtc as ERC20;
    const seth = c.seth as ERC20;
    const schf = c.schf as ERC20;
    const susd = c.susd as ERC20;
    const sxau = c.sxau as ERC20;
    const sxag = c.sxag as ERC20;

    await susd.connect(c.susdWhale).transfer(c.sovReignOwnerAddr,BigNumber.from(10_000_000).mul(tenPow18));
    console.log(`SUSD Transferred to Owner`);

    let synthAddress = "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F";

    const synthetix = new Contract(
        synthAddress,
        SynthSwap,
        c.sovReignOwnerAcct
    )
  
    console.log(`Synthetix connected at: ${synthAddress}`);

    let ratesAddress = "0xd69b189020EF614796578AfE4d10378c5e7e1138";

    const exchangeRates = new Contract(
        ratesAddress,
        SynthRates,
        c.sovReignOwnerAcct
    )
  
    console.log(`ExchangeRate connected at: ${ratesAddress}`);


    const sbtcCurrencyKey = await sbtc.currencyKey();
    const sethCurrencyKey = await seth.currencyKey();
    const schfCurrencyKey = await schf.currencyKey();
    const susdCurrencyKey = await susd.currencyKey();
    const sxauCurrencyKey = await sxau.currencyKey();
    const sxagCurrencyKey = await sxag.currencyKey();

    const sbtcPrice = await exchangeRates.effectiveValueAndRates(
        susdCurrencyKey, BigNumber.from(1).mul(tenPow18).mul(2), sbtcCurrencyKey);

    const sethPrice = await exchangeRates.effectiveValueAndRates(
        susdCurrencyKey, BigNumber.from(15).mul(tenPow18).mul(2), sethCurrencyKey);

    const schfPrice = await exchangeRates.effectiveValueAndRates(
        susdCurrencyKey, BigNumber.from(40000).mul(tenPow18).mul(2), schfCurrencyKey);

    const sxauPrice = await exchangeRates.effectiveValueAndRates(
        susdCurrencyKey, BigNumber.from(30).mul(tenPow18).mul(2), sxauCurrencyKey);

    const sxagPrice = await exchangeRates.effectiveValueAndRates(
        susdCurrencyKey, BigNumber.from(150).mul(tenPow18).mul(2), sxagCurrencyKey);



    const sbtcAmount = sbtcPrice[2];
    const sethAmount = sethPrice[2];
    const schfAmount = schfPrice[2];
    const sxauAmount = sxauPrice[2];
    const sxagAmount = sxagPrice[2];


    await synthetix.connect(c.sovReignOwnerAcct).exchange(susdCurrencyKey,sbtcAmount,sbtcCurrencyKey);
    console.log(`Swapped sUSD for ${await sbtc.balanceOf(c.sovReignOwnerAddr)} sbtc`)
    await synthetix.connect(c.sovReignOwnerAcct).exchange(susdCurrencyKey,sethAmount,sethCurrencyKey);
    console.log(`Swapped sUSD for ${await seth.balanceOf(c.sovReignOwnerAddr)} seth`)
    await synthetix.connect(c.sovReignOwnerAcct).exchange(susdCurrencyKey,schfAmount,schfCurrencyKey);
    console.log(`Swapped sUSD for ${await schf.balanceOf(c.sovReignOwnerAddr)} schf`)
    await synthetix.connect(c.sovReignOwnerAcct).exchange(susdCurrencyKey,sxauAmount,sxauCurrencyKey);
    console.log(`Swapped sUSD for ${await sxau.balanceOf(c.sovReignOwnerAddr)} sxau`)
    await synthetix.connect(c.sovReignOwnerAcct).exchange(susdCurrencyKey,sxagAmount,sxagCurrencyKey);
    console.log(`Swapped sUSD for ${await sxag.balanceOf(c.sovReignOwnerAddr)} sxag`)

    increaseBlockTime(600)

    await synthetix.connect(c.sovReignOwnerAcct).settle(sbtcCurrencyKey);
    await synthetix.connect(c.sovReignOwnerAcct).settle(sethCurrencyKey);
    await synthetix.connect(c.sovReignOwnerAcct).settle(schfCurrencyKey);
    await synthetix.connect(c.sovReignOwnerAcct).settle(sxauCurrencyKey);
    await synthetix.connect(c.sovReignOwnerAcct).settle(sxagCurrencyKey);

    console.log(`Settled to ${await sbtc.balanceOf(c.sovReignOwnerAddr)} sbtc`)
    console.log(`Settled to ${await seth.balanceOf(c.sovReignOwnerAddr)} seth`)
    console.log(`Settled to ${await schf.balanceOf(c.sovReignOwnerAddr)} schf`)
    console.log(`Settled to ${await sxau.balanceOf(c.sovReignOwnerAddr)} sxau`)
    console.log(`Settled to ${await sxag.balanceOf(c.sovReignOwnerAddr)} sxag`)

    return c;
}