import React, { memo, useCallback, useMemo } from "react";
import { View, Pressable } from "react-native";
import { t } from "../../i18n/t";
import { ValueComponent } from "../ValueComponent";
import { PriceComponent } from "../PriceComponent";
import { useTypedNavigation } from "../../utils/useTypedNavigation";
import { extractDomain } from "../../engine/utils/extractDomain";
import Animated from "react-native-reanimated";
import { useAnimatedPressedInOut } from "../../utils/useAnimatedPressedInOut";
import { useHoldersAccountStatus, useSelectedAccount, useTheme } from "../../engine/hooks";
import { HoldersAccountState, holdersUrl } from "../../engine/api/holders/fetchAccountState";
import { GeneralHoldersAccount, GeneralHoldersCard } from "../../engine/api/holders/fetchAccounts";
import { getDomainKey } from "../../engine/state/domainKeys";
import { PerfText } from "../basic/PerfText";
import { Typography } from "../styles";
import { ScrollView } from "react-native-gesture-handler";
import { HoldersAccountCard } from "./HoldersAccountCard";

import IcTonIcon from '@assets/ic-ton-acc.svg';

export const HoldersAccountItem = memo((props: {
    account: GeneralHoldersAccount,
    last?: boolean,
    first?: boolean,
    rightAction?: () => void
    rightActionIcon?: any,
    single?: boolean,
    hidden?: boolean
}) => {
    const theme = useTheme();
    const navigation = useTypedNavigation();
    const selected = useSelectedAccount();
    const holdersAccStatus = useHoldersAccountStatus(selected!.address).data;

    const needsEnrolment = useMemo(() => {
        if (holdersAccStatus?.state === HoldersAccountState.NeedEnrollment) {
            return true;
        }
        return false;
    }, [holdersAccStatus]);

    const onPress = useCallback(() => {
        const domain = extractDomain(holdersUrl);
        const domainKey = getDomainKey(domain);
        if (needsEnrolment || !domainKey) {
            navigation.navigate(
                'HoldersLanding',
                {
                    endpoint: holdersUrl,
                    onEnrollType: props.account ? { type: 'account', id: props.account.id } : { type: 'create' }
                }
            );
            return;
        }
        navigation.navigateHolders(props.account ? { type: 'account', id: props.account.id } : { type: 'create' });
    }, [props.account, needsEnrolment]);

    const { onPressIn, onPressOut, animatedStyle } = useAnimatedPressedInOut();

    const title = props.account?.name
        ? props.account.name
        : t('products.holders.accounts.account');
    const subtitle = t('products.holders.accounts.basicAccount');

    return (
        <Animated.View style={[
            { flex: 1, borderRadius: 20, backgroundColor: theme.surfaceOnBg, paddingVertical: 20 },
            animatedStyle
        ]}>
            <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                style={{ flexGrow: 1, }}
                onPress={onPress}
            >
                <View style={{ flexDirection: 'row', flexGrow: 1, alignItems: 'center', paddingHorizontal: 20 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 0 }}>
                        <IcTonIcon width={46} height={46} />
                    </View>
                    <View style={{ marginLeft: 12, flexShrink: 1 }}>
                        <PerfText
                            style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}
                            ellipsizeMode="tail"
                            numberOfLines={1}
                        >
                            {title}
                        </PerfText>
                        <PerfText
                            style={[{ color: theme.textSecondary }, Typography.regular15_20]}
                            numberOfLines={1}
                            ellipsizeMode={'tail'}
                        >
                            <PerfText style={{ flexShrink: 1 }}>
                                {subtitle}
                            </PerfText>
                        </PerfText>
                    </View>
                    {(!!props.account && props.account.balance) && (
                        <View style={{ flexGrow: 1, alignItems: 'flex-end' }}>
                            <PerfText style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                                <ValueComponent value={props.account.balance} precision={2} centFontStyle={{ opacity: 0.5 }} />
                                <PerfText style={{ opacity: 0.5 }}>
                                    {' TON'}
                                </PerfText>
                            </PerfText>
                            <PriceComponent
                                amount={BigInt(props.account.balance)}
                                style={{
                                    backgroundColor: 'transparent',
                                    paddingHorizontal: 0, paddingVertical: 0,
                                    alignSelf: 'flex-end',
                                    height: undefined
                                }}
                                textStyle={[{ color: theme.textSecondary }, Typography.regular15_20]}
                                currencyCode={'EUR'}
                                theme={theme}
                            />
                        </View>
                    )}
                </View>
            </Pressable>
            <ScrollView
                horizontal={true}
                style={{ height: 46, marginLeft: 78, marginTop: 10 }}
                contentContainerStyle={{ gap: 8 }}
                showsHorizontalScrollIndicator={false}
            >
                {props.account.cards.map((card, index) => {
                    return (
                        <HoldersAccountCard
                            card={card as GeneralHoldersCard}
                            theme={theme}
                        />
                    )
                })}
            </ScrollView>
        </Animated.View>
    );
});