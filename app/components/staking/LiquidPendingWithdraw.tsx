import { memo, useEffect, useState } from "react"
import { View, Text } from "react-native"
import { ThemeType } from "../../engine/state/theme"
import { Countdown } from "../Countdown";
import { Typography } from "../styles";
import { fromNano } from "@ton/core";
import { t } from "../../i18n/t";
import { PriceComponent } from "../PriceComponent";
import { ItemDivider } from "../ItemDivider";

export const LiquidPendingWithdraw = memo(({ theme, pendingUntil, amount, last }: { theme: ThemeType, pendingUntil: number, amount: bigint, last?: boolean }) => {
    const [left, setLeft] = useState(Math.floor(Date.now() / 1000));

    useEffect(() => {
        const timerId = setInterval(() => {
            setLeft(Math.floor(Date.now() / 1000));
        }, 1000);
        return () => {
            clearInterval(timerId);
        };
    }, []);

    return (
        <>
            <View style={{
                flexDirection: 'row', width: '100%',
                justifyContent: 'space-between', alignItems: 'center',
            }}>
                <View>
                    <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                        {t('products.staking.withdrawStatus.pending')}
                    </Text>
                    <Text style={[{ color: theme.textSecondary, marginTop: 2 }, Typography.regular15_20]}>
                        <Countdown
                            hidePrefix
                            left={pendingUntil - left}
                            textStyle={[{ flex: 1, flexShrink: 1 }, Typography.regular13_18]}
                        />
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                        {parseFloat(parseFloat(fromNano(amount)).toFixed(3))}
                        <Text style={{ color: theme.textSecondary }}>
                            {' TON'}
                        </Text>
                    </Text>
                    <PriceComponent
                        amount={amount}
                        style={{
                            backgroundColor: theme.transparent,
                            paddingHorizontal: 0,
                            paddingVertical: 0,
                            alignSelf: 'flex-end'
                        }}
                        textStyle={[{ color: theme.textSecondary }, Typography.regular15_20]}
                        theme={theme}
                    />
                </View>
            </View>
            {!last && (<ItemDivider marginHorizontal={0} marginVertical={8} />)}
        </>
    );
});