import { Address, toNano } from "@ton/core";
import { useJettonContent, useJettons, useKnownJettons, useNetwork, usePrice } from "..";
import { fromBnWithDecimals } from "../../../utils/withDecimals";

export function useSpecialJetton(address: Address) {
    const { isTestnet: testOnly } = useNetwork();
    const knownJettons = useKnownJettons(testOnly);
    const specialJettonMaster = knownJettons?.specialJetton;
    const jettons = useJettons(address.toString({ testOnly }));
    const masterContent = useJettonContent(specialJettonMaster ?? null);
    const [price,] = usePrice();

    if (!specialJettonMaster) {
        return null;
    }

    // Check if the special jetton master is a valid address
    try {
        Address.parse(specialJettonMaster);
    } catch {
        return null;
    }

    const specialJetton = specialJettonMaster
        ? jettons.find(j => j.master.toString({ testOnly }) === specialJettonMaster)
        : null;

    const balanceString = fromBnWithDecimals(specialJetton?.balance ?? 0n, masterContent?.decimals ?? 6);
    const nano = toNano(balanceString);
    const tonRate = price?.price?.usd ? 1 / price.price.usd : 0; // 1 usd = tonRate * ton

    // Convert balance to TON
    let toTon = 0n;
    try {
        toTon = toNano(parseFloat(balanceString) * tonRate);
    } catch {
        console.warn('Failed to convert balance to TON');
    }

    return { ...specialJetton, nano, toTon, masterContent, master: Address.parse(specialJettonMaster) };
}

export type SpecialJetton = ReturnType<typeof useSpecialJetton>;