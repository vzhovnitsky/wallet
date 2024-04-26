import * as React from 'react';
import { fragment } from '../../fragment';
import { View } from 'react-native';
import { HoldersAppComponent } from './components/HoldersAppComponent';
import { useParams } from '../../utils/useParams';
import { t } from '../../i18n/t';
import { useEffect, useMemo } from 'react';
import { useHoldersAccountStatus, useHoldersAccounts, useNetwork, useSelectedAccount, useTheme } from '../../engine/hooks';
import { holdersUrl } from '../../engine/api/holders/fetchAccountState';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { onHoldersInvalidate } from '../../engine/effects/onHoldersInvalidate';
import { useFocusEffect } from '@react-navigation/native';

export type HoldersAppParams = { type: 'account'; id: string; } | { type: 'create' } | { type: 'prepaid'; id: string };

export const HoldersAppFragment = fragment(() => {
    const theme = useTheme();
    const { isTestnet } = useNetwork();
    const params = useParams<HoldersAppParams>();
    const acc = useSelectedAccount();
    const status = useHoldersAccountStatus(acc!.address.toString({ testOnly: isTestnet })).data;
    const accounts = useHoldersAccounts(acc!.address.toString({ testOnly: isTestnet })).data;
    const url = holdersUrl(isTestnet);

    useEffect(() => {
        return () => {
            if (!!acc) {
                onHoldersInvalidate(acc.addressString, isTestnet);
            }
        }
    }, [acc, isTestnet]);

    // to account for wierd statusbar bug with navigating withing the bottom bar stack
    useFocusEffect(() => setStatusBarStyle(theme.style === 'dark' ? 'light' : 'dark'));

    // Resolve accounts and status with memo to avoid re-renders
    const holders = useMemo(() => {
        return { accounts, status };
    }, []);

    return (
        <View style={{
            flexGrow: 1,
            backgroundColor: theme.backgroundPrimary
        }}>
            <StatusBar style={theme.style === 'dark' ? 'light' : 'dark'} />
            <HoldersAppComponent
                title={t('products.holders.title')}
                variant={params}
                endpoint={url}
                accounts={holders.accounts}
                status={holders.status}
            />
        </View>
    );
});