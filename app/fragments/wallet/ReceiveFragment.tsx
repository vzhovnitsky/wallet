import React, { useCallback, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fragment } from "../../fragment";
import { View, Text, Pressable, ScrollView, Image, Platform, Alert } from "react-native";
import { t } from "../../i18n/t";
import { QRCode } from "../../components/QRCode/QRCode";
import { useParams } from "../../utils/useParams";
import { CopyButton } from "../../components/CopyButton";
import { ShareButton } from "../../components/ShareButton";
import { WImage } from "../../components/WImage";
import { useTypedNavigation } from "../../utils/useTypedNavigation";
import { ScreenHeader } from "../../components/ScreenHeader";
import { captureRef } from 'react-native-view-shot';
import { useNetwork, useBounceableWalletFormat, useSelectedAccount, useTheme, useVerifyJetton } from "../../engine/hooks";
import { Address } from "@ton/core";
import { JettonMasterState } from "../../engine/metadata/fetchJettonMasterContent";
import { getJettonMaster } from "../../engine/getters/getJettonMaster";
import { StatusBar } from "expo-status-bar";
import { useLedgerTransport } from "../ledger/components/TransportContext";
import { pathFromAccountNumber } from "../../utils/pathFromAccountNumber";
import { RoundButton } from "../../components/RoundButton";
import { Typography } from "../../components/styles";

import TonIcon from '@assets/ic-ton-acc.svg';

