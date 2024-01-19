import React, { memo, useEffect, useRef, useState } from "react"
import { StyleProp, View, ViewStyle, Image } from "react-native"
import { avatarHash } from "../utils/avatarHash";
import { Avatar, avatarColors } from "./Avatar";
import { KnownWallets } from "../secure/KnownWallets";
import { useNetwork, useTheme, useWalletSettings } from "../engine/hooks";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const Color = require('color');

export const PendingTransactionAvatar = memo(({
    style,
    avatarId,
    address,
    kind
}: {
    style?: StyleProp<ViewStyle>,
    avatarId: string,
    address?: string,
    kind: 'in' | 'out'
}) => {
    const theme = useTheme();
    const network = useNetwork();
    const [walletSettings,] = useWalletSettings(address);
    let color = avatarColors[avatarHash(avatarId, avatarColors.length)];

    const rotation = useSharedValue(0);

    const animatedRotation = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value * 360}deg` }],
        }
    }, []);

    let known = address ? KnownWallets(network.isTestnet)[address] : undefined;
    let lighter = Color(color).lighten(0.4).hex();
    let darker = Color(color).lighten(0.2).hex();

    if (known && known.colors) {
        lighter = known.colors.primary;
        darker = known.colors.secondary;
    }

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(rotation.value + 1, { duration: 1500, easing: Easing.linear }),
            -1,
        );
    }, []);

    return (
        <View style={[{ flex: 1, height: 46, width: 46, justifyContent: 'center', alignItems: 'center' }, style]}>
            <View style={{
                position: 'absolute',
                top: 0, left: 0,
                right: 0, bottom: 0,
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Avatar
                    address={address}
                    size={46}
                    id={avatarId}
                    hash={walletSettings.avatar}
                    borderWith={0}
                    backgroundColor={theme.backgroundPrimary}
                    theme={theme}
                    isTestnet={network.isTestnet}
                    hashColor
                />
            </View>
            <Animated.View style={[
                {
                    height: 20,
                    width: 20,
                    position: 'absolute',
                    bottom: -2, right: -2,
                },
                animatedRotation
            ]}>
                <View
                    style={{
                        backgroundColor: '#FF9A50',
                        height: 20, width: 20,
                        borderRadius: 10,
                        borderWidth: 2, borderColor: theme.surfaceOnElevation,
                        justifyContent: 'center', alignItems: 'center'
                    }}
                >
                    <Image style={{ height: 10, width: 10 }} source={require('@assets/ic-pending-arch.png')} />
                </View>
            </Animated.View>
        </View>
    )
})