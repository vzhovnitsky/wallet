import React, { memo, useMemo } from "react"
import { HoldersAccountItem } from "./HoldersAccountItem";
import { View, Text, Image } from "react-native";
import { useHoldersAccounts, useHoldersHiddenAccounts, useNetwork, useSelectedAccount, useTheme } from "../../engine/hooks";
import { CollapsibleCards } from "../animated/CollapsibleCards";
import { t } from "../../i18n/t";
import { PerfText } from "../basic/PerfText";
import { ValueComponent } from "../ValueComponent";
import { PriceComponent } from "../PriceComponent";
import { Typography } from "../styles";

import IcHide from '@assets/ic-hide.svg';

export const HoldersProductComponent = memo(() => {
    const network = useNetwork();
    const theme = useTheme();
    const selected = useSelectedAccount();
    const accounts = useHoldersAccounts(selected!.address).data?.accounts;
    const [hiddenCards, markCard] = useHoldersHiddenAccounts(selected!.address);
    const visibleList = useMemo(() => {
        return (accounts ?? []).filter((item) => {
            return !hiddenCards.includes(item.id);
        });
    }, [hiddenCards, accounts]);
    const totalBalance = useMemo(() => {
        return visibleList?.reduce((acc, item) => {
            return acc + BigInt(item.balance);
        }, BigInt(0));
    }, [visibleList]);

    if (!network.isTestnet) {
        return null;
    }

    if (!visibleList || visibleList?.length === 0) {
        return null;
    }

    if (visibleList.length <= 3) {
        return (
            <View style={{ marginBottom: 16, paddingHorizontal: 16, gap: 16 }}>
                <View
                    style={[{
                        flexDirection: 'row',
                        justifyContent: 'space-between', alignItems: 'center',
                    }]}
                >
                    <Text style={[{ color: theme.textPrimary, }, Typography.semiBold20_28]}>
                        {t('products.holders.accounts.title')}
                    </Text>
                </View>
                {visibleList.map((item, index) => {
                    return (
                        <HoldersAccountItem
                            key={`card-${index}`}
                            account={item}
                            rightActionIcon={<IcHide height={36} width={36} style={{ width: 36, height: 36 }} />}
                            rightAction={() => markCard(item.id, true)}
                            style={{ paddingVertical: 0 }}
                        />
                    )
                })}
            </View>
        )
    }

    return (
        <View style={{ marginBottom: 16 }}>
            <CollapsibleCards
                title={t('products.holders.accounts.title')}
                items={visibleList}
                renderItem={(item, index) => {
                    return (
                        <HoldersAccountItem
                            key={`card-${index}`}
                            account={item}
                            rightActionIcon={<IcHide height={36} width={36} style={{ width: 36, height: 36 }} />}
                            rightAction={() => markCard(item.id, true)}
                        />
                    )
                }}
                renderFace={() => {
                    return (
                        <View style={[
                            {
                                flexGrow: 1, flexDirection: 'row',
                                padding: 20,
                                marginHorizontal: 16,
                                borderRadius: 20,
                                alignItems: 'center',
                                backgroundColor: theme.surfaceOnElevation,
                            },
                            theme.style === 'dark' ? {
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.15,
                                shadowRadius: 4,
                            } : {}
                        ]}>
                            <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 0 }}>
                                <Image
                                    source={require('@assets/ic-holders-accounts.png')}
                                    style={{ width: 46, height: 46, borderRadius: 23 }}
                                />
                            </View>
                            <View style={{ marginLeft: 12, flexShrink: 1 }}>
                                <PerfText
                                    style={{ color: theme.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600' }}
                                    ellipsizeMode="tail"
                                    numberOfLines={1}
                                >
                                    {t('products.holders.accounts.title')}
                                </PerfText>
                                <PerfText
                                    numberOfLines={1}
                                    ellipsizeMode={'tail'}
                                    style={[{ flexShrink: 1, color: theme.textSecondary }, Typography.regular15_20]}
                                >
                                    <PerfText style={{ flexShrink: 1 }}>
                                        {t('common.showMore')}
                                    </PerfText>
                                </PerfText>
                            </View>
                            {(!!totalBalance) && (
                                <View style={{ flexGrow: 1, alignItems: 'flex-end' }}>
                                    <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                                        <ValueComponent value={totalBalance} precision={2} />
                                        <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
                                            {' TON'}
                                        </Text>
                                    </Text>
                                    <PriceComponent
                                        amount={totalBalance}
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
                    )
                }}
                itemHeight={122}
                theme={theme}
            />
        </View>
    );
})