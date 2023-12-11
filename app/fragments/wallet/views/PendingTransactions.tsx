import React, { useCallback, useEffect } from "react";
import { memo } from "react";
import { View, Text } from "react-native";
import { usePendingTransactions } from "../../../engine/hooks/transactions/usePendingTransactions";
import { PendingTransaction, pendingTransactionsState } from "../../../engine/state/pending";
import { useTheme } from "../../../engine/hooks/theme/useTheme";
import { PendingTransactionAvatar } from "../../../components/PendingTransactionAvatar";
import { useNetwork } from "../../../engine/hooks/network/useNetwork";
import { KnownWallet, KnownWallets } from "../../../secure/KnownWallets";
import { t } from "../../../i18n/t";
import { ValueComponent } from "../../../components/ValueComponent";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useContact } from "../../../engine/hooks/contacts/useContact";
import { AddressComponent } from "../../../components/address/AddressComponent";
import { Address } from "@ton/core";
import { PriceComponent } from "../../../components/PriceComponent";
import { ItemDivider } from "../../../components/ItemDivider";
import { formatTime } from "../../../utils/dates";
import { Avatar } from "../../../components/Avatar";
import { useSetRecoilState } from "recoil";

const PendingTransactionView = memo(({
    tx,
    first,
    last,
    single,
    onRemove
}: {
    tx: PendingTransaction,
    first?: boolean,
    last?: boolean,
    single?: boolean,
    onRemove?: (id: string) => void,
}) => {
    const theme = useTheme();
    const { isTestnet } = useNetwork();
    const body = tx.body;
    const targetFriendly = body?.type === 'token' ? body.target.toString({ testOnly: isTestnet }) : tx.address?.toString({ testOnly: isTestnet });
    const contact = useContact(targetFriendly);

    // Resolve built-in known wallets
    let known: KnownWallet | undefined = undefined;
    if (targetFriendly) {
        if (KnownWallets(isTestnet)[targetFriendly]) {
            known = KnownWallets(isTestnet)[targetFriendly];
        }
        if (!!contact) { // Resolve contact known wallet
            known = { name: contact.name }
        }
    }

    const amount = body?.type === 'token'
        ? body.amount
        : tx.amount > 0n
            ? tx.amount
            : -tx.amount;

    useEffect(() => {
        if (onRemove && tx.status === 'sent') {
            setTimeout(() => {
                onRemove(tx.id);
            }, 15000);
        }
    }, [tx.status, onRemove]);

    return (
        <Animated.View
            entering={FadeInDown}
            exiting={FadeOutUp}
            style={{
                paddingHorizontal: 20, paddingVertical: 20, paddingBottom: tx.body?.type === 'comment' ? 0 : undefined
            }}
        >
            <View style={{
                alignSelf: 'stretch',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <View style={{
                    width: 46, height: 46,
                    borderRadius: 23,
                    borderWidth: 0, marginRight: 10,
                    justifyContent: 'center', alignItems: 'center',
                }}>
                    {tx.status === 'pending' ? (
                        <PendingTransactionAvatar
                            kind={'out'}
                            address={targetFriendly}
                            avatarId={targetFriendly ?? 'batch'}
                        />
                    ) : (
                        <Avatar
                            address={targetFriendly}
                            verified
                            size={46}
                            borderWith={0}
                            id={targetFriendly ?? 'batch'}
                            theme={theme}
                            isTestnet={false}
                            backgroundColor={theme.backgroundPrimary}
                        />
                    )}
                </View>
                <View style={{ flex: 1, marginRight: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                            style={{ color: theme.textPrimary, fontSize: 17, fontWeight: '600', lineHeight: 24, flexShrink: 1 }}
                            ellipsizeMode={'tail'}
                            numberOfLines={1}
                        >
                            {tx.status === 'pending' ? t('tx.sending') : t('tx.sent')}
                        </Text>
                    </View>
                    {known ? (
                        <Text
                            style={{ color: theme.textSecondary, fontSize: 15, marginRight: 8, lineHeight: 20, fontWeight: '400', marginTop: 2 }}
                            ellipsizeMode="middle"
                            numberOfLines={1}
                        >
                            {known.name}
                        </Text>
                    ) : (
                        <Text
                            style={{ color: theme.textSecondary, fontSize: 15, marginRight: 8, lineHeight: 20, fontWeight: '400', marginTop: 2 }}
                            ellipsizeMode="middle"
                            numberOfLines={1}
                        >
                            {targetFriendly ? <AddressComponent address={Address.parse(targetFriendly)} /> : t('tx.batch')}
                            {` • ${formatTime(tx.time)}`}
                        </Text>
                    )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text
                        style={{
                            color: theme.textPrimary,
                            fontWeight: '600',
                            lineHeight: 24,
                            fontSize: 17,
                            marginRight: 2,
                        }}
                        numberOfLines={1}
                    >
                        {'-'}
                        <ValueComponent
                            value={amount}
                            decimals={(body?.type === 'token' && body.master.decimals) ? body.master.decimals : undefined}
                            precision={3}
                        />
                        {body?.type === 'token' && body.master.symbol ? ` ${body.master.symbol}` : ' TON'}
                    </Text>
                    {tx.body?.type !== 'token' && (
                        <PriceComponent
                            amount={amount}
                            prefix={'-'}
                            style={{
                                height: undefined,
                                backgroundColor: theme.transparent,
                                paddingHorizontal: 0, paddingVertical: 0,
                                alignSelf: 'flex-end',
                            }}
                            theme={theme}
                            textStyle={{
                                color: theme.textSecondary,
                                fontWeight: '400',
                                fontSize: 15, lineHeight: 20
                            }}
                        />
                    )}
                </View>
            </View>
            {!last && !single && (
                <ItemDivider />
            )}
        </Animated.View>
    )
});

export const PendingTransactions = memo(() => {
    const pending = usePendingTransactions();
    const setPending = useSetRecoilState(pendingTransactionsState);
    const theme = useTheme();

    const removePending = useCallback((id: string) => {
        setPending((prev) => {
            return prev.filter((tx) => tx.id !== id);
        });
    }, [setPending]);

    return (
        <View>
            {pending.length > 0 && (
                <Animated.View
                    entering={FadeInDown}
                    exiting={FadeOutUp}
                    style={{
                        backgroundColor: theme.backgroundPrimary,
                        justifyContent: 'flex-end',
                        paddingBottom: 2,
                        paddingTop: 12,
                        marginVertical: 8,
                        paddingHorizontal: 16
                    }}
                >
                    <Text style={{
                        fontSize: 20,
                        fontWeight: '600',
                        color: theme.textPrimary,
                        lineHeight: 28,
                    }}>
                        {t('wallet.pendingTransactions')}
                    </Text>
                </Animated.View>
            )}
            <View style={{
                overflow: 'hidden',
                backgroundColor: theme.surfaceOnElevation,
                marginHorizontal: 16, borderRadius: 20,
            }}>
                {pending.map((tx, i) => (
                    <PendingTransactionView
                        key={tx.id}
                        tx={tx}
                        first={i === 0}
                        last={i === pending.length - 1}
                        onRemove={() => removePending(tx.id)}
                    />
                ))}
            </View>
        </View>
    );
});