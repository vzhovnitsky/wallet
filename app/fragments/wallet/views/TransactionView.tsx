import * as React from 'react';
import { Pressable, Text } from 'react-native';
import { ValueComponent } from '../../../components/ValueComponent';
import { AddressComponent } from '../../../components/address/AddressComponent';
import { KnownWallet, KnownWallets } from '../../../secure/KnownWallets';
import { t } from '../../../i18n/t';
import { TypedNavigation } from '../../../utils/useTypedNavigation';
import { PriceComponent } from '../../../components/PriceComponent';
import { Address } from '@ton/core';
import { Jetton, TransactionDescription } from '../../../engine/types';
import { useMemo } from 'react';
import { ThemeType } from '../../../engine/state/theme';
import { AddressContact } from '../../../engine/hooks/contacts/useAddressBook';
import { formatTime } from '../../../utils/dates';
import { PerfText } from '../../../components/basic/PerfText';
import { AppState } from '../../../storage/appState';
import { PerfView } from '../../../components/basic/PerfView';
import { Typography } from '../../../components/styles';
import { useVerifyJetton, useWalletSettings } from '../../../engine/hooks';
import { avatarHash } from '../../../utils/avatarHash';
import { WalletSettings } from '../../../engine/state/walletSettings';
import { getLiquidStakingAddress } from '../../../utils/KnownPools';
import { usePeparedMessages } from '../../../engine/hooks';
import { TxAvatar } from './TxAvatar';
import { PreparedMessageView } from './PreparedMessageView';
import { avatarColors } from '../../../components/avatar/Avatar';

