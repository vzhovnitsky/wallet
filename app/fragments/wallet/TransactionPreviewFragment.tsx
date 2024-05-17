import React, { useCallback, useMemo } from "react";
import { Platform, ScrollView, Text, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fragment } from "../../fragment";
import { getAppState } from "../../storage/appState";
import { useParams } from "../../utils/useParams";
import { valueText } from "../../components/ValueComponent";
import { formatDate, formatTime } from "../../utils/dates";
import { useTypedNavigation } from "../../utils/useTypedNavigation";
import { Avatar, avatarColors } from "../../components/avatar/Avatar";
import { t } from "../../i18n/t";
import { KnownWallet, KnownWallets } from "../../secure/KnownWallets";
import { RoundButton } from "../../components/RoundButton";
import { PriceComponent } from "../../components/PriceComponent";
import { copyText } from "../../utils/copyText";
import { ToastDuration, useToaster } from '../../components/toast/ToastProvider';
import { ScreenHeader } from "../../components/ScreenHeader";
import { ItemGroup } from "../../components/ItemGroup";
import { AboutIconButton } from "../../components/AboutIconButton";
import { useAppState, useBounceableWalletFormat, useDontShowComments, useJettons, useKnownJettons, useNetwork, usePeparedMessages, usePrice, useSelectedAccount, useServerConfig, useSpamMinAmount, useTheme, useVerifyJetton, useWalletsSettings } from "../../engine/hooks";
import { useRoute } from "@react-navigation/native";
import { TransactionDescription } from "../../engine/types";
import { BigMath } from "../../utils/BigMath";
import { useLedgerTransport } from "../ledger/components/TransportContext";
import { Address, fromNano } from "@ton/core";
import { StatusBar } from "expo-status-bar";
import { formatAmount, formatCurrency } from "../../utils/formatCurrency";
import { PerfText } from "../../components/basic/PerfText";
import { Typography } from "../../components/styles";
import { useAddressBookContext } from "../../engine/AddressBookContext";
import { PerfView } from "../../components/basic/PerfView";
import { PreviewFrom } from "./views/preview/PreviewFrom";
import { PreviewTo } from "./views/preview/PreviewTo";
import { TxInfo } from "./views/preview/TxInfo";
import { AddressComponent } from "../../components/address/AddressComponent";
import { avatarHash } from "../../utils/avatarHash";
import { PreviewMessages } from "./views/preview/PreviewMessages";
import { BatchAvatars } from "../../components/avatar/BatchAvatars";
import { ItemDivider } from "../../components/ItemDivider";
import { HoldersOpType, HoldersOpView } from "../../components/transfer/HoldersOpView";

