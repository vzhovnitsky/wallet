import { DefaultValue, atom, selector } from 'recoil';
import { persistedBooleanEffect } from '../utils/mmkvPersistanceEffects';
import { storage } from '../../storage/storage';
import * as Application from 'expo-application';

export const isTestnetKey = 'isTestnet';

export const IS_SANDBOX = Application.applicationId === 'com.tonhub.app.testnet' ||
    Application.applicationId === 'com.tonhub.app.debug.testnet' ||
    Application.applicationId === 'com.tonhub.wallet.testnet' ||
    Application.applicationId === 'com.tonhub.wallet.testnet.debug' ||
    Application.applicationId === 'com.sandbox.app.zenpay.demo' ||
    Application.applicationId === 'com.sandbox.app.zenpay.demo.debug';

const isTestnetAtom = atom({
    key: 'wallet/network/isTestnet',
    effects: [persistedBooleanEffect(storage, isTestnetKey)]
});

export function getIsTestnet() {
    let isTestnet = storage.getBoolean(isTestnetKey);
    if (isTestnet === undefined) {
      isTestnet = false;
    }
    if (IS_SANDBOX) {
      isTestnet = true;
    }

    return isTestnet;
}

export const networkSelector = selector({
    key: 'wallet/network',
    get: ({ get }) => {
        return { isTestnet: get(isTestnetAtom) ?? (IS_SANDBOX || false) };
    },
    set: ({ set }, newValue) => {
        if (newValue instanceof DefaultValue) {
            newValue = { isTestnet: false };
        }
        set(isTestnetAtom, newValue.isTestnet);
    }
});