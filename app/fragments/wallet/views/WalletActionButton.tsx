import { memo } from "react";
import { Pressable, View, Image, Text, StyleSheet } from "react-native";
import { TypedNavigation } from "../../../utils/useTypedNavigation";
import { ThemeType } from "../../../engine/state/theme";
import { t } from "../../../i18n/t";
import { Typography } from "../../../components/styles";

export type WalletActionType = "send" | "receive" | "buy" | "swap";

const nullTransfer = {
    amount: null,
    target: null,
    stateInit: null,
    job: null,
    comment: null,
    jetton: null,
    callback: null
};

export const WalletActionButton = memo(({
    type,
    navigation,
    theme
}: {
    type: WalletActionType,
    navigation: TypedNavigation,
    theme: ThemeType,
}) => {

    switch (type) {
        case 'buy': {
            return (
                <Pressable
                    onPress={() => navigation.navigate('Buy')}
                    style={({ pressed }) => ([{ opacity: pressed ? 0.5 : 1 }, styles.button])}
                >
                    <View style={{ justifyContent: 'center', alignItems: 'center', borderRadius: 14 }}>
                        <View style={{
                            backgroundColor: theme.accent,
                            width: 32, height: 32,
                            borderRadius: 16,
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Image source={require('@assets/ic-buy.png')} />
                        </View>
                        <Text style={[{ color: theme.textPrimary, marginTop: 6 }, Typography.medium15_20]}
                            minimumFontScale={0.7}
                            adjustsFontSizeToFit
                            numberOfLines={1}
                        >
                            {t('wallet.actions.buy')}
                        </Text>
                    </View>
                </Pressable>
            );
        }
        case 'send': {
            return (
                <Pressable
                    onPress={() => navigation.navigateSimpleTransfer(nullTransfer)}
                    style={({ pressed }) => ([{ opacity: pressed ? 0.5 : 1 }, styles.button])}
                >
                    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{
                            backgroundColor: theme.accent,
                            width: 32, height: 32,
                            borderRadius: 16,
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Image source={require('@assets/ic_send.png')} />
                        </View>
                        <Text
                            style={{
                                fontSize: 15,
                                color: theme.textPrimary,
                                marginTop: 6,
                                fontWeight: '500',
                            }}
                        >
                            {t('wallet.actions.send')}
                        </Text>
                    </View>
                </Pressable>
            );
        }
        case 'receive': {
            return (
                <Pressable
                    onPress={() => navigation.navigate('Receive')}
                    style={({ pressed }) => ([{ opacity: pressed ? 0.5 : 1 }, styles.button])}
                >
                    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{
                            backgroundColor: theme.accent,
                            width: 32, height: 32,
                            borderRadius: 16,
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Image source={require('@assets/ic_receive.png')} />
                        </View>
                        <Text
                            style={{
                                fontSize: 15, lineHeight: 20,
                                color: theme.textPrimary,
                                marginTop: 6,
                                fontWeight: '500'
                            }}
                            minimumFontScale={0.7}
                            adjustsFontSizeToFit
                            numberOfLines={1}
                        >
                            {t('wallet.actions.receive')}
                        </Text>
                    </View>
                </Pressable>
            );
        }
        case 'swap': {
            return (
                <Pressable
                    onPress={() => navigation.navigate('Swap')}
                    style={({ pressed }) => ([{ opacity: pressed ? 0.5 : 1 }, styles.button])}
                >
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{
                            backgroundColor: theme.accent,
                            width: 32, height: 32,
                            borderRadius: 16,
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Image source={require('@assets/ic_swap.png')} />
                        </View>
                        <Text
                            style={{
                                fontSize: 15,
                                color: theme.textPrimary,
                                marginTop: 6,
                                fontWeight: '500',
                            }}
                        >
                            {t('wallet.actions.swap')}
                        </Text>
                    </View>
                </Pressable>
            );
        }
        default: {
            return null;
        }
    }
});

const styles = StyleSheet.create({
    button: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    },
});