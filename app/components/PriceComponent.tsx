import React, { memo, useMemo } from "react"
import { StyleProp, ViewStyle, TextStyle } from "react-native"
import { CurrencySymbols, formatCurrency } from "../utils/formatCurrency"
import { usePrice } from "../engine/hooks";
import { fromNano } from "@ton/core";
import { ThemeType } from "../engine/state/theme";
import { PerfView } from "./basic/PerfView";
import { PerfText } from "./basic/PerfText";

import TonSign from '@assets/ic_ton_sign.svg';

export const PriceComponent = memo((
    {
        amount,
        style,
        textStyle,
        centsTextStyle,
        prefix,
        suffix,
        currencyCode,
        showSign,
        theme,
        priceUSD,
        hideCentsIfNull
    }: {
        amount: bigint,
        style?: StyleProp<ViewStyle>,
        textStyle?: StyleProp<TextStyle>,
        centsTextStyle?: StyleProp<TextStyle>,
        prefix?: string,
        suffix?: string,
        currencyCode?: string,
        showSign?: boolean,
        theme: ThemeType,
        priceUSD?: number,
        hideCentsIfNull?: boolean
    }
) => {
    const [price, currency] = usePrice();

    const isNeg = amount < 0;
    const abs = isNeg ? -amount : amount;

    const fullText = useMemo(() => {
        if (!price) {
            return '';
        }
        const priceInUSD = priceUSD ?? price.price.usd;
        const rates = price.price.rates;

        const formattedAmount = parseFloat(fromNano(abs)) * priceInUSD * rates[currencyCode || currency];
        const decimals = (amount === 0n && hideCentsIfNull) ? 0 : 2;

        // Check if the formattedAmount is less than the smallest value representable by the specified precision
        if (formattedAmount > 0 && formattedAmount < Math.pow(10, -decimals)) {
            // Include the currency symbol for the "<0.01" case
            const symbol = CurrencySymbols[currency].symbol;
            return `${prefix ?? ''}${isNeg ? '-' : ''}<0.${'0'.repeat(decimals - 1)}1${symbol}${suffix ?? ''}`;
        }

        const formattedCurrency = formatCurrency(formattedAmount.toFixed(decimals), currencyCode || currency, isNeg);
        return `${prefix ?? ''}${formattedCurrency}${suffix ?? ''}`;
    }, [amount, price, currencyCode, currency, prefix, suffix, abs, isNeg, priceUSD, hideCentsIfNull]);

    let decimalPoint = fullText.match(/[.,]/)?.[0];
    const parts = fullText.split(decimalPoint ?? /[.,]/);
    const integer = parts[0];
    const cents = parts[1];

    if (parts.length === 1) {
        decimalPoint = '';
    }

    if (!price) {
        return <></>;
    }

    return (
        <PerfView style={[{
            backgroundColor: theme.accent,
            borderRadius: 16,
            height: 28,
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 12,
            paddingLeft: showSign ? 2 : 12
        }, style]}>
            {showSign && (
                <PerfView style={{
                    height: 24, width: 24,
                    justifyContent: 'center', alignItems: 'center',
                    backgroundColor: theme.ton, borderRadius: 12,
                    marginRight: 6
                }}>
                    <TonSign
                        height={12}
                        width={12}
                        style={{ marginTop: 2, height: 12, width: 12 }}
                    />
                </PerfView>
            )}
            <PerfText style={[{
                color: theme.surfaceOnBg,
                fontSize: 15, fontWeight: '500',
                textAlign: "center",
                lineHeight: 20
            }, textStyle]}>
                {`${integer}${decimalPoint ?? ','}`}
                <PerfText style={centsTextStyle}>
                    {cents}
                </PerfText>
            </PerfText>
        </PerfView>
    );
});