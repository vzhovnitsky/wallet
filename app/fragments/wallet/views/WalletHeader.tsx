import React from "react";
import { memo, useCallback } from "react";
import { Pressable, View, Text, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../../components/Avatar";
import { useTypedNavigation } from "../../../utils/useTypedNavigation";
import { getAppState } from "../../../storage/appState";
import { resolveUrl } from "../../../utils/resolveUrl";
import { t } from "../../../i18n/t";
import { useLinkNavigator } from "../../../useLinkNavigator";
import { ReAnimatedCircularProgress } from "../../../components/CircularProgress/ReAnimatedCircularProgress";
import { CopilotStep } from "react-native-copilot";
import { OnboadingView } from "../../../components/onboarding/CopilotTooltip";
import { useNetwork, useSelectedAccount, useSyncState, useTheme } from "../../../engine/hooks";
import { useWalletSettings } from "../../../engine/hooks/appstate/useWalletSettings";

import NoConnection from '@assets/ic-no-connection.svg';

export const WalletHeader = memo(() => {
    const network = useNetwork();
    const theme = useTheme();
    const linkNavigator = useLinkNavigator(network.isTestnet);
    const syncState = useSyncState();
    const safeArea = useSafeAreaInsets();
    const navigation = useTypedNavigation();

    const address = useSelectedAccount()!.address;
    const currentWalletIndex = getAppState().selected;
    const [walletSettings,] = useWalletSettings(address);

    const onQRCodeRead = (src: string) => {
        try {
            let res = resolveUrl(src, network.isTestnet);
            if (res) {
                linkNavigator(res);
            }
        } catch (error) {
            // Ignore
        }
    };
    const openScanner = useCallback(() => navigation.navigateScanner({ callback: onQRCodeRead }), []);

    const onAccountPress = useCallback(() => {
        navigation.navigate('AccountSelector');
    }, []);

    return (
        <View
            style={{
                backgroundColor: theme.backgroundUnchangeable,
                paddingTop: safeArea.top + (Platform.OS === 'ios' ? 0 : 16),
                paddingHorizontal: 16
            }}
            collapsable={false}
        >
            <View style={{
                height: 44,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 6
            }}>
                <Pressable
                    style={({ pressed }) => {
                        return {
                            opacity: pressed ? 0.5 : 1,
                            flex: 1
                        }
                    }}
                    onPress={() => navigation.navigate('WalletSettings')}
                >
                    <CopilotStep
                        text={t('onboarding.avatar')}
                        order={1}
                        name={'firstStep'}
                    >
                        <OnboadingView style={{
                            width: 32, height: 32,
                            backgroundColor: theme.accent,
                            borderRadius: 16
                        }}>
                            <Avatar
                                id={address.toString({ testOnly: network.isTestnet })}
                                size={32}
                                borderWith={0}
                                hash={walletSettings?.avatar}
                                backgroundColor={theme.iconUnchangeable}
                                theme={theme}
                                isTestnet={network.isTestnet}
                            />
                        </OnboadingView>
                    </CopilotStep>
                </Pressable>
                <Pressable
                    onPress={onAccountPress}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: '30%' }}
                >
                    <CopilotStep
                        text={t('onboarding.wallet')}
                        order={2}
                        name={'secondStep'}
                    >
                        <OnboadingView style={{
                            flexDirection: 'row',
                            backgroundColor: theme.surfaceOnDark,
                            height: 32, borderRadius: 32,
                            paddingHorizontal: 12, paddingVertical: 4,
                            alignItems: 'center'
                        }}>
                            <Text
                                style={{
                                    fontWeight: '500',
                                    fontSize: 17, lineHeight: 24,
                                    color: theme.textOnsurfaceOnDark, flexShrink: 1,
                                    marginRight: 8
                                }}
                                ellipsizeMode='tail'
                                numberOfLines={1}
                            >
                                {walletSettings?.name || `${network.isTestnet ? '[test]' : ''} ${t('common.wallet')} ${currentWalletIndex + 1}`}
                            </Text>
                            {syncState === 'updating' && (
                                <ReAnimatedCircularProgress
                                    size={14}
                                    color={theme.textOnsurfaceOnDark}
                                    reverse
                                    infinitRotate
                                    progress={0.8}
                                />
                            )}
                            {syncState === 'connecting' && (
                                <NoConnection
                                    height={16}
                                    width={16}
                                    style={{ height: 16, width: 16 }}
                                />
                            )}
                            {syncState === 'online' && (
                                <View style={{ height: 16, width: 16, justifyContent: 'center', alignItems: 'center' }}>
                                    <View style={{ backgroundColor: theme.accentGreen, width: 8, height: 8, borderRadius: 4 }} />
                                </View>
                            )}
                        </OnboadingView>
                    </CopilotStep>
                </Pressable>
                <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'flex-end' }}>
                    <Pressable
                        style={({ pressed }) => ({
                            opacity: pressed ? 0.5 : 1,
                            backgroundColor: theme.surfaceOnDark,
                            height: 32, width: 32, justifyContent: 'center', alignItems: 'center',
                            borderRadius: 16
                        })}
                        onPress={openScanner}
                    >
                        <Image
                            source={require('@assets/ic-scan-main.png')}
                            style={{
                                height: 22,
                                width: 22,
                                tintColor: theme.iconUnchangeable
                            }}
                        />
                    </Pressable>
                </View>
            </View>
        </View>
    );
});