const TransactionPreview = () => {
    const theme = useTheme();
    const { isTestnet } = useNetwork();
    const knownWallets = KnownWallets(isTestnet);
    const route = useRoute();
    const safeArea = useSafeAreaInsets();
    const navigation = useTypedNavigation();
    const selected = useSelectedAccount()!;
    const toaster = useToaster();
    const ledgerContext = useLedgerTransport();
    const appState = useAppState();
    const addressBook = useAddressBookContext();
    const [price, currency] = usePrice();
    const [spamMinAmount,] = useSpamMinAmount();
    const [dontShowComments,] = useDontShowComments();
    const [bounceableFormat,] = useBounceableWalletFormat();
    const knownJettonMasters = useKnownJettons(isTestnet)?.masters ?? {};

    const isLedger = route.name === 'LedgerTransactionPreview';

    const address = useMemo(() => {
        if (isLedger && !!ledgerContext?.addr?.address) {
            try {
                return Address.parse(ledgerContext.addr.address);
            } catch {
                return null;
            }
        } else {
            return selected.address;
        }
    }, [ledgerContext?.addr?.address, selected]);

    const jettons = useJettons(address!.toString({ testOnly: isTestnet }));
    const params = useParams<{ transaction: TransactionDescription }>();

    const tx = params.transaction;
    const operation = tx.base.operation;
    const kind = tx.base.parsed.kind;
    const item = operation.items[0];
    const fees = BigInt(tx.base.fees);
    const messages = tx.base.outMessages ?? [];
    const opAddress = item.kind === 'token' ? operation.address : tx.base.parsed.resolvedAddress;
    const isOwn = appState.addresses.findIndex((a) => a.address.equals(Address.parse(opAddress))) >= 0;
    const parsedOpAddr = Address.parseFriendly(opAddress);
    const parsedAddress = parsedOpAddr.address;
    const opAddressBounceable = parsedAddress.toString({ testOnly: isTestnet });

    const preparedMessages = usePeparedMessages(messages, isTestnet);
    const [walletsSettings,] = useWalletsSettings();
    const ownWalletSettings = walletsSettings[opAddressBounceable];
    const opAddressWalletSettings = walletsSettings[opAddressBounceable];

    const avatarColorHash = opAddressWalletSettings?.color ?? avatarHash(opAddress, avatarColors.length);
    const avatarColor = avatarColors[avatarColorHash];

    const contact = addressBook.asContact(opAddressBounceable);
    const isSpam = addressBook.isDenyAddress(opAddressBounceable);

    let dateStr = `${formatDate(tx.base.time, 'MMMM dd, yyyy')} • ${formatTime(tx.base.time)}`;
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    const feesPrise = useMemo(() => {
        if (!price) {
            return undefined;
        }

        const isNeg = fees < 0n;
        const abs = isNeg ? -fees : fees;

        return formatCurrency(
            (parseFloat(fromNano(abs)) * price.price.usd * price.price.rates[currency]).toFixed(3),
            currency,
            isNeg
        );
    }, [price, currency, fees]);

    let jetton = jettons.find((j) =>
        !!tx.metadata?.jettonWallet?.master
        && j.master.equals(tx.metadata?.jettonWallet?.master)
    );

    let op: string;
    if (tx.op) {
        op = tx.op;
        if (op === 'airdrop') {
            op = t('tx.airdrop');
        }
    } else {
        if (tx.base.parsed.kind === 'out') {
            if (tx.base.parsed.status === 'pending') {
                op = t('tx.sending');
            } else {
                op = t('tx.sent');
            }
        } else if (tx.base.parsed.kind === 'in') {
            if (tx.base.parsed.bounced) {
                op = t('tx.bounced');
            } else {
                op = t('tx.received');
            }
        } else {
            throw Error('Unknown kind');
        }
    }

    const holdersOp = useMemo<null | HoldersOpType>(
        () => {
            if (!operation.op) {
                return null;
            }

            if (operation.op.res === 'known.holders.accountTopUp') {
                return {
                    type: 'topUp',
                    amount: operation.op.options.amount
                };
            } else if (operation.op.res === 'known.holders.accountJettonTopUp') {
                return { type: 'jettonTopUp' };
            } else if (operation.op.res === 'known.holders.accountLimitsChange') {
                const onetime = operation.op.options.onetime === '0' ? null : operation.op.options.onetime;
                const daily = operation.op.options.daily === '0' ? null : operation.op.options.daily;
                const monthly = operation.op.options.monthly === '0' ? null : operation.op.options.monthly;

                return { type: 'limitsChange', onetime, daily, monthly };
            }

            return null;
        }, [operation.op]);

    // Resolve built-in known wallets
    let known: KnownWallet | undefined = undefined;
    if (knownWallets[opAddressBounceable]) {
        known = knownWallets[opAddressBounceable];
    }
    if (!!contact) { // Resolve contact known wallet
        known = { name: contact.name }
    }
    if (!!opAddressWalletSettings?.name) { // Resolve target wallet settings
        known = { name: opAddressWalletSettings.name }
    }

    const config = useServerConfig().data;
    const spam = config?.wallets?.spam?.includes(opAddressBounceable)
        || isSpam
        || (
            BigMath.abs(BigInt(tx.base.parsed.amount)) < spamMinAmount
            && tx.base.parsed.body?.type === 'comment'
            && !knownWallets[opAddressBounceable]
            && !isTestnet
        ) && tx.base.parsed.kind !== 'out';

    const participants = useMemo(() => {
        const appState = getAppState();
        const index = isLedger
            ? 'Ledger'
            : `${appState.addresses.findIndex((a) => address?.equals(a.address)) + 1}`;

        if (tx.base.parsed.kind === 'out') {
            return {
                from: {
                    address: address?.toString({ testOnly: isTestnet, bounceable: bounceableFormat }) || '',
                    name: ownWalletSettings?.name || `${t('common.wallet')} ${index}`
                },
                to: {
                    address: opAddress,
                    name: known?.name
                }
            }
        }

        return {
            from: {
                address: opAddress,
                name: known?.name
            },
            to: {
                address: address?.toString({ testOnly: isTestnet, bounceable: bounceableFormat }) || '',
                name: ownWalletSettings?.name || `${t('common.wallet')} ${index}`
            }
        }
    }, [opAddress, ownWalletSettings, tx, known, bounceableFormat]);

    const onCopyAddress = useCallback((address: string) => {
        copyText(address);
        toaster.show({
            message: t('common.walletAddress') + ' ' + t('common.copied').toLowerCase(),
            type: 'default',
            duration: ToastDuration.SHORT,
        });
    }, []);

    const amountText = valueText({
        value: item.amount,
        precision: 9,
        decimals: item.kind === 'token' && jetton ? jetton.decimals : undefined,
    });

    const amountColor = kind === 'in'
        ? spam
            ? theme.textPrimary
            : theme.accentGreen
        : theme.textPrimary

    const jettonMaster = tx.masterAddressStr ?? tx.metadata?.jettonWallet?.master?.toString({ testOnly: isTestnet });

    const { isSCAM: isSCAMJetton, verified: verifiedJetton } = useVerifyJetton({
        ticker: item.kind === 'token' ? jetton?.symbol : undefined,
        master: jettonMaster
    });

    const verified = !!tx.verified || verifiedJetton;

    return (
        <PerfView
            style={{
                alignSelf: 'stretch', flexGrow: 1, flexBasis: 0,
                alignItems: 'center',
                paddingTop: Platform.OS === 'android' ? safeArea.top + 24 : undefined,
            }}
        >
            <StatusBar style={Platform.select({ android: theme.style === 'dark' ? 'light' : 'dark', ios: 'light' })} />
            <ScreenHeader
                onClosePressed={navigation.goBack}
                title={dateStr}
                titleStyle={Typography.regular15_20}
            />
            <ScrollView
                style={{ flexGrow: 1, alignSelf: 'stretch', marginTop: 16 }}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                automaticallyAdjustContentInsets={false}
                contentInset={{ bottom: safeArea.bottom + 16 }}
                alwaysBounceVertical={false}
            >
                <PerfView style={{
                    backgroundColor: theme.surfaceOnElevation,
                    borderRadius: 20,
                    padding: 20,
                    width: '100%',
                    overflow: 'hidden',
                    justifyContent: 'center', alignItems: 'center'
                }}>
                    <PerfView style={{ backgroundColor: theme.divider, position: 'absolute', top: 0, left: 0, right: 0, height: 54 }} />
                    {!!holdersOp ? (
                        <Image
                            source={require('@assets/ic-holders-accounts.png')}
                            style={{ width: 68, height: 68, borderRadius: 34 }}
                        />
                    ) : (
                        tx.base.outMessagesCount > 1 ? (
                            <BatchAvatars
                                messages={messages}
                                size={68}
                                icProps={{
                                    size: 28,
                                    borderWidth: 2,
                                    position: 'bottom'
                                }}
                                showSpambadge
                                theme={theme}
                                isTestnet={isTestnet}
                                denyList={addressBook.state.denyList}
                                contacts={addressBook.state.contacts}
                                spamWallets={config?.wallets?.spam ?? []}
                                ownAccounts={appState.addresses}
                                walletsSettings={walletsSettings}
                                backgroundColor={theme.surfaceOnBg}
                                borderWidth={2.5}
                                knownWallets={knownWallets}
                                knownJettonMasters={knownJettonMasters}
                            />
                        ) : (
                            <Avatar
                                size={68}
                                id={opAddressBounceable}
                                address={opAddressBounceable}
                                spam={spam}
                                showSpambadge
                                verified={verified}
                                borderWith={2.5}
                                borderColor={theme.surfaceOnElevation}
                                backgroundColor={avatarColor}
                                markContact={!!contact}
                                icProps={{
                                    isOwn: isOwn,
                                    borderWidth: 2,
                                    position: 'bottom',
                                    size: 28
                                }}
                                theme={theme}
                                knownWallets={knownWallets}
                                hash={opAddressWalletSettings?.avatar}
                            />
                        )
                    )}
                    <PerfText
                        style={[
                            {
                                color: theme.textPrimary,
                                paddingTop: (spam || !!contact || verified || isOwn || !!knownWallets[opAddressBounceable]) ? 16 : 8,
                            },
                            Typography.semiBold17_24
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {op}
                    </PerfText>
                    {!!known?.name ? (
                        <PerfView style={{ flexDirection: 'row', gap: 6, marginTop: 2, paddingHorizontal: 16 }}>
                            <PerfText
                                style={[{ color: theme.textPrimary, flexShrink: 1 }, Typography.regular17_24]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {known.name}
                            </PerfText>
                            <PerfText
                                style={[{ color: theme.textSecondary }, Typography.regular17_24]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                <AddressComponent
                                    address={parsedOpAddr.address}
                                    bounceable={parsedOpAddr.isBounceable}
                                    end={4}
                                    testOnly={isTestnet}
                                    known={!!known}
                                />
                            </PerfText>
                        </PerfView>
                    ) : (
                        !!operation.op && (
                            <PerfText
                                style={[{ color: theme.textSecondary, marginTop: 2 }, Typography.regular15_20]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {t(operation.op.res, operation.op.options)}
                            </PerfText>
                        )
                    )}
                    {tx.base.parsed.status === 'failed' ? (
                        <PerfText style={[
                            { color: theme.accentRed, marginTop: 12 },
                            Typography.semiBold27_32
                        ]}>
                            {t('tx.failed')}
                        </PerfText>
                    ) : (
                        tx.base.outMessagesCount > 1 ? (
                            <PerfView style={{ justifyContent: 'center', alignItems: 'center' }}>
                                {preparedMessages.map((message, index) => {
                                    if (!message.amountString) {
                                        return null;
                                    }

                                    return (
                                        <Text
                                            key={`prep-amount-${index}`}
                                            minimumFontScale={0.4}
                                            adjustsFontSizeToFit={true}
                                            numberOfLines={1}
                                            style={[
                                                { color: theme.textPrimary },
                                                Typography.semiBold17_24
                                            ]}
                                        >
                                            {message.amountString}
                                        </Text>
                                    );
                                })}
                            </PerfView>
                        ) : (
                            <>
                                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                                    <Text
                                        minimumFontScale={0.4}
                                        adjustsFontSizeToFit={true}
                                        numberOfLines={1}
                                        style={[{ color: amountColor }, Typography.semiBold27_32]}
                                    >
                                        {
                                            `${amountText[0]}${amountText[1]}${item.kind === 'ton'
                                                ? ' TON'
                                                : (jetton?.symbol ? ' ' + jetton?.symbol : '')}`
                                        }
                                        {isSCAMJetton && (' • ')}
                                    </Text>
                                    {isSCAMJetton && (
                                        <Text style={[{ color: theme.accentRed }, Typography.semiBold27_32]}>
                                            {'SCAM'}
                                        </Text>
                                    )}
                                </View>
                                {item.kind === 'ton' && tx.base.outMessagesCount <= 1 && (
                                    <PriceComponent
                                        style={{
                                            backgroundColor: theme.transparent,
                                            paddingHorizontal: 0,
                                            alignSelf: 'center',
                                            paddingVertical: 0,
                                            height: 'auto',
                                            paddingLeft: 0
                                        }}
                                        theme={theme}
                                        prefix={kind === 'in' ? '+' : ''}
                                        textStyle={[{ color: theme.textSecondary }, Typography.regular17_24]}
                                        amount={BigInt(item.amount)}
                                    />
                                )}
                            </>
                        )
                    )}
                </PerfView>
                {!!holdersOp && (
                    <HoldersOpView
                        theme={theme}
                        op={holdersOp}
                    />
                )}
                {
                    tx.base.outMessagesCount > 1 ? (
                        <>
                            <PerfView style={{ marginTop: 16 }}>
                                <PreviewMessages
                                    outMessages={preparedMessages}
                                    theme={theme}
                                    addressBook={addressBook.state}
                                />
                            </PerfView>
                            <ItemGroup style={{ marginTop: 16 }}>
                                <TxInfo
                                    lt={tx.base.lt}
                                    address={address?.toString({ testOnly: isTestnet }) || ''}
                                    hash={tx.base.hash}
                                    toaster={toaster}
                                    theme={theme}
                                    isTestnet={isTestnet}
                                />
                            </ItemGroup>
                            <PerfView style={{
                                backgroundColor: theme.surfaceOnElevation,
                                padding: 20, borderRadius: 20,
                                marginTop: 16,
                                flexDirection: 'row',
                                justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <PerfView>
                                    <PerfText
                                        style={[{ color: theme.textSecondary, marginBottom: 2 }, Typography.regular13_18]}>
                                        {t('txPreview.blockchainFee')}
                                    </PerfText>
                                    <PerfText style={[{ color: theme.textPrimary }, Typography.regular17_24]}>
                                        {tx.base.fees
                                            ? <>
                                                {`${formatAmount(fromNano(fees))}`}
                                                <PerfText style={{ color: theme.textSecondary }}>
                                                    {` ${feesPrise}`}
                                                </PerfText>
                                            </>
                                            : '...'
                                        }
                                    </PerfText>
                                </PerfView>
                                <AboutIconButton
                                    title={t('txPreview.blockchainFee')}
                                    description={t('txPreview.blockchainFeeDescription')}
                                    style={{ height: 24, width: 24, position: undefined, marginRight: 8 }}
                                    size={24}
                                />
                            </PerfView>
                        </>
                    ) : (
                        <>
                            {!(dontShowComments && isSpam) && (!!operation.comment) && (
                                <ItemGroup style={{ marginTop: 16 }}>
                                    <PerfView style={{ paddingHorizontal: 10, justifyContent: 'center' }}>
                                        <PerfText style={[{ color: theme.textSecondary }, Typography.regular15_20]}>
                                            {t('common.message')}
                                        </PerfText>
                                        <PerfView style={{ alignItems: 'flex-start' }}>
                                            <PerfText style={[{ color: theme.textPrimary }, Typography.regular17_24]}>
                                                {operation.comment}
                                            </PerfText>
                                        </PerfView>
                                    </PerfView>
                                </ItemGroup>
                            )}
                            <ItemGroup style={{ marginVertical: 16 }}>
                                <PreviewFrom
                                    onCopyAddress={onCopyAddress}
                                    from={participants.from}
                                    kind={kind}
                                    theme={theme}
                                    isTestnet={isTestnet}
                                    bounceableFormat={bounceableFormat}
                                />
                                {(!!participants.to.address && !!participants.from.address) && (
                                    <PerfView style={{ height: 1, alignSelf: 'stretch', backgroundColor: theme.divider, marginVertical: 16, marginHorizontal: 10 }} />
                                )}
                                <PreviewTo
                                    onCopyAddress={onCopyAddress}
                                    to={participants.to}
                                    kind={kind}
                                    theme={theme}
                                    testOnly={isTestnet}
                                    bounceableFormat={bounceableFormat}
                                />
                                <PerfView style={{ height: 1, alignSelf: 'stretch', backgroundColor: theme.divider, marginVertical: 16, marginHorizontal: 10 }} />
                                <TxInfo
                                    lt={tx.base.lt}
                                    address={address?.toString({ testOnly: isTestnet }) || ''}
                                    hash={tx.base.hash}
                                    toaster={toaster}
                                    theme={theme}
                                    isTestnet={isTestnet}
                                />
                            </ItemGroup>
                            <PerfView style={{
                                backgroundColor: theme.surfaceOnElevation,
                                padding: 20, borderRadius: 20,
                                flexDirection: 'row',
                                justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <PerfView>
                                    <PerfText
                                        style={[{ color: theme.textSecondary, marginBottom: 2 }, Typography.regular13_18]}>
                                        {t('txPreview.blockchainFee')}
                                    </PerfText>
                                    <PerfText style={[{ color: theme.textPrimary }, Typography.regular17_24]}>
                                        {tx.base.fees
                                            ? <>
                                                {`${formatAmount(fromNano(fees))}`}
                                                <PerfText style={{ color: theme.textSecondary }}>
                                                    {` ${feesPrise}`}
                                                </PerfText>
                                            </>
                                            : '...'
                                        }
                                    </PerfText>
                                </PerfView>
                                <AboutIconButton
                                    title={t('txPreview.blockchainFee')}
                                    description={t('txPreview.blockchainFeeDescription')}
                                    style={{ height: 24, width: 24, position: undefined, marginRight: 8 }}
                                    size={24}
                                />
                            </PerfView>
                        </>
                    )
                }
            </ScrollView>
            {
                tx.base.parsed.kind === 'out' && (tx.base.parsed.body?.type !== 'payload') && !isLedger && (
                    <PerfView style={{ flexDirection: 'row', width: '100%', marginBottom: safeArea.bottom + 16, paddingHorizontal: 16 }}>
                        <RoundButton
                            title={t('txPreview.sendAgain')}
                            style={{ flexGrow: 1 }}
                            onPress={() => {
                                const operation = tx.base.operation;
                                const item = operation.items[0];
                                const opAddressString = item.kind === 'token' ? operation.address : tx.base.parsed.resolvedAddress;
                                const opAddr = Address.parseFriendly(opAddressString);
                                const bounceable = bounceableFormat ? true : opAddr.isBounceable;
                                const target = opAddr.address.toString({ testOnly: isTestnet, bounceable });
                                navigation.navigateSimpleTransfer({
                                    target,
                                    comment: tx.base.parsed.body && tx.base.parsed.body.type === 'comment' ? tx.base.parsed.body.comment : null,
                                    amount: BigInt(tx.base.parsed.amount) > 0n ? BigInt(tx.base.parsed.amount) : -BigInt(tx.base.parsed.amount),
                                    job: null,
                                    stateInit: null,
                                    jetton: null,
                                    callback: null
                                })
                            }}
                        />
                    </PerfView>
                )
            }
        </PerfView>
    );
}
TransactionPreview.displayName = 'TransactionPreview';

export const TransactionPreviewFragment = fragment(TransactionPreview);
TransactionPreviewFragment.displayName = 'TransactionPreviewFragment';