export function TransactionView(props: {
    own: Address,
    tx: TransactionDescription,
    separator: boolean,
    theme: ThemeType,
    navigation: TypedNavigation,
    onPress: (src: TransactionDescription) => void,
    onLongPress?: (src: TransactionDescription) => void,
    ledger?: boolean,
    spamMinAmount: bigint,
    dontShowComments: boolean,
    denyList: { [key: string]: { reason: string | null } },
    contacts: { [key: string]: AddressContact },
    isTestnet: boolean,
    spamWallets: string[],
    appState?: AppState,
    walletsSettings: { [key: string]: WalletSettings },
    jettons: Jetton[],
    bounceableFormat: boolean,
    knownWallets: { [key: string]: KnownWallet }
}) {
    const {
        theme,
        tx,
        denyList,
        spamMinAmount, dontShowComments, spamWallets,
        contacts,
        isTestnet,
        knownWallets
    } = props;
    const parsed = tx.base.parsed;
    const operation = tx.base.operation;
    const kind = tx.base.parsed.kind;
    const item = operation.items[0];
    const itemAmount = BigInt(item.amount);
    const absAmount = itemAmount < 0 ? itemAmount * BigInt(-1) : itemAmount;
    const opAddress = item.kind === 'token' ? operation.address : tx.base.parsed.resolvedAddress;
    const parsedOpAddr = Address.parseFriendly(opAddress);
    const parsedAddress = parsedOpAddr.address;
    const parsedAddressFriendly = parsedAddress.toString({ testOnly: isTestnet });
    const isOwn = (props.appState?.addresses ?? []).findIndex((a) => a.address.equals(Address.parse(opAddress))) >= 0;
    const preparedMessages = usePeparedMessages(tx.base.outMessages, isTestnet);

    const walletSettings = props.walletsSettings[parsedAddressFriendly];
    const jetton = props.jettons.find((j) =>
        !!tx.metadata?.jettonWallet?.master
        && j.master.equals(tx.metadata?.jettonWallet?.master)
    );

    const avatarColorHash = walletSettings?.color ?? avatarHash(parsedAddressFriendly, avatarColors.length);
    const avatarColor = avatarColors[avatarColorHash];

    const contact = contacts[parsedAddressFriendly];
    const isSpam = !!denyList[parsedAddressFriendly]?.reason;

    // Operation
    const op = useMemo(() => {
        if (operation.op) {
            const isLiquid = getLiquidStakingAddress(isTestnet).equals(Address.parse(opAddress));
            if (operation.op.res === 'known.withdraw' && isLiquid) {
                return t('known.withdrawLiquid');
            }
            return t(operation.op.res, operation.op.options);
        } else {
            if (parsed.kind === 'out') {
                if (parsed.status === 'pending') {
                    return t('tx.sending');
                } else {
                    return t('tx.sent');
                }
            } else if (parsed.kind === 'in') {
                if (parsed.bounced) {
                    return t('tx.bounced');
                } else {
                    return t('tx.received');
                }
            } else {
                throw Error('Unknown kind');
            }
        }
    }, [operation.op, parsed]);

    // Resolve built-in known wallets
    let known: KnownWallet | undefined = undefined;
    if (knownWallets[parsedAddressFriendly]) {
        known = knownWallets[parsedAddressFriendly];
    }
    if (tx.title) {
        known = { name: tx.title };
    }
    if (!!contact) { // Resolve contact known wallet
        known = { name: contact.name }
    }
    if (!!walletSettings?.name) {
        known = { name: walletSettings.name }
    }

    let spam =
        !!spamWallets.find((i) => opAddress === i)
        || isSpam
        || (
            absAmount < spamMinAmount
            && !!tx.base.operation.comment
            && !knownWallets[parsedAddressFriendly]
            && !isTestnet
        ) && kind !== 'out';

    const amountColor = (kind === 'in')
        ? (spam ? theme.textPrimary : theme.accentGreen)
        : theme.textPrimary;

    const jettonMaster = tx.masterAddressStr ?? tx.metadata?.jettonWallet?.master?.toString({ testOnly: isTestnet });

    const { isSCAM: isSCAMJetton } = useVerifyJetton({
        ticker: item.kind === 'token' ? tx.masterMetadata?.symbol : undefined,
        master: jettonMaster
    });

    const symbolText = `${(item.kind === 'token')
        ? `${jetton?.symbol ? ` ${jetton.symbol}` : ''}`
        : ' TON'}${isSCAMJetton ? ' • ' : ''}`;

    if (preparedMessages.length > 1) {
        return (
            <>
                {preparedMessages.map((m, i) => (
                    <PreparedMessageView
                        own={props.own}
                        message={m}
                        separator={false}
                        theme={theme}
                        navigation={props.navigation}
                        onPress={() => props.onPress(props.tx)}
                        onLongPress={() => props.onLongPress?.(props.tx)}
                        contacts={props.contacts}
                        isTestnet={props.isTestnet}
                        bounceableFormat={props.bounceableFormat}
                        walletsSettings={props.walletsSettings}
                        time={tx.base.time}
                        status={parsed.status}
                        knownWallets={knownWallets}
                    />
                ))}
            </>
        );
    }

    return (
        <Pressable
            onPress={() => props.onPress(props.tx)}
            style={{
                paddingHorizontal: 16,
                paddingVertical: 20,
                paddingBottom: operation.comment ? 0 : undefined
            }}
            onLongPress={() => props.onLongPress?.(props.tx)}
        >
            <PerfView style={{
                alignSelf: 'stretch',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <PerfView style={{
                    width: 46, height: 46,
                    borderRadius: 23,
                    position: 'relative',
                    borderWidth: 0, marginRight: 10,
                    justifyContent: 'center', alignItems: 'center'
                }}>
                    <TxAvatar
                        status={parsed.status}
                        parsedAddressFriendly={parsedAddressFriendly}
                        kind={kind}
                        spam={spam}
                        isOwn={isOwn}
                        theme={theme}
                        isTestnet={isTestnet}
                        walletSettings={walletSettings}
                        markContact={!!contact}
                        avatarColor={avatarColor}
                        knownWallets={knownWallets}
                    />
                </PerfView>
                <PerfView style={{ flex: 1, marginRight: 4 }}>
                    <PerfView style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <PerfText
                            style={[
                                { color: theme.textPrimary, flexShrink: 1 },
                                Typography.semiBold17_24
                            ]}
                            ellipsizeMode={'tail'}
                            numberOfLines={1}
                        >
                            {op}
                        </PerfText>
                        {spam && (
                            <PerfView style={{
                                backgroundColor: theme.backgroundUnchangeable,
                                borderWidth: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: 100,
                                paddingHorizontal: 5,
                                marginLeft: 10,
                                height: 15
                            }}>
                                <PerfText
                                    style={[
                                        { color: theme.textPrimaryInverted },
                                        Typography.medium10_12
                                    ]}
                                >
                                    {'SPAM'}
                                </PerfText>
                            </PerfView>
                        )}
                    </PerfView>
                    <Text
                        style={[
                            { color: theme.textSecondary, marginRight: 8, marginTop: 2 },
                            Typography.regular15_20
                        ]}
                        ellipsizeMode={'middle'}
                        numberOfLines={1}
                    >
                        {tx.base.outMessagesCount <= 1 && (
                            <>
                                {known
                                    ? known.name
                                    : <AddressComponent
                                        testOnly={isTestnet}
                                        address={parsedOpAddr.address}
                                        bounceable={props.bounceableFormat || parsedOpAddr.isBounceable}
                                    />
                                }
                                {' • '}
                            </>
                        )}
                        {`${formatTime(tx.base.time)}`}
                    </Text>
                </PerfView>
                <PerfView style={{ alignItems: 'flex-end' }}>
                    {parsed.status === 'failed' ? (
                        <PerfText style={[
                            { color: theme.accentRed },
                            Typography.semiBold17_24
                        ]}>
                            {t('tx.failed')}
                        </PerfText>
                    ) : (
                        <Text
                            style={[{ color: amountColor, marginRight: 2 }, Typography.semiBold17_24]}
                            numberOfLines={1}
                        >
                            {kind === 'in' ? '+' : '-'}
                            <ValueComponent
                                value={absAmount}
                                decimals={item.kind === 'token' ? tx.masterMetadata?.decimals : undefined}
                                precision={3}
                                centFontStyle={{ fontSize: 15 }}
                            />
                            <Text style={{ fontSize: 15 }}>
                                {symbolText}
                                {isSCAMJetton && (
                                    <Text style={{ color: theme.accentRed }}>
                                        {' SCAM'}
                                    </Text>
                                )}
                            </Text>
                        </Text>
                    )}
                    {item.kind !== 'token' && tx.base.outMessagesCount <= 1 && (
                        <PriceComponent
                            amount={absAmount}
                            prefix={kind === 'in' ? '+' : '-'}
                            style={{
                                height: undefined,
                                backgroundColor: theme.transparent,
                                paddingHorizontal: 0, paddingVertical: 0,
                                alignSelf: 'flex-end',
                            }}
                            theme={theme}
                            textStyle={[
                                { color: theme.textSecondary },
                                Typography.regular15_20
                            ]}
                        />
                    )}
                </PerfView>
            </PerfView>
            {!!operation.comment && !(spam && dontShowComments) && (
                <PerfView style={{
                    flexShrink: 1, alignSelf: 'flex-start',
                    backgroundColor: theme.border,
                    marginTop: 8,
                    paddingHorizontal: 10, paddingVertical: 8,
                    borderRadius: 10, marginLeft: 46 + 10, height: 36
                }}>
                    <PerfText
                        numberOfLines={1}
                        ellipsizeMode={'tail'}
                        style={[
                            { color: theme.textPrimary, maxWidth: 400 },
                            Typography.regular15_20
                        ]}
                    >
                        {operation.comment}
                    </PerfText>
                </PerfView>
            )}
        </Pressable>
    );
}
TransactionView.displayName = 'TransactionView';