export const ReceiveFragment = fragment(() => {
    const theme = useTheme();
    const network = useNetwork();
    const safeArea = useSafeAreaInsets();
    const navigation = useTypedNavigation();
    const imageRef = useRef<View>(null);
    const params = useParams<{ addr?: string, ledger?: boolean, jetton?: { master: Address, data: JettonMasterState } }>();
    const selected = useSelectedAccount();
    const [bounceableFormat,] = useBounceableWalletFormat();
    const ledgerContext = useLedgerTransport();

    const qrSize = 262;

    const [jetton, setJetton] = useState<{ master: Address, data: JettonMasterState } | null>(params?.jetton ?? null);

    const friendly = useMemo(() => {
        if (params.addr) {
            try {
                const parsed = Address.parseFriendly(params.addr);
                return parsed.address.toString({ testOnly: network.isTestnet, bounceable: parsed.isBounceable });
            } catch {
                Alert.alert(t('common.error'), t('transfer.error.invalidAddress'));
            }
        }
        return selected!.address.toString({ testOnly: network.isTestnet, bounceable: bounceableFormat });
    }, [params, selected, bounceableFormat]);

    const onAssetSelected = useCallback((selected?: { master: Address, wallet?: Address }) => {
        if (selected) {
            const data = getJettonMaster(selected.master, network.isTestnet);
            if (data) {
                setJetton({ master: selected.master, data });
                return;
            }
        }
        setJetton(null);
    }, []);

    const ledgerConfirming = useRef(false);

    const onLedgerConfirm = useCallback(async () => {
        if (params.ledger && ledgerConfirming.current === false) {
            ledgerConfirming.current = true;
            try {
                const addr = ledgerContext.addr;
                if (!addr || !ledgerContext?.tonTransport) {
                    Alert.alert(t('hardwareWallet.ledger'), t('hardwareWallet.errors.noDevice'));
                } else {
                    const path = pathFromAccountNumber(addr?.acc, network.isTestnet);
                    await ledgerContext?.tonTransport?.validateAddress(path, { testOnly: network.isTestnet });
                }
            } catch (e) {
                let isAppOpen = await ledgerContext.tonTransport?.isAppOpen();

                if (!isAppOpen) {
                    Alert.alert(t('hardwareWallet.ledger'), t('hardwareWallet.openTheAppDescription'));
                } else if (e instanceof Error && e.name === 'LockedDeviceError') {
                    Alert.alert(t('hardwareWallet.ledger'), t('hardwareWallet.unlockLedgerDescription'));
                }
            } finally {
                ledgerConfirming.current = false;
            }
        }
    }, [ledgerContext, network.isTestnet]);

    const link = useMemo(() => {
        if (jetton) {
            return `https://${network.isTestnet ? 'test.' : ''}tonhub.com/transfer`
                + `/${friendly}`
                + `?jetton=${jetton.master.toString({ testOnly: network.isTestnet })}`
        }
        return `https://${network.isTestnet ? 'test.' : ''}tonhub.com/transfer`
            + `/${friendly}`
    }, [jetton, network, friendly]);

    const { isSCAM, verified: isVerified } = useVerifyJetton({
        ticker: jetton?.data.symbol,
        master: jetton?.master?.toString({ testOnly: network.isTestnet })
    });

    return (
        <View
            style={{
                flexGrow: 1,
                justifyContent: 'space-between',
                alignItems: 'center'
            }}
            collapsable={false}
        >
            <StatusBar style={Platform.select({ android: theme.style === 'dark' ? 'light' : 'dark', ios: 'light' })} />
            <ScreenHeader
                style={[
                    { minHeight: safeArea.bottom === 0 ? 60 : undefined },
                    Platform.select({ android: { paddingTop: safeArea.top } })
                ]}
                title={t('receive.title')}
                onClosePressed={navigation.goBack}
            />
            <ScrollView style={{ flexGrow: 1, width: '100%' }}>
                <View
                    ref={imageRef}
                    style={Platform.select({
                        ios: { backgroundColor: theme.elevation },
                        android: { backgroundColor: theme.backgroundPrimary }
                    })}
                >
                    <Text style={{
                        color: theme.textSecondary,
                        fontSize: 17,
                        fontWeight: '400',
                        lineHeight: 24,
                        textAlign: 'center',
                        marginBottom: 24,
                        marginHorizontal: 32,
                        marginTop: 16
                    }}>
                        {t('receive.subtitle')}
                    </Text>
                    <View style={{ paddingHorizontal: 43, width: '100%', marginBottom: 16 }}>
                        <View style={{
                            justifyContent: 'center',
                            backgroundColor: theme.style === 'dark' ? theme.white : theme.surfaceOnElevation,
                            borderRadius: 20,
                            padding: 24,
                            marginBottom: 16,
                            overflow: 'hidden',
                        }}>
                            <View style={{ height: qrSize, justifyContent: 'center', alignItems: 'center' }}>
                                <QRCode
                                    data={link}
                                    size={qrSize}
                                    icon={jetton?.data.image}
                                    color={theme.backgroundUnchangeable}
                                />
                            </View>
                        </View>
                        <View style={{ backgroundColor: theme.surfaceOnElevation, borderRadius: 20, padding: 20, paddingBottom: params.ledger ? 10 : 20 }}>
                            <Pressable
                                style={({ pressed }) => {
                                    return {
                                        opacity: pressed ? 0.5 : 1,
                                    }
                                }}
                                onPress={() => {
                                    if (params.ledger) {
                                        navigation.navigate('LedgerAssets', { callback: onAssetSelected, selectedJetton: jetton?.master });
                                        return;
                                    }
                                    navigation.navigate('Assets', { callback: onAssetSelected, selectedJetton: jetton?.master });
                                }}
                            >
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <View style={{ height: 46, width: 46, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            {!!jetton && (
                                                <WImage
                                                    src={jetton.data.image?.preview256}
                                                    blurhash={jetton.data.image?.blurhash}
                                                    width={46}
                                                    heigh={46}
                                                    borderRadius={23}
                                                    lockLoading
                                                />
                                            )}
                                            {!jetton && (
                                                <TonIcon width={46} height={46} style={{ height: 46, width: 46 }} />
                                            )}
                                            {isVerified ? (
                                                <View style={{
                                                    justifyContent: 'center', alignItems: 'center',
                                                    height: 20, width: 20, borderRadius: 10,
                                                    position: 'absolute', right: -2, bottom: -2,
                                                    backgroundColor: theme.surfaceOnElevation
                                                }}>
                                                    <Image
                                                        source={require('@assets/ic-verified.png')}
                                                        style={{ height: 20, width: 20 }}
                                                    />
                                                </View>
                                            ) : (isSCAM && (
                                                <View style={{
                                                    justifyContent: 'center', alignItems: 'center',
                                                    height: 20, width: 20, borderRadius: 10,
                                                    position: 'absolute', right: -2, bottom: -2,
                                                    backgroundColor: theme.surfaceOnBg
                                                }}>
                                                    <Image
                                                        source={require('@assets/ic-jetton-scam.png')}
                                                        style={{ height: 20, width: 20 }}
                                                    />
                                                </View>
                                            ))}
                                        </View>
                                        <View style={{ justifyContent: 'space-between' }}>
                                            <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                                                {`${jetton?.data.symbol ?? `TON ${t('common.wallet')}`}`}
                                                {isSCAM && (
                                                    <>
                                                        {' • '}
                                                        <Text style={{ color: theme.accentRed }}>
                                                            {'SCAM'}
                                                        </Text>
                                                    </>
                                                )}
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 15,
                                                    fontWeight: '400',
                                                    lineHeight: 20,
                                                    color: theme.textSecondary,
                                                }}
                                                selectable={false}
                                                ellipsizeMode={'middle'}
                                            >
                                                {
                                                    friendly.slice(0, 6)
                                                    + '...'
                                                    + friendly.slice(friendly.length - 6)
                                                }
                                            </Text>
                                        </View>
                                    </View>
                                    <Image
                                        source={require('@assets/ic-chevron-right.png')}
                                        style={{ height: 16, width: 16, tintColor: theme.iconPrimary }}
                                    />
                                </View>
                            </Pressable>
                            {params.ledger && !jetton && (
                                <RoundButton
                                    display={'secondary_contrast'}
                                    title={t('hardwareWallet.actions.loadAddress')}
                                    action={onLedgerConfirm}
                                    style={{ marginTop: 8 }}
                                />
                            )}
                        </View>
                    </View>
                </View>
                <View style={{
                    width: '100%',
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                    paddingHorizontal: 43,
                    marginBottom: safeArea.bottom + 16,
                }}>
                    <CopyButton
                        style={{
                            marginRight: 16,
                            backgroundColor: theme.surfaceOnElevation,
                            borderWidth: 0,
                            height: 56,
                        }}
                        body={friendly}
                        textStyle={{
                            color: theme.textThird,
                            fontSize: 17, lineHeight: 24,
                            fontWeight: '600',
                        }}
                    />
                    <ShareButton
                        style={{
                            backgroundColor: theme.surfaceOnElevation,
                            borderWidth: 0,
                            height: 56,
                        }}
                        body={link}
                        textStyle={{
                            color: theme.textThird,
                            fontSize: 17, lineHeight: 24,
                            fontWeight: '600',
                        }}
                        onScreenCapture={() => {
                            return new Promise((resolve, reject) => {
                                (async () => {
                                    setTimeout(async () => {
                                        try {
                                            const localUri = await captureRef(imageRef, {
                                                height: 440,
                                                quality: 1,
                                            });
                                            resolve({ uri: localUri });
                                        } catch {
                                            reject();
                                        }
                                    }, 150);
                                })();
                            })
                        }}
                    />
                </View>
            </ScrollView>
            <View style={{ flexGrow: 1 }} />
        </View>
    );
});