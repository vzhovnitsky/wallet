import axios from 'axios';
import { holdersEndpoint } from './fetchAccountState';
import { z } from 'zod';

const tonconnectV2Config = z.object({
    address: z.string(),
    proof: z.object({
        timestamp: z.number(),
        domain: z.object({
            lengthBytes: z.number(),
            value: z.string(),
        }),
        signature: z.string(),
        payload: z.string(),
        walletStateInit: z.string().optional().nullable(),
        publicKey: z.string().optional().nullable(),
    })
});

const tonXKey = z.object({
    kind: z.literal('ton-x'),
    session: z.string(),
    config: z.object({
        address: z.string(),
        endpoint: z.string(),
        walletType: z.string(),
        walletConfig: z.string(),
        walletSig: z.string(),
        appPublicKey: z.string()
    })
});

const tonXLiteKey = z.object({
    kind: z.literal('ton-x-lite'),
    config: z.object({
        address: z.string(),
        walletConfig: z.string(),
        walletType: z.string(),
        time: z.number(),
        signature: z.string(),
        subkey: z.object({
            domain: z.string(),
            publicKey: z.string(),
            time: z.number(),
            signature: z.string()
        })
    })
});

const tonconnectV2Key = z.object({
    kind: z.literal('tonconnect-v2'),
    wallet: z.union([z.literal('tonhub'), z.literal('tonkeeper')]),
    config: tonconnectV2Config,
});

const keys = z.union([tonXKey, tonXLiteKey, tonconnectV2Key]);

export type AccountKeyParam = z.infer<typeof keys>;

export async function fetchAccountToken(key: AccountKeyParam, isTestnet: boolean): Promise<string> {
    const endpoint = holdersEndpoint(isTestnet);
    const requestParams = {
        stack: 'ton',
        network: isTestnet ? 'ton-testnet' : 'ton-mainnet',
        key: key
    };

    const res = await axios.post(
        `https://${endpoint}/v2/user/wallet/connect`,
        requestParams
    );

    if (!res.data.ok) {
        throw Error('Failed to fetch card token');
    }
    return res.data.token as string;
}