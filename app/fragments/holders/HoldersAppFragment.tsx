import * as React from 'react';
import { fragment } from '../../fragment';
import { Alert, View } from 'react-native';
import { HoldersAppComponent } from './components/HoldersAppComponent';
import { useParams } from '../../utils/useParams';
import { t } from '../../i18n/t';
import { useEffect, useMemo } from 'react';
import { useTypedNavigation } from '../../utils/useTypedNavigation';
import { useHoldersAccountStatus, useHoldersIsReady, useNetwork, useSelectedAccount, useTheme } from '../../engine/hooks';
import { HoldersAccountState, holdersUrl } from '../../engine/api/holders/fetchAccountState';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { onHoldersInvalidate } from '../../engine/effects/onHoldersInvalidate';
import { useFocusEffect } from '@react-navigation/native';

export type HoldersAppParams = { type: 'account'; id: string; } | { type: 'create' };

export const HoldersAppFragment = fragment(() => {
    const theme = useTheme();
    const { isTestnet } = useNetwork();
    const params = useParams<HoldersAppParams>();
    const selected = useSelectedAccount();
    const navigation = useTypedNavigation();
    const status = useHoldersAccountStatus(selected!.address).data;
    const isHoldersReady = useHoldersIsReady(holdersUrl);

    const needsEnrollment = useMemo(() => {
        if (!isHoldersReady) {
            return true;
        }

        if (!status) {
            return true;
        }

        if (status.state === HoldersAccountState.NeedEnrollment) {
            return true;
        }

        return false;
    }, [status, isHoldersReady]);

    useEffect(() => {
        (async () => {
            await new Promise<boolean>(resolve => {
                Alert.alert(
                    'HoldersApp',
                    JSON.stringify({ needsEnrollment, status: status?.state, isHoldersReady }),
                    [{
                        text: t('common.ok'),
                        onPress: () => {
                            resolve(true)
                        }
                    }])
            });

            await new Promise<boolean>(resolve => {
                Alert.alert(
                    'HoldersApp',
                    'Going back to previous screen...',
                    [{
                        text: t('common.ok'),
                        onPress: () => {
                            resolve(true)
                        }
                    }])
            });

            if (needsEnrollment) {
                navigation.goBack();
            }
        })();
    }, [needsEnrollment]);

    useEffect(() => {
        return () => {
            if (!!selected) {
                onHoldersInvalidate(selected.addressString, isTestnet);
            }
        }
    }, [selected, isTestnet]);

    // to account for wierd statusbar bug with navigating withing the bottom bar stack
    useFocusEffect(() => setStatusBarStyle(theme.style === 'dark' ? 'light' : 'dark'));

    return (
        <View style={{
            flexGrow: 1,
            backgroundColor: theme.backgroundPrimary
        }}>
            <StatusBar style={theme.style === 'dark' ? 'light' : 'dark'} />
            {needsEnrollment ? null : (
                <HoldersAppComponent
                    title={t('products.holders.title')}
                    variant={params}
                    token={(status as { token: string }).token}
                    endpoint={holdersUrl}
                />
            )}
        </View>
    );
});