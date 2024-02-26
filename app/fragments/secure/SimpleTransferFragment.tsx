import * as React from 'react';
import { Platform, Text, View, KeyboardAvoidingView, Keyboard, Alert, Pressable, StyleProp, ViewStyle, Image, Dimensions } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboard } from '@react-native-community/hooks';
import Animated, { FadeOut, FadeIn, LinearTransition, Easing } from 'react-native-reanimated';
import { ATextInput, ATextInputRef } from '../../components/ATextInput';
import { RoundButton } from '../../components/RoundButton';
import { contractFromPublicKey } from '../../engine/contractFromPublicKey';
import { resolveUrl } from '../../utils/resolveUrl';
import { backoff } from '../../utils/time';
import { useTypedNavigation } from '../../utils/useTypedNavigation';
import { AsyncLock } from 'teslabot';
import { getCurrentAddress } from '../../storage/appState';
import { t } from '../../i18n/t';
import { KnownJettonMasters, KnownWallets } from '../../secure/KnownWallets';
import { fragment } from '../../fragment';
import { LedgerOrder, Order, createJettonOrder, createLedgerJettonOrder, createSimpleLedgerOrder, createSimpleOrder } from './ops/Order';
import { useLinkNavigator } from "../../useLinkNavigator";
import { useParams } from '../../utils/useParams';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ReactNode, RefObject, createRef, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { WImage } from '../../components/WImage';
import { formatAmount, formatCurrency, formatInputAmount } from '../../utils/formatCurrency';
import { ValueComponent } from '../../components/ValueComponent';
import { useRoute } from '@react-navigation/native';
import { useAccountLite, useClient4, useCommitCommand, useConfig, useJettonMaster, useJettonWallet, useNetwork, usePrice, useSelectedAccount, useTheme } from '../../engine/hooks';
import { useLedgerTransport } from '../ledger/components/TransportContext';
import { fromBnWithDecimals, toBnWithDecimals } from '../../utils/withDecimals';
import { fetchSeqno } from '../../engine/api/fetchSeqno';
import { getLastBlock } from '../../engine/accountWatcher';
import { MessageRelaxed, loadStateInit, comment, internal, external, fromNano, Cell, Address, toNano, SendMode, storeMessage, storeMessageRelaxed } from '@ton/core';
import { estimateFees } from '../../utils/estimateFees';
import { resolveLedgerPayload } from '../ledger/utils/resolveLedgerPayload';
import { TransferAddressInput, addressInputReducer } from '../../components/address/TransferAddressInput';
import { ItemDivider } from '../../components/ItemDivider';
import { AboutIconButton } from '../../components/AboutIconButton';
import { StatusBar } from 'expo-status-bar';
import { ScrollView } from 'react-native-gesture-handler';
import { TransferHeader } from '../../components/transfer/TransferHeader';

import IcTonIcon from '@assets/ic-ton-acc.svg';
import IcChevron from '@assets/ic_chevron_forward.svg';

export type SimpleTransferParams = {
    target?: string | null,
    comment?: string | null,
    amount?: bigint | null,
    stateInit?: Cell | null,
    job?: string | null,
    jetton?: Address | null,
    callback?: ((ok: boolean, result: Cell | null) => void) | null,
    back?: number,
    app?: {
        domain: string,
        title: string,
        url: string,
    }
}

