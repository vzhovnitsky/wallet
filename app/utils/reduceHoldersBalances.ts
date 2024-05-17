import { toNano } from "@ton/core";
import { GeneralHoldersAccount } from "../engine/api/holders/fetchAccounts";
import { toBnWithDecimals } from "./withDecimals";

export function reduceHoldersBalances(accs: GeneralHoldersAccount[], priceUSD: number) {
    return accs.reduce((acc, item) => {
        if (item.cryptoCurrency.ticker === 'TON') {
            return acc + BigInt(item.balance);
        }
        const amount = toBnWithDecimals(item.balance, item.cryptoCurrency.decimals) / toNano(priceUSD);
        return acc + toBnWithDecimals(amount, item.cryptoCurrency.decimals);
    }, BigInt(0));
}