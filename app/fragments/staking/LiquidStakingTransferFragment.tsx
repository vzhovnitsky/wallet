import * as React from 'react';
import { Platform, Text, View, KeyboardAvoidingView, Keyboard, Alert, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '@react-native-community/hooks';
import Animated, { useSharedValue, useAnimatedRef, measure, scrollTo, runOnUI, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ATextInput, ATextInputRef } from '../../components/ATextInput';
import { RoundButton } from '../../components/RoundButton';
import { fragment } from "../../fragment";
import { useTypedNavigation } from '../../utils/useTypedNavigation';
import { t } from '../../i18n/t';
import { PriceComponent } from '../../components/PriceComponent';
import { parseAmountToBn } from '../../utils/parseAmount';
import { ValueComponent } from '../../components/ValueComponent';
import { useParams } from '../../utils/useParams';
import { useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from 'react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { formatCurrency, formatInputAmount } from '../../utils/formatCurrency';
import { Address, Builder, beginCell, fromNano, toNano } from '@ton/core';
import { useAccountLite, useLiquidStakingMember, useNetwork, usePrice, useSelectedAccount, useTheme } from '../../engine/hooks';
import { useLedgerTransport } from '../ledger/components/TransportContext';
import { TonPayloadFormat } from '@ton-community/ton-ledger';
import { AboutIconButton } from '../../components/AboutIconButton';
import { StatusBar } from 'expo-status-bar';
import { useLiquidStaking } from '../../engine/hooks/staking/useLiquidStaking';
import { StakingTransferParams, actionTitle } from './StakingTransferFragment';
import { getLiquidStakingAddress } from '../../utils/KnownPools';
import { storeLiquidDeposit, storeLiquidWithdraw } from '../../utils/LiquidStakingContract';
import { ItemDivider } from '../../components/ItemDivider';
import { Typography } from '../../components/styles';

import IcTonIcon from '@assets/ic-ton-acc.svg';

export type LiquidStakingTransferParams = Omit<StakingTransferParams, 'target'>;

type AmountAction = { type: 'ton', amount: string } | { type: 'wsTon', amount: string };
type AmountState = { ton: string, wsTon: string };

function reduceAmountState(withdrawRate: bigint, depostRate: bigint, type: 'withdraw' | 'top_up') {
    return (state: AmountState, action: AmountAction): AmountState => {
        try {
            const amount = action.amount.replace(',', '.').replaceAll(' ', '');
            if (action.type === 'ton') {
                const ton = formatInputAmount(action.amount, 9, { skipFormattingDecimals: true }, state.ton);
                const computed = parseFloat(amount) * parseFloat(fromNano(type === 'withdraw' ? withdrawRate : depostRate)) || 0
                const wsTon = fromNano(toNano(computed.toFixed(9)));

                if (ton === state.ton) {
                    return state;
                }

                return { ton, wsTon };
            }

            const wsTon = formatInputAmount(action.amount, 9, { skipFormattingDecimals: true }, state.wsTon);
            const computed = parseFloat(amount) * parseFloat(fromNano(type === 'withdraw' ? withdrawRate : depostRate)) || 0;
            const ton = fromNano(toNano(computed.toFixed(9)));

            if (wsTon === state.wsTon) {
                return state;
            }

            return { ton, wsTon };
        } catch {
            return state;
        }
    }
}

export const LiquidStakingTransferFragment = fragment(() => {
    const theme = useTheme();
    const network = useNetwork();
    const navigation = useTypedNavigation();
    const params = useParams<LiquidStakingTransferParams>();
    const route = useRoute();
    const [price, currency] = usePrice();
    const selected = useSelectedAccount();

    const isLedger = route.name === 'LedgerLiquidStakingTransfer';

    const ledgerContext = useLedgerTransport();
    const ledgerAddress = useMemo(() => {
        if (!isLedger || !ledgerContext?.addr?.address) return;
        try {
            return Address.parse(ledgerContext?.addr?.address);
        } catch { }
    }, [ledgerContext?.addr?.address]);

    const accountLite = useAccountLite(selected!.address);
    const ledgerAccountLite = useAccountLite(ledgerAddress);
    const account = isLedger ? ledgerAccountLite : accountLite;
    const memberAddress = isLedger ? ledgerAddress : selected?.address;
    const safeArea = useSafeAreaInsets();
    const liquidStaking = useLiquidStaking().data;
    const member = useLiquidStakingMember(memberAddress)?.data;

    let initAmount = {
        ton: '',
        wsTon: ''
    }

    if (params?.action === 'top_up' && params.amount) {
        const depostRate = liquidStaking?.rateDeposit ?? 0n;
        const ton = fromNano(params.amount);
        const computed = parseFloat(ton) * parseFloat(fromNano(depostRate)) || 0
        const wsTon = fromNano(toNano(computed.toFixed(9)));
        initAmount = {
            ton,
            wsTon
        }
    }

    const [amount, dispatchAmount] = useReducer(
        reduceAmountState(
            liquidStaking?.rateWithdraw ?? 0n,
            liquidStaking?.rateDeposit ?? 0n,
            params?.action === 'withdraw' ? 'withdraw' : 'top_up'
        ),
        initAmount
    );

    const [minAmountWarn, setMinAmountWarn] = useState<string>();

    const validAmount = useMemo(() => {
        let value: bigint | null = null;
        try {
            const valid = amount.ton.replace(',', '.').replaceAll(' ', '');
            value = toNano(valid);
            return value;
        } catch {
            return null;
        }
    }, [amount.ton]);

    const balance = useMemo(() => {
        if (params?.action === 'withdraw') {
            return member?.balance ?? 0n;
        }
        if (params.action === 'top_up') {
            return account?.balance ?? 0n;
        }

        return 0n;
    }, [params.action, member, account]);

    const onSetAmount = useCallback((action: AmountAction) => {
        setMinAmountWarn(undefined);
        dispatchAmount(action);
    }, []);

    const doContinue = useCallback(async () => {

        if (params.action !== 'withdraw' && params.action !== 'top_up') {
            return;
        }

        const poolAddress = getLiquidStakingAddress(network.isTestnet);
        const target = poolAddress.toString({ testOnly: network.isTestnet });

        let transferAmountTon: bigint;
        let transferAmountWsTon: bigint;
        let minAmount = liquidStaking?.extras.minStake ?? toNano('1');
        minAmount += liquidStaking?.extras.receiptPrice ?? toNano('0.1');
        minAmount += liquidStaking?.extras.depositFee ?? toNano('0.1');

        try {
            // transferAmount = parseAmountToBn(amount);
            transferAmountTon = parseAmountToBn(amount.ton);
            transferAmountWsTon = parseAmountToBn(amount.wsTon);
        } catch (e) {
            Alert.alert(t('transfer.error.invalidAmount'));
            return;
        }

        // Check min stake amount
        if (params?.action === 'top_up' && transferAmountTon < minAmount) {
            setMinAmountWarn(t('products.staking.minAmountWarning', { minAmount: fromNano(minAmount) }));
            return;
        }

        // Check availible 
        if (params?.action === 'withdraw' && (!balance || balance < transferAmountWsTon)) {
            setMinAmountWarn(t('products.staking.transfer.notEnoughStaked'));
            return;
        }

        // Ledger transfer
        if (isLedger) {
            let ledgerPayload: TonPayloadFormat = {
                type: 'comment',
                text: 'Withdraw',
            };
            let actionText = t('transfer.title');

            if (params.action === 'withdraw') {
                transferAmountTon = liquidStaking
                    ? (liquidStaking.extras.withdrawFee + liquidStaking.extras.receiptPrice)
                    : toNano('0.2');
                actionText = t('products.staking.transfer.withdrawStakeTitle');
            } else if (params.action === 'top_up') {
                actionText = t('products.staking.transfer.topUpTitle');
                ledgerPayload.text = 'Deposit';
            }

            const text = t('products.staking.transfer.ledgerSignText', { action: actionText });
            navigation.navigateLedgerSignTransfer({
                order: {
                    type: 'ledger',
                    target: target,
                    payload: ledgerPayload,
                    amount: transferAmountTon,
                    amountAll: false,
                    stateInit: null,
                },
                text: text,
            });
            return;
        }

        // Add withdraw payload
        let payloadBuilder: Builder = beginCell();

        if (params?.action === 'withdraw') {
            payloadBuilder.store(storeLiquidWithdraw(0n, transferAmountWsTon, memberAddress))
            transferAmountTon = liquidStaking
                ? (liquidStaking.extras.withdrawFee + liquidStaking.extras.receiptPrice)
                : toNano('0.2');
        } else if (params.action === 'top_up') {
            payloadBuilder.store(storeLiquidDeposit(0n, transferAmountTon, memberAddress));
            transferAmountTon += liquidStaking
                ? (liquidStaking.extras.depositFee + liquidStaking.extras.receiptPrice)
                : toNano('0.2');
        } else {
            throw Error('Invalid action');
        }

        // Check amount
        if ((transferAmountTon === (account?.balance ?? 0n) || (account?.balance ?? 0n) < transferAmountTon)) {
            setMinAmountWarn(
                params.action === 'withdraw'
                    ? t(
                        'products.staking.transfer.notEnoughCoinsFee',
                        { amount: liquidStaking ? fromNano(liquidStaking.extras.withdrawFee + liquidStaking.extras.receiptPrice) : '0.2' }
                    )
                    : t('transfer.error.notEnoughCoins')
            );
            return;
        }

        if (transferAmountTon === 0n || transferAmountWsTon === 0n) {
            Alert.alert(t('transfer.error.zeroCoins'));
            return;
        }

        // Dismiss keyboard for iOS
        if (Platform.OS === 'ios') {
            Keyboard.dismiss();
        }

        // Navigate to TransferFragment
        navigation.navigateTransfer({
            order: {
                type: 'order',
                messages: [{
                    target,
                    payload: payloadBuilder.endCell(),
                    amount: transferAmountTon,
                    amountAll: false,
                    stateInit: null,
                }]
            },
            text: null,
            job: null,
            callback: null
        });
    }, [amount, params, member, liquidStaking, balance, network]);

    //
    // Scroll state tracking
    //

    const [selectedInput, setSelectedInput] = React.useState(0);

    const refs = React.useMemo(() => {
        let r: React.RefObject<ATextInputRef>[] = [];
        for (let i = 0; i < 2; i++) {
            r.push(React.createRef());
        }
        return r;
    }, []);

    const keyboard = useKeyboard();
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const containerRef = useAnimatedRef<View>();

    const scrollToInput = useCallback((index: number) => {
        'worklet';

        if (index === 0) {
            scrollTo(scrollRef, 0, 0, true);
            return;
        }

        let container = measure(containerRef);
        if (Platform.OS !== 'android' && container) {
            scrollTo(scrollRef, 0, container.height, true);
        }
        if (Platform.OS === 'android') {
            scrollTo(scrollRef, 0, 400, true);
        }
        return;

    }, []);

    const keyboardHeight = useSharedValue(keyboard.keyboardShown ? keyboard.keyboardHeight : 0);
    useEffect(() => {
        keyboardHeight.value = keyboard.keyboardShown ? keyboard.keyboardHeight : 0;
    }, [keyboard.keyboardShown ? keyboard.keyboardHeight : 0, selectedInput]);

    const onFocus = useCallback((index: number) => {
        if (amount.ton === '0' || amount.wsTon === '0') {
            onSetAmount({ type: index === 0 ? 'ton' : 'wsTon', amount: '' });
        }
        runOnUI(scrollToInput)(index);
        setSelectedInput(index);
    }, [amount]);

    const onAddAll = useCallback(() => {
        let addAmount = balance;
        if (params?.action === 'top_up') {
            // Account for withdraw fee need to unstake 
            addAmount -= liquidStaking
                ? (
                    liquidStaking.extras.withdrawFee + liquidStaking.extras.receiptPrice  // saving up for the potential second 'withdraw' request
                    + liquidStaking.extras.depositFee + liquidStaking.extras.receiptPrice
                )
                : toNano('0.4');

            onSetAmount({ type: 'ton', amount: fromNano(addAmount) });
            return;
        }

        // withdraw
        if (addAmount > 0n) {
            onSetAmount({ type: 'wsTon', amount: fromNano(addAmount) });
        }
    }, [balance, params, liquidStaking]);

    useLayoutEffect(() => {
        setTimeout(() => refs[0]?.current?.focus(), 100);
    }, []);

    const priceText = useMemo(() => {
        if (!validAmount) {
            return;
        }
        const isNeg = validAmount < 0n;
        const abs = isNeg ? -validAmount : validAmount;
        return formatCurrency(
            (parseFloat(fromNano(abs)) * (price ? price?.price.usd * price.price.rates[currency] : 0)).toFixed(2),
            currency,
            isNeg
        );
    }, [validAmount, price, currency]);

    return (
        <View style={{ flexGrow: 1 }}>
            <StatusBar style={Platform.select({
                android: theme.style === 'dark' ? 'light' : 'dark',
                ios: 'light'
            })} />
            <ScreenHeader
                title={actionTitle(params?.action)}
                onClosePressed={navigation.goBack}
                style={Platform.select({ android: { paddingTop: safeArea.top } })}
            />
            <Animated.ScrollView
                style={{ flexGrow: 1, flexBasis: 0, alignSelf: 'stretch', }}
                contentInset={{ bottom: keyboard.keyboardShown ? (keyboard.keyboardHeight - safeArea.bottom) : 0.1 /* Some weird bug on iOS */, top: 0.1 /* Some weird bug on iOS */ }}
                contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16 }}
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                ref={scrollRef}
                scrollEventThrottle={16}
            >
                <View
                    ref={containerRef}
                    style={{ flexGrow: 1, flexBasis: 0, alignSelf: 'stretch', flexDirection: 'column', marginTop: 16 }}
                >
                    {params?.action === 'withdraw' ? (
                        <>
                            <View
                                style={{
                                    backgroundColor: theme.surfaceOnElevation,
                                    borderRadius: 20,
                                    justifyContent: 'center',
                                    padding: 20
                                }}
                            >
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{
                                        height: 46, width: 46,
                                        justifyContent: 'center', alignItems: 'center',
                                        borderRadius: 23,
                                        marginRight: 12
                                    }}>
                                        <Image
                                            source={require('@assets/ic-wston.png')}
                                            style={{
                                                height: 46,
                                                width: 46,
                                            }}
                                        />
                                        <View style={[{
                                            position: 'absolute',
                                            justifyContent: 'center', alignItems: 'center',
                                            bottom: -2, right: -2,
                                            width: 20, height: 20, borderRadius: 20,
                                            backgroundColor: theme.surfaceOnElevation
                                        }]}>

                                            <Image
                                                source={require('@assets/ic-verified.png')}
                                                style={{ width: 20, height: 20 }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flexGrow: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                            <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                                                <Text style={{ color: theme.textSecondary }}>
                                                    {t('common.send')}
                                                </Text>
                                                {' wsTON'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={[{ color: theme.textSecondary }, Typography.regular15_20]}>
                                                {'Whales Liquid Token'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <ItemDivider marginHorizontal={0} marginVertical={20} />
                                <View style={{
                                    flexDirection: 'row',
                                    marginBottom: 12,
                                    justifyContent: 'space-between'
                                }}>
                                    <Text style={[{ color: theme.textSecondary }, Typography.regular15_20]}>
                                        {`${t('common.balance')}: `}
                                        <ValueComponent
                                            precision={4}
                                            value={balance}
                                            centFontStyle={{ opacity: 0.5 }}
                                        />
                                    </Text>
                                    <Pressable
                                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                                        onPress={onAddAll}
                                    >
                                        <Text style={[{ color: theme.accent }, Typography.medium15_20]}>
                                            {t('transfer.sendAll')}
                                        </Text>
                                    </Pressable>
                                </View>
                                <ATextInput
                                    index={0}
                                    ref={refs[0]}
                                    onFocus={onFocus}
                                    value={amount.wsTon}
                                    onValueChange={(newVal) => {
                                        onSetAmount({ type: 'wsTon', amount: newVal });
                                    }}
                                    keyboardType={'numeric'}
                                    style={{
                                        backgroundColor: theme.backgroundPrimary,
                                        paddingHorizontal: 16, paddingVertical: 14,
                                        borderRadius: 16,
                                    }}
                                    inputStyle={[Typography.regular17_24, {
                                        lineHeight: undefined,
                                        color: minAmountWarn ? theme.accentRed : theme.textPrimary,
                                        width: 'auto',
                                        flexShrink: 1
                                    }]}
                                    suffix={priceText}
                                    hideClearButton
                                    prefix={'wsTON'}
                                />
                            </View>
                            <View
                                style={{
                                    marginBottom: 16,
                                    backgroundColor: theme.surfaceOnElevation,
                                    borderRadius: 20,
                                    justifyContent: 'center',
                                    padding: 20,
                                    marginTop: 16
                                }}
                            >
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 0 }}>
                                        <IcTonIcon width={46} height={46} />
                                        <View style={{
                                            justifyContent: 'center', alignItems: 'center',
                                            height: 20, width: 20, borderRadius: 10,
                                            position: 'absolute', right: -2, bottom: -2,
                                            backgroundColor: theme.surfaceOnBg
                                        }}>
                                            <Image
                                                source={require('@assets/ic-verified.png')}
                                                style={{ height: 20, width: 20 }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ marginLeft: 12, flexShrink: 1 }}>
                                        <Text
                                            style={{ color: theme.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600' }}
                                            ellipsizeMode="tail"
                                            numberOfLines={1}
                                        >
                                            <Text style={{ color: theme.textSecondary }}>
                                                {t('wallet.actions.receive')}
                                            </Text>
                                            {' TON'}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            ellipsizeMode={'tail'}
                                            style={{ fontSize: 15, fontWeight: '400', lineHeight: 20, color: theme.textSecondary }}
                                        >
                                            {'The Open Network'}
                                        </Text>
                                    </View>
                                </View>
                                <ATextInput
                                    index={1}
                                    ref={refs[1]}
                                    onFocus={onFocus}
                                    value={amount.ton}
                                    onValueChange={(newVal) => {
                                        onSetAmount({ type: 'ton', amount: newVal });
                                    }}
                                    keyboardType={'numeric'}
                                    style={{
                                        backgroundColor: theme.backgroundPrimary,
                                        paddingHorizontal: 16, paddingVertical: 14,
                                        borderRadius: 16,
                                        marginTop: 16
                                    }}
                                    inputStyle={[Typography.regular17_24, {
                                        lineHeight: undefined,
                                        color: minAmountWarn ? theme.accentRed : theme.textPrimary,
                                        width: 'auto',
                                        flexShrink: 1
                                    }]}
                                    suffix={priceText}
                                    hideClearButton
                                    prefix={'TON'}
                                />
                                {!!minAmountWarn && (
                                    <Text style={{
                                        color: theme.accentRed,
                                        fontSize: 13,
                                        lineHeight: 18,
                                        marginTop: 8,
                                        marginLeft: 16,
                                        fontWeight: '400'
                                    }}>
                                        {minAmountWarn}
                                    </Text>
                                )}
                            </View>
                        </>
                    ) : (
                        <>
                            <View
                                style={{
                                    marginBottom: 16,
                                    backgroundColor: theme.surfaceOnElevation,
                                    borderRadius: 20,
                                    justifyContent: 'center',
                                    padding: 20
                                }}
                            >
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 0 }}>
                                        <IcTonIcon width={46} height={46} />
                                        <View style={{
                                            justifyContent: 'center', alignItems: 'center',
                                            height: 20, width: 20, borderRadius: 10,
                                            position: 'absolute', right: -2, bottom: -2,
                                            backgroundColor: theme.surfaceOnBg
                                        }}>
                                            <Image
                                                source={require('@assets/ic-verified.png')}
                                                style={{ height: 20, width: 20 }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ marginLeft: 12, flexShrink: 1 }}>
                                        <Text
                                            style={{ color: theme.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600' }}
                                            ellipsizeMode="tail"
                                            numberOfLines={1}
                                        >
                                            <Text style={{ color: theme.textSecondary }}>
                                                {t('common.send')}
                                            </Text>
                                            {' TON'}
                                        </Text>
                                        <Text
                                            numberOfLines={1}
                                            ellipsizeMode={'tail'}
                                            style={{ fontSize: 15, fontWeight: '400', lineHeight: 20, color: theme.textSecondary }}
                                        >
                                            {'The Open Network'}
                                        </Text>
                                    </View>
                                </View>
                                <ItemDivider marginHorizontal={0} marginVertical={20} />
                                <View style={{
                                    flexDirection: 'row',
                                    marginBottom: 12,
                                    justifyContent: 'space-between'
                                }}>
                                    <Text style={[{ color: theme.textSecondary }, Typography.regular15_20]}>
                                        {`${t('common.balance')}: `}
                                        <ValueComponent
                                            precision={4}
                                            value={balance}
                                            centFontStyle={{ opacity: 0.5 }}
                                        />
                                    </Text>
                                    <Pressable
                                        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                                        onPress={onAddAll}
                                    >
                                        <Text style={[{ color: theme.accent }, Typography.medium15_20]}>
                                            {t('transfer.sendAll')}
                                        </Text>
                                    </Pressable>
                                </View>
                                <ATextInput
                                    index={0}
                                    ref={refs[0]}
                                    onFocus={onFocus}
                                    value={amount.ton}
                                    onValueChange={(newVal) => {
                                        onSetAmount({ type: 'ton', amount: newVal });
                                    }}
                                    keyboardType={'numeric'}
                                    style={{
                                        backgroundColor: theme.backgroundPrimary,
                                        paddingHorizontal: 16, paddingVertical: 14,
                                        borderRadius: 16,
                                    }}
                                    inputStyle={[Typography.regular17_24, {
                                        lineHeight: undefined,
                                        color: minAmountWarn ? theme.accentRed : theme.textPrimary,
                                        width: 'auto',
                                        flexShrink: 1
                                    }]}
                                    suffix={priceText}
                                    hideClearButton
                                    prefix={'TON'}
                                />
                                {!!minAmountWarn && (
                                    <Text style={{
                                        color: theme.accentRed,
                                        fontSize: 13,
                                        lineHeight: 18,
                                        marginTop: 8,
                                        marginLeft: 16,
                                        fontWeight: '400'
                                    }}>
                                        {minAmountWarn}
                                    </Text>
                                )}
                            </View>
                            <View
                                style={{
                                    backgroundColor: theme.surfaceOnElevation,
                                    borderRadius: 20,
                                    justifyContent: 'center',
                                    padding: 20
                                }}
                            >
                                <View style={{ flexDirection: 'row' }}>
                                    <View style={{
                                        height: 46, width: 46,
                                        justifyContent: 'center', alignItems: 'center',
                                        borderRadius: 23,
                                        marginRight: 12
                                    }}>
                                        <Image
                                            source={require('@assets/ic-wston.png')}
                                            style={{
                                                height: 46,
                                                width: 46,
                                            }}
                                        />
                                        <View style={[{
                                            position: 'absolute',
                                            justifyContent: 'center', alignItems: 'center',
                                            bottom: -2, right: -2,
                                            width: 20, height: 20, borderRadius: 20,
                                            backgroundColor: theme.surfaceOnElevation
                                        }]}>

                                            <Image
                                                source={require('@assets/ic-verified.png')}
                                                style={{ width: 20, height: 20 }}
                                            />
                                        </View>
                                    </View>
                                    <View style={{ flexGrow: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                            <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                                                <Text style={{ color: theme.textSecondary }}>
                                                    {t('wallet.actions.receive')}
                                                </Text>
                                                {' wsTON'}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={[{ color: theme.textSecondary }, Typography.regular15_20]}>
                                                {'Whales Liquid Token'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <ATextInput
                                    index={1}
                                    ref={refs[1]}
                                    onFocus={onFocus}
                                    value={amount.wsTon}
                                    onValueChange={(newVal) => {
                                        onSetAmount({ type: 'wsTon', amount: newVal });
                                    }}
                                    keyboardType={'numeric'}
                                    style={{
                                        backgroundColor: theme.backgroundPrimary,
                                        paddingHorizontal: 16, paddingVertical: 14,
                                        borderRadius: 16,
                                        marginTop: 16
                                    }}
                                    inputStyle={[Typography.regular17_24, {
                                        lineHeight: undefined,
                                        color: minAmountWarn ? theme.accentRed : theme.textPrimary,
                                        width: 'auto',
                                        flexShrink: 1
                                    }]}
                                    suffix={priceText}
                                    hideClearButton
                                    prefix={'wsTON'}
                                />
                            </View>
                        </>
                    )}
                    <View style={{
                        borderRadius: 20,
                        backgroundColor: theme.surfaceOnElevation,
                        padding: 20,
                        marginTop: 16
                    }}>
                        <Text style={[{ color: theme.textSecondary, marginBottom: 2 }, Typography.regular13_18]}>
                            {t('products.staking.pools.rateTitle')}
                        </Text>
                        <Text style={[{ color: theme.textPrimary }, Typography.regular17_24]}>
                            {'1 wsTON = '}
                            <ValueComponent
                                value={(params.action === 'withdraw' ? liquidStaking?.rateWithdraw : liquidStaking?.rateDeposit) ?? 0n}
                                precision={9}
                                suffix={' TON'}
                            />
                        </Text>
                        <ItemDivider marginHorizontal={0} marginVertical={20} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={[{ color: theme.textSecondary, marginBottom: 2 }, Typography.regular13_18]}>
                                    {params.action === 'withdraw' ? t('products.staking.info.withdrawFee') : t('products.staking.info.depositFee')}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[{ color: theme.textPrimary }, Typography.regular17_24]}>
                                        <ValueComponent
                                            value={
                                                params.action === 'withdraw'
                                                    ? (liquidStaking?.extras.withdrawFee ?? 0n) + (liquidStaking?.extras.receiptPrice ?? 0n)
                                                    : (liquidStaking?.extras.depositFee ?? 0n) + (liquidStaking?.extras.receiptPrice ?? 0n)
                                            }
                                            precision={9}
                                            suffix={' TON'}
                                        />
                                    </Text>
                                    <PriceComponent
                                        amount={
                                            params.action === 'withdraw'
                                                ? (liquidStaking?.extras.withdrawFee ?? 0n) + (liquidStaking?.extras.receiptPrice ?? 0n)
                                                : (liquidStaking?.extras.depositFee ?? 0n) + (liquidStaking?.extras.receiptPrice ?? 0n)
                                        }
                                        style={{
                                            backgroundColor: theme.transparent,
                                            paddingHorizontal: 0, paddingVertical: 0,
                                            paddingLeft: 6, paddingRight: 0,
                                            height: undefined
                                        }}
                                        theme={theme}
                                        textStyle={[{ color: theme.textSecondary }, Typography.regular17_24]}
                                    />
                                </View>
                            </View>
                            <AboutIconButton
                                title={params.action === 'withdraw' ? t('products.staking.info.withdrawFee') : t('products.staking.info.depositFee')}
                                description={params.action === 'withdraw' ? t('products.staking.info.withdrawFeeDescription') : t('products.staking.info.depositFeeDescription')}
                                style={{ height: 24, width: 24, position: undefined }}
                                size={24}
                            />
                        </View>
                    </View>
                </View>
            </Animated.ScrollView>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'position' : undefined}
                style={{
                    marginHorizontal: 16, marginTop: 16,
                    marginBottom: safeArea.bottom + 16,
                }}
                keyboardVerticalOffset={Platform.select({
                    ios: safeArea.top + 16,
                    android: 16
                })}
            >
                <RoundButton
                    title={t('common.continue')}
                    action={doContinue}
                />
            </KeyboardAvoidingView>
        </View>
    );
});