export const SimpleTransferFragment = fragment(() => {
    const theme = useTheme();
    const network = useNetwork();
    const navigation = useTypedNavigation();
    const params: SimpleTransferParams | undefined = useParams();
    const route = useRoute();
    const isLedger = route.name === 'LedgerSimpleTransfer';
    const safeArea = useSafeAreaInsets();
    const acc = useSelectedAccount();
    const client = useClient4(network.isTestnet);
    const [price, currency] = usePrice();

    // Ledger
    const ledgerContext = useLedgerTransport();
    const addr = ledgerContext?.addr;
    const ledgerAddress = useMemo(() => {
        if (addr && isLedger) {
            try {
                return Address.parse(addr.address);
            } catch { }
        }
    }, [addr]);

    const accountLite = useAccountLite(isLedger ? ledgerAddress : acc!.address);

    const [addressDomainInputState, dispatchAddressDomainInput] = useReducer(
        addressInputReducer(),
        {
            input: params?.target || '',
            target: params?.target || '',
            domain: undefined
        }
    );

    const { target, input: addressDomainInput, domain } = addressDomainInputState;

    const [commentString, setComment] = useState(params?.comment || '');
    const [amount, setAmount] = useState(params?.amount ? fromNano(params.amount) : '');
    const [stateInit, setStateInit] = useState<Cell | null>(params?.stateInit || null);
    const [estimation, setEstimation] = useState<bigint | null>(null);
    const [jetton, setJetton] = useState<Address | null>(params?.jetton || null);

    const jettonWallet = useJettonWallet(jetton?.toString({ testOnly: network.isTestnet }), true);
    const jettonMaster = useJettonMaster(jettonWallet?.master!);
    const symbol = jettonMaster ? jettonMaster.symbol! : 'TON'

    const targetAddressValid = useMemo(() => {
        if (target.length > 48) {
            return null;
        }
        try {
            return Address.parseFriendly(target);
        } catch {
            return null;
        }
    }, [target]);

    const jettonState = useMemo(() => {
        if (!jetton) {
            return null;
        }

        if (!jettonWallet || !jettonMaster) {
            return null;
        }
        return { wallet: jettonWallet, master: jettonMaster, walletAddress: jetton };
    }, [jetton, jettonMaster, jettonWallet]);

    const validAmount = useMemo(() => {
        let value: bigint | null = null;

        if (!amount) {
            return null;
        }

        try {
            const valid = amount.replace(',', '.').replaceAll(' ', '');
            // Manage jettons with decimals
            if (jettonState) {
                value = toBnWithDecimals(valid, jettonState.master.decimals ?? 9);
            } else {
                value = toNano(valid);
            }
            return value;
        } catch {
            return null;
        }
    }, [amount, jettonState]);

    const priceText = useMemo(() => {
        if (!price || jettonState || !validAmount) {
            return undefined;
        }

        const isNeg = validAmount < 0n;
        const abs = isNeg ? -validAmount : validAmount;

        return formatCurrency(
            (parseFloat(fromNano(abs)) * price.price.usd * price.price.rates[currency]).toFixed(2),
            currency,
            isNeg
        );
    }, [jettonState, validAmount, price, currency]);

    const estimationPrise = useMemo(() => {
        if (!estimation || !price || !validAmount) {
            return undefined;
        }

        const isNeg = estimation < 0n;
        const abs = isNeg ? -estimation : estimation;

        return formatCurrency(
            (parseFloat(fromNano(abs)) * price.price.usd * price.price.rates[currency]).toFixed(2),
            currency,
            isNeg
        );
    }, [price, currency, estimation]);

    const isVerified = useMemo(() => {
        if (!jettonState || !jettonState.wallet.master) {
            return true;
        }
        return !!KnownJettonMasters(network.isTestnet)[jettonState.wallet.master];
    }, [jettonState]);

    const balance = useMemo(() => {
        let value: bigint;
        if (jettonState) {
            value = BigInt(jettonState.wallet.balance);
        } else {
            value = accountLite?.balance || 0n;
        }
        return value;
    }, [jettonState, accountLite?.balance, isLedger]);

    const amountError = useMemo(() => {
        if (amount.length === 0) {
            return undefined;
        }
        if (validAmount === null) {
            return t('transfer.error.invalidAmount');
        }
        if (validAmount < 0n) {
            return t('transfer.error.invalidAmount');
        }
        if (validAmount > balance) {
            return t('transfer.error.notEnoughCoins');
        }
        if (validAmount === 0n && !!jettonState) {
            return t('transfer.error.zeroCoins');
        }

        return undefined;
    }, [validAmount, balance, amount]);

    const commitCommand = useCommitCommand();
    const callback: ((ok: boolean, result: Cell | null) => void) | null = params && params.callback ? params.callback : null;

    // Auto-cancel job
    useEffect(() => {
        return () => {
            if (params && params.job) {
                commitCommand(false, params.job, new Cell());
            }
            if (params && params.callback) {
                params.callback(false, null);
            }
        }
    }, []);

    // Resolve order
    const order = useMemo(() => {
        if (validAmount === null) {
            return null
        }

        try {
            Address.parseFriendly(target);
        } catch (e) {
            return null;
        }

        if (isLedger && ledgerAddress) {
            // Resolve jetton order
            if (jettonState) {
                const txForwardAmount = toNano('0.05')
                    + (estimation ?? toNano('0.1'));
                return createLedgerJettonOrder({
                    wallet: jettonState.walletAddress,
                    target: target,
                    domain: domain,
                    responseTarget: ledgerAddress,
                    text: commentString,
                    amount: validAmount,
                    tonAmount: 1n,
                    txAmount: txForwardAmount,
                    payload: null
                }, network.isTestnet);
            }

            // Resolve order
            return createSimpleLedgerOrder({
                target: target,
                domain: domain,
                text: commentString,
                payload: null,
                amount: accountLite?.balance === validAmount ? toNano('0') : validAmount,
                amountAll: accountLite?.balance === validAmount ? true : false,
                stateInit
            });
        }

        // Resolve jetton order
        if (jettonState) {
            const txForwardAmount = toNano('0.05')
                + (estimation ?? toNano('0.1'));

            return createJettonOrder({
                wallet: jettonState.walletAddress,
                target: target,
                domain: domain,
                responseTarget: acc!.address,
                text: commentString,
                amount: validAmount,
                tonAmount: 1n,
                txAmount: txForwardAmount,
                payload: null
            }, network.isTestnet);
        }

        // Resolve order
        return createSimpleOrder({
            target: target,
            domain: domain,
            text: commentString,
            payload: null,
            amount: (validAmount === accountLite?.balance) ? toNano('0') : validAmount,
            amountAll: validAmount === accountLite?.balance,
            stateInit,
            app: params?.app
        });

    }, [validAmount, target, domain, commentString, stateInit, jettonState, params?.app, acc, ledgerAddress, estimation]);

    // Estimate fee
    const config = useConfig();
    const lock = useMemo(() => new AsyncLock(), []);
    useEffect(() => {
        let ended = false;
        lock.inLock(async () => {
            await backoff('simple-transfer', async () => {
                if (ended) {
                    return;
                }

                // Load app state
                const currentAddress = getCurrentAddress();

                let seqno = await fetchSeqno(client, await getLastBlock(), ledgerAddress ?? currentAddress.address);

                // Parse order
                let intMessage: MessageRelaxed;
                let sendMode: number = SendMode.IGNORE_ERRORS | SendMode.PAY_GAS_SEPARATELY;

                let storageStats: ({
                    lastPaid: number;
                    duePayment: string | null;
                    used: {
                        bits: number;
                        cells: number;
                        publicCells: number;
                    }
                } | null)[] = [];

                const block = await backoff('transfer', () => client.getLastBlock());

                if (!order) {
                    const internalStateInit = !!stateInit
                        ? loadStateInit(stateInit.asSlice())
                        : null;

                    const body = comment(commentString);

                    intMessage = internal({
                        to: currentAddress.address,
                        value: 0n,
                        init: internalStateInit,
                        bounce: false,
                        body,
                    });

                    const state = await backoff('transfer', () => client.getAccount(block.last.seqno, currentAddress.address));
                    storageStats = state.account.storageStat ? [state.account.storageStat] : [];
                } else {
                    if (order.type === 'order') {
                        const internalStateInit = !!order.messages[0].stateInit
                            ? loadStateInit(order.messages[0].stateInit.asSlice())
                            : null;

                        const body = order.messages[0].payload ? order.messages[0].payload : null;

                        intMessage = internal({
                            to: Address.parse(order.messages[0].target),
                            value: 0n,
                            init: internalStateInit,
                            bounce: false,
                            body,
                        });

                        const state = await backoff('transfer', () => client.getAccount(block.last.seqno, Address.parse(order.messages[0].target)));
                        storageStats = state.account.storageStat ? [state.account.storageStat] : [];

                        if (order.messages[0].amountAll) {
                            sendMode = SendMode.CARRY_ALL_REMAINING_BALANCE;
                        }
                    } else {
                        const internalStateInit = !!stateInit
                            ? loadStateInit(stateInit.asSlice())
                            : null;

                        const body = order.payload ? resolveLedgerPayload(order.payload) : comment(commentString);

                        intMessage = internal({
                            to: currentAddress.address,
                            value: 0n,
                            init: internalStateInit,
                            bounce: false,
                            body,
                        });

                        const state = await backoff('transfer', () => client.getAccount(block.last.seqno, currentAddress.address));
                        storageStats = state.account.storageStat ? [state.account.storageStat] : [];
                    }
                }

                // Load contract
                const contract = await contractFromPublicKey(currentAddress.publicKey);

                // Create transfer
                let transfer = contract.createTransfer({
                    seqno: seqno,
                    secretKey: Buffer.alloc(64),
                    sendMode,
                    messages: [intMessage],
                });


                if (ended) {
                    return;
                }

                // Resolve fee
                if (config && accountLite) {
                    const externalMessage = external({
                        to: contract.address,
                        body: transfer,
                        init: seqno === 0 ? contract.init : null
                    });

                    let inMsg = new Cell().asBuilder();
                    storeMessage(externalMessage)(inMsg);

                    let outMsg = new Cell().asBuilder();
                    storeMessageRelaxed(intMessage)(outMsg);

                    let local = estimateFees(config, inMsg.endCell(), [outMsg.endCell()], storageStats);
                    setEstimation(local);
                }
            });
        });
        return () => {
            ended = true;
        }
    }, [order, accountLite, client, config, commentString, ledgerAddress]);

    const linkNavigator = useLinkNavigator(network.isTestnet);
    const onQRCodeRead = useCallback((src: string) => {
        let res = resolveUrl(src, network.isTestnet);
        if (res && res.type === 'transaction') {
            if (res.payload) {
                linkNavigator(res);
            } else {
                let mComment = commentString;
                let mTarget = target;
                let mAmount = validAmount;
                let mStateInit = stateInit;
                let mJetton = jetton;

                try {
                    mAmount = toNano(amount);
                } catch {
                    mAmount = null;
                }

                if (res.address) {
                    mTarget = res.address.toString({ testOnly: network.isTestnet });
                }

                if (res.amount) {
                    mAmount = res.amount;
                }

                if (res.comment) {
                    mComment = res.comment;
                }
                if (res.stateInit) {
                    mStateInit = res.stateInit;
                } else {
                    mStateInit = null;
                }

                if (isLedger) {
                    navigation.navigateLedgerTransfer({
                        target: mTarget,
                        comment: mComment,
                        amount: mAmount,
                        stateInit: mStateInit,
                        jetton: mJetton,
                    });
                    return;
                }

                navigation.navigateSimpleTransfer({
                    target: mTarget,
                    comment: mComment,
                    amount: mAmount,
                    stateInit: mStateInit,
                    jetton: mJetton,
                });
            }
        }
    }, [commentString, target, validAmount, stateInit, jetton,]);

    const onAddAll = useCallback(() => {
        const amount = jettonState
            ? fromBnWithDecimals(balance, jettonState.master.decimals)
            : fromNano(balance);
        const formatted = formatInputAmount(amount.replace('.', ','), jettonState?.master.decimals ?? 9, { skipFormattingDecimals: true });
        setAmount(formatted);
    }, [balance, jettonState]);

    //
    // Scroll state tracking
    //

    const [selectedInput, setSelectedInput] = useState<number | null>(0);

    const refs = useMemo(() => {
        let r: RefObject<ATextInputRef>[] = [];
        for (let i = 0; i < 3; i++) {
            r.push(createRef());
        }
        return r;
    }, []);

    const scrollRef = useRef<ScrollView>(null);

    const keyboard = useKeyboard();

    const onAssetSelected = useCallback((selected?: { master: Address, wallet: Address }) => {
        if (selected) {
            setJetton(selected.wallet);
            return;
        }
        setJetton(null);
    }, []);

    const isKnown: boolean = !!KnownWallets(network.isTestnet)[target];

    const doSend = useCallback(async () => {
        let address: Address;

        try {
            let parsed = Address.parseFriendly(target);
            address = parsed.address;
        } catch (e) {
            Alert.alert(t('transfer.error.invalidAddress'));
            return;
        }

        if (validAmount === null) {
            Alert.alert(t('transfer.error.invalidAmount'));
            return;
        }

        if (validAmount < 0n) {
            Alert.alert(t('transfer.error.invalidAmount'));
            return;
        }

        // Might not happen
        if (!order) {
            return;
        }

        // Load contract
        const contract = await contractFromPublicKey(acc!.publicKey);

        // Check if transfering to yourself
        if (isLedger && !ledgerAddress) {
            return;
        }

        if (address.equals(isLedger ? ledgerAddress! : contract.address)) {
            let allowSendingToYourself = await new Promise((resolve) => {
                Alert.alert(t('transfer.error.sendingToYourself'), undefined, [
                    {
                        onPress: () => resolve(true),
                        text: t('common.continueAnyway')
                    },
                    {
                        onPress: () => resolve(false),
                        text: t('common.cancel'),
                        isPreferred: true,
                    }
                ]);
            });
            if (!allowSendingToYourself) {
                return;
            }
        }

        // Check amount
        if (balance < validAmount || balance === 0n) {
            Alert.alert(t('transfer.error.notEnoughCoins'));
            return;
        }
        if (validAmount === 0n) {
            if (!!jettonState) {
                Alert.alert(t('transfer.error.zeroCoins'));
                return;
            }
            let allowSeingZero = await new Promise((resolve) => {
                Alert.alert(t('transfer.error.zeroCoinsAlert'), undefined, [
                    {
                        onPress: () => resolve(true),
                        text: t('common.continueAnyway')
                    },
                    {
                        onPress: () => resolve(false),
                        text: t('common.cancel'),
                        isPreferred: true,
                    }
                ]);
            });
            if (!allowSeingZero) {
                return;
            }
        }

        setSelectedInput(null);
        // Dismiss keyboard for iOS
        if (Platform.OS === 'ios') {
            Keyboard.dismiss();
        }

        if (isLedger) {
            navigation.replace('LedgerSignTransfer', {
                text: null,
                order: order as LedgerOrder,
            });
            return;
        }

        // Navigate to transaction confirmation
        navigation.navigateTransfer({
            text: commentString,
            order: order as Order,
            job: params && params.job ? params.job : null,
            callback,
            back: params && params.back ? params.back + 1 : undefined
        })
    }, [
        amount, target, domain, commentString,
        accountLite,
        stateInit,
        order,
        callback,
        jettonState,
        ledgerAddress,
        isLedger,
        balance
    ]);

    const onFocus = useCallback((index: number) => {
        setSelectedInput(index);
    }, []);

    const onSubmit = useCallback((index: number) => {
        setSelectedInput(null);
    }, []);

    const resetInput = useCallback(() => {
        Keyboard.dismiss();
        setSelectedInput(null);
    }, []);

    const { selected, onNext, header } = useMemo<{
        selected: 'amount' | 'address' | 'comment' | null,
        onNext: (() => void) | null,
        header: {
            onBackPressed?: () => void,
            title?: string,
            rightButton?: ReactNode,
            titleComponent?: ReactNode,
        }
    }>(() => {

        if (selectedInput === null) {
            return {
                selected: null,
                onNext: null,
                header: { title: t('transfer.title') }
            }
        }

        const addressFriendly = targetAddressValid?.address.toString({ testOnly: network.isTestnet });

        const headertitle = addressFriendly
            ? {
                titleComponent: (
                    <TransferHeader
                        theme={theme}
                        addressFriendly={addressFriendly}
                        isTestnet={network.isTestnet}
                    />
                )
            }
            : {
                title: t('transfer.title'),
            }

        if (selectedInput === 0) {
            return {
                selected: 'address',
                onNext: targetAddressValid ? resetInput : null,
                header: {
                    title: t('common.recipient'),
                    titleComponent: undefined,
                }
            }
        }

        if (selectedInput === 1) {
            return {
                selected: 'amount',
                onNext: resetInput,
                header: { ...headertitle }
            }
        }

        if (selectedInput === 2) {
            return {
                selected: 'comment',
                onNext: resetInput,
                header: { ...headertitle }
            }
        }

        // Default
        return { selected: null, onNext: null, header: { ...headertitle } };
    }, [selectedInput, targetAddressValid, validAmount, refs, doSend, amountError]);

    const [addressInputHeight, setAddressInputHeight] = useState(0);
    const [amountInputHeight, setAmountInputHeight] = useState(0);

    const seletectInputStyles = useMemo<{
        amount: StyleProp<ViewStyle>,
        address: StyleProp<ViewStyle>,
        comment: StyleProp<ViewStyle>,
        fees: StyleProp<ViewStyle>,
    }>(() => {
        switch (selected) {
            case 'address':
                return {
                    address: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 1, zIndex: 1 },
                    amount: { opacity: 0, pointerEvents: 'none', height: 0 },
                    comment: { opacity: 0, pointerEvents: 'none', height: 0 },
                    fees: { opacity: 0, height: 0 },
                }
            case 'amount':
                return {
                    address: { opacity: 0, pointerEvents: 'none' },
                    amount: { position: 'relative', top: -addressInputHeight - 16, left: 0, right: 0, opacity: 1, zIndex: 1 },
                    comment: { opacity: 0, pointerEvents: 'none' },
                    fees: { opacity: 0, pointerEvents: 'none' },
                }
            case 'comment':
                return {
                    address: { opacity: 0, pointerEvents: 'none' },
                    amount: { opacity: 0, pointerEvents: 'none' },
                    comment: { position: 'absolute', top: -addressInputHeight - amountInputHeight - 32, left: 0, right: 0, opacity: 1, zIndex: 1 },
                    fees: { opacity: 0 },
                }
            default:
                return {
                    address: { opacity: 1 },
                    amount: { opacity: 1 },
                    comment: { opacity: 1 },
                    fees: { opacity: 1 }
                }
        }
    }, [selected, addressInputHeight, amountInputHeight]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0 });
    }, [selectedInput]);

    return (
        <View style={{ flexGrow: 1 }}>
            <StatusBar style={Platform.select({ android: theme.style === 'dark' ? 'light' : 'dark', ios: 'light' })} />
            <ScreenHeader
                title={header.title}
                onBackPressed={header?.onBackPressed}
                titleComponent={header.titleComponent}
                onClosePressed={navigation.goBack}
                style={Platform.select({ android: { paddingTop: safeArea.top } })}
            />
            <ScrollView
                ref={scrollRef}
                style={{ flexGrow: 1, flexBasis: 0, alignSelf: 'stretch', marginTop: 16 }}
                contentContainerStyle={[
                    { marginHorizontal: 16, flexGrow: 1 },
                    Platform.select({ android: { minHeight: addressInputHeight } }),
                ]}
                contentInset={{
                    // bottom: 0.1,
                    bottom: keyboard.keyboardShown ? keyboard.keyboardHeight - 86 - 32 : 0.1 /* Some weird bug on iOS */, // + 56 + 32
                    top: 0.1 /* Some weird bug on iOS */
                }}
                contentInsetAdjustmentBehavior={'never'}
                keyboardShouldPersistTaps={'always'}
                keyboardDismissMode={'none'}
                automaticallyAdjustContentInsets={false}
                scrollEnabled={!selectedInput}
                nestedScrollEnabled={!selectedInput}
            >
                <Animated.View
                    layout={LinearTransition.duration(300).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))}
                    style={seletectInputStyles.address}
                    onLayout={(e) => setAddressInputHeight(e.nativeEvent.layout.height)}
                >
                    <TransferAddressInput
                        ref={refs[0]}
                        acc={ledgerAddress ?? acc!.address}
                        theme={theme}
                        target={target}
                        input={addressDomainInput}
                        domain={domain}
                        validAddress={targetAddressValid?.address}
                        isTestnet={network.isTestnet}
                        index={0}
                        onFocus={onFocus}
                        dispatch={dispatchAddressDomainInput}
                        onSubmit={onSubmit}
                        onQRCodeRead={onQRCodeRead}
                        isSelected={selected === 'address'}
                        onSearchItemSelected={() => {
                            scrollRef.current?.scrollTo({ y: 0 });
                        }}
                    />
                </Animated.View>
                {selected === 'address' && (
                    <View style={{ height: addressInputHeight }} />
                )}
                <View style={{ marginTop: 16 }}>
                    <Animated.View
                        layout={LinearTransition.duration(300).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))}
                        style={[seletectInputStyles.amount, { flex: 1 }]}
                        onLayout={(e) => setAmountInputHeight(e.nativeEvent.layout.height)}
                    >
                        <View
                            style={{
                                backgroundColor: theme.surfaceOnElevation,
                                borderRadius: 20,
                                justifyContent: 'center',
                                padding: 20
                            }}
                        >
                            <Pressable
                                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                                onPress={() => navigation.navigate(
                                    isLedger ? 'LedgerAssets' : 'Assets',
                                    {
                                        callback: onAssetSelected,
                                        selectedJetton: jettonState ? Address.parse(jettonState.master.address) : undefined
                                    }
                                )}
                            >
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <View style={{ flexDirection: 'row', flexShrink: 1, overflow: 'hidden' }}>
                                        <View style={{
                                            height: 46, width: 46,
                                            justifyContent: 'center', alignItems: 'center',
                                            marginRight: 12
                                        }}>
                                            {!!jettonState && (
                                                <WImage
                                                    src={jettonState.master.image?.preview256}
                                                    blurhash={jettonState.master.image?.blurhash}
                                                    width={46}
                                                    heigh={46}
                                                    borderRadius={23}
                                                    lockLoading
                                                />
                                            )}
                                            {!jettonState && (<IcTonIcon width={46} height={46} />)}
                                            {isVerified && (
                                                <View style={{
                                                    justifyContent: 'center', alignItems: 'center',
                                                    height: 20, width: 20, borderRadius: 10,
                                                    position: 'absolute', right: -2, bottom: 0,
                                                    backgroundColor: theme.surfaceOnBg
                                                }}>
                                                    <Image
                                                        source={require('@assets/ic-verified.png')}
                                                        style={{ height: 20, width: 20 }}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ justifyContent: 'space-between', flexShrink: 1 }}>
                                            <Text style={{
                                                fontSize: 17,
                                                color: theme.textPrimary,
                                                fontWeight: '600',
                                                lineHeight: 24
                                            }}>
                                                {symbol}
                                            </Text>
                                            <Text
                                                style={{ flexShrink: 1 }}
                                                numberOfLines={4}
                                                ellipsizeMode={'tail'}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: '400',
                                                        lineHeight: 20,
                                                        color: theme.textSecondary,
                                                    }}
                                                    selectable={false}
                                                >
                                                    {`${jettonState?.master.description ?? 'The Open Network'}`}
                                                </Text>
                                            </Text>
                                        </View>
                                    </View>
                                    <IcChevron style={{ height: 12, width: 12 }} height={12} width={12} />
                                </View>
                            </Pressable>
                            <ItemDivider marginHorizontal={0} />
                            <View style={{
                                flexDirection: 'row',
                                marginBottom: 12,
                                justifyContent: 'space-between'
                            }}>
                                <Text style={{
                                    fontWeight: '400',
                                    fontSize: 15, lineHeight: 20,
                                    color: theme.textSecondary,
                                }}>
                                    {`${t('common.balance')}: `}
                                    <ValueComponent
                                        precision={4}
                                        value={balance}
                                        decimals={jettonState ? jettonState.master.decimals : undefined}
                                    />
                                    {jettonState ? ` ${jettonState.master.symbol}` : ''}
                                </Text>
                                <Pressable
                                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                                    onPress={onAddAll}
                                >
                                    <Text style={{
                                        fontWeight: '500',
                                        fontSize: 15, lineHeight: 20,
                                        color: theme.accent,
                                    }}>
                                        {t('transfer.sendAll')}
                                    </Text>
                                </Pressable>
                            </View>
                            <ATextInput
                                index={1}
                                ref={refs[1]}
                                onFocus={onFocus}
                                value={amount}
                                onValueChange={(newVal) => {
                                    const formatted = formatInputAmount(newVal, jettonState?.master.decimals ?? 9, { skipFormattingDecimals: true }, amount);
                                    setAmount(formatted);
                                }}
                                keyboardType={'numeric'}
                                style={{
                                    backgroundColor: theme.elevation,
                                    paddingHorizontal: 16, paddingVertical: 14,
                                    borderRadius: 16,
                                }}
                                inputStyle={{
                                    fontSize: 17, fontWeight: '400',
                                    color: amountError ? theme.accentRed : theme.textPrimary,
                                    width: 'auto',
                                    flexShrink: 1
                                }}
                                suffix={priceText}
                                hideClearButton
                                prefix={jettonState ? (jettonState.master.symbol ?? '') : 'TON'}
                            />
                            {amountError && (
                                <Animated.View entering={FadeIn} exiting={FadeOut.duration(100)}>
                                    <Text style={{
                                        color: theme.accentRed,
                                        fontSize: 13,
                                        lineHeight: 18,
                                        marginTop: 8,
                                        fontWeight: '400'
                                    }}>
                                        {amountError}
                                    </Text>
                                </Animated.View>
                            )}
                        </View>
                    </Animated.View>
                </View>
                <View style={{ marginTop: 16 }}>
                    <Animated.View
                        layout={LinearTransition.duration(300).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))}
                        style={[
                            seletectInputStyles.comment,
                            { flex: 1 }
                        ]}
                    >
                        <View style={{
                            backgroundColor: theme.surfaceOnElevation,
                            paddingVertical: 20,
                            paddingHorizontal: (commentString.length > 0 && selected !== 'comment') ? 4 : 0,
                            width: '100%', borderRadius: 20,
                        }}>
                            <ATextInput
                                value={commentString}
                                index={2}
                                ref={refs[2]}
                                onFocus={onFocus}
                                onValueChange={setComment}
                                placeholder={isKnown ? t('transfer.commentRequired') : t('transfer.comment')}
                                keyboardType={'default'}
                                autoCapitalize={'sentences'}
                                label={isKnown ? t('transfer.commentRequired') : t('transfer.comment')}
                                style={{ paddingHorizontal: 16 }}
                                inputStyle={{
                                    flexShrink: 1,
                                    fontSize: 17,
                                    fontWeight: '400', color: theme.textPrimary,
                                    textAlignVertical: 'center',
                                }}
                                multiline
                            />
                        </View>
                        {selected === 'comment' && (
                            <Animated.View layout={LinearTransition.duration(300).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))}>
                                <Text style={{
                                    color: theme.textSecondary,
                                    fontSize: 13, lineHeight: 18,
                                    fontWeight: '400',
                                    paddingHorizontal: 16,
                                    marginTop: 2
                                }}>
                                    {t('transfer.commentDescription')}
                                </Text>
                            </Animated.View>
                        )}
                    </Animated.View>
                </View>
                <View style={{ marginTop: 16 }}>
                    <Animated.View
                        layout={LinearTransition.duration(300).easing(Easing.bezierFn(0.25, 0.1, 0.25, 1))}
                        style={[
                            seletectInputStyles.fees,
                            { flex: 1 }
                        ]}
                    >
                        <View style={{
                            backgroundColor: theme.surfaceOnElevation,
                            padding: 20, borderRadius: 20,
                            flexDirection: 'row',
                            justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <View>
                                <Text
                                    style={{
                                        color: theme.textSecondary,
                                        fontSize: 13, lineHeight: 18, fontWeight: '400',
                                        marginBottom: 2
                                    }}>
                                    {t('txPreview.blockchainFee')}
                                </Text>
                                <Text style={{
                                    color: theme.textPrimary,
                                    fontSize: 17, lineHeight: 24, fontWeight: '400'
                                }}>
                                    {estimation
                                        ? <>
                                            {`${formatAmount(fromNano(estimation))} TON`}
                                        </>
                                        : '...'
                                    }
                                    {!!estimationPrise && (
                                        <Text style={{
                                            color: theme.textSecondary,
                                            fontSize: 17, lineHeight: 24, fontWeight: '400',
                                        }}>
                                            {` (${estimationPrise})`}
                                        </Text>

                                    )}
                                </Text>
                            </View>
                            <AboutIconButton
                                title={t('txPreview.blockchainFee')}
                                description={t('txPreview.blockchainFeeDescription')}
                                style={{ height: 24, width: 24, position: undefined }}
                                size={24}
                            />
                        </View>
                    </Animated.View>
                </View>
                <View style={{ height: 56 }} />
            </ScrollView>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'position' : undefined}
                style={[
                    { marginHorizontal: 16, marginTop: 16, },
                    Platform.select({
                        android: { marginBottom: safeArea.bottom + 16 },
                        ios: { marginBottom: safeArea.bottom + 32 }
                    })
                ]}
                keyboardVerticalOffset={Platform.OS === 'ios' ? safeArea.top + 32 : 0}
            >
                {!!selected
                    ? <RoundButton
                        title={t('common.save')}
                        disabled={!onNext}
                        onPress={onNext ? onNext : undefined}
                    />
                    : <RoundButton
                        disabled={!order}
                        title={t('common.continue')}
                        action={doSend}
                    />
                }
            </KeyboardAvoidingView>
        </View>
    );
});