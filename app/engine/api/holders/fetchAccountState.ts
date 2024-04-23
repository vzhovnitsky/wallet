import axios from 'axios';
import { z } from 'zod';
import { getHoldersUrl } from '../../../fragments/dev/DeveloperToolsFragment';

export const holdersEndpointStage = 'card-staging.whales-api.com';
export const holdersUrlStage = 'https://tonhub-stage.holders.io';

export const holdersEndpointProd = 'card-prod.whales-api.com';
export const holdersUrlProd = 'https://tonhub.holders.io';

export const holdersEndpoint = (isTestnet: boolean) => isTestnet ? holdersEndpointStage : holdersEndpointProd;
export const holdersUrl = (isTestnet: boolean) => isTestnet ? holdersUrlStage : holdersUrlProd;

export type AccountState = z.infer<typeof accountStateCodec>;

export type AccountStateRes = { ok: boolean, state: AccountState };

export enum HoldersAccountState {
    NeedEnrollment = 'need-enrollment',
    NeedPhone = 'need-phone',
    NoRef = 'no-ref',
    NeedKyc = 'need-kyc',
    NeedEmail = 'need-email',
    Ok = 'ok',
}

export const accountStateCodec = z.union([
    z.object({
        state: z.union([
            z.literal(HoldersAccountState.NeedPhone),
            z.literal(HoldersAccountState.NoRef),
        ]),
    }),
    z.object({
        state: z.literal(HoldersAccountState.NeedKyc),
        kycStatus: z.union([
            z.null(),
            z.object({
                applicantStatus: z.union([
                    z.union([
                        z.object({ review: z.object({ reviewStatus: z.string() }) }),
                        z.null(),
                        z.undefined()
                    ]),
                    z.undefined(),
                    z.null()
                ]),
            }),
        ]),
        notificationSettings: z.object({
            enabled: z.boolean(),
        }),
        suspended: z.boolean(),
    }),
    z.object({
        state: z.union([
            z.literal(HoldersAccountState.Ok),
            z.literal(HoldersAccountState.NeedEmail),
            z.literal(HoldersAccountState.NeedPhone),
        ]),
        notificationSettings: z.object({
            enabled: z.boolean(),
        }),
        suspended: z.boolean(),
    }),
]);

export const accountStateResCodec = z.object({
    ok: z.boolean(),
    state: accountStateCodec,
});

export async function fetchAccountState(token: string, isTestnet: boolean): Promise<AccountState | null> {
    const endpoint = isTestnet ? holdersEndpointStage : holdersEndpointProd;
    const res = await axios.post(`https://${endpoint}/account/state`, { token });

    if (res.status === 401) {
        return null;
    }

    if (!res.data.ok) {
        throw Error('Failed to fetch account state');
    }

    return res.data.state as AccountState;
}