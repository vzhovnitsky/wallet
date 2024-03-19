import React, { memo } from "react";
import { View, Text, Pressable, Image } from "react-native";
import Animated from "react-native-reanimated";
import { AddressSearchItem } from "./AddressSearch";
import { useBounceableWalletFormat, useNetwork, useTheme } from "../../engine/hooks";
import { useAnimatedPressedInOut } from "../../utils/useAnimatedPressedInOut";
import { Avatar, avatarColors } from "../avatar/Avatar";
import { AddressComponent } from "./AddressComponent";
import { WalletSettings } from "../../engine/state/walletSettings";
import { avatarHash } from "../../utils/avatarHash";
import { useContractInfo } from "../../engine/hooks/metadata/useContractInfo";

export const AddressSearchItemView = memo(({
    item,
    onPress,
    walletsSettings
}: {
    item: AddressSearchItem,
    onPress?: (item: AddressSearchItem) => void,
    walletsSettings: { [key: string]: WalletSettings }
}) => {
    const theme = useTheme();
    const network = useNetwork();
    const [bounceableFormat,] = useBounceableWalletFormat();
    const addressString = item.addr.address.toString({ testOnly: network.isTestnet });
    const contractInfo = useContractInfo(addressString);

    const settings = walletsSettings[addressString];

    const avatarColorHash = settings?.color ?? avatarHash(addressString, avatarColors.length);
    const avatarColor = avatarColors[avatarColorHash];

    const bounceable = (contractInfo?.kind === 'wallet')
        ? bounceableFormat
        : item.addr.isBounceable

    const { animatedStyle, onPressIn, onPressOut } = useAnimatedPressedInOut();

    return (
        <Pressable
            onPress={
                () => onPress
                    ? onPress({ ...item, addr: { ...item.addr, isBounceable: bounceable } })
                    : undefined
            }
            onPressIn={onPressIn}
            onPressOut={onPressOut}
        >
            <Animated.View style={[{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, animatedStyle]}>
                <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 0, marginRight: 12 }}>
                    {item.isLedger ? (
                        <Image
                            style={{ width: 46, height: 46 }}
                            source={require('@assets/ledger_device.png')}
                        />
                    ) : (
                        <Avatar
                            address={addressString}
                            id={addressString}
                            size={46}
                            borderWith={0}
                            markContact={item.type === 'contact'}
                            icProps={{
                                isOwn: item.type === 'my-wallets',
                                backgroundColor: theme.elevation
                            }}
                            hash={settings?.avatar}
                            theme={theme}
                            isTestnet={network.isTestnet}
                            backgroundColor={avatarColor}
                        />
                    )}
                </View>
                <View style={{ flexShrink: 1, justifyContent: 'center' }}>
                    <Text
                        style={{ color: theme.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600' }}
                        ellipsizeMode={'tail'}
                        numberOfLines={1}
                    >
                        {item.isLedger ? 'Ledger' : item.title}
                    </Text>
                    <Text
                        style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 20, fontWeight: '400' }}
                        ellipsizeMode={'middle'}
                        numberOfLines={1}
                    >
                        <AddressComponent
                            bounceable={bounceable}
                            address={item.addr.address}
                        />
                    </Text>
                </View>
            </Animated.View>
        </Pressable>
